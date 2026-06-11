## Goal

Make `/` the single command center: Ash chat thread on top, vault list underneath. Kill `/home`, remove dead nav, verify captures actually persist, and make "Save to Vault" feel instant.

## 1. Delete `/home` route and any dead nav

- `src/App.tsx`: remove the `/home` Route entry and the `Home` import.
- `src/pages/Home.tsx`: delete the file (the redirect shim is no longer needed once the route is gone).
- `src/pages/Index.tsx`: remove the now-unused `Home as HomeIcon` and `useNavigate` imports. (The "Home" nav button was already removed; just clean leftover imports.)
- Grep-confirm: no remaining `/home`, `navigate("/home")`, or `HomeIcon` references anywhere in `src/`.

## 2. Merge the Ash chat thread into `/`

The Ash chat thread currently only lived in `Home.tsx`. `AshDock` is just a floating *capture composer* — it has no chat thread. To honor "the Ash chat thread and the idea vault list together," port the chat thread into the Capture view of `/`.

- New component `src/components/app/home/AshChatPanel.tsx`:
  - Wraps `useAshChat` (prompt input + streaming reply + reset + stop + regenerate).
  - Renders the conversation thread with user/assistant bubbles.
  - Shows `AshMessageActions` under each assistant reply (Save / Copy / Regenerate).
  - Empty state: orb + one-line hint + suggestion chips ("Summarize this URL…", "Save this idea…").
  - Auto-detects URLs / long pasted text in the input and opens the matching capture sheet via callbacks (`onOpenUrlCapture`, `onOpenTranscriptCapture`) — same routing logic that used to live in `Home.tsx`.
- `src/pages/Index.tsx` (Capture view block, `filter.kind === "all"`):
  - Replace the current `<VoiceOrb />` block with a vertical stack:
    1. `<AshChatPanel />` (top, ~55% of viewport, scrollable thread + sticky composer).
    2. Below it: a compact "Recently captured" vault strip (latest 6 ideas via existing `useIdeas({kind:"recent"})`) so saves appear immediately under the chat. Click → opens IdeaDetail (reuse existing `selectedId` state).
  - Keep the existing search bar at the top of the Capture view.
  - VoiceOrb moves into AshChatPanel's composer footer (mic affordance next to the send button).

## 3. Wire "Save to Vault" so the saved idea appears immediately

`useSaveAshToIdea` already calls `createIdea` (which invalidates the ideas query). What's missing is the *visible feedback* in the merged UI.

- After `save()` resolves with an `idea`, `AshChatPanel` calls a new `onSaved(idea.id)` prop.
- `Index.tsx` handles it by:
  - Selecting the saved idea (`setSelectedId(idea.id)`) on desktop so the right pane opens it.
  - On mobile: keep the existing sonner toast with a "View" action that selects the idea.
- The "Recently captured" strip directly below the chat will re-render with the new idea on top (React Query invalidation handles this automatically — no extra wiring).

## 4. Verify URL and transcript capture flows

The capture screens already exist and are wired correctly (`UrlCaptureScreen`, `TranscriptCaptureScreen`):
- URL flow: `extract-url` edge fn → `extracted_text` → `summarize` edge fn → `ai_summary` → `createIdea` with `source_type: "webpage"`, `folder_id`.
- Transcript flow: pasted text → `raw_note` + `extracted_text` → `summarize` → `ai_summary` → `createIdea` with `source_type: "transcript"`, `folder_id`.

What this plan adds is **end-to-end verification** after the merge:
- Both sheets are launched from `AshChatPanel` (URL paste auto-detect, transcript via "Paste transcript" chip).
- `onCreated(ideaId)` callback from each sheet is wired in `Index.tsx` to `setSelectedId(ideaId)` so the saved idea opens immediately in the vault detail pane.
- Manual test checklist after the change:
  1. Paste a URL in the Ash composer → URL sheet opens prefilled → Extract & summarize → toast + idea appears in Recently-captured strip + opens in detail pane.
  2. Paste long text → transcript sheet opens prefilled → Summarize & save → same verification.
  3. Send a normal chat message → click Save to Vault on the reply → idea appears in the strip and opens in detail.
  4. Reload `/` — saved ideas persist (already covered by existing `useIdeas` query).

## Files

**Edited:** `src/App.tsx`, `src/pages/Index.tsx`
**Created:** `src/components/app/home/AshChatPanel.tsx`
**Deleted:** `src/pages/Home.tsx`

## Out of scope

- No DB schema changes (all required columns and edge functions already exist).
- No changes to `AshDock` (the floating quick-capture dock stays as-is for non-chat surfaces).
- No changes to `useAshChat`, `useSaveAshToIdea`, `extract-url`, `summarize`, or `ash-chat` edge functions.
