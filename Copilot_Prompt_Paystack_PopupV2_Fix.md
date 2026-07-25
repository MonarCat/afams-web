# Copilot Prompt — Fix Paystack Checkout 400 Error (Migrate InlineJS V1 → V2)

**Priority:** Blocking. No marketing spend or live checkout traffic should go to afams.co.ke until this is resolved — checkout is currently broken for all customers.

## Symptom

Every checkout attempt fails with:
```
api.paystack.co/checkout/request_inline: Failed to load resource: status 400
setupTransaction @ index-3k5W6bKb.js
AxiosError: Request failed with status code 400
```

## Root Cause

The site is loading Paystack **InlineJS V1** (`https://js.paystack.co/v1/inline.js` or the legacy `PaystackPop.setup({...}).openIframe()` pattern), which calls the now-deprecated `request_inline` endpoint. Paystack is rejecting these calls with a 400. This must be migrated to **InlineJS Popup V2**.

## Fix Steps

1. **Find the current script include.** Search the codebase for `js.paystack.co/v1/inline.js` or any `<script src="https://js.paystack.co/inline.js">` (no version = old default). Replace with:
   ```html
   <script src="https://js.paystack.co/v2/inline.js"></script>
   ```
   If installed via npm instead, confirm `package.json` uses `@paystack/inline-js` and that the import path resolves to the v2 build — reinstall/update if pinned to an old version.

2. **Find `setupTransaction`** (referenced directly in the error stack, in the bundled `index-*.js` — locate its source file pre-bundle, likely something like `checkout.js`, `paystack.js`, or inside a payment service module).

3. **Replace the V1 pattern:**
   ```javascript
   // OLD (V1) — DO NOT USE
   const handler = PaystackPop.setup({
     key: PUBLIC_KEY,
     email: customerEmail,
     amount: amountInKobo,
     ref: reference,
     callback: function(response) {
       // handle success
     },
     onClose: function() {
       // handle cancel
     }
   });
   handler.openIframe();
   ```

   **With the V2 pattern:**
   ```javascript
   // NEW (V2)
   const popup = new PaystackPop();
   popup.newTransaction({
     key: PUBLIC_KEY,
     email: customerEmail,
     amount: amountInKobo,
     ref: reference,
     onSuccess: (transaction) => {
       // handle success — transaction.reference available here
       // still verify server-side via Paystack Verify Transaction endpoint before fulfilling the order
     },
     onCancel: () => {
       // handle cancel
     },
     onError: (error) => {
       // handle transaction load/setup errors gracefully (was previously unhandled)
     }
   });
   ```

4. **Callback renames — this is the core breaking change:**
   - `callback` → `onSuccess`
   - `onClose` → `onCancel`
   - `.openIframe()` call is no longer needed — `newTransaction()` opens the popup itself
   - Add `onError` if not already present, since V2 surfaces setup errors explicitly

5. **If using `@paystack/inline-js` via npm/yarn:**
   ```javascript
   import PaystackPop from '@paystack/inline-js';
   const popup = new PaystackPop();
   popup.newTransaction({ /* same config as above */ });
   ```

6. **Verify amount units.** V1 and V2 both expect `amount` in kobo/lowest currency unit (i.e. KES amount × 100) — confirm this wasn't already a separate bug, since the growbag price update (Task 1) changes several `unit_price` values that flow into this checkout call.

## Testing Checklist

- [ ] `js.paystack.co/v2/inline.js` is loaded (check Network tab, not v1)
- [ ] Test transaction opens popup with no console errors, no `request_inline` 400
- [ ] `onSuccess` fires and reference is captured correctly
- [ ] `onCancel` fires when user closes the popup manually
- [ ] `onError` is implemented and logs/handles setup failures instead of failing silently
- [ ] Server-side webhook/verify flow (HMAC-SHA512, Deno Edge Function) still correctly verifies the transaction reference from the new `onSuccess` payload — do not skip this, since V2's success payload shape may differ slightly from V1's `callback` payload
- [ ] Full checkout tested end-to-end with a real low-value test order before removing test mode
- [ ] Confirm no other page (e.g. any secondary checkout entry point, cart drawer, quick-buy button) still references the old V1 pattern — search the whole repo, not just the main checkout page

## Note

This fix should land **before** any of the pricing/copy updates go live to customers, since checkout is currently non-functional for everyone — this is a hard blocker independent of the product catalog changes.
