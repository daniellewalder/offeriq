## What's actually wrong

You uploaded **two different documents** for 2339 Lyric:
1. `2339 Lyric.pdf` — the **buyer's original offer** ($2,235,000)
2. `Seller Counter Offer #1 - 1225.pdf` — **your counter** ($2,475,000)

Both PDFs got attached to the **same single offer record** in the database, and the extraction model picked the most recent price it saw — $2,475,000 — overwriting the original. So the system has no idea there was a negotiation. From the database's point of view there is just one offer at $2,475,000, which is why the AI says "Buyer accepted the seller's counter price." It's not making it up — it literally cannot see the original $2,235,000 anywhere.

This will keep happening on every deal until counters are tracked separately.

## The fix

Treat counters as their own document type with their own price, and compare original-vs-counter instead of overwriting.

### 1. Add counter-specific document categories (intake)
In `OfferIntake.tsx`, expand `DOC_CATEGORIES`:
- `Purchase Agreement` (buyer's original offer)
- `Seller Counter` (counters issued by seller)
- `Buyer Counter` (counters issued by buyer)
- existing: Proof of Funds, Pre-Approval, Proof of Income, Addenda, Disclosures, Other

When the user uploads, they tag each PDF with the right category — same UX as today, just more accurate options.

### 2. Track counters as a versioned negotiation, not a price overwrite
Add a `counters` JSONB column on `offers` (or a small `offer_counters` table) so each counter is a separate row with: who issued it (seller/buyer), price, terms changed, source document. The original `offer_price` field stays as the **buyer's original offer price** and never gets overwritten.

### 3. Update the extract-offer edge function
- When documents in the package include a `Seller Counter` or `Buyer Counter` category, extract their price/terms into the `counters` array, not into the top-level offer fields.
- Add a new field in the extraction schema: `counter_chain` — an ordered list of `{party, price, key_changes, source_document}`.
- Update the system prompt to explicitly say: "If you see a counter-offer document, do NOT overwrite the original offer price. Record it as a separate counter in the negotiation history."

### 4. Show the negotiation in the Comparison view
On the offer card and in the AI Strategist panel, render the chain like:
```text
Buyer offer:    $2,235,000
Seller counter: $2,475,000  (you, +$240k, added 3-mo $1 leaseback)
Status:         Awaiting buyer response
```

### 5. Update the AI Strategist prompt (compare-offers function)
Pass the `counter_chain` into the analysis so it reasons about *the live negotiation*, not a fictional accepted deal. Strategy output becomes things like "buyer is unlikely to accept a $240k bump + free leaseback — consider…" instead of "buyer accepted."

### 6. Clean up the existing bad record
The current 2339 Lyric offer (id `6b0a0154…`) has the wrong $2,475,000 as offer_price. After the schema change, re-run extraction on this offer so it splits properly into original ($2,235,000) + seller counter ($2,475,000 + leaseback).

## Files touched
- `supabase/functions/extract-offer/index.ts` — new fields, updated prompt, counter handling
- `supabase/functions/compare-offers/index.ts` — accept and reason over `counter_chain`
- new migration — add `counters` column (or table) + backfill
- `src/pages/OfferIntake.tsx` — new categories, show counter chain in preview
- `src/pages/Comparison.tsx` — render negotiation history on offer cards + pass to strategist
- `src/lib/offerService.ts` — types + helpers for counters

## What you'll see after
Upload buyer offer + your counter → system shows two distinct prices, the strategist treats it as an active negotiation, and "Buyer accepted" never appears unless you actually upload a signed acceptance.
