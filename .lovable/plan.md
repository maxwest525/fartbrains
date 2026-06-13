## Auto-link recommendations on saved ideas

When an idea is saved, detect specific things the source recommends (tools, products, repos, books, channels) and resolve each to one clickable URL. Show them in a new "Links & references" section on the idea detail page.

### Detection + resolution pipeline

New edge function `extract-references` runs once per idea, fire-and-forget after save.

1. **LLM extraction (Lovable AI, gemini flash lite).** Input = title + extracted_text + ai_summary. Output = JSON array of distinct, *specific* recommendations:
   ```
   [{ name: "LibreChat", kind: "github_repo|tool|product|site|book|channel|paper|other", query: "LibreChat github" }]
   ```
   Cap at 8 items.

2. **Skip-list rule (the new constraint).** The system prompt explicitly tells the model:
   - Do NOT extract generic platforms when they're just mentioned in passing: `Google, ChatGPT, Claude, GitHub, YouTube, Twitter/X, Reddit, Facebook, Instagram, TikTok, LinkedIn, Wikipedia, Gmail, Notion, Slack, Discord, Microsoft, Apple, OpenAI, Anthropic`.
   - These are only allowed when they are the *specific subject* of the recommendation — e.g. "check out the new Claude Sonnet 4.5 release notes" → keep with a specific URL; "I asked ChatGPT" → skip.
   - For a specific item *hosted on* one of these (e.g. a particular GitHub repo, a particular YouTube channel/video), keep it but the `query` must include the unique identifier (repo name, channel name, video title) — never just "github" or "youtube".
   - Also enforced server-side: after extraction, drop any item whose `name` (case-insensitive, trimmed) exactly matches the skip-list.

3. **Resolve each item to one URL:**
   - Try Firecrawl `/v2/search` with `limit: 1` using the `query` field. Take the top organic result.
   - If `FIRECRAWL_API_KEY` is missing OR Firecrawl errors / returns 0 results: fall back to a second AI call asking for the single most likely official URL. Mark `source: "ai_guess"` so UI can show a subtle "best guess" badge.

4. Persist results in `idea_references` (delete-then-insert per idea so re-runs don't duplicate).

### Database

New table `public.idea_references`:
- `id`, `user_id`, `idea_id` (fk → ideas, cascade)
- `name`, `url`, `title`, `description`, `kind`, `source` (`firecrawl` | `ai_guess`), `position`
- `created_at`

RLS: users manage their own rows by `user_id`. GRANTs to authenticated + service_role.

### Trigger points

- **On save:** `useCreateIdea` and `useSaveAshToIdea` fire `supabase.functions.invoke("extract-references", { body: { ideaId } })` after the insert succeeds. No UI block.
- **Manual refresh:** small "Find links" button in the section header re-invokes.

### UI: `<IdeaReferences ideaId={...} />`

Mounted inside `IdeaDetail`, just above `RelatedIdeas`. Mirrors `RelatedIdeas` patterns:
- React Query against `idea_references`.
- Hidden entirely when 0 rows and not running.
- Skeleton row "Finding links…" while extracting.
- Each row: kind-aware icon, name, optional 1-line description, opens URL in new tab. `ai_guess` rows get a tiny "best guess" tag.
- Style matches the existing glass/neon detail-view aesthetic.

### Files

New:
- `supabase/migrations/<ts>_idea_references.sql`
- `supabase/functions/extract-references/index.ts`
- `src/components/app/IdeaReferences.tsx`
- `src/hooks/useIdeaReferences.ts`

Edited:
- `src/hooks/useIdeas.ts` — invoke after create
- `src/hooks/useSaveAshToIdea.ts` — invoke after save
- `src/components/app/IdeaDetail.tsx` — mount `<IdeaReferences />`

### Notes

- Firecrawl connector needs to be linked for the high-quality path; without it the feature still works via AI guess.
- Function is idempotent and only runs on save / manual refresh — not on every detail view.