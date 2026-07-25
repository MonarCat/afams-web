-- ============================================================
-- Afams Product Updates — July 2026
-- Migration: 012_product_updates_jul2026.sql
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================

-- Premium range launch date
INSERT INTO public.site_config (key, value)
VALUES ('premium_range_launch_date', '2027-01-11')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- Delivery policy flags
INSERT INTO public.site_config (key, value)
VALUES
  ('free_delivery_min_kes', '2499'),
  ('free_delivery_area_label', 'Nairobi Metropolitan Area'),
  ('outside_metro_delivery_label', 'Standard applicable delivery rate')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- Explicitly disable retired ProSoil promo
INSERT INTO public.site_config (key, value)
VALUES ('prosoil_farmbag_promo_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
