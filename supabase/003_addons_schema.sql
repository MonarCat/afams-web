-- ============================================================
-- Afams SuChai — Add-ons & ProSoil Schema
-- Run in Supabase SQL Editor on project dvquyzzqsnlcassvgdzz
-- ============================================================

-- ── 1A. SEED CATALOG TABLE ──────────────────────────────────
-- Simlaw Seeds retail catalogue (October 2025) + 16% Afams margin.
-- Weights: 10g and 25g only. Open-Pollinated / Maisha-pack varieties.
CREATE TABLE IF NOT EXISTS seed_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  variety     TEXT NOT NULL,
  seed_slug   TEXT NOT NULL UNIQUE,
  price_10g   INTEGER,         -- KES, NULL if weight not available
  price_25g   INTEGER,         -- KES, NULL if weight not available
  in_stock    BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO seed_catalog (category, variety, seed_slug, price_10g, price_25g) VALUES
-- BEETROOT
('Beetroot',              'Crimson Globe / Detroit',              'beetroot-crimson-globe',          70,  145),
-- BROCCOLI
('Broccoli',              'Calabrese',                            'broccoli-calabrese',              100,  230),
('Broccoli',              'Green Sprouting',                      'broccoli-green-sprouting',         90,  170),
-- CABBAGE
('Cabbage',               'Chinese Cabbage (Michihili)',          'cabbage-chinese-michihili',        55,   95),
('Cabbage',               'Copenhagen Market',                    'cabbage-copenhagen-market',        65,  145),
('Cabbage',               'Pack Choi Green',                      'cabbage-pack-choi-green',          65,  130),
('Cabbage',               'Sugarloaf',                            'cabbage-sugarloaf',                70,  145),
-- CAPSICUM — HOT
('Capsicum — Hot',        'Long Cayenne',                         'capsicum-hot-long-cayenne',       170,  400),
-- CAPSICUM — SWEET
('Capsicum — Sweet',      'Super Wonder / California Wonder',     'capsicum-sweet-super-wonder',     215,  510),
-- CARROT
('Carrot',                'Nantes',                               'carrot-nantes',                   170,  400),
-- CAULIFLOWER
('Cauliflower',           'Early Snowball',                       'cauliflower-early-snowball',       85,  145),
-- CELERY
('Celery',                'Tall Utah',                            'celery-tall-utah',                140,  270),
-- COLLARD (SUKUMA WIKI)
('Collard (Sukuma Wiki)', 'Simlaw Select',                        'collard-simlaw-select',           170,  395),
('Collard (Sukuma Wiki)', 'Southern Georgia',                     'collard-southern-georgia',         75,  110),
('Collard (Sukuma Wiki)', 'Sukuma Siku',                          'collard-sukuma-siku',              60,  125),
-- CUCUMBER
('Cucumber',              'Ashley',                               'cucumber-ashley',                 110,  250),
-- EGGPLANT (BRINJAL)
('Eggplant (Brinjal)',    'Black Beauty',                         'eggplant-black-beauty',           135,  310),
('Eggplant (Brinjal)',    'Early Long Purple',                    'eggplant-early-long-purple',      100,  235),
-- HERBS
('Herbs',                 'Chamomile',                            'herbs-chamomile',                 435, 1070),
('Herbs',                 'Chives',                               'herbs-chives',                    395,  960),
('Herbs',                 'Coriander (Dahnia)',                   'herbs-coriander',                  55,   90),
('Herbs',                 'Dill',                                 'herbs-dill',                      100,  215),
('Herbs',                 'Fennel',                               'herbs-fennel',                    200,  470),
('Herbs',                 'Sage',                                 'herbs-sage',                      615, 1515),
('Herbs',                 'Sweet Basil',                          'herbs-sweet-basil',               255,  625),
('Herbs',                 'Thyme',                                'herbs-thyme',                     820, 2020),
-- INDIGENOUS VEGETABLES
('Indigenous Vegetables', 'Amaranthus / Terere',                  'indig-amaranthus-terere',         110,  265),
('Indigenous Vegetables', 'Amaranthus Dubious',                   'indig-amaranthus-dubious',         60,  100),
('Indigenous Vegetables', 'Common N. Shade / Managu',             'indig-common-nightshade',          60,  100),
('Indigenous Vegetables', 'Crotolaria (Mito/Miro)',               'indig-crotolaria',                 60,  105),
('Indigenous Vegetables', 'Giant Night Shade / Managu',           'indig-giant-nightshade',           65,  120),
('Indigenous Vegetables', 'Jews Mallow / Sunhemp',                'indig-jews-mallow',                60,   75),
('Indigenous Vegetables', 'Kunde Mboga',                          'indig-kunde-mboga',                60,   75),
('Indigenous Vegetables', 'Spider Plant (Saga/Saget)',            'indig-spider-plant',               25,   35),
-- KALE
('Kale',                  'Ethiopian Kale',                       'kale-ethiopian',                   65,  135),
('Kale',                  'Thousand Headed',                      'kale-thousand-headed',             65,  135),
-- LEEKS
('Leeks',                 'American Flag',                        'leeks-american-flag',             120,  215),
('Leeks',                 'Bulgarian Giant',                      'leeks-bulgarian-giant',           130,  250),
('Leeks',                 'Italian Giant',                        'leeks-italian-giant',              65,  110),
-- LETTUCE
('Lettuce',               'Great Lakes',                          'lettuce-great-lakes',             130,  300),
('Lettuce',               'Red Salad',                            'lettuce-red-salad',                65,  100),
-- OKRA
('Okra',                  'Carentan',                             'okra-carentan',                   105,  250),
('Okra',                  'Pusa Sawani / Clemson Spineless',      'okra-pusa-sawani',                 40,   55),
-- ONION
('Onion',                 'Bombay Red',                           'onion-bombay-red',                 75,  170),
('Onion',                 'Improved Red Creole',                  'onion-improved-red-creole',       125,  285),
('Onion',                 'Spring Bunching',                      'onion-spring-bunching',           140,  325),
('Onion',                 'Texas Early Grano',                    'onion-texas-early-grano',         175,  415),
('Onion',                 'White Lisbon',                         'onion-white-lisbon',              125,  300),
-- PARSLEY
('Parsley',               'Champion Moss Curled',                 'parsley-champion-moss-curled',    110,  205),
-- RADISH
('Radish',                'Cherry Belle',                         'radish-cherry-belle',              70,  160),
-- SPINACH
('Spinach',               'Fordhook Giant',                       'spinach-fordhook-giant',           85,  175),
-- SQUASH
('Squash',                'Butternut — Waltham',                  'squash-butternut-waltham',        125,  200),
('Squash',                'Zucchini / Black Beauty',              'squash-zucchini-black-beauty',    210,  360),
-- SWEET CORN
('Sweet Corn',            'Golden Bantam',                        'sweetcorn-golden-bantam',          55,   95),
-- TOMATO
('Tomato',                'Cal J',                                'tomato-cal-j',                    140,  325),
('Tomato',                'M82',                                  'tomato-m82',                      135,  250),
('Tomato',                'Marglobe',                             'tomato-marglobe',                 220,  530),
('Tomato',                'Money Maker',                          'tomato-money-maker',              175,  420),
('Tomato',                'Rio Grande vF',                        'tomato-rio-grande-vf',            230,  545),
('Tomato',                'Roma',                                 'tomato-roma',                     135,  250),
('Tomato',                'Super Rio',                            'tomato-super-rio',                215,  520),
-- WATERMELON
('Watermelon',            'Crimson Sweet',                        'watermelon-crimson-sweet',        175,  415),
('Watermelon',            'Sugar Baby',                           'watermelon-sugar-baby',           145,  340)

