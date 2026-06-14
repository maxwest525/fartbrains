## Changes

### 1. Remove search bar from Capture page (`src/pages/Index.tsx`)
Delete the search `<Input>` block inside the Capture view (lines ~322–342). Keep the wrapper minimal or remove the empty top padding container. Search is still accessible from any other view (Recents, Folders, Favorites) via the top header search.

Also remove the now-unused "Recents" pill from the desktop `navItems` array since Recent becomes a folder.

### 2. Add "Recent" virtual folder tile on Folders page (`src/components/app/FoldersPage.tsx`)
- Extend `Props` with an optional `onOpenRecent: () => void` callback.
- Prepend a non-deletable "Recent" tile to the grid, before user folders:
  - Clock icon glyph (instead of Folder) with a fixed neutral/primary hue
  - Label: "Recent"
  - Subtitle: "Recently captured" (no count, or count of all ideas — skip for v1 to avoid extra query)
  - No kebab menu (can't rename/delete)
  - Click → calls `onOpenRecent()`
- Make sure it's not filtered out by the search query (or include it when query matches "recent").

### 3. Wire it up in `Index.tsx`
Pass `onOpenRecent={() => { setView("ideas"); handleFilterChange({ kind: "recent" }); }}` to `<FoldersPage>`.

### 4. Mobile tab bar
No change — `MobileTabBar` already routes Recent through Folders implicitly via filter changes. If it currently exposes a "Recent" tab, leave it (user only asked to remove from capture top + add to folders page).

## Out of scope
- No data model changes (Recent stays a filter, not a real folder row).
- No changes to search behavior on other views.
