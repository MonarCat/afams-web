-- ============================================================
-- Afams POS — in-store sales (admin "Shop" tab)
-- Migration: 013_pos_sales.sql
--
-- Run with Supabase `execute_sql` (never apply_migration) — see repo conventions.
-- Additive only: creates one table and one function. Touches no existing object.
--
-- Flow
--   1. Edge function `pos-charge` prices the cart server-side from `products`,
--      inserts a `pos_sales` row (status 'pending') and asks Paystack to push an
--      STK prompt to the customer's phone (or records a cash sale straight away).
--   2. On payment success, either the Paystack webhook (metadata.pos_ref) or the
--      `pos-charge` status poll calls finalize_pos_sale(). It is idempotent and
--      atomic: it creates the order (status 'delivered', handed over in store),
--      the order_items rows, and deducts stock.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_sales (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text        NOT NULL UNIQUE,            -- also used as the Paystack charge reference
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  cashier_email  text,
  method         text        NOT NULL CHECK (method IN ('mpesa', 'airtel', 'cash')),
  phone          text,
  customer_email text,
  items          jsonb       NOT NULL,                   -- [{sku,name,quantity,unit_price}] priced server-side
  total_amount   integer     NOT NULL CHECK (total_amount > 0),
  tendered       integer,                                -- cash only
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  failure_reason text,
  paystack_ref   text,
  order_id       uuid        REFERENCES public.orders (id),
  order_number   text
);

CREATE INDEX IF NOT EXISTS pos_sales_status_idx  ON public.pos_sales (status);
CREATE INDEX IF NOT EXISTS pos_sales_created_idx ON public.pos_sales (created_at DESC);

-- RLS on with NO policies: only the service role (edge functions) can read/write.
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;

-- ── finalize_pos_sale ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_pos_sale(
  p_reference   text,
  p_paystack_ref text    DEFAULT NULL,
  p_paid_amount  integer DEFAULT NULL    -- KES actually received; NULL for cash
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale     public.pos_sales%ROWTYPE;
  v_primary  jsonb;
  v_item     jsonb;
  v_order_id uuid;
  v_order_no text;
  v_label    text;
BEGIN
  -- Lock the sale row so the webhook and a status poll can't both finalize it.
  SELECT * INTO v_sale FROM public.pos_sales WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Idempotent: already done → return the existing order.
  IF v_sale.status = 'success' THEN
    RETURN jsonb_build_object('order_id', v_sale.order_id,
                              'order_number', v_sale.order_number,
                              'duplicate', true);
  END IF;

  -- Money was taken but not for the expected amount: don't invent an order.
  IF p_paid_amount IS NOT NULL AND p_paid_amount <> v_sale.total_amount THEN
    UPDATE public.pos_sales
       SET status = 'failed',
           failure_reason = format('Amount mismatch: paid %s, expected %s', p_paid_amount, v_sale.total_amount),
           paystack_ref = COALESCE(p_paystack_ref, paystack_ref),
           updated_at = now()
     WHERE id = v_sale.id;
    RETURN jsonb_build_object('error', 'amount_mismatch');
  END IF;

  v_label   := CASE v_sale.method WHEN 'mpesa' THEN 'M-Pesa' WHEN 'airtel' THEN 'Airtel Money' ELSE 'Cash' END;
  v_primary := v_sale.items -> 0;

  INSERT INTO public.orders (
    customer_name, customer_email, customer_phone, delivery_address, county,
    product_sku, product_name, quantity, unit_price, total_amount,
    paystack_ref, payment_method, paid_at, status, delivered_at, notes, items
  ) VALUES (
    'Walk-in customer',
    COALESCE(NULLIF(v_sale.customer_email, ''), 'pos@afams.co.ke'),
    v_sale.phone,
    'In-store (POS)',
    'Nairobi',
    v_primary ->> 'sku',
    v_primary ->> 'name',
    (v_primary ->> 'quantity')::int,
    (v_primary ->> 'unit_price')::int,
    v_sale.total_amount,
    CASE WHEN v_sale.method = 'cash' THEN NULL ELSE COALESCE(p_paystack_ref, v_sale.reference) END,
    CASE WHEN v_sale.method = 'cash' THEN 'manual' ELSE 'paystack' END,
    now(),
    'delivered',                      -- handed over at the counter; keeps the fulfilment queue clean
    now(),
    'POS in-store sale · ' || v_label,
    v_sale.items
  )
  RETURNING id, order_number INTO v_order_id, v_order_no;

  -- Line items. The existing trg_sync_order_totals trigger recomputes the order
  -- total and product summary from these rows.
  INSERT INTO public.order_items (order_id, product_sku, product_name, quantity, unit_price, item_type, is_free)
  SELECT v_order_id,
         i ->> 'sku',
         i ->> 'name',
         (i ->> 'quantity')::int,
         (i ->> 'unit_price')::int,
         'product',
         false
    FROM jsonb_array_elements(v_sale.items) AS i;

  -- Stock. Never fails the sale (the money is already taken); clamps at zero.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_sale.items) LOOP
    UPDATE public.products
       SET stock_quantity = GREATEST(0, stock_quantity - (v_item ->> 'quantity')::int)
     WHERE sku = v_item ->> 'sku';
  END LOOP;

  UPDATE public.pos_sales
     SET status = 'success',
         order_id = v_order_id,
         order_number = v_order_no,
         paystack_ref = COALESCE(p_paystack_ref, paystack_ref),
         failure_reason = NULL,
         updated_at = now()
   WHERE id = v_sale.id;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_no, 'duplicate', false);
END;
$$;

-- Only edge functions (service_role) may finalize a sale.
REVOKE ALL ON FUNCTION public.finalize_pos_sale(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pos_sale(text, text, integer) TO service_role;
