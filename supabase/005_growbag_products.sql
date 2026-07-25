-- ============================================================
-- Afams GrowBag — Product Range Migration
-- Migration: 005_growbag_products.sql
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================
--
-- GrowBag matrix update (July 2026):
--   Mini      Wide 10L  KES 259   | Compact 5L   KES 129
--   Medium    Wide 25L  KES 629   | Compact 20L  KES 499
--   Standard  Wide 50L  KES 1290  | Compact 40L  KES 999
--   Large     Wide 70L  KES 1800  | Compact 65L  KES 1679 | Vertical 65L KES 1999
--   XL        Wide 90L  KES 2300  | Compact 85L  KES 2099 | Vertical 85L KES 2699
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_line  text,
  ADD COLUMN IF NOT EXISTS variant       text,
  ADD COLUMN IF NOT EXISTS size_label    text,
  ADD COLUMN IF NOT EXISTS volume_litres numeric;

INSERT INTO public.products
  (sku, name, description, unit_price, active, product_line, variant, size_label, volume_litres)
VALUES
  ('GB-MINI-W', 'GrowBag Mini — Wide', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 259, true, 'growbag', 'Wide', 'Mini', 10),
  ('GB-MINI-C', 'GrowBag Mini — Compact', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 129, true, 'growbag', 'Compact', 'Mini', 5),
  ('GB-MED-W', 'GrowBag Medium — Wide', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 629, true, 'growbag', 'Wide', 'Medium', 25),
  ('GB-MED-C', 'GrowBag Medium — Compact', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 499, true, 'growbag', 'Compact', 'Medium', 20),
  ('GB-STD-W', 'GrowBag Standard — Wide', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 1290, true, 'growbag', 'Wide', 'Standard', 50),
  ('GB-STD-C', 'GrowBag Standard — Compact', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 999, true, 'growbag', 'Compact', 'Standard', 40),
  ('GB-LRG-W', 'GrowBag Large — Wide', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 1800, true, 'growbag', 'Wide', 'Large', 70),
  ('GB-LRG-C', 'GrowBag Large — Compact', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 1679, true, 'growbag', 'Compact', 'Large', 65),
  ('GB-LRG-V', 'GrowBag Large — Vertical', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 1999, true, 'growbag', 'Vertical', 'Large', 65),
  ('GB-XL-W', 'GrowBag XL — Wide', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 2300, true, 'growbag', 'Wide', 'XL', 90),
  ('GB-XL-C', 'GrowBag XL — Compact', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 2099, true, 'growbag', 'Compact', 'XL', 85),
  ('GB-XL-V', 'GrowBag XL — Vertical', 'Breathable woven GrowBag with bonded liner. Also available in Heavy Duty PP Woven Gunia for rugged handling, rocky ground, and repeated reuse seasons.', 2699, true, 'growbag', 'Vertical', 'XL', 85)
ON CONFLICT (sku) DO UPDATE
  SET name          = EXCLUDED.name,
      description   = EXCLUDED.description,
      unit_price    = EXCLUDED.unit_price,
      active        = EXCLUDED.active,
      product_line  = EXCLUDED.product_line,
      variant       = EXCLUDED.variant,
      size_label    = EXCLUDED.size_label,
      volume_litres = EXCLUDED.volume_litres;

CREATE INDEX IF NOT EXISTS products_product_line_idx ON public.products (product_line);
