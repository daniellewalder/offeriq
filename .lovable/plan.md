
## Why uploads don't work

The upload pipeline is fully wired — the Supabase storage bucket `offer-documents` exists with correct RLS, and `uploadDocument()` in `src/lib/offerService.ts` does the right thing. The problem is upstream:

**The app has no authentication.** There is no `/auth` route, no sign-in screen, no sign-up. `App.tsx` drops you straight onto the dashboard. When `OfferIntake` calls `supabase.auth.getUser()`, it returns `null`, the code shows a "Not signed in" toast, and the upload silently falls back to a fake progress simulation that never touches storage or the database.

Storage RLS requires `auth.uid()` to match the first folder of the upload path. With no logged-in user, every real upload is rejected.

## What I'll build

### 1. Auth page (`/auth`)
- New `src/pages/Auth.tsx` with tabs for Sign in / Sign up (email + password).
- Uses `supabase.auth.signUp` and `supabase.auth.signInWithPassword`.
- Sets `emailRedirectTo: ${window.location.origin}/dashboard` on signup.
- On success, navigates to `/dashboard`. Premium styling matching the existing OfferIQ design tokens.

### 2. Auto-confirm email signups
- Configure auth so users can sign in immediately without verifying email — the prototype stays usable with no inbox round-trip.

### 3. Route protection
- New `src/components/ProtectedRoute.tsx` that subscribes to `onAuthStateChange` first, then calls `getSession()` (correct order), and redirects to `/auth` if no session.
- Wrap every workspace route in `App.tsx`: `/dashboard`, `/new-analysis`, `/offer-intake`, `/comparison`, `/risk-scoring`, `/priorities`, `/leverage`, `/counter-strategy`, `/delta-view`, `/buyer-readiness`, `/report`.
- Leave public routes alone: `/`, `/auth`, `/portal/:token`, `/portal/:token/present`, `/seller-report/:token`.

### 4. Wire the sidebar to the real user
- `AppLayout.tsx` currently hardcodes "DW / Danielle Walder / Coldwell Banker". Replace with the logged-in user's email + initials from `supabase.auth.getUser()`.
- Sign-out button calls `supabase.auth.signOut()` then navigates to `/auth`.

### 5. Fix `OfferIntake` upload UX
- Remove the silent "fall back to fake simulation" path. If upload fails, surface the real error in a toast instead of pretending it worked. Keep the real upload path (which already works once a user is signed in).

## Files

- **Create:** `src/pages/Auth.tsx`, `src/components/ProtectedRoute.tsx`
- **Edit:** `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/OfferIntake.tsx`
- **Backend:** enable auto-confirm email signups

## Note on user profiles

This plan does NOT create a `profiles` table — the sidebar will show email + initials derived from `auth.users` directly. If you later want display names, avatars, brokerage, or roles, we can add a `profiles` table with an auto-create trigger as a follow-up.

## Result

Open the app → redirected to `/auth` → sign up with email/password → land on dashboard → go to Offer Intake → uploaded documents actually persist to Supabase storage and the `documents` table, tied to your user.
