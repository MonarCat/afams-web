-- ── 011: Update Afams ProSoil 25kg price to KES 799 ───────────────────────────

UPDATE public.products
SET unit_price = 799
WHERE sku = 'PS-25KG';
