-- ============================================================
-- Afams — stock deduction for EVERY sales channel
-- Migration: 014_stock_deduction_all_channels.sql
--
-- Run with Supabase `execute_sql` (never apply_migration) — see repo conventions.
--   STATUS: APPLIED to the live database on 2026-10-20 (rollback test T1-T7 passed first). Supersedes the private stock loop in 013_pos_sales.sql.
--
-- Problem this fixes
--   * The old deduct_stock_after_order() read item keys `sku` / `quantity`, but the
--     Paystack webhook stores `product_sku` / `quantity`, so only the FIRST line of a
--     multi-item website order was ever deducted.
--   * It raised an exception when any line was short, which deducted nothing at all.
--   * Nothing deducted stock when an admin marked an order paid, or for rows created
--     any other way (SQL editor, future channels).
--   * It was executable by anon/authenticated.
--
-- Design
--   * orders.stock_deducted_at — per-order "already deducted" flag => idempotent.
--   * deduct_stock_after_order(order_id) — the ONE function that moves stock. Reads lines from
--     orders.items (product_sku|sku, quantity|qty), else order_items rows, else the flat
--     product_sku/quantity columns; also honours the legacy prosoil_qty column. Aggregates per
--     SKU, clamps at zero, never raises for stock reasons, and is a no-op on a second call.
--   * Trigger orders_deduct_stock — fires when an order is inserted as, or updated to, a paid
--     status (paid/processing/shipped/delivered) and has not been deducted yet. Covers the
--     storefront webhook, POS, "mark as paid" in admin, and manual inserts. Failures are caught
--     and logged as warnings: an order is never lost because of stock bookkeeping.
--   * Existing paid-like orders are flagged as handled so touching them later can never
--     deduct stock a second time.
--   * finalize_pos_sale() now relies on the same function (no private stock loop).
-- ============================================================

-- 1) Per-order flag + backfill (preserve updated_at on the historical rows) ---------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz;

ALTER TABLE public.orders DISABLE TRIGGER orders_updated_at;
UPDATE public.orders
   SET stock_deducted_at = COALESCE(paid_at, created_at)
 WHERE stock_deducted_at IS NULL
   AND status IN ('paid', 'processing', 'shipped', 'delivered');
ALTER TABLE public.orders ENABLE TRIGGER orders_updated_at;

-- 2) The single deduction function --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_stock_after_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_lines jsonb;
  r       record;
  v_have  integer;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Idempotent: already deducted → nothing to do.
  IF v_order.stock_deducted_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- (a) lines from orders.items (accepts product_sku|sku and quantity|qty)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sku', s.sku, 'qty', s.qty)), '[]'::jsonb)
    INTO v_lines
    FROM (
      SELECT COALESCE(NULLIF(i ->> 'product_sku', ''), NULLIF(i ->> 'sku', '')) AS sku,
             CASE WHEN COALESCE(i ->> 'quantity', i ->> 'qty') ~ '^[0-9]+$'
                  THEN COALESCE(i ->> 'quantity', i ->> 'qty')::int END AS qty
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(v_order.items) = 'array' THEN v_order.items ELSE '[]'::jsonb END
             ) AS i
    ) s
   WHERE s.sku IS NOT NULL AND s.qty > 0;

  -- (b) else the order_items rows
  IF jsonb_array_length(v_lines) = 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('sku', oi.product_sku, 'qty', oi.quantity)), '[]'::jsonb)
      INTO v_lines
      FROM public.order_items oi
     WHERE oi.order_id = p_order_id AND oi.product_sku IS NOT NULL AND oi.quantity > 0;
  END IF;

  -- (c) else the flat columns on the order row
  IF jsonb_array_length(v_lines) = 0 AND v_order.product_sku IS NOT NULL AND v_order.quantity > 0 THEN
    v_lines := jsonb_build_array(jsonb_build_object('sku', v_order.product_sku, 'qty', v_order.quantity));
  END IF;

  -- Legacy ProSoil columns (only when the SKU isn't already listed as a line)
  IF COALESCE(v_order.prosoil_qty, 0) > 0
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) l WHERE l ->> 'sku' = 'PS-25KG') THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('sku', 'PS-25KG', 'qty', v_order.prosoil_qty));
  END IF;

  -- Deduct, one UPDATE per SKU in a stable order (avoids deadlocks between concurrent orders).
  FOR r IN
    SELECT l ->> 'sku' AS sku, SUM((l ->> 'qty')::int) AS qty
      FROM jsonb_array_elements(v_lines) l
     GROUP BY 1
     ORDER BY 1
  LOOP
    SELECT stock_quantity INTO v_have FROM public.products WHERE sku = r.sku FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;                                   -- unknown SKU (e.g. a free add-on with no product row)
    END IF;
    IF v_have < r.qty THEN
      RAISE WARNING 'Oversold % on order %: needed %, had %', r.sku, v_order.order_number, r.qty, v_have;
    END IF;
    UPDATE public.products
       SET stock_quantity = GREATEST(0, stock_quantity - r.qty)
     WHERE sku = r.sku;
  END LOOP;

  UPDATE public.orders SET stock_deducted_at = now() WHERE id = p_order_id;
END;
$$;

-- Only the service role (edge functions) and the trigger below may call it.
REVOKE ALL ON FUNCTION public.deduct_stock_after_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_stock_after_order(uuid) TO service_role;

-- 3) Trigger: any order that becomes paid deducts stock exactly once -----------------------------
CREATE OR REPLACE FUNCTION public.trg_deduct_stock_for_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.deduct_stock_after_order(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Never lose an order (or block a status change) because of stock bookkeeping.
    RAISE WARNING 'Stock deduction failed for order %: %', NEW.order_number, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS orders_deduct_stock ON public.orders;
CREATE TRIGGER orders_deduct_stock
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IN ('paid', 'processing', 'shipped', 'delivered') AND NEW.stock_deducted_at IS NULL)
  EXECUTE FUNCTION public.trg_deduct_stock_for_paid_order();

-- 4) POS: finalize_pos_sale now uses the shared deduction (replaces the private loop from 013) ---
CREATE OR REPLACE FUNCTION public.finalize_pos_sale(
  p_reference    text,
  p_paystack_ref text    DEFAULT NULL,
  p_paid_amount  integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale     public.pos_sales%ROWTYPE;
  v_primary  jsonb;
  v_order_id uuid;
  v_order_no text;
  v_label    text;
BEGIN
  SELECT * INTO v_sale FROM public.pos_sales WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_sale.status = 'success' THEN
    RETURN jsonb_build_object('order_id', v_sale.order_id,
                              'order_number', v_sale.order_number,
                              'duplicate', true);
  END IF;

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

  -- Inserted as 'delivered' (handed over at the counter). The orders_deduct_stock trigger deducts
  -- stock on this insert; the explicit call below is a no-op safety net.
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
    'delivered',
    now(),
    'POS in-store sale · ' || v_label,
    v_sale.items
  )
  RETURNING id, order_number INTO v_order_id, v_order_no;

  INSERT INTO public.order_items (order_id, product_sku, product_name, quantity, unit_price, item_type, is_free)
  SELECT v_order_id,
         i ->> 'sku',
         i ->> 'name',
         (i ->> 'quantity')::int,
         (i ->> 'unit_price')::int,
         'product',
         false
    FROM jsonb_array_elements(v_sale.items) AS i;

  PERFORM public.deduct_stock_after_order(v_order_id);

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

REVOKE ALL ON FUNCTION public.finalize_pos_sale(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pos_sale(text, text, integer) TO service_role;
