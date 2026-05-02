## Goal

Let you capture a **named project** (e.g. "TruMove") whose content is a list of **typed deliverables** — not just plain to-dos. Each item is one of: task, buy, build, order, meeting, call, research, ship, decide, other. The result is a single idea that renders as a grouped board, with quick-add per type.

No backend schema changes — we reuse the existing `ideas` table by storing the deliverables as structured markdown inside `raw_note`, and tagging the idea with `project` so it gets special rendering.

---

## UX

### 1. New "Project" source in the composer

Add a **Project** tile to `SourcePicker` (alongside Note, Instagram, Link, List, Transcript). Selecting it shows:

- **Project name** input (required) — becomes the idea title.
- **Quick-add row**: a type chip selector (Task · Buy · Build · Order · Meeting · Call · Research · Ship · Decide · Other) + text field + Enter to add. Items pile up below as a live preview list grouped by type.
- **Folder** chips (existing).
- Save button: "Create project".

The composer writes one idea with:
- `title` = project name
- `tags` = `["project"]`
- `source_type` = `"manual"`
- `raw_note` = structured markdown (see Technical section)

### 2. Project rendering in the idea detail

When an idea has the `project` tag, `IdeaDetail` swaps the plain checklist for a **Deliverables board**:

- Items grouped by type, each group with its colored icon (Buy = orange cart, Build = blue hammer, Meeting = purple calendar, etc.) and a count badge.
- Each row: checkbox · type chip · text · optional inline edit/delete on hover (desktop) or swipe (mobile).
- A persistent **"+ Add deliverable"** row at the bottom of each group, plus a global add at the top with the same type-chip + text composer used in capture.
- Toggling a checkbox or adding/editing/deleting an item updates `raw_note` in place (same pattern as today's checklist toggle).
- Progress bar at top: "7 of 18 done".

### 3. Idea list affordance

In `IdeaList`, project ideas get a small "Project · 7/18" badge next to the title so they stand out from regular notes. The existing `list` icon style is reused for the row icon tone.

### 4. Folder view

No structural change to folders, but if a folder contains one or more project ideas, they render at the **top of the folder list** in a thin "Projects" group (same row component, just hoisted) so they act as the spine of the folder.

---

## Technical

### Storage format (in `raw_note`)

Deliverables are stored as a GFM checklist where each line carries a type prefix in bold-square-brackets so today's checklist toggler keeps working:

```
- [ ] **[buy]** Order resistance bands
- [x] **[meeting]** Kickoff with Sara
- [ ] **[build]** Landing page hero section
- [ ] **[task]** Write copy for FAQ
```

- The line regex used by `IdeaDetail`'s existing `toggleItem` (`/^(\s*- \[)([ xX])(\] )(.*)$/`) still matches, so the basic toggle keeps working as a fallback even on older clients.
- A new parser splits `m[4]` on the leading `**[type]**` token to extract `{ type, text }`.

### New files

- `src/components/app/ProjectComposer.tsx` — used inside `ComposeIdea` when `source === "project"`. Owns the type-chip selector, draft items list, and serialises to the markdown above on save.
- `src/components/app/ProjectBoard.tsx` — used inside `IdeaDetail` when `idea.tags.includes("project")`. Renders grouped deliverables, handles add/toggle/edit/delete by rewriting `raw_note` via `useUpdateIdea`.
- `src/lib/deliverables.ts` — shared `DELIVERABLE_TYPES` constant (key, label, icon, tone), `parseDeliverables(raw_note)`, and `serializeDeliverables(items)`.

### Edited files

- `src/components/app/SourcePicker.tsx` — add `project` tile (enabled).
- `src/components/app/ComposeIdea.tsx` — branch to `ProjectComposer` when `source === "project"`; on save, set `tags: ["project"]` and bypass the AI summary path.
- `src/components/app/IdeaDetail.tsx` — when `idea.tags.includes("project")`, render `ProjectBoard` in place of the current checklist/note section.
- `src/components/app/IdeaList.tsx` — show "Project · X/Y" badge for tagged ideas (mobile + desktop rows).

### No DB migration

- `tags` is already `text[]` on `ideas`, so `["project"]` works today.
- No new columns, no RLS changes, no edge-function changes.

### Out of scope (can follow up)

- Promoting a single deliverable to its own full idea.
- Per-deliverable due dates / reminders (currently project-level only via existing `remind_at`).
- Drag-to-reorder between groups.

---

## Diagram

```text
Capture
 └─ [Project] tile selected
     ├─ Name: "TruMove"
     ├─ Folder: TruMove (chip)
     └─ Quick-add: [Buy ▾] "Resistance bands"  ⏎
                   ↓ live preview
                   Buy   · Resistance bands
                   Build · Landing hero
                   Meet  · Kickoff w/ Sara
     [ Create project ]

Idea detail (project)
 ┌──────────────────────────────────────┐
 │ TruMove                    7 / 18 ✓  │
 │ ███████░░░░░░░░░░  39%               │
 ├──────────────────────────────────────┤
 │ Buy (3)                              │
 │  ☐ Resistance bands                  │
 │  ☑ Yoga mats                         │
 │  + add buy                           │
 │ Build (5)                            │
 │  ☐ Landing hero                      │
 │  …                                   │
 │ Meeting (2) · Order (1) · Task (7)   │
 └──────────────────────────────────────┘
```
