
## Goal

Make the `/home` Ash surface actually capture work into the Idea Vault — not just chat. Three connected pieces:

1. A "Save to Idea Vault" button on every Ash assistant reply.
2. Auto-detection in the prompt bar so URLs and long pasted transcripts route into proper capture flows (extract → summarize → save) instead of just chatting.
3. Dedicated URL and Transcript capture screens reachable from `/home` (desktop), saving both raw text and the AI summary into a chosen folder.

## 1. "Save to Idea Vault" on Ash replies

On each assistant message in `src/pages/Home.tsx`, add a small action row (visible on hover, like Gemini) with **Save to Vault**, **Copy**, **Regenerate**.

Save flow (new hook `useSaveAshToIdea`):
- `title`: first ~80 chars of the user prompt, or AI-suggested via a quick `summarize` call (skip if reply is short).
- `raw_note`: the **user prompt** (so the question is preserved).
- `extracted_text`: the **full assistant reply** (raw).
- `ai_summary`: the assistant reply if it's already concise (<800 chars); otherwise call the existing `summarize` edge function to shorten.
- `source_type: "manual"`, `folder_id: null` (Inbox) by default, with a folder picker popover to override.
- Toast with "Saved · View" linking to `/?ideaId=...`.

## 2. Smart prompt routing on `/home`

Update `src/pages/Home.tsx` submit handler. Before calling `useAshChat.send`:

- **URL detection** — if the trimmed input is a single URL (via `normalizeUrl`), open the new **URL Capture** sheet pre-filled with that URL instead of chatting.
- **Long text detection** — if input is ≥ 400 chars or has ≥ 3 line breaks, offer an inline chip: *"Looks like a transcript — capture it?"* that opens the **Transcript Capture** screen pre-filled. Pressing Enter still chats; the chip is the opt-in.
- Otherwise: normal Ash chat (unchanged).

This keeps the chat fast for short queries but routes real "capture" intent to the proper saving pipeline.

## 3. URL Capture screen (desktop /home)

New component `src/components/app/UrlCaptureScreen.tsx` — desktop sibling of `TranscriptCaptureScreen`, mounted as an overlay sheet from `/home`.

Fields: URL (required), Title (optional), Folder picker (reuses chip strip from `TranscriptCaptureScreen`), "Save only" / "Extract & summarize" buttons.

Flow on submit:
1. Call existing `extract-url` edge function → returns `{ title, text, siteName, thumbnail, ... }`.
2. Call existing `summarize` edge function with the extracted text → concise summary + suggested title.
3. `createIdea` with:
   - `source_type: "webpage"`, `source_url`, `source_meta`
   - `extracted_text`: raw extracted text
   - `ai_summary`: AI summary
   - `raw_note`: null (URL is the user input)
   - `folder_id`: picked folder
4. Toast + close. Same "needs review" fallback as transcript flow when summary is thin.

Duplicate-URL check via existing `useDuplicateUrl` hook surfaces a warning before save.

## 4. Transcript capture from /home

`TranscriptCaptureScreen` already exists and does exactly the right thing. Surface it on `/home`:

- Add a "Paste transcript" quick pill alongside the existing pills.
- The long-text detection chip from step 2 opens the same screen with `note` prefilled.
- Reuse as-is — no logic changes.

## Technical details

**Files to create**
- `src/components/app/home/AshMessageActions.tsx` — hover action row (Save / Copy / Regenerate).
- `src/hooks/useSaveAshToIdea.ts` — orchestrates summarize + createIdea + toast.
- `src/components/app/UrlCaptureScreen.tsx` — full-screen capture overlay; structurally mirrors `TranscriptCaptureScreen`.
- `src/components/app/home/CaptureLauncher.tsx` (small) — state machine for which capture sheet (`null | "url" | "transcript"`) is open, mounted by `Home.tsx`.

**Files to edit**
- `src/pages/Home.tsx` — wire prompt detection, mount `CaptureLauncher`, render `AshMessageActions` per assistant bubble, add "Paste transcript" + "Save link" pills.
- `src/hooks/useAshChat.ts` — expose `regenerate()` (re-send last user message after popping the last assistant reply).

**No DB changes.** All required tables/columns (`ideas.extracted_text`, `ai_summary`, `source_*`) already exist. All edge functions (`extract-url`, `summarize`, `ash-chat`) already exist.

**Folder default:** Inbox (`null`). Both capture screens use the chip picker so the user can drop into any folder including "+ New folder".

**Error handling:** extraction failure → fall back to "Save only" with the URL stored and a warning toast. Summary failure → save with raw text only and mark "needs review" (matches existing transcript pattern).

## Out of scope
- Streaming the "Save to Vault" summarization (one-shot is fine, fast).
- Mobile changes — this is the desktop `/home` surface only; mobile capture stays on the existing composer.
- Auto-saving every Ash chat (only saved when user clicks Save).
