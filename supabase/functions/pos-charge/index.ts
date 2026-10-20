// supabase/functions/pos-charge/index.ts
// Afams Ltd — Admin POS: in-store sales (mobile-money prompt or cash)
// Deno runtime — Supabase Edge Functions. Deployed with verify_jwt: true.
//
// CONTRACT (POST, requires a valid admin Supabase Auth session)
//   { action: 'charge', items: [{ sku, qty }], method: 'mpesa'|'airtel', phone, email? }
//     -> { reference, total, display_text, expires_in }        (STK prompt sent)
//   { action: 'cash',   items: [{ sku, qty }], tendered: number }
//     -> { status: 'success', receipt }                         (recorded immediately)
//   { action: 'status', reference }
//     -> { status: 'pending' }
//      | { status: 'success', receipt }
//      | { status: 'failed' | 'cancelled', reason }
//   { action: 'cancel', reference }
//     -> { status: 'cancelled' }
//
// Pricing trust boundary: prices and totals are ALWAYS computed here from the
// `products` table. The client only ever sends SKUs and quantities.
//
// Success is recorded by public.finalize_pos_sale() — called by the Paystack
// webhook (metadata.pos_ref) and, as a fallback, by the `status` poll below.
// finalize_pos_sale is idempotent, so both paths can race safely.
//
// Auth: caller's JWT must belong to a row in public.admins (matched by email).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://afams.co.ke',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const PAYSTACK = 'https://api.paystack.co';
const MAX_LINES = 30;
const MAX_QTY = 99;
const CHARGE_TIMEOUT_SECONDS = 180; // Paystack gives the customer 180s to approve

type Json = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Kenyan mobile → +2547XXXXXXXX / +2541XXXXXXXX, or null if it doesn't look right. */
function normalisePhone(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/[\s\-().+]/g, '');
  if (/^0[71]\d{8}$/.test(d)) d = '254' + d.slice(1);
  else if (/^[71]\d{8}$/.test(d)) d = '254' + d;
  return /^254[71]\d{8}$/.test(d) ? '+' + d : null;
}

function newReference(prefix: string): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

const METHOD_LABEL: Record<string, string> = { mpesa: 'M-Pesa', airtel: 'Airtel Money', cash: 'Cash' };

interface SaleLine { sku: string; name: string; quantity: number; unit_price: number }

/** Validate the cart and price it from the products table. Throws Error(message) for the client. */
// deno-lint-ignore no-explicit-any
async function priceCart(sb: any, rawItems: unknown): Promise<{ lines: SaleLine[]; total: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('Cart is empty');
  if (rawItems.length > MAX_LINES) throw new Error('Too many lines in one sale');

  // Merge duplicate SKUs, validate quantities.
  const wanted = new Map<string, number>();
  for (const it of rawItems as Json[]) {
    const sku = String(it?.sku ?? '').trim();
    const qty = Number(it?.qty);
    if (!sku) throw new Error('Item is missing a SKU');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error(`Invalid quantity for ${sku}`);
    wanted.set(sku, (wanted.get(sku) ?? 0) + qty);
  }

  const { data: products, error } = await sb
    .from('products')
    .select('sku, name, unit_price, stock_quantity, active')
    .in('sku', [...wanted.keys()]);
  if (error) throw new Error('Could not load products');

  const bySku = new Map<string, Json>((products ?? []).map((p: Json) => [String(p.sku), p]));
  const lines: SaleLine[] = [];
  let total = 0;
  for (const [sku, qty] of wanted) {
    const p = bySku.get(sku);
    if (!p || p.active !== true) throw new Error(`${sku} is not available`);
    const stock = Number(p.stock_quantity ?? 0);
    if (stock < qty) throw new Error(`Only ${stock} of ${p.name} in stock`);
    const price = Number(p.unit_price);
    if (!Number.isInteger(price) || price < 0) throw new Error(`${p.name} has no valid price`);
    lines.push({ sku, name: String(p.name), quantity: qty, unit_price: price });
    total += price * qty;
  }
  if (total <= 0) throw new Error('Sale total must be above zero');
  return { lines, total };
}

