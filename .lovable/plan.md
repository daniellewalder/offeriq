# Make this a real, agent-usable tool

Goal: An agent should sign in, hit "New Analysis," upload real PDFs, and watch the system actually read the contract — with one labeled demo deal kept around purely as a teaching example. No mock data leaking into "real" views.

---

## What changes

### 1. Sample data — keep one, kill the rest

- **Keep** the Bel Air Stone Canyon deal in `src/data/sampleData.ts` (all 5 offers stay) **but only ever surface it behind a clearly labeled "Demo deal — example only" badge** on the Dashboard. Never on real analyses.
- **Remove** `MOCK_EXTRACTION` from `OfferIntake.tsx` and remove the silent fallback in `runExtraction` that pretends mock data is real extraction. If real extraction fails, show the actual error.
- **Remove** `recentProperties` mock list — Dashboard should only show real properties from the DB plus one pinned demo card.
- All non-demo pages (Comparison, Risk, Leverage, Counter, Delta, Report, Seller Portal) currently fall back to `sampleProperty` when no real data exists. Replace those fallbacks with `<EmptyDealState />` (already exists) pointing to "Start a new analysis."

### 2. Demo deal becomes a first-class, read-only example

- On Dashboard, render a single pinned card: "Demo Deal — 1247 Stone Canyon Rd (example)" with a Sparkles icon and a tooltip "Sample data so you can see the full experience before uploading your own."
- Clicking it loads all downstream pages with `sampleProperty` and a top banner: "You're viewing the demo deal. Start a new analysis to upload real offers."
- Real deals never mix demo data into their views.

### 3. Harden the upload → extract → display pipeline

This is the part that's been silently failing. Concrete fixes:

**Upload (`OfferIntake.tsx` + `offerService.ts`)**
- Show a per-file status pill: `Queued → Uploading → Stored → Extracting → Done / Error`, with the actual error message inline (no toast-only failures).
- After `uploadDocument` returns, immediately re-query the `documents` row to confirm it actually exists. If it doesn't, surface a hard error.
- Validate file type before upload: PDF, TXT, or known text MIMEs. Reject scanned-image PDFs with a friendly "This looks like a scanned image — text-based PDFs work best" warning (we can still attempt extraction).

**Extraction (`extract-offer` edge function)**
- Already calls Gemini 2.5 Pro on real PDF text — that part is solid.
- Add a `debug` block to the response: `per_document_chars_extracted`, `model`, `tokens_used` (if available), `version`, `parsed_at`. Show this in a small "Extraction details" disclosure on the offer card so the agent can see exactly what the AI saw.
- If a PDF parses to <200 chars (likely scanned), return a clear `warning` field instead of running the model on near-empty text.

**Display**
- After extraction completes, immediately navigate the user to `/comparison` with the new offer highlighted, instead of leaving them on the intake page guessing whether anything happened.
- Comparison/Risk/Leverage pages must read from `fetchOffersWithExtraction(dealAnalysisId)` only — no `sampleProperty` fallback when a real analysis exists.

### 4. A "verify" button on each extracted offer

A small "Re-extract" button on each uploaded offer card that re-runs the edge function and bumps the version, so when you submit a test offer we can prove the pipeline is live and re-runnable.

---

## Test plan you'll run after this ships

1. Sign in.
2. Click "Start a new analysis" → fill in property → continue.
3. Upload one real offer PDF.
4. Watch status pills move through Stored → Extracting → Done.
5. See extracted fields with quoted evidence from your actual PDF.
6. Land on Comparison and see your real offer next to the demo deal (clearly separated).

If any step fails, the failure is visible in the UI with the real error — no silent mock fallback.

---

## Files touched

- `src/data/sampleData.ts` — add `isDemo: true` flag, prune `recentProperties` to empty
- `src/pages/OfferIntake.tsx` — remove `MOCK_EXTRACTION`, remove silent fallback, add per-file status, navigate on success
- `src/pages/Dashboard.tsx` — show pinned demo card + real properties from DB
- `src/pages/Comparison.tsx`, `RiskScoring.tsx`, `Leverage.tsx`, `CounterStrategy.tsx`, `DeltaView.tsx`, `Report.tsx`, `SellerPortal.tsx` — replace `sampleProperty` fallbacks with `<EmptyDealState />` when no real analysis, except when viewing the demo deal
- `src/lib/offerService.ts` — add post-upload verification re-query
- `supabase/functions/extract-offer/index.ts` — return debug block + scanned-PDF warning
- New: small `DemoBanner` component shown at top of demo-deal pages

No DB migrations needed.

---

## What this does NOT include

- Live MLS / comps integration (separate plan).
- OCR for scanned PDFs (we'll warn, not silently fail).
- Multi-user collaboration or real-time updates.

Approve this and I'll implement, then you upload an offer and we'll verify it end-to-end.