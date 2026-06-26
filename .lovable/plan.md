## Changes

### 1. Restore the text idea composer on Capture
The Capture view in `src/pages/Index.tsx` currently shows only the `VoiceOrb` — the typed idea input is gone. Mount `ComposeIdea` above the orb so users can type/paste a quick idea again. Keep the orb directly under it.

### 2. Smarter related-ideas picker → "Related nodes"
Rework `CrossPollination` + `RelatedIdeas` into a single section called **Related nodes** in `IdeaDetail.tsx`:
- Remove the random `CrossPollination` block.
- Upgrade `supabase/functions/related-ideas/index.ts` to score candidates by:
  - tag overlap (Jaccard on `tags`)
  - shared folder bonus
  - shared `idea_references` host bonus
  - then ask the LLM to re-rank/justify the top ~15 prefiltered candidates rather than seeing the whole library.
- Return top 5 with a one-line reason each.
- Rename UI heading from "Related ideas" to **Related nodes** and add a small refresh button (replaces the "Surprise me" affordance).

### 3. All cards in idea collapsible to original size
In `IdeaDetail.tsx`, wrap each `<section>` (Note/Checklist/Project, Ready-to-paste prompt, Summary, Research, References, Related nodes, Original extracted text) in a `<Collapsible>` (from `@/components/ui/collapsible`). The section header becomes the trigger with a chevron; default open; collapsed state per-section persisted in `localStorage` keyed by `idea.id + section`.

### 4. Remove pills around "Generate prompt"
In the Ready-to-paste prompt header in `IdeaDetail.tsx`, replace the `Button variant="outline"`/`ghost` rounded-full pills (Copy, Generate prompt/Regenerate) with plain icon+label text buttons (no border, no background, no rounded-full). Same treatment for the Summary "Regenerate" button and the Related-nodes refresh.

### 5. Remove timestamps from Created/Updated
In `IdeaDetail.tsx`, change `new Date(...).toLocaleString()` → `toLocaleDateString()` for both Created and Updated.

### 6. Restore keypad background + size on full mobile web view
In `src/components/ProtectedRoute.tsx`, the keypad screen currently uses its own local radial gradient. Drop the custom `bg-[radial-gradient(...)]` from the `<main>` so it inherits the global app background (the same one used everywhere else after the recent change). Keep the ambient blurred orbs.

In `src/components/auth/PasscodeKeypad.tsx`, size up for full mobile web:
- Keys: `h-16 w-16 text-[26px]` → `h-[72px] w-[72px] text-[30px]` on `sm` and below; scale dots from `h-3.5 w-3.5` → `h-4 w-4` with `gap-5`.
- Increase grid gap from `gap-4` → `gap-5`.
- Container `max-w-sm` → `max-w-md` in `ProtectedRoute.tsx` so the bigger keypad fits.

## Technical notes

- `related-ideas` function: keep the same response shape `{ related: [{ id, title, reason }] }`. Add server-side prefilter using a SQL query selecting `id, title, tags, folder_id` plus a join to `idea_references(host)`; compute overlap in TS, then send top 15 to the LLM with the target idea for re-ranking.
- `RelatedIdeas.tsx` keeps current UI but: heading text "Related nodes", add small refresh icon button (no pill styling), invalidate the react-query key on click.
- Collapsible persistence helper: small inline `useCollapsed(ideaId, key)` hook in `IdeaDetail.tsx`.
- No DB schema changes.
