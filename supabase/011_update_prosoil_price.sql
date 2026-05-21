-- ── 011: Update Afams ProSoil 25kg price from KES 399 to KES 599 ─────────────

UPDATE public.products
SET unit_price = 599
WHERE sku = 'PS-25KG';
