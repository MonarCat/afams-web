# Copilot Prompt — Afams.co.ke Product, Pricing & Policy Updates
**Date:** 25 July 2026
**Scope:** GrowBag catalog pricing/sizing, ProSoil pricing + promo removal, Premium Range launch date, seeds/seedlings shipping copy, free delivery geo-restriction, growbag material copy.

---

## Context for Copilot

This is a static HTML/CSS/JS site (afams.co.ke) deployed on Vercel, backed by Supabase project `dvquyzzqsnlcassvgdzz`. Product data lives in the `products` table (PK = `sku`, text; `unit_price` is an **integer** in KES — no decimals, no currency symbols in the DB). Site-wide toggles/dates (e.g. launch dates, delivery rules) are typically stored in the `site_config` table as feature flags/key-value pairs, and referenced from front-end JS — check for an existing `site_config` entry before hardcoding any date or rule in HTML/JS.

**Supabase MCP rule:** Always use `execute_sql` for any schema or data change. **Never use `apply_migration`** — it returns "No approval received" on this project and will silently fail.

Find all files/queries referencing the SKUs below before editing — check product cards, cart/checkout summaries, admin dashboard, and any hardcoded price displays in marketing pages, not just the DB.

---

## Task 1 — GrowBag Range: Update Sizes & Prices

Update the `products` table rows (and any corresponding front-end display copy/JSON) for the GrowBag range to the new size/price matrix below. Each variant (Wide/Compact/Vertical) should remain a distinct SKU — do not collapse variants into one row with a size dropdown unless that pattern already exists in the current schema.

| Tier | Variant | Size (L) | Price (KES) |
|---|---|---|---|
| Mini GrowBag | Wide | 10L | 259 |
| Mini GrowBag | Compact | 5L | 129 |
| Medium GrowBag | Wide | 25L | 629 |
| Medium GrowBag | Compact | 20L | 499 |
| Standard GrowBag | Wide | 50L | 1290 |
| Standard GrowBag | Compact | 40L | 999 |
| Large GrowBag | Wide | 70L | 1800 |
| Large GrowBag | Compact | 65L | 1679 |
| Large GrowBag | Vertical | 65L | 1999 |
| Extra-Large GrowBag | Wide | 90L | 2300 |
| Extra-Large GrowBag | Compact | 85L | 2099 |
| Extra-Large GrowBag | Vertical | 85L | 2699 |

**Implementation notes:**
- `unit_price` must be stored as a plain integer (e.g. `2300`, not `2,300` or `2300.00`).
- Update both the litre size label and the price on every SKU — some tiers changed size *and* price, don't just patch one field.
- Regenerate/update any static product JSON, cart line-item snapshots, or cached catalog pages that duplicate this data outside the DB.
- After the SQL update, spot-check the storefront GrowBag section and the cart to confirm the new sizes/prices render correctly (no stale cached values).

**Example `execute_sql` pattern (adjust SKUs/column names to match actual schema):**
```sql
UPDATE products SET size_label = '10L', unit_price = 259 WHERE sku = 'GB-MINI-WIDE';
UPDATE products SET size_label = '5L',  unit_price = 129 WHERE sku = 'GB-MINI-COMPACT';
-- ... repeat for all rows in the table above, using the actual SKUs in the DB
```

---

## Task 2 — Afams ProSoil: Price Update + Promo Removal

1. Update ProSoil (SKU `PS-25KG`) `unit_price` to **799**.
2. **Remove entirely** any "Buy 3 bags, get 1 free (up to 3 free bags max) when ordering with a FarmBag" promotion logic tied to ProSoil — this applies to any bundling/discount logic in cart calculation code, `site_config` promo flags, and any marketing copy on product pages or banners mentioning this offer.
3. Confirm cart/checkout math has no leftover conditional that auto-adds free ProSoil units when a FarmBag SKU is present — search for ProSoil SKU references in checkout/cart JS specifically, since promo logic is often embedded there rather than in the DB.
4. ProSoil should behave as a standard, non-promotional catalog item at KES 799 going forward.

```sql
UPDATE products SET unit_price = 799 WHERE sku = 'PS-25KG';
```

---

