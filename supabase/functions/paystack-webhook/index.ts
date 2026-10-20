// supabase/functions/paystack-webhook/index.ts
// Afams Ltd — Paystack Webhook Handler
// Deno runtime — Supabase Edge Functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://afams.co.ke',
  'Access-Control-Allow-Headers': 'content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// HMAC-SHA512 using Web Crypto — no external deps
async function verifyHmac(
  secret: string,
  rawBody: string,
  sig: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );
    const buf = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(rawBody),
    );
    const expected = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return expected === sig;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {

  // CORS preflight
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: CORS });

  // Step 1: Read raw body FIRST — required for HMAC, do not parse before this
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Could not read body' }),
      { status: 400, headers: CORS });
  }

  // Step 2: Verify HMAC signature
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
  const sig    = req.headers.get('x-paystack-signature') ?? '';

  if (!secret) {
    console.error('[webhook] PAYSTACK_SECRET_KEY not set');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: CORS });
  }
  if (!await verifyHmac(secret, rawBody, sig)) {
    console.error('[webhook] HMAC verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: CORS });
  }

  // Step 3: Parse JSON
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: CORS });
  }

  // Step 4: Only handle charge.success — acknowledge everything else
  if (payload.event !== 'charge.success') {
    console.log('[webhook] Ignoring event:', payload.event);
    return new Response(JSON.stringify({ received: true }),
      { status: 200, headers: CORS });
  }

  const data     = (payload.data     ?? {}) as Record<string, unknown>;
  const meta     = (data.metadata    ?? {}) as Record<string, unknown>;
  const customer = (data.customer    ?? {}) as Record<string, unknown>;
  const paystackRef = String(data.reference ?? '').trim();

  if (!paystackRef)
    return new Response(JSON.stringify({ error: 'No reference in payload' }),
      { status: 400, headers: CORS });

  console.log('[webhook] Processing charge.success — ref:', paystackRef);
  console.log('[webhook] metadata.items:', JSON.stringify(meta.items));

  // Step 5: Supabase service-role client — bypasses RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ══════════════════════════════════════════════════════════════════
  // Step 5a: POS IN-STORE SALE — additive, early return.
  //
  // Charges started from the admin "Shop" tab (pos-charge edge function)
  // carry metadata.pos_ref. They are finalized by public.finalize_pos_sale()
  // (idempotent: creates the order + order_items and deducts stock).
  // Without this branch they would fall through to the Support Base "gift"
  // detection below, because POS metadata has no order-shaped fields.
  // Regular storefront payments never set pos_ref, so they are unaffected.
  // ══════════════════════════════════════════════════════════════════
  if (typeof meta.pos_ref === 'string' && meta.pos_ref.length > 0) {
    const paidKes = Math.round(Number(data.amount ?? 0) / 100); // minor units → KES
    const { data: posResult, error: posErr } = await supabase.rpc('finalize_pos_sale', {
      p_reference:    meta.pos_ref,
      p_paystack_ref: paystackRef,
      p_paid_amount:  paidKes,
    });
    if (posErr) {
      // 500 → Paystack retries; finalize_pos_sale is idempotent so retries are safe.
      console.error('[webhook] POS finalize failed:', meta.pos_ref, posErr.message);
      return new Response(JSON.stringify({ error: 'POS finalize failed', detail: posErr.message }),
        { status: 500, headers: CORS });
    }
    console.log('[webhook] POS sale finalized:', meta.pos_ref, JSON.stringify(posResult));
    return new Response(JSON.stringify({ received: true, pos: true, result: posResult }),
      { status: 200, headers: CORS });
  }
  // ══════════════════════════════════════════════════════════════════
  // End POS branch.
  // ══════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════
  // Step 5b: SUPPORT BASE "GIVE" DETECTION — additive, does not touch
  // the product-order path below at all.
  //
  // checkout.html (product orders) always sets one of: items_json,
  // items, cart, cart_items, or order_ref in metadata. The Paystack
  // Payment Page at paystack.shop/pay/afams (used for the "Give"
  // flow on support.html) never sets any of these — it's a plain
  // hosted page with no custom metadata injection. Their absence is
  // therefore a reliable signal that this charge is a Support Base
  // gift, not a product order — and previously this exact case was
  // silently mis-recorded as a bogus KES 0 "Product" order.
  // ══════════════════════════════════════════════════════════════════
  const hasOrderShapedMetadata =
    (typeof meta.items_json === 'string' && meta.items_json.length > 2) ||
    (Array.isArray(meta.items) && (meta.items as unknown[]).length > 0) ||
    (typeof meta.cart === 'string' && meta.cart.length > 2) ||
    (typeof meta.cart_items === 'string' && meta.cart_items.length > 2) ||
    (typeof meta.order_ref === 'string' && meta.order_ref.length > 0);

  if (!hasOrderShapedMetadata) {
    console.log('[webhook] No order-shaped metadata — treating as Support Base gift:', paystackRef);

    const amountKes = Math.round(Number(data.amount ?? 0) / 100); // kobo/cents → KES
    if (amountKes <= 0) {
      console.warn('[webhook] Support Base gift had non-positive amount — skipping insert');
      return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200, headers: CORS });
    }

    const givenName = String(customer.first_name ?? '').trim();
    const familyInitial = String(customer.last_name ?? '').trim().charAt(0);
    const displayName = givenName
      ? (familyInitial ? `${givenName} ${familyInitial}.` : givenName)
      : 'A Supporter';

    const { error: giftErr } = await supabase
      .from('support_base')
      .insert({
        display_name: displayName,
        is_anonymous: displayName === 'A Supporter',
        amount: amountKes,
        currency: String(data.currency ?? 'KES'),
        external_ref: paystackRef,
        payment_source: 'paystack',
      });

    if (giftErr) {
      if (String(giftErr.message).includes('duplicate key')) {
        console.log('[webhook] Duplicate Support Base gift, already recorded:', paystackRef);
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: CORS });
      }
      console.error('[webhook] Support Base insert failed:', giftErr.message);
      return new Response(JSON.stringify({ error: 'Support Base insert failed', detail: giftErr.message }), { status: 500, headers: CORS });
    }

    console.log('[webhook] Recorded Support Base gift:', displayName, amountKes, 'KES —', paystackRef);
    return new Response(JSON.stringify({ received: true, support_base: true }), { status: 200, headers: CORS });
  }
  // ══════════════════════════════════════════════════════════════════
  // End Support Base branch — everything below is the original,
  // unmodified product-order path.
  // ══════════════════════════════════════════════════════════════════

  // Step 6: Idempotency — skip if this reference was already processed
  const { data: existing } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('paystack_ref', paystackRef)
    .maybeSingle();

  if (existing) {
    console.log('[webhook] Duplicate — already processed:', paystackRef);
    return new Response(
      JSON.stringify({ received: true, duplicate: true, order: existing.order_number }),
      { status: 200, headers: CORS },
    );
  }

  // Step 6b: Hydrate full order details from `pending_orders` when checkout.html
  // used the new lean metadata path (order_ref only, no items_json). This lets
  // Paystack's own request stay tiny while we still get full item/customer data.
  // Backward-compatible: if there's no order_ref, or no matching row, or the
  // lookup fails for any reason, we simply proceed with `meta` as-is exactly
  // like before this change existed.
  let effectiveMeta: Record<string, unknown> = meta;
  if (typeof meta.order_ref === 'string' && meta.order_ref.length > 0 && !meta.items_json) {
    try {
      const { data: pending } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('reference', meta.order_ref)
        .maybeSingle();
      if (pending) {
        effectiveMeta = Object.assign({}, meta, {
          customer_name:    pending.customer_name,
          customer_email:   pending.customer_email,
          customer_phone:   pending.customer_phone,
          delivery_address: pending.delivery_address,
          county:           pending.county,
          country:          pending.country,
          items_json:       pending.items_json,
        });
        console.log('[webhook] Hydrated order from pending_orders — ref:', meta.order_ref);
      } else {
        console.warn('[webhook] order_ref present but no matching pending_orders row:', meta.order_ref);
      }
    } catch (err) {
      console.warn('[webhook] pending_orders lookup failed, continuing with raw metadata:', err);
    }
  }
  const meta_ = effectiveMeta; // used below instead of `meta` from this point on

  // Step 7: Extract items array from metadata
  // checkout.html sends metadata.items_json (preferred) or metadata.cart as JSON.
  // Fall back through legacy metadata.items → cart_items strings if needed.
  // Final fallback: build single-item array from flat metadata fields.
  type RawItem = Record<string, unknown>;
  let rawItems: RawItem[] = [];

  if (typeof meta_.items_json === 'string' && meta_.items_json.length > 2) {
    try { rawItems = JSON.parse(meta_.items_json); } catch { /* ignore */ }
    console.log('[webhook] Parsed metadata.items_json — count:', rawItems.length);
  } else if (Array.isArray(meta_.items) && (meta_.items as RawItem[]).length > 0) {
    rawItems = meta_.items as RawItem[];
    console.log('[webhook] Using metadata.items — count:', rawItems.length);
  } else if (typeof meta_.cart === 'string' && meta_.cart.length > 2) {
    try { rawItems = JSON.parse(meta_.cart); } catch { /* ignore */ }
    console.log('[webhook] Parsed metadata.cart — count:', rawItems.length);
  } else if (typeof meta_.cart_items === 'string' && meta_.cart_items.length > 2) {
    try { rawItems = JSON.parse(meta_.cart_items); } catch { /* ignore */ }
    console.log('[webhook] Parsed metadata.cart_items — count:', rawItems.length);
  }

  if (rawItems.length === 0) {
    console.warn('[webhook] All item arrays empty — using single-product fallback');
    rawItems = [{
      sku:   meta_.product_sku,
      name:  meta_.product_name ?? 'Product',
      price: meta_.unit_price   ?? 0,
      qty:   meta_.quantity     ?? 1,
    }];
  }

  // Step 8: Normalise each item
  const normItems = rawItems.map((item) => {
    const qty       = Math.max(1, parseInt(String(item.qty ?? item.quantity ?? 1), 10));
    const unitPrice = Math.max(0, Math.round(Number(item.price ?? item.unit_price ?? 0)));
    return {
      product_sku:  String(item.sku  ?? item.id  ?? '').trim() || null,
      product_name: String(item.name ?? 'Product').trim(),
      quantity:     qty,
      unit_price:   unitPrice,
      item_type:    String(item.type  ?? 'product'),
      is_free:      item.is_free === true,
    };
  });

  // Step 9: Calculate totals
  const itemsTotal    = normItems.reduce(
    (s, i) => s + (i.is_free ? 0 : i.unit_price * i.quantity), 0,
  );
  const paystackTotal = Math.round(Number(data.amount ?? 0) / 100); // kobo → KES
  const totalAmount   = paystackTotal > 0 ? paystackTotal : itemsTotal;

  console.log('[webhook] Items total:', itemsTotal, '| Paystack total:', paystackTotal, '| Using:', totalAmount);
  console.log('[webhook] Normalised items:', JSON.stringify(normItems));

  // Step 10: Primary item for backward-compat flat columns on orders row
  const primary = normItems.find(i => !i.is_free) ?? normItems[0];

  // Step 11: Insert parent order row
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      paystack_ref:     paystackRef,
      customer_name:    String(meta_.customer_name  ?? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()),
      customer_email:   String(meta_.customer_email ?? customer.email ?? ''),
      customer_phone:   String(meta_.customer_phone ?? ''),
      delivery_address: String(meta_.delivery_address ?? ''),
      county:           String(meta_.county   ?? ''),
      // Flat backward-compat columns — keep populated for queries that don't join
      product_sku:      primary.product_sku,
      product_name:     primary.product_name,
      quantity:         primary.quantity,
      unit_price:       primary.unit_price,
      total_amount:     totalAmount,
      items:            normItems,       // full array written to JSONB column
      status:           'paid',
      paid_at:          new Date().toISOString(),
      payment_method:   'paystack',
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) {
    console.error('[webhook] ORDER INSERT FAILED:', orderErr?.message);
    return new Response(
      JSON.stringify({ error: 'Order insert failed', detail: orderErr?.message }),
      { status: 500, headers: CORS },
    );
  }

  console.log('[webhook] Order created:', order.order_number, '| id:', order.id);

  // Step 12: Bulk insert ALL line items — single DB call, all items atomically
  const lineItems = normItems.map(item => ({
    order_id:     order.id,
    product_sku:  item.product_sku  || null,
    product_name: item.product_name,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    item_type:    item.item_type,
    is_free:      item.is_free,
  }));

  console.log('[webhook] Inserting', lineItems.length, 'row(s) into order_items');

  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(lineItems);

  if (itemsErr) {
    // Log but do not fail — order row is saved; items are recoverable from JSONB
    console.error('[webhook] ORDER_ITEMS FAILED:', itemsErr.message, itemsErr.hint);
  } else {
    console.log('[webhook] order_items OK —', lineItems.length, 'item(s) for', order.order_number);
  }

  // Step 13: Deduct stock for the order via the deployed RPC.
  const { error: stockErr } = await supabase
    .rpc('deduct_stock_after_order', { p_order_id: order.id });
  if (stockErr) {
    console.error('[webhook] Stock deduction failed for order', order.order_number, ':', stockErr.message);
  } else {
    console.log('[webhook] Stock deducted for order', order.order_number);
  }

  // Step 13b: Mark the pending_orders row (if one was used) as fulfilled —
  // best-effort, never blocks the webhook response.
  if (typeof meta_.order_ref === 'string' && meta_.order_ref.length > 0) {
    supabase
      .from('pending_orders')
      .update({ status: 'fulfilled' })
      .eq('reference', meta_.order_ref)
      .then(() => console.log('[webhook] pending_orders marked fulfilled:', meta_.order_ref))
      .catch((e: Error) => console.error('[webhook] pending_orders status update failed:', e.message));
  }

  // Step 14: Respond to Paystack BEFORE sending email — prevents 30s timeout
  const webhookResponse = new Response(
    JSON.stringify({ received: true, order_id: order.id, order_number: order.order_number }),
    { status: 200, headers: CORS },
  );

  // Step 15: Trigger confirmation email — fire and forget, non-blocking
  supabase.functions.invoke('send-order-email', {
    body: { order_id: order.id, email_type: 'order_received' },
  }).catch((e: Error) =>
    console.error('[webhook] Email invoke failed:', e.message),
  );

  return webhookResponse;
});
