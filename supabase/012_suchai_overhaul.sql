ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subscription boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_discount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  variety text NOT NULL CHECK (variety IN ('rtd', 'ordinary')),
  flavor text NOT NULL CHECK (flavor IN ('plain', 'ginger', 'lemon')),
  size text NOT NULL CHECK (size IN ('50g', '100g', '150g', '200g', '250g')),
  unit_price integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  line_total integer GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

INSERT INTO site_config (key, value)
VALUES ('pre_order_mode', 'false')
ON CONFLICT (key) DO UPDATE SET value = 'false';

INSERT INTO site_config (key, value)
VALUES
  ('brand_name', 'SuChai'),
  ('subscribe_discount_pct', '10'),
  ('suchai_active', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
