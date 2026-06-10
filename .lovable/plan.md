## What you'll get

A full-screen **graph overlay** you can pop open from anywhere in the app. Every idea is a node. Connections come from three layers you can toggle on/off:

1. **Folder edges** — idea → its folder (folder nodes are larger)
2. **Tag edges** — ideas sharing a tag connect through a tag node
3. **AI relation edges** — uses your existing `related-ideas` function to draw semantic links between ideas (this is the "crazy connections" web)

The whole thing is a physics simulation — drag nodes, pinch to zoom, nodes repel each other, linked nodes pull together. Same vibe as Obsidian's graph.

### The voice orb
A **glowing animated orb** floats in the bottom-center of the canvas, always pulsing.
- **Tap & hold the orb** → records voice → transcribes → creates a new idea node that animates into the graph and auto-links to anything semantically related.
- **Tap & hold any idea node** → records voice → appends transcript to that idea (long-press, so single-tap is still "focus this node").
- A subtle ring around the orb fills while recording; release to stop.

### Where it lives
A "Graph" button on the home header opens it as a **full-screen overlay** (not a new tab). Close button top-right. Works in both mobile and desktop.

## Technical details

**Library:** `react-force-graph-2d` — Canvas-based, handles thousands of nodes smoothly on mobile, supports custom node painting (for the pulsing voice node, idea thumbnails, folder icons).

**Data:**
- New hook `useGraphData()` builds `{ nodes, links }` from existing `ideas`, `folders`, and shared tags — pure client-side, no migrations.
- AI edges: new edge function `idea-graph-edges` that batches `related-ideas` for every idea and caches results in a new `idea_relations` table (`source_id`, `target_id`, `score`). Recomputed lazily / on demand.

**Voice:** reuses existing `useVoiceCapture` hook and `transcribe-deliverables` / summarize pipeline that already powers your compose flow.

**Files added:**
- `src/components/app/GraphOverlay.tsx` — the canvas + orb + node interactions
- `src/components/app/VoiceOrb.tsx` — the pulsing record button (SVG + Framer Motion)
- `src/hooks/useGraphData.ts` — assembles nodes/edges from ideas/folders/tags/relations
- `supabase/functions/idea-graph-edges/index.ts` — batch semantic-link builder
- migration: `idea_relations` table + RLS + grants

**Files edited:**
- `src/pages/Index.tsx` — Graph button + overlay mount
- `package.json` — add `react-force-graph-2d` + `d3-force`

```text
┌─────────────────────────────────────────┐
│  ✕                            Filters ▾ │
│                                         │
│     ●───●         ●─────●               │
│    /│   │        /       \              │
│   ● │   ●───────●    ●────●             │
│    \│  /              \   │             │
│     ●─●                ●──●             │
│                                         │
│                  ╭───╮                  │
│                 │ 🎙  │  ← pulsing orb  │
│                  ╰───╯                  │
└─────────────────────────────────────────┘
```

## On agent-memory MCP (no code yet — your call)

The `agent-memory` skill is a separate Node.js MCP server that runs **on your laptop** and stores its own memories in a local file. It's not designed to plug into a hosted web app like yours. Two real ways to get the same effect:

### Option A — Expose Idea Vault itself as an MCP server (recommended)
Your ideas already ARE your memory. I'd build a `vault-mcp` edge function that speaks the MCP protocol over HTTP, with tools:
- `search_ideas(query, tags?)`
- `read_idea(id)`
- `write_idea(title, body, tags?)`
- `list_folders()`

Then Claude Desktop / ChatGPT / Cursor / Codex CLI can all read & write your vault as long-term memory. One auth token, hosted, nothing to run locally.

### Option B — Run the upstream agent-memory locally
Clone `webzler/agentMemory` on your Mac, point it at a folder, and your local AI tools get a separate memory bank. Doesn't talk to this app at all.

### Option C — Both
Idea Vault as the canonical store via Option A, optionally mirror into a local MCP for offline.

**My recommendation:** ship the graph + orb now, then add Option A as a second pass once you've used the graph for a week and know what shape the MCP tools should take.

## Out of scope (intentionally)
- No MCP server in this pass
- No rewrite of the rest of the UI — the graph is a layover as you said
- No real-time collaboration on the graph