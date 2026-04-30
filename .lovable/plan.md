## Goal

Add an inline-editable **Listing price** next to the listing name in the Offer Intake header. Edits write straight to `properties.listing_price` for the currently active deal.

## Why this is small

The whole downstream stack already reads `properties.listing_price`:

- **Comparison** page — already shows "Listed at $X" and per-offer price delta (`Comparison.tsx:270`, `:343`).
- **AI Strategist** (`compare-offers` edge function) — already receives `property.listingPrice` in its prompt (`index.ts:35`).
- **Shared portal** — `portalService.ts` already reads `listing_price` and propagates it.
- **Counter Strategy / Leverage / Recommendation / Seller Report** engines all consume `listingPrice`.

So once the value is editable on Intake and saved to the database, *all of the above* are already covered. No other UI changes are needed for this request.

## What I'll change

### 1. `src/pages/OfferIntake.tsx` — header edit UI
- Track `listingPrice` in component state (alongside `analysisLabel`), seeded from the loaded analysis.
- Replace the right-hand "Uploading into" block with two stacked rows:
  - Listing name (existing)
  - **Listed at $X,XXX,XXX** with a pencil icon → click swaps it for an inline number input, blur/Enter saves, Esc cancels.
- On save: optimistic UI update + toast on error (rollback). Validate as a positive integer ≤ $999,999,999.
- Refresh the in-memory `analysisOptions` entry too so the picker stays accurate.

### 2. `src/lib/dealsDashboardService.ts` (or a new tiny helper in `offerService.ts`)
- Add `updatePropertyListingPrice(userId, propertyId, price)` — single `UPDATE properties SET listing_price = $1 WHERE id = $2 AND user_id = $3`. RLS already enforces ownership, but the explicit `user_id` filter is belt-and-suspenders.

### 3. `src/lib/activeAnalysis.ts` — lookup helper
- Make `fetchAnalysisById` return the `property_id` (it likely already does via `properties(*)`; just need to expose it). Used so the intake page knows which property row to update.

## What I'm explicitly NOT doing (because already done)

- Showing "% of ask" on Comparison cards → already shown as price delta.
- Passing listing price to AI Strategist → already passed.
- Showing in shared portal → already shown.

If you'd rather see "% of ask" as a separate badge on Comparison cards (e.g. `+2.3% over ask`), say the word and I'll add that as a follow-up — but it's a separate visual tweak, not a wiring change.

## Validation

- Number input: digits only, max 9 digits, no negatives.
- Empty → treated as "clear" (sets to NULL, downstream code already handles null).
- Optimistic update reverts on Supabase error with a toast.
