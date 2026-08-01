// ============================================================
// Afams Ltd — Send Order Email (Brevo transactional)
// Path: supabase/functions/send-order-email/index.ts
// Runtime: Supabase Edge Functions (Deno)
// Deploy:  supabase functions deploy send-order-email
//
// Called by the admin panel after a status change to trigger
// the appropriate Brevo transactional email.
//
// Required Supabase Secrets (set via Dashboard or CLI):
//   BREVO_API_KEY
//   BREVO_SENDER_EMAIL   (e.g. orders@afams.co.ke)
//   BREVO_SENDER_NAME    (e.g. Afams)
//   BREVO_TEMPLATE_ORDER_RECEIVED    (integer template ID)
//   BREVO_TEMPLATE_PAYMENT_SUCCESS   (integer template ID)
//   BREVO_TEMPLATE_ORDER_DISPATCHED  (integer template ID)
//   BREVO_TEMPLATE_ORDER_DELIVERED   (integer template ID)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BREVO_TEMPLATES } from "../_shared/types.ts";

const CORS_HEADERS = {
  // Deliberate wildcard: server-side auth below restricts this endpoint to service-role or authorized admin callers.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Brevo helpers ─────────────────────────────────────────────
async function sendBrevoTemplate(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  templateId: number,
  toEmail: string,
  toName: string,
  params: Record<string, string | number>,
): Promise<{ messageId?: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName }],
      templateId,
      params,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API error (template ${templateId}): ${res.status} ${text}`);
  }

  let payload: { messageId?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // ignore non-json response
  }
  return payload;
}

async function sendBrevoMessage(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  toEmail: string,
  toName: string,
  subject: string,
  textContent: string,
): Promise<{ messageId?: string }> {
  const escapedText = textContent
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const htmlContent = `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6;margin:0;">${escapedText}</pre>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName }],
      subject,
      textContent,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API error (raw message): ${res.status} ${text}`);
  }

  let payload: { messageId?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // ignore non-json response
  }
  return payload;
}

// Constant-time string comparison to prevent timing-based credential leakage
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// ── Valid email types ─────────────────────────────────────────
const ADMIN_EMAIL_TYPES = [
  "order_received",
  "payment_success",
  "order_processing",
  "order_dispatched",
  "order_delivered",
  "order_cancelled",
  "order_refunded",
  "order_status_generic",
] as const;
type AdminEmailType = (typeof ADMIN_EMAIL_TYPES)[number];

const STATUS_TO_EMAIL_TYPE: Record<string, AdminEmailType> = {
  pending: "order_received",
  paid: "payment_success",
  processing: "order_processing",
  shipped: "order_dispatched",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
  refunded: "order_refunded",
};

const STATUS_EMAIL_COPY: Record<string, { subject: string; intro: string }> = {
  pending:    { subject: "We've received your order",          intro: "Your order has been received and is now in our queue." },
  paid:       { subject: "Payment confirmed",                  intro: "We have received your payment and your order is secured." },
  processing: { subject: "Your order is being prepared",       intro: "Your order is now being prepared by our team." },
  shipped:    { subject: "Your order is on its way",           intro: "Your order has been dispatched and is on its way." },
  delivered:  { subject: "Your order has been delivered",      intro: "Your order has been marked as delivered." },
  cancelled:  { subject: "Your order has been cancelled",      intro: "Your order has been cancelled." },
  refunded:   { subject: "Your refund has been processed",     intro: "Your refund has been processed." },
  generic:    { subject: "Your order status has been updated", intro: "Your order status has been updated." },
};

function formatPaymentMethod(raw: unknown): string {
  const val = String(raw ?? "").trim().toLowerCase();
  if (!val || val === "paystack") return "M-Pesa / M-Pesa Till / Airtel Money / Card";
  if (val.includes("mpesa till") || val.includes("mpesa_till") || val.includes("till")) return "M-Pesa Till";
  if (val.includes("mpesa") || val.includes("m-pesa")) return "M-Pesa";
  if (val.includes("airtel")) return "Airtel Money";
  if (val.includes("card")) return "Card";
  return String(raw);
}

interface EmailOrderItem {
  name: string;
  qty: number;
  price: number;
}

function getOrderItems(order: Record<string, unknown>): EmailOrderItem[] {
  const fromOrderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const fromItems = Array.isArray(order.items) ? order.items : [];
  const sourceItems = fromOrderItems.length ? fromOrderItems : fromItems;
  return sourceItems
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const safeItem = item as Record<string, unknown>;
      const qtyValue = parseInt(String(safeItem.quantity ?? safeItem.qty ?? "1"), 10);
      const qty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
      const price = Math.max(0, Number(safeItem.unit_price ?? safeItem.price ?? 0) || 0);
      return {
        name: String(safeItem.product_name ?? safeItem.name ?? safeItem.product_sku ?? safeItem.sku ?? "Product"),
        qty,
        price,
      };
    });
}

function getOrderItemsSummary(items: EmailOrderItem[]): string {
  return items
    .map((item) => formatOrderItemLine(item))
    .join(", ");
}

function formatOrderItemLine(item: EmailOrderItem, includePrice = false): string {
  const base = `${item.name} ×${item.qty}`;
  if (!includePrice) return base;
  return `${base} (KES ${item.price.toLocaleString("en-KE")})`;
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Require authenticated user (admin panel sends JWT) OR service-role key (webhook internal calls)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Allow internal service-role calls (e.g. from the paystack-webhook edge function)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const serviceRoleBearer = serviceRoleKey ? ("Bearer " + serviceRoleKey) : "";
  const isServiceRoleCall = serviceRoleBearer
    ? timingSafeEqual(authHeader, serviceRoleBearer)
    : false;

  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.error("[send-order-email] BREVO_API_KEY not set");
    return new Response(JSON.stringify({ error: "Server misconfigured: missing BREVO_API_KEY" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "orders@afams.co.ke";
  const senderName  = Deno.env.get("BREVO_SENDER_NAME")  ?? "Afams";

  let body: { order_id?: string; email_type?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { order_id: orderId } = body;
  const claimedStatusHint = String(body.status ?? "").trim().toLowerCase();
  const rawEmailType = String(body.email_type ?? "").trim().toLowerCase();
  const isExplicitEmailType = rawEmailType.length > 0;
  let emailType = rawEmailType;

  if (!orderId || typeof orderId !== "string") {
    return new Response(JSON.stringify({ error: "Missing order_id" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (isExplicitEmailType && !ADMIN_EMAIL_TYPES.includes(emailType as AdminEmailType)) {
    return new Response(JSON.stringify({ error: `Unknown email_type "${emailType}"` }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!isServiceRoleCall) {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const configuredAdminEmails = (
      Deno.env.get("ADMIN_EMAILS")
      ?? Deno.env.get("ADMIN_EMAIL")
      ?? Deno.env.get("BREVO_ADMIN_EMAIL")
      ?? "iammwombe@gmail.com"
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const callerEmail = String(user.email ?? "").trim().toLowerCase();
    if (!callerEmail || !configuredAdminEmails.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const primaryOrderRes = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();
  let order = primaryOrderRes.data;
  let fetchError = primaryOrderRes.error;

  if (fetchError) {
    const fallback = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (fallback.error) {
      fetchError = fallback.error;
      order = null;
    } else {
      fetchError = null;
      order = fallback.data;
    }
  }

  if (fetchError || !order) {
    console.error("[send-order-email] Order not found:", orderId, fetchError?.message);
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const orderLineItems = getOrderItems(order as Record<string, unknown>);
  const orderItemsSummary = getOrderItemsSummary(orderLineItems);
  const orderRef       = order.order_number ?? order.id.slice(0, 8);
  const customerName   = order.customer_name ?? "Customer";
  const customerEmail  = order.customer_email ?? "";
  const productName    = orderItemsSummary || order.product_name || order.product_sku || "—";
  const quantity       = String(
    orderLineItems.reduce((sum, item) => sum + item.qty, 0)
      || Number(order.quantity ?? 1)
      || 1,
  );
  const totalKES       = `KES ${(order.total_amount ?? 0).toLocaleString("en-KE")}`;
  const paymentMethod  = formatPaymentMethod(order.payment_method);
  const paymentRef     = order.paystack_ref ?? "—";
  const customerPhone  = order.customer_phone ?? "—";
  const deliveryAddress = order.delivery_address ?? "—";
  const county         = order.county ?? "—";
  const orderItemsText = orderLineItems.length
    ? orderLineItems.map((item) => formatOrderItemLine(item, true)).join("\n")
    : `${productName} ×${quantity}`;
  const normalizedStatus = String(order.status ?? "").trim().toLowerCase();
  if (!isExplicitEmailType) {
    emailType = STATUS_TO_EMAIL_TYPE[normalizedStatus] ?? "order_status_generic";
    if (!STATUS_TO_EMAIL_TYPE[normalizedStatus]) {
      console.warn(`[send-order-email] Unknown order.status "${normalizedStatus || "(empty)"}" — falling back to order_status_generic`);
    }
  }
  if (claimedStatusHint && claimedStatusHint !== normalizedStatus) {
    console.warn(
      `[send-order-email] Ignoring client status "${claimedStatusHint}" for order ${orderRef}; using DB status "${normalizedStatus || "(empty)"}"`,
    );
  }

  if (!customerEmail) {
    console.warn(`[send-order-email] Order ${orderRef} has no customer_email — skipping`);
    return new Response(JSON.stringify({ sent: false, reason: "no customer email" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    let providerMessageId: string | undefined;

    if (emailType === "order_received") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_RECEIVED") ?? String(BREVO_TEMPLATES.order_received),
        10,
      );
      const orderedAt = order.created_at
        ? new Date(order.created_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number:       orderRef,
        order_ref:          orderRef,
        order_reference:    orderRef,
        customer_name:      customerName,
        customer_email:     customerEmail,
        customer_phone:     customerPhone,
        delivery_address:   deliveryAddress,
        county:             county,
        product_name:       productName,
        quantity:           quantity,
        order_items:        orderItemsText,
        order_items_text:   orderItemsText,
        total_amount:       totalKES,
        payment_method:     paymentMethod,
        paystack_reference: paymentRef,
        payment_reference:  paymentRef,
        brand_logo_url:     "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url:     "https://afams.co.ke/assets/images/afams_favicon_512.png",
        estimated_delivery: "3–5 business days",
        ordered_at:         orderedAt,
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] order_received → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "payment_success") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_PAYMENT_SUCCESS") ?? String(BREVO_TEMPLATES.payment_success),
        10,
      );
      if (!Number.isInteger(templateId) || templateId <= 0) {
        throw new Error("Invalid BREVO_TEMPLATE_PAYMENT_SUCCESS: expected a positive integer template ID");
      }
      const paidAt = order.paid_at
        ? new Date(order.paid_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number:       orderRef,
        order_ref:          orderRef,
        order_reference:    orderRef,
        customer_name:      customerName,
        customer_email:     customerEmail,
        customer_phone:     customerPhone,
        delivery_address:   deliveryAddress,
        county:             county,
        product_name:       productName,
        quantity:           quantity,
        order_items:        orderItemsText,
        order_items_text:   orderItemsText,
        total_amount:       totalKES,
        payment_method:     paymentMethod,
        paystack_reference: paymentRef,
        payment_reference:  paymentRef,
        brand_logo_url:     "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url:     "https://afams.co.ke/assets/images/afams_favicon_512.png",
        paid_at:            paidAt,
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] payment_success → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "order_processing") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_PROCESSING") ?? String(BREVO_TEMPLATES.order_processing),
        10,
      );
      if (!Number.isInteger(templateId) || templateId <= 0) {
        throw new Error("Invalid BREVO_TEMPLATE_ORDER_PROCESSING: expected a positive integer template ID");
      }

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number:       orderRef,
        order_ref:          orderRef,
        order_reference:    orderRef,
        customer_name:      customerName,
        customer_email:     customerEmail,
        customer_phone:     customerPhone,
        delivery_address:   deliveryAddress,
        county:             county,
        product_name:       productName,
        quantity:           quantity,
        order_items:        orderItemsText,
        order_items_text:   orderItemsText,
        total_amount:       totalKES,
        payment_method:     paymentMethod,
        paystack_reference: paymentRef,
        payment_reference:  paymentRef,
        brand_logo_url:     "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url:     "https://afams.co.ke/assets/images/afams_favicon_512.png",
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] order_processing → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "order_dispatched") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_DISPATCHED") ?? String(BREVO_TEMPLATES.order_dispatched),
        10,
      );
      const dispatchedAt = order.shipped_at
        ? new Date(order.shipped_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number:       orderRef,
        order_ref:          orderRef,
        order_reference:    orderRef,
        customer_name:      customerName,
        customer_email:     customerEmail,
        customer_phone:     customerPhone,
        delivery_address:   deliveryAddress,
        county:             county,
        product_name:       productName,
        quantity:           quantity,
        order_items:        orderItemsText,
        order_items_text:   orderItemsText,
        total_amount:       totalKES,
        payment_method:     paymentMethod,
        paystack_reference: paymentRef,
        payment_reference:  paymentRef,
        brand_logo_url:     "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url:     "https://afams.co.ke/assets/images/afams_favicon_512.png",
        estimated_delivery: "2–5 business days",
        tracking_number:    order.tracking_number ?? "—",
        dispatched_at:      dispatchedAt,
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] order_dispatched → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "order_delivered") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_DELIVERED") ?? String(BREVO_TEMPLATES.order_delivered),
        10,
      );
      const deliveredAt = order.delivered_at
        ? new Date(order.delivered_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number: orderRef,
        order_ref: orderRef,
        order_reference: orderRef,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        county: county,
        product_name: productName,
        quantity: quantity,
        order_items: orderItemsText,
        order_items_text: orderItemsText,
        total_amount: totalKES,
        payment_method: paymentMethod,
        paystack_reference: paymentRef,
        payment_reference: paymentRef,
        brand_logo_url: "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url: "https://afams.co.ke/assets/images/afams_favicon_512.png",
        delivered_at: deliveredAt,
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] order_delivered → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "order_cancelled") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_CANCELLED") ?? String(BREVO_TEMPLATES.order_cancelled),
        10,
      );
      if (!Number.isInteger(templateId) || templateId <= 0) {
        throw new Error("Invalid BREVO_TEMPLATE_ORDER_CANCELLED: expected a positive integer template ID");
      }
      const cancelledAt = order.updated_at
        ? new Date(order.updated_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number: orderRef,
        order_ref: orderRef,
        order_reference: orderRef,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        county: county,
        product_name: productName,
        quantity: quantity,
        order_items: orderItemsText,
        order_items_text: orderItemsText,
        total_amount: totalKES,
        payment_method: paymentMethod,
        paystack_reference: paymentRef,
        payment_reference: paymentRef,
        brand_logo_url: "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url: "https://afams.co.ke/assets/images/afams_favicon_512.png",
        cancelled_at: cancelledAt,
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] order_cancelled → ${customerEmail} (order ${orderRef})`);

    } else if (emailType === "order_refunded") {
      const templateId = parseInt(
        Deno.env.get("BREVO_TEMPLATE_ORDER_REFUNDED") ?? String(BREVO_TEMPLATES.order_refunded),
        10,
      );
      if (!Number.isInteger(templateId) || templateId <= 0) {
        throw new Error("Invalid BREVO_TEMPLATE_ORDER_REFUNDED: expected a positive integer template ID");
      }
      const refundedAt = order.updated_at
        ? new Date(order.updated_at).toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          })
        : new Date().toLocaleDateString("en-KE", {
            day: "numeric", month: "long", year: "numeric",
          });

      const result = await sendBrevoTemplate(brevoApiKey, senderEmail, senderName, templateId, customerEmail, customerName, {
        order_number: orderRef,
        order_ref: orderRef,
        order_reference: orderRef,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        county: county,
        product_name: productName,
        quantity: quantity,
        order_items: orderItemsText,
        order_items_text: orderItemsText,
        total_amount: totalKES,
        payment_method: paymentMethod,
        paystack_reference: paymentRef,
        payment_reference: paymentRef,
        brand_logo_url: "https://afams.co.ke/assets/images/afams_logo_stacked.png",
        brand_icon_url: "https://afams.co.ke/assets/images/afams_favicon_512.png",
        refunded_at: refundedAt,
      });
      providerMessageId = result.messageId;
      console.log(`[send-order-email] order_refunded → ${customerEmail} (order ${orderRef})`);

    } else {
      const copy = STATUS_EMAIL_COPY[normalizedStatus] ?? STATUS_EMAIL_COPY.generic;
      if (!STATUS_EMAIL_COPY[normalizedStatus]) {
        console.warn(
          `[send-order-email] Unknown status "${normalizedStatus || "(empty)"}" for order ${orderRef}; sending generic fallback email`,
        );
      }

      const fallbackStatus = normalizedStatus || String(order.status ?? "").trim() || "updated";
      const subject = `[Afams Order ${orderRef}] ${copy.subject}`;
      const textBody = [
        `Hello ${customerName},`,
        "",
        copy.intro,
        "",
        `Order REF: ${orderRef}`,
        `Current Status: ${fallbackStatus}`,
        `Items: ${orderItemsSummary || productName}`,
        `Quantity: ${quantity}`,
        `Total Amount: ${totalKES}`,
        "",
        "Questions? Email orders@afams.co.ke",
        "",
        "Best regards,",
        "Afams LTD Team",
        "orders@afams.co.ke · afams.co.ke · WhatsApp: +254 714 128 514",
      ].join("\n");

      const result = await sendBrevoMessage(
        brevoApiKey,
        senderEmail,
        senderName,
        customerEmail,
        customerName,
        subject,
        textBody,
      );
      providerMessageId = result.messageId;
      console.log(`[send-order-email] ${emailType} (${fallbackStatus}) → ${customerEmail} (order ${orderRef})`);
    }

    return new Response(JSON.stringify({ sent: true, emailType, orderRef, providerMessageId }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-order-email] Brevo error:", msg);
    // Return 200 so the admin save still succeeds — email failure is non-blocking.
    return new Response(JSON.stringify({ sent: false, error: "Email delivery failed. Check Edge Function logs." }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