ON CONFLICT (seed_slug) DO NOTHING;

ALTER TABLE seed_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seeds" ON seed_catalog;
CREATE POLICY "Public can read seeds" ON seed_catalog FOR SELECT USING (TRUE);

-- ── 1B. PROSOIL PRODUCT ─────────────────────────────────────
-- Insert ProSoil into the existing products table
-- NOTE: Replace image filenames after uploading to Truehost /images/ directory
INSERT INTO products (name, slug, description, price, category, in_stock, images, sort_order)
VALUES (
  'Afams ProSoil 25kg',
  'prosoil-25kg',
  'Pre-mixed, pH-balanced, sterilised growing medium. Topsoil + compost + perlite + slow-release fertiliser. Pour into your SuChai, water and start planting immediately. No weed seeds. Ready to plant. pH 6.2–6.8. 25kg bag.',
  59900,
  'growing-medium',
  TRUE,
  '["prosoil-both.jpg", "prosoil-front.jpg", "prosoil-back.jpg"]',
  10
)
ON CONFLICT (slug) DO NOTHING;

-- ── 1C. EXTEND ORDERS TABLE FOR ADD-ONS ────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS free_seeds         JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS extra_seeds        JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS extra_seeds_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_seeds_total  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_qty        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_unit_price INTEGER DEFAULT 59900,
  ADD COLUMN IF NOT EXISTS prosoil_total      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prosoil_promo_bag  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS addons_total       INTEGER DEFAULT 0;
