## The actual problem

`ComposeIdea` (the main composer at the top of Capture) already exposes every input type via its `SourcePicker`: Note, Project, Instagram, **Link**, List, **Transcript**. Tapping any tile swaps the composer body to the right input (URL field, transcript textarea, note field, etc.) and runs the same extract → preview → save flow.

Underneath that composer we currently render two more surfaces doing the exact same jobs:

1. `UrlCapturePanel` — a giant always-expanded card that duplicates the Link tile.
2. A "Paste a transcript" row that pushes a full-screen `TranscriptCapture` page that duplicates the Transcript tile.

That's why every page loads with this big stack of redundant capture cards. Fix: delete the duplicates, lean on the composer's source picker as the single source of truth.

## Changes

**1. Remove the duplicate surfaces from the Capture view**
In `src/pages/Index.tsx`:
- Delete the `<UrlCapturePanel ... />` block (around lines 297–310).
- Delete the "Paste a transcript" row button (around lines 312–329).
- Delete the import of `UrlCapturePanel`.
- Delete the `view === "transcript"` branch (lines 22, 96–99, 103, 242–252) and the `TranscriptCapture` import — it's no longer reachable from the UI.
- Keep the small footer hint ("Saved ideas land in Recents and the All folder.") right under the composer.

**2. Make sure the composer is the obvious entry point**
- Verify `ComposeIdea`'s `SourcePicker` is visible immediately on the Capture screen (it is — it sits at the top of the composer card). No layout change needed.
- Optional polish: if the source picker scrolls horizontally on mobile, confirm Link / Transcript / Instagram tiles are visible without scrolling, or reorder so the most-used ones lead.

**3. Delete dead files**
- `src/components/app/UrlCapturePanel.tsx` — no remaining references.
- `src/components/app/TranscriptCapture.tsx` — no remaining references.
- Run a quick `rg` to confirm nothing else imports them before deletion.

## Result

Capture screen becomes: movie ticker → search → **one** composer (with the source picker that handles Link, Transcript, Instagram, Note, List, Project) → small hint line → tab bar. Every input type is reachable in one tap from the same place, and the page stops repeating itself.

## Files touched

- `src/pages/Index.tsx` (remove duplicate panel, transcript row, transcript view branch + imports)
- `src/components/app/UrlCapturePanel.tsx` (delete)
- `src/components/app/TranscriptCapture.tsx` (delete)
