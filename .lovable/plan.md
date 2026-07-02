## Goal

Replace the current single-user auto-sign-in with a proper onboarding flow:

1. **Splash** — logo + aurora background, ~1.5s
2. **Sign in / Sign up** — magic link (email only)
3. **Post-login passcode prompt** — "Add a passcode?" → Yes shows keypad to set one, Skip goes straight into the app
4. Returning users with a passcode → keypad unlock
5. Returning users without a passcode → straight into the app

## Flow

```text
/               → <ProtectedRoute>
                    ├─ splash (1.5s, first mount only)
                    ├─ if no session → <Auth /> (magic link)
                    ├─ if session + passcode set + not unlocked → <PasscodeKeypad mode="unlock">
                    ├─ if session + no passcode + not yet prompted → <PasscodeSetupPrompt>
                    │                                                   ├─ "Set a passcode" → keypad in setup mode
                    │                                                   └─ "Not now" → skip flag stored, continue
                    └─ else → app
```

## Files

**New**
- `src/components/auth/SplashScreen.tsx` — full-screen aurora + centered animated IV logo, fades out after 1.5s.
- `src/components/auth/AuthScreen.tsx` — email input, "Send magic link" button, success state ("Check your inbox"). Uses `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin }})`. Also offers a "Send me another link" resend.
- `src/components/auth/PasscodeSetupPrompt.tsx` — glass card: "Add a passcode?" · **Set passcode** / **Not now**. "Not now" stores `iv.passcode.optout.v1 = "1"`.

**Modified**
- `src/pages/Auth.tsx` — render `<AuthScreen />` instead of redirecting.
- `src/components/ProtectedRoute.tsx` — full rewrite of the gating logic below.
- `src/lib/passcode.ts` —
  - `hasPasscode()` returns `true` only when a user-set hash exists (drop the "always true" hack + `DEFAULT_PASSCODE`).
  - Add `hasOptedOut()` / `setOptedOut()` helpers backed by localStorage.
  - Restore real `verifyPasscode` against the stored hash + salt (already implemented; just stop short-circuiting on `DEFAULT_PASSCODE`).
- `src/components/auth/PasscodeKeypad.tsx` — accept an explicit `mode: "setup" | "unlock"` prop instead of inferring from `hasPasscode()`, and hide "Forgot passcode?" in setup mode.

## ProtectedRoute rewrite (order matters)

1. Show `<SplashScreen />` for 1500ms on first mount (guard with a `sessionStorage` flag so intra-session route changes don't replay it).
2. Wait for `useAuth()` to resolve.
3. No session → `<AuthScreen />`.
4. Session + `hasPasscode()` + `!isUnlocked()` → `<PasscodeKeypad mode="unlock">`.
5. Session + `!hasPasscode()` + `!hasOptedOut()` → `<PasscodeSetupPrompt>`.
   - "Set passcode" → `<PasscodeKeypad mode="setup">` → on success continue into app.
   - "Not now" → `setOptedOut()` → continue.
6. Otherwise → render `children`.

Also handle the magic-link return: Supabase drops the user back at `/` with a hash containing the session, so `useAuth` will hydrate automatically — no extra callback route needed.

## Magic link setup

Uses the existing Lovable Cloud auth. No provider config needed — email OTP/magic link works out of the box. Redirect URL is `window.location.origin`, so the same flow works on preview and production.

Auth emails will use the default Lovable template unless you also want branded emails — I'll leave that alone unless you ask, since it requires setting up an email domain.

## Open questions

1. Should the "Not now" opt-out persist forever, or re-prompt next session? (My default: persist — user can add one later from Settings.)
2. Should signed-in users be able to sign out? Right now there's a sign-out button in the top nav — I'll keep it working and route them back to `<AuthScreen />` after.
3. Keypad length is currently 4 digits (constant says 4, subtitle says 6 — mismatch). I'll standardize on **4 digits** and fix the subtitle copy.
