## Goal

Stop the chat input from getting tall. It should grow to at most 2 lines (~48px), then scroll inside the box so the cursor stays reachable without making the composer bigger.

## Changes

**`src/components/app/AshDock.tsx`** (the `textarea` at line 425):
- Replace the existing auto-grow `useEffect` so it caps height at `48px` (2 lines × 24px `leading-6`) instead of `160px`.
- Update className: drop `max-h-40`, add `max-h-12 overflow-y-auto`.

**`src/components/app/home/AshChatPanel.tsx`** (the `Textarea` at the composer):
- Same treatment on `inputRef`: auto-grow `useEffect` capped at `48px`.
- Update className: change `min-h-[44px] max-h-40` → `min-h-[44px] max-h-12`, add `overflow-y-auto`.

That's it — no other behavior changes, no layout changes around the composer.
