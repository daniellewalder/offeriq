
## Goal

Make file uploads actually work from the flow you're using right now.

## What’s happening now

Authentication is working: your account is being created and the app is signed in successfully.

The real problem is the UX and wiring:

- `/new-analysis` is the page you’re on now
- that page shows an upload dropzone, but it is only a visual placeholder
- it has no hidden file input, no `onChange`, no drag/drop handler, and no backend upload call
- the real upload logic exists in `/offer-intake`
- even there, uploads only work after creating an offer package first, and that screen defaults to the non-upload view

So from a user perspective, “upload files” appears available in the first screen, but the actual upload pipeline is somewhere else.

## Implementation plan

1. Replace the fake upload experience on `NewAnalysis`
- Remove the non-functional upload box from `src/pages/NewAnalysis.tsx`
- Turn this page into a real “create analysis” entry step, or redirect its CTA straight into the real upload workflow
- Make the primary action unambiguous: create/open an offer package and continue to uploads

2. Make the real upload screen the default upload experience
- Update `src/pages/OfferIntake.tsx` so it opens in upload mode by default instead of the “existing sample offers” view
- If there are no user-created packages yet, show the create-package UI immediately
- After package creation, keep that package selected automatically and focus the upload area

3. Eliminate the “looks clickable but does nothing” problem
- Ensure every visible upload zone has a real file input behind it
- Wire click, drag-over, and drop events consistently
- Show a clear disabled/empty-state message when uploads are blocked because an offer package does not exist yet

4. Fix the upload sequencing edge case
- Right now `handleFiles()` can run before the background `createOffer()` finishes, which triggers:
  - “Offer is still being created — please wait a moment and try again.”
- Change the flow so package creation completes before upload starts, or queue dropped files until `dbOfferId` is ready
- This removes the race condition between “create package” and “upload document”

5. Align dashboard and landing links with the real flow
- Review links that currently send users to `/new-analysis`
- Either:
  - keep `/new-analysis` but make it a real first step, or
  - route those entry points directly to `/offer-intake`
- Update empty states and CTAs so the first upload action always lands on a working uploader

6. Clean up misleading copy
- Remove placeholder/demo wording that suggests upload works where it does not
- Update max file size copy to match the actual platform limit
- Make labels clearer: “Create offer package” first, then “Upload documents”

## Files to update

- `src/pages/NewAnalysis.tsx`
- `src/pages/OfferIntake.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/EmptyDealState.tsx`
- `src/pages/Index.tsx` if its CTA should also point to the working upload flow

## Expected result

After this change, your flow will be:

```text
Sign in
→ Start new analysis
→ Create/select offer package
→ Click or drag files
→ Files upload immediately
→ Document rows show progress/success
→ Extraction can run once uploads finish
```

## Technical details

- `NewAnalysis.tsx` currently has no actual upload implementation
- `OfferIntake.tsx` already contains the real upload logic:
  - file input
  - drag/drop handlers
  - `uploadDocument()`
  - authenticated user check
  - storage + documents table insert
- The current failure is primarily flow/wiring, not account creation
- A secondary issue is the async race between package creation and file upload
- No backend schema change appears necessary for this specific issue based on the current evidence

## Success criteria

- Clicking the first visible upload area opens a file picker
- Dragging files onto the first visible upload area adds and uploads them
- No “wait and try again” race after creating a package
- Users no longer have to discover a separate hidden upload screen to make uploads work
