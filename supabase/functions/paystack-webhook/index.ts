import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SK = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS });

  const { reference, email, phone, cart, subMode } = await req.json();
  if (!reference || typeof reference !== 'string') {
    return new Response('Missing payment reference', { status: 400, headers: CORS });
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: 'Bearer ' + PAYSTACK_SK },
  });
  const verifyPayload = await verifyRes.json();
  const tx = verifyPayload?.data;

  if (!verifyRes.ok || tx?.status !== 'success') {
    return new Response('Payment not verified', { status: 400, headers: CORS });
  }

  const items: any[] = Array.isArray(cart) ? cart : typeof cart === 'string' ? JSON.parse(cart) : [];
  if (!items.length) {
    return new Response('Cart is empty', { status: 400, headers: CORS });
  }

  const supabase = createClient(SB_URL, SB_KEY);
  const isSub = subMode === 'sub';
  const total = Math.round(Number(tx.amount || 0) / 100);

  const productSummary = items.map((i: any) => `${i.name} (${i.size}) ×${i.qty}`).join(', ');

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      email,
      phone,
      product_name: productSummary,
      amount: total,
      paystack_ref: reference,
      payment_status: 'paid',
      subscription: isSub,
      sub_discount: isSub ? Math.round(total * 0.1) : 0,
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    console.error('Order insert error:', orderErr);
    return new Response('DB error', { status: 500, headers: CORS });
  }

  const orderItems = items.map((i: any) => ({
    order_id: order.id,
    product_id: i.id,
    variety: i.variety,
    flavor: i.flavor,
    size: i.size,
    unit_price: i.basePrice,
    quantity: i.qty,
  }));

  const { error: orderItemsErr } = await supabase.from('order_items').insert(orderItems);
  if (orderItemsErr) console.error('Order items insert error:', orderItemsErr);

  await fetch(`${SB_URL}/functions/v1/send-order-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + SB_KEY,
    },
    body: JSON.stringify({ orderId: order.id, email, phone, items, total, isSub }),
  });

  return new Response(JSON.stringify({ success: true, orderId: order.id }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