## Task 3 — FarmBag System Premium Range: Launch Date Update

Change the "Awaiting Official Launch" date displayed for the Premium Range from **1 September 2026** to **11 January 2027**.

- Locate this date wherever it's sourced (`site_config` key is the likely location, e.g. `premium_range_launch_date` — check for it before adding a new one) and update it there, not just in the HTML, so the countdown/badge stays consistent if it's dynamically rendered.
- If the date is currently hardcoded in HTML/JS with no `site_config` backing, migrate it into `site_config` while you're in there so future date changes don't require a code deploy.

```sql
UPDATE site_config SET value = '2027-01-11' WHERE key = 'premium_range_launch_date';
```

---

## Task 4 — Seeds & Seedling Packs: "Ships Same Day" Copy

Add "**Ships same day**" messaging to the Seeds & Seedling Packs product section(s) — product cards and/or product detail view, wherever shipping/fulfillment info is currently shown for other product lines (for consistency of placement/styling).

- This is a copy-only change unless there's an existing fulfillment-time field per product category, in which case set it there instead of hardcoding text.

---

## Task 5 — Free Delivery Threshold: Restrict to Nairobi Metropolitan Area

Current copy: "Free Delivery on orders KES 2,499+" (implied to apply everywhere).

**New behavior:**
- Free delivery on orders ≥ KES 2,499 applies **only within the Nairobi Metropolitan Area**.
- Orders outside Nairobi Metro Area are charged a **standard applicable delivery rate** regardless of order value.

**Implementation notes:**
- If checkout already has a location/county selector, gate the free-delivery logic on that field (define "Nairobi Metropolitan Area" as a checklist of counties/areas — likely Nairobi County plus immediate satellite towns if that's the existing definition used elsewhere on the site; confirm against any existing delivery-zone list before inventing a new one).
- If no location field currently exists in checkout, this task also requires adding one (dropdown or text input) before delivery-fee logic can branch on it — flag this to Monar if the schema doesn't currently support it, since it may be a larger change than pure copy.
- Update the marketing copy everywhere the KES 2,499+ free delivery claim appears (homepage banner, product pages, checkout, footer) to reflect the Nairobi Metro Area qualifier — don't leave an unqualified "free delivery" claim anywhere on the site.
- Standard rate for outside-Metro orders should be clearly stated at checkout before payment, not just implied.

---

## Task 6 — GrowBag Material Copy: Add "Gunia" Heavy-Duty Alternative

Update the GrowBag material description to introduce a rugged, heavy-duty woven alternative material alongside the current fabric, without using potentially unfamiliar-to-customers raw terminology as the *only* descriptor — lead with the durability benefit, then name it.

Suggested copy pattern (adapt tone to match existing product copy style):

> "Available in our standard breathable woven fabric, or step up to our **Heavy Duty PP Woven Gunia** — a rugged, tightly-woven polypropylene sack-grade material built for tougher handling, rocky ground, and repeated seasons of reuse."

**Implementation notes:**
- Add this as a material option/variant note on GrowBag product listings — confirm with Monar whether "Heavy Duty PP Woven Gunia" is a selectable variant (separate SKU/price) or just descriptive copy about the standard material's construction. If it's a real alternate material option, it likely needs its own SKU(s) mirroring the size matrix in Task 1, at a price Monar will confirm separately.
- Keep the primary product name/branding unchanged — this is additive material copy, not a rename of the GrowBag line.

---

## Testing / Acceptance Checklist

- [ ] All GrowBag SKUs show correct new size labels and integer `unit_price` values (spot-check DB + rendered storefront + cart)
- [ ] ProSoil shows KES 799 with zero promotional/bundling logic remaining anywhere in cart, checkout, or marketing copy
- [ ] Premium Range launch date reads 11 January 2027 everywhere it's displayed
- [ ] Seeds & Seedling Packs show "Ships same day"
- [ ] Free delivery messaging clearly scoped to Nairobi Metropolitan Area; outside-area orders show standard rate before payment
- [ ] GrowBag material copy updated with heavy-duty "gunia" alternative language, styling consistent with rest of site
- [ ] No cached/static duplicate of old prices, dates, or promo copy left anywhere (search repo-wide, not just the obvious pages)
