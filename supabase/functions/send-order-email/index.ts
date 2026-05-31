import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const { email, items, total, isSub } = await req.json();

  const rows = items
    .map((i: any) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-size:14px">${i.name} · ${i.flavor} · ${i.size}</td><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;text-align:right">×${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;text-align:right;font-weight:600">KES ${(i.basePrice * i.qty).toLocaleString()}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#F4EDD6;margin:0;padding:20px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden"><div style="background:#0B1E12;padding:28px 24px;text-align:center"><div style="font-family:Georgia,serif;font-size:38px;color:#fff">Su<span style="color:#C9A020">Chai</span></div><div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:3px;margin-top:6px">ORDER CONFIRMED</div></div><div style="padding:28px 24px"><p style="font-size:15px;color:#0B1E12;margin-bottom:20px">Your SuChai order is confirmed${isSub ? ' (Subscribe &amp; Save 10%)' : ''}. We will be in touch shortly with delivery details.</p><table style="width:100%;border-collapse:collapse">${rows}</table><div style="border-top:2px solid #0B1E12;margin-top:16px;padding-top:14px;display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600;font-size:15px;color:#0B1E12">Total</span><span style="font-weight:600;font-size:20px;color:#C9A020">KES ${total.toLocaleString()}</span></div>${isSub ? '<div style="background:#F4EDD6;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:13px;color:#1C4730">✓ You saved 10% with Subscribe &amp; Save!</div>' : ''}</div><div style="background:#F4EDD6;padding:20px 24px;text-align:center"><div style="font-size:12px;color:#8A7A6A">Afams Limited · Nairobi, Kenya<br><a href="https://afams.co.ke" style="color:#C9A020">afams.co.ke</a> · <a href="mailto:orders@afams.co.ke" style="color:#C9A020">orders@afams.co.ke</a></div></div></div></body></html>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'SuChai by Afams', email: 'orders@afams.co.ke' },
      to: [{ email }],
      subject: '✓ Your SuChai order is confirmed',
      htmlContent: html,
    }),
  });

  const error = res.ok ? null : await res.text();
  return new Response(
    JSON.stringify({ sent: res.ok, status: res.status, error }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
