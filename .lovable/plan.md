
## Goal
Turn the Capture page into a real funnel entry: paste a URL or type an idea → extract → generate prompt → chat with the result inside a branded in-app assistant. Lock V1 scope so nothing ships half-wired.

---

## V1 (build now)

### 1. Homepage URL capture → idea record
- Add a URL input directly on the Capture screen (above the orb), with an "Extract" button.
- Server: reuse `scrape-url` edge function. Save returned `markdown` to `ideas.extracted_text`, `summary` to `ideas.ai_summary`, title from page metadata.
- New idea is created immediately in `Ideas` folder with `source_type='url'` and `source_url`. Toast: "Saved. Ready to prompt."
- Works with **or without** an idea note. If both URL and note are filled, both are stored on the same idea.

**Artifact:** `UrlQuickCapture.tsx` mounted in `Index.tsx` above `VoiceOrb`. **Done when:** pasting a URL creates an idea row with non-empty `extracted_text` and the user lands on the idea detail.

### 2. "Generate Prompt" step (already exists — wire it as the funnel step)
- Existing `generate-prompt` function already accepts `note + summary + extractedText`. Keep it.
- Promote the Generate Prompt button to the **primary CTA** on a newly-created idea (top of detail, full-width gradient).
- Add a 2-input MVP shortcut on the Capture page: if user filled BOTH idea note AND URL, auto-call `generate-prompt` after extraction completes and show the result inline with "Open chat with this prompt" CTA.

**Artifact:** updated `IdeaDetail.tsx` + new auto-prompt branch in `UrlQuickCapture`. **Done when:** the generated prompt appears within ~5s of extraction in the 2-input path.

### 3. Branded in-app chat ("Ash")
- Reuse existing `AshDock` + `ash-chat` edge function (already streams via Gemini).
- New entry path: "Open chat with this idea" button on idea detail → opens AshDock pre-seeded with a system message containing the idea's `extracted_text` + `ai_summary` + generated prompt.
- Add a small "Save reply to idea" action on each Ash assistant message (already partially in `useSaveAshToIdea` — wire it to append to the current idea).
- No model picker in V1 — default `google/gemini-3-flash-preview`.

**Artifact:** updated `AshDock.tsx` with seeded-context mode. **Done when:** clicking "Chat with this idea" from a detail opens Ash with context loaded and first reply streams.

---

## V2 (defer — do not build now)

Explicitly out of V1 so we don't ship dead buttons:
- **Deep research** (multi-source synthesis) — keep `deep-research` function but hide the UI button until V2.
- **Citations panel** — defer.
- **Competitor analysis** — defer.
- **Vertex grounding / branded search** — defer (requires Google Cloud project + billing).
- **Image generation** — defer; see workflow map below.
- **Video generation** — defer; see workflow map below.
- **Per-user billing / friend access gating** — defer (separate plan when you're ready).

---

## Media generation workflow (mapped, not built)

Documenting now so when you say "build it" we don't redesign:

**Image gen flow**
1. Input: user clicks "Generate image" on an idea → modal with prompt prefilled from idea title + summary.
2. Refine: user edits prompt; optional style chips (photoreal, illustration, diagram).
3. Generate: edge function `generate-image` calls Lovable AI `google/gemini-3-flash-image` (Nano Banana).
4. Storage: upload returned bytes to new `idea-media` bucket → insert row in new `idea_media` table (`idea_id`, `kind='image'`, `storage_path`, `prompt`, `model`).
5. Display: gallery section on idea detail, click to enlarge, download, regenerate.

**Video gen flow** (same shape, heavier)
1. Input: "Generate video" → modal w/ prompt + duration (4s/8s) + aspect ratio.
2. Generate: edge function `generate-video` calls a video model (TBD — needs connector; flag this as a V2 dependency to pick provider).
3. Storage: same `idea-media` bucket, `kind='video'`, plus poster frame.
4. Display: inline `<video>` player in detail with download.

**V2 prerequisites to confirm before building media:**
- Pick video provider (Veo via Vertex? Runway? Pika?).
- Confirm `idea_media` table + `idea-media` storage bucket schema.
- Decide if media generation is gated/billed.

---

## Technical notes
- DB: no new tables for V1. Reuse `ideas.extracted_text`, `ai_summary`, `source_url`, `source_type`.
- Edge functions: no new ones for V1 — `scrape-url`, `generate-prompt`, `ash-chat` already exist.
- Auth: nothing new; existing protected route covers it.
- New code: `UrlQuickCapture.tsx`, small edits to `Index.tsx`, `IdeaDetail.tsx`, `AshDock.tsx`.

---

## Order of build (when you approve)
1. `UrlQuickCapture` on homepage + idea record creation.
2. Auto-generate-prompt when both inputs present.
3. "Chat with this idea" → seeded AshDock.
4. Hide V2 surfaces (deep research, citations, media buttons) behind a feature flag so the UI stays honest.

Reply **"go"** to switch to build mode and ship V1 in this order, or tell me what to cut/add first.
