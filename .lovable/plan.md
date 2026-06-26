## Fix list

1. **Related ideas → "Idea node match"**
   - Verify `supabase/functions/related-ideas/index.ts` uses hybrid scoring (tag overlap + AI/embedding similarity), not random.
   - Ensure `RelatedIdeas.tsx` header reads "Idea node match" / "Related nodes" and shows match reason.

2. **All cards in Idea Detail collapsible**
   - Audit `IdeaDetail.tsx` and wrap every section (Note, Generate Prompt, Summary, Raw text, References, Research, Related nodes, Cross-pollination, Tags, Reminders) in `CollapsibleSection` with default-collapsed for secondary cards so the page returns to its original compact size.

3. **Remove pill styling**
   - Strip `rounded-full`/`border`/`bg-*` chrome from the Generate Prompt button and any remaining pill wrappers in `ComposeIdea.tsx`, `IdeaDetail.tsx`, `IdeaReferences.tsx`, `RelatedIdeas.tsx`. Keep them as plain text + icon.

4. **Restore idea input box on Capture**
   - `src/pages/Index.tsx` Capture view is missing the compose textarea. Re-mount `ComposeIdea` (note + prompt fields) above `VoiceOrb` so users can type ideas again.

5. **Restore keypad background**
   - `PasscodeKeypad.tsx` / `Auth.tsx`: re-apply the original ambient gradient background layer (matching `body::before` orbs) so the lock screen isn't flat.

6. **Remove timestamps from Created/Updated**
   - In `IdeaDetail.tsx`, format dates as date-only (e.g. `Jun 26, 2026`) — drop `HH:mm`.

7. **Enlarge keypad on mobile web**
   - `PasscodeKeypad.tsx`: increase button size with `aspect-square` + `clamp(64px, 22vw, 96px)` and bump font-size + dot size so it fills the full mobile viewport.

## Out of scope
No changes to Graph, Calendar, AshDock, or edge function infra beyond `related-ideas` verification.
