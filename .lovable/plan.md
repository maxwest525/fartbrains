## Restrict AshDock to the Capture page only

Right now AshDock shows on the Capture page **and** on the browse list (Recent, Favorites, folder view, search results). You want it strictly on Capture — everywhere else (folders, calendar, graph, browse list, inside an idea) should have no dock. The "Ask Ash" experience inside an idea already lives on its own sub-page (`IdeaChatScreen` with suggested prompts), which stays untouched.

### Change

In `src/pages/Index.tsx`, tighten the AshDock render gate so it only mounts on Capture:

```tsx
{view === "ideas" &&
  filter.kind === "all" &&
  selectedId === null && <AshDock />}
```

That single condition change removes the dock from:
- Recent / Favorites / Folder / Search browse list
- Folders, Calendar, Graph pages (already hidden, kept hidden)
- Any open idea on mobile or desktop (already hidden, kept hidden)

### Out of scope

- `IdeaChatScreen` and the in-idea **Chat** button — unchanged.
- Composer styling, suggested prompts, VoiceOrb — unchanged.
- The floating `+` FAB on browse views — unchanged.