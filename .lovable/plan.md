## Goal

1. Make the Ash screen the homescreen with a Today panel (todos + reminders + recent ideas).
2. Replace the current sign-in screen with an Apple-style numeric passcode lock.
3. Surface the same data on the desktop app via the existing `/notes-feed` bridge.

---

## 1. Backend — `todos` table

Migration creates `public.todos`:

- `title text not null`
- `done boolean default false`
- `due_at timestamptz null`
- `completed_at timestamptz null`
- `user_id`, `created_at`, `updated_at` (with update trigger)
- RLS: owner-only
- GRANTs to `authenticated` + `service_role`

No priority, no tags, no recurrence.

## 2. Hooks (web)

`src/hooks/useTodos.ts`:
- `useTodos()` — open todos, newest first
- `useCreateTodo()` — `{ title }`
- `useToggleTodo()` — flips `done`, stamps `completed_at`
- `useDeleteTodo()`

`src/hooks/useTodayFeed.ts` aggregator returning `{ todos, reminders, recentIdeas }` for the Today panel.

## 3. `/home` route — Ash dashboard

New `src/pages/Home.tsx` mounted at `/home` and added as a "Home" item in the desktop top nav (Capture stays at `/`).

```text
┌─────────────────────────────────────────────────┐
│         What can Ash do for you today?  ◐      │
│      ┌──────────────────────────────────┐       │
│      │  Ask Ash anything…       ✨ lucky │       │
│      └──────────────────────────────────┘       │
│      [Inbox] [Pipeline] [Calendar] [Alerts]     │
│                                                 │
│ ┌─ Today ─────────────┐                         │
│ │ ☐ Gotta get milk    │                         │
│ │ ☐ Call mom  ⏰ 3pm  │                         │
│ │ 💡 3 new ideas      │                         │
│ │ + add               │                         │
│ └─────────────────────┘  (bottom-left glass)    │
└─────────────────────────────────────────────────┘
```

- Ash prompt bar (already wired to Gemini) untouched.
- `TodayPanel` is bottom-left glass card with three stacked sections, inline "+ add" for todos.
- Mobile keeps the existing capture screen — dashboard layout only renders on `md+`.

## 4. Apple-style passcode lock

Replace `src/pages/Auth.tsx`'s email/password form with a numeric passcode keypad.

UX:
- Header avatar/initial + "Enter Passcode".
- Six empty dots that fill as digits are entered.
- 3×4 keypad: `1 2 3 / 4 5 6 / 7 8 9 / · 0 ⌫`. Big round buttons, haptic-feel hover/press.
- Last button is backspace; `·` blank to mirror iOS.
- On 6 digits → auto-submit. Wrong code → red shake on the dots, clear, vibration if `navigator.vibrate` is present.
- After 5 wrong tries, lock the keypad for 30s.

How it logs in (keeps the existing single-user allowlist model):
- The passcode is **not** the Lovable Cloud password. It's a local gate that, on match, performs a `signInWithPassword` for `admin@trumoveinc.com` using a server-stored credential.
- The 6-digit code is checked against a hashed value (bcryptjs) stored in `localStorage` *and* re-derived against an `APP_PASSCODE_HASH` baked at build time via a `VITE_` var. First-run flow: if no hash exists yet, the screen says "Create Passcode" → enter twice to set.
- The Supabase email/password used to actually authenticate is set once via `VITE_APP_LOGIN_EMAIL` / a passcode-derived secret stored in Cloud — no plaintext password ships in the bundle.
- "Forgot passcode?" link wipes local hash and falls back to the existing email/password form (kept as a hidden fallback route at `/auth/email`).

New files:
- `src/components/auth/PasscodeKeypad.tsx` — keypad + dots + shake animation.
- `src/hooks/usePasscodeAuth.ts` — verify, create, lockout, sign-in glue.
- `src/lib/passcode.ts` — hash/verify helpers.

## 5. Desktop bridge — extend `/notes-feed`

`supabase/functions/notes-feed/index.ts` returns:

```json
{
  "notes":     [...existing ideas...],
  "todos":     [{ id, title, done, due_at, updated_at }],
  "reminders": [{ id, title, fire_at, source: "idea"|"folder" }],
  "cursor":    "..."
}
```

Backward compatible — old desktop clients reading only `notes` keep working.

---

## Out of scope

- Birthdays/recurrence (per your call earlier).
- Multi-user passcodes / per-profile gates.
- Two-way desktop writes.

## Files

**New**: `supabase/migrations/<ts>_todos.sql`, `src/hooks/useTodos.ts`, `src/hooks/useTodayFeed.ts`, `src/pages/Home.tsx`, `src/components/app/home/TodayPanel.tsx`, `src/components/auth/PasscodeKeypad.tsx`, `src/hooks/usePasscodeAuth.ts`, `src/lib/passcode.ts`.

**Edited**: `src/App.tsx` (add `/home`, `/auth/email` fallback), `src/pages/Auth.tsx` (swap to keypad), `src/pages/Index.tsx` (add "Home" nav item on desktop), `supabase/functions/notes-feed/index.ts`.
