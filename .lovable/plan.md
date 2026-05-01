# Fix Counter Strategy: leaseback noise + duplicate targets

Two real bugs on `/counter-strategy`:

1. **Leaseback is mentioned even when no buyer asked for one.** The engine always emits a `leaseback_terms` string ("7-day rent-free leaseback", etc.) and the detail view always renders a "Leaseback" field. If `leasebackRequest` is empty/None on every offer, this is noise — and worse, it suggests the seller is offering something they shouldn't volunteer.

2. **Only one offer ends up countered.** `buildMaximizePrice`, `buildMaximizeCertainty`, and `buildBestBalance` each independently pick the "best" offer for their lens. With a small package (2 offers), the same offer often wins all three lenses, so the user sees three strategies aimed at the same buyer. The intent of the page is one strategy per offer angle.

## Changes

### 1. `src/lib/counterStrategyEngine.ts` — leaseback only when relevant

- Add a helper `anyLeasebackRequested(offers)` and a per-offer `hasLeasebackRequest(o)` that treat empty / `"None"` / `"none"` / null as "not requested".
- In each builder (`buildMaximizePrice`, `buildMaximizeCertainty`, `buildBestBalance`):
  - Only set `leaseback_terms` when the **target offer** actually requested a leaseback. Otherwise leave it as empty string `""`.
  - Drop leaseback language from the rationale strings when not relevant.
- Keep `leasebackOffer()` for the case where it IS requested (honor / counter-shorten / split posture).

### 2. `src/lib/counterStrategyEngine.ts` — distinct targets across strategies

Replace the three independent `best(...)` picks with a **single assignment pass** so each strategy targets a different offer when there are enough offers:

- Rank offers by each lens (price, certainty, balance) into ordered lists.
- Greedy assignment: pick "Maximize Price" first (top of price list), then "Maximize Certainty" from certainty list excluding already-used offers, then "Best Balance" from balance list excluding already-used.
- Fallback: if there are fewer offers than strategies (e.g., 1 or 2 offers), allow reuse but mark duplicates clearly — when only 1 offer exists, still produce 3 strategies on that offer (current behavior); when 2 offers exist, ensure at least 2 distinct targets are used across the 3 strategies (no offer countered three times).

### 3. `src/pages/CounterStrategy.tsx` — hide empty leaseback field

In `StrategyDetail`'s Counter Terms grid, only render the `Leaseback` `<Field>` when `strategy.leaseback_terms` is a non-empty string. No other UI changes.

## Out of scope

- No DB schema changes.
- No edge function changes.
- No changes to scoring / leverage engines.

## Technical notes

- `Offer.leasebackRequest` is a free-text string ("None", "30 days post-close", etc.). The "not requested" check is: `!s || s.trim() === "" || s.trim().toLowerCase() === "none"`.
- Strategy ordering in the UI is driven by the array order returned from `generateCounterStrategies`; assignment pass preserves the existing `[price, certainty, balance]` order.
- `recommended: true` stays on `best_balance`.
