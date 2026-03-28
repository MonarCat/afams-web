// POST /api/paystack/webhook
// Receives Paystack webhook events, verifies the HMAC-SHA512 signature,
// and updates the matching order in Supabase when payment is confirmed.

const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[webhook] PAYSTACK_SECRET_KEY is not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Vercel automatically parses JSON bodies; re-serialise for signature verification.
  // Paystack sends compact JSON so the output of JSON.stringify matches the wire payload.
  const rawBody = JSON.stringify(req.body);
  const expectedHash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const receivedHash = req.headers['x-paystack-signature'];

  if (!receivedHash || expectedHash !== receivedHash) {
    console.warn('[webhook] Signature mismatch — possible spoofed request');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event?.event === 'charge.success') {
    const { reference } = event.data || {};
    if (!reference) {
      console.error('[webhook] charge.success event missing reference');
      return res.status(400).json({ error: 'Missing reference in event data' });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[webhook] Supabase credentials not configured');
      // Return 200 so Paystack does not retry — log the event manually
      return res.status(200).json({ message: 'Received; DB not configured' });
    }

    // Idempotency check — skip if already marked as paid
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?paystack_reference=eq.${encodeURIComponent(reference)}&payment_status=eq.paid&select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ message: 'Already processed' });
    }

    // Update order to paid + confirmed
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?paystack_reference=eq.${encodeURIComponent(reference)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_status: 'paid',
          order_status: 'confirmed',
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('[webhook] Supabase PATCH failed:', errText);
      return res.status(500).json({ error: 'Failed to update order' });
    }

    console.log(`[webhook] Order confirmed for reference: ${reference}`);
  }

  return res.status(200).json({ message: 'Webhook received' });
};