/** Build the receipt payload the admin prints. */
// deno-lint-ignore no-explicit-any
async function buildReceipt(sb: any, sale: Json, cashierName: string): Promise<Json> {
  const { data: order } = await sb
    .from('orders')
    .select('order_number, paid_at, created_at')
    .eq('id', sale.order_id)
    .maybeSingle();
  const method = String(sale.method);
  const tendered = sale.tendered == null ? null : Number(sale.tendered);
  return {
    order_number: String(sale.order_number ?? order?.order_number ?? ''),
    date: order?.paid_at ?? order?.created_at ?? new Date().toISOString(),
    cashier: cashierName,
    method: METHOD_LABEL[method] ?? method,
    items: (sale.items as SaleLine[]).map((i) => ({ name: i.name, qty: i.quantity, price: i.unit_price })),
    total: Number(sale.total_amount),
    tendered,
    change: tendered == null ? null : Math.max(0, tendered - Number(sale.total_amount)),
  };
}

async function paystack(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: Json }> {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
  const res = await fetch(PAYSTACK + path, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let body: Json = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { ok: res.ok, status: res.status, body };
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Missing auth token' }, 401);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user?.email) return json({ error: 'Invalid or expired session' }, 401);
  const callerEmail = userData.user.email.toLowerCase();

  const { data: adminRow } = await sb.from('admins').select('email, name').eq('email', callerEmail).maybeSingle();
  if (!adminRow) {
    console.warn('[pos-charge] Non-admin attempted access:', callerEmail);
    return json({ error: 'Not authorized' }, 403);
  }
  const cashierName = String(adminRow.name ?? '').trim() || callerEmail.split('@')[0];

  let body: Json;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const action = String(body.action ?? '');

  try {
    // ── CHARGE: price the cart, record a pending sale, push the STK prompt ──
    if (action === 'charge') {
      const method = String(body.method ?? '');
      if (method !== 'mpesa' && method !== 'airtel') return json({ error: 'Choose M-Pesa or Airtel Money' }, 400);
      const phone = normalisePhone(body.phone);
      if (!phone) return json({ error: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678' }, 400);
      const email = String(body.email ?? '').trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Customer email looks invalid' }, 400);

      const { lines, total } = await priceCart(sb, body.items);
      const reference = newReference('POS');

      const { error: insErr } = await sb.from('pos_sales').insert({
        reference, cashier_email: callerEmail, method, phone,
        customer_email: email || null, items: lines, total_amount: total, status: 'pending',
      });
      if (insErr) { console.error('[pos-charge] insert failed:', insErr.message); return json({ error: 'Could not start the sale' }, 500); }

      const res = await paystack('/charge', {
        method: 'POST',
        body: JSON.stringify({
          email: email || 'pos@afams.co.ke',
          amount: total * 100, // KES → minor units
          currency: 'KES',
          reference,
          mobile_money: { phone, provider: method === 'mpesa' ? 'mpesa' : 'atl' },
          metadata: { pos_ref: reference, source: 'pos', cashier: callerEmail },
        }),
      });

      const data = (res.body.data ?? {}) as Json;
      const chargeStatus = String(data.status ?? '');
      if (!res.ok || res.body.status !== true || chargeStatus === 'failed') {
        const reason = String(data.message ?? data.gateway_response ?? res.body.message ?? 'Could not send the payment prompt');
        console.error('[pos-charge] Paystack charge rejected:', res.status, reason);
        await sb.from('pos_sales').update({ status: 'failed', failure_reason: reason, updated_at: new Date().toISOString() }).eq('reference', reference);
        return json({ error: reason }, 502);
      }

      return json({
        reference, total,
        display_text: String(data.display_text ?? 'Ask the customer to enter their PIN on their phone.'),
        expires_in: CHARGE_TIMEOUT_SECONDS,
      });
    }

    // ── CASH: record immediately ──
    if (action === 'cash') {
      const { lines, total } = await priceCart(sb, body.items);
      const tendered = Number(body.tendered);
      if (!Number.isInteger(tendered) || tendered < total) return json({ error: 'Cash received is less than the total' }, 400);
      const reference = newReference('POSC');

      const { error: insErr } = await sb.from('pos_sales').insert({
        reference, cashier_email: callerEmail, method: 'cash',
        items: lines, total_amount: total, tendered, status: 'pending',
      });
      if (insErr) { console.error('[pos-charge] cash insert failed:', insErr.message); return json({ error: 'Could not record the sale' }, 500); }

      const { data: fin, error: finErr } = await sb.rpc('finalize_pos_sale', { p_reference: reference });
      if (finErr || !fin || (fin as Json).error) {
        console.error('[pos-charge] cash finalize failed:', finErr?.message ?? JSON.stringify(fin));
        return json({ error: 'Could not record the sale' }, 500);
      }
      const { data: sale } = await sb.from('pos_sales').select('*').eq('reference', reference).single();
      return json({ status: 'success', receipt: await buildReceipt(sb, sale, cashierName) });
    }

    // ── STATUS: poll. Webhook usually finalizes first; verify with Paystack as a fallback ──
    if (action === 'status') {
      const reference = String(body.reference ?? '');
      if (!reference) return json({ error: 'reference is required' }, 400);

      let { data: sale } = await sb.from('pos_sales').select('*').eq('reference', reference).maybeSingle();
      if (!sale) return json({ error: 'Sale not found' }, 404);

      if (sale.status !== 'success' && sale.method !== 'cash') {
        const v = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
        const vd = (v.body.data ?? {}) as Json;
        const vs = String(vd.status ?? '');

        if (vs === 'success') {
          const paidKes = Math.round(Number(vd.amount ?? 0) / 100);
          if (String(vd.currency ?? 'KES') !== 'KES') {
            return json({ status: 'failed', reason: 'Unexpected currency on payment — check Paystack.' });
          }
          const { data: fin, error: finErr } = await sb.rpc('finalize_pos_sale', {
            p_reference: reference, p_paystack_ref: reference, p_paid_amount: paidKes,
          });
          if (finErr || !fin || (fin as Json).error) {
            console.error('[pos-charge] finalize on poll failed:', finErr?.message ?? JSON.stringify(fin));
            return json({ status: 'failed', reason: 'Payment received but the sale could not be saved — check Paystack and Orders.' });
          }
          ({ data: sale } = await sb.from('pos_sales').select('*').eq('reference', reference).single());
        } else if (['failed', 'reversed', 'abandoned'].includes(vs) && sale.status === 'pending') {
          const reason = String(vd.gateway_response ?? vd.message ?? 'Payment was declined or cancelled on the phone');
          await sb.from('pos_sales').update({ status: 'failed', failure_reason: reason, updated_at: new Date().toISOString() }).eq('reference', reference);
          return json({ status: 'failed', reason });
        }
        // 'pending' / 'ongoing' / 'processing' / 'queued', or verify not ready yet → keep waiting
      }

      if (sale.status === 'success') return json({ status: 'success', receipt: await buildReceipt(sb, sale, cashierName) });
      if (sale.status === 'failed' || sale.status === 'cancelled') return json({ status: sale.status, reason: sale.failure_reason ?? 'Payment did not complete' });
      return json({ status: 'pending' });
    }

    // ── CANCEL: cashier gave up waiting. A late approval is still recorded by the webhook. ──
    if (action === 'cancel') {
      const reference = String(body.reference ?? '');
      if (!reference) return json({ error: 'reference is required' }, 400);
      await sb.from('pos_sales')
        .update({ status: 'cancelled', failure_reason: 'Cancelled at the till', updated_at: new Date().toISOString() })
        .eq('reference', reference).eq('status', 'pending');
      return json({ status: 'cancelled' });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    // priceCart() throws user-facing messages (stock, availability, bad quantity).
    const msg = e instanceof Error ? e.message : 'Something went wrong';
    console.warn('[pos-charge]', action, '→', msg);
    return json({ error: msg }, 400);
  }
});
