# Security review

## P0 — fixed
### 1. Authentication gate disabled; every visitor signed in anonymously  ✅ FIXED (iteration 1)
`ProtectedRoute` skipped the auth screen entirely and called
`supabase.auth.signInAnonymously()` for anyone who loaded the page. Because every
expensive edge function authorizes with `requireUser()` — which accepts *any*
valid JWT, anonymous included — unauthenticated internet traffic could spend the
account's AI, transcription and scraping budget, and the product could not be
sold at all. Now: real auth screen for signed-out visitors, no anonymous session
minting, and anonymous sessions are actively signed out.

### 2. `notes-feed` returned every tenant's data  ✅ FIXED (iteration 2)
The function queries `ideas`, `todos`, `idea_reminders` and `folders` with the
service-role key and **no `user_id` filter**, gated only by a shared
`NOTES_FEED_TOKEN`. Its own comment states the project is "effectively
single-tenant". In a multi-customer product that is a full cross-tenant dump.
Now: `requireUser()` authenticates the caller, the function runs as that user
(so RLS applies), and every query carries an explicit `user_id` filter as
defence in depth. The shared `NOTES_FEED_TOKEN` is gone — desktop pollers must
send the customer's own access token.

### 3. RLS `UPDATE` policies have no `WITH CHECK`  ✅ FIX WRITTEN, NOT YET APPLIED
`ideas`, `folders`, `calendar_events`, `idea_reminders`, `idea_references`,
`event_gifts` and `todos` define `FOR UPDATE USING (auth.uid() = user_id)` with
no `WITH CHECK`. A user can therefore update a row they own and set
`user_id` to another account, pushing rows into someone else's brain.
`supabase/migrations/20260903120000_rls_update_with_check.sql` recreates each
policy with the matching `WITH CHECK`. **This migration has not been applied** —
this session has no database access. It must be applied and then verified with
the two-account test before launch.

## P0 — open

### 4. No rate limiting or usage accounting on AI routes  ✅ FIXED (iteration 5)
Every AI edge function was unlimited per user, and `transcribe-instagram` had no
authentication at all — an unauthenticated caller could drive Apify and
ElevenLabs spend directly. All 17 paid routes now go through
`_shared/ai-guard.ts`, which authenticates the caller, resolves their plan,
enforces per-minute / per-hour / per-month weighted quotas, caps input size, and
records the call in `ai_usage_events`. Quota is reserved *before* the work runs,
so a route that crashes still counts. The table stores metadata only — never
note bodies, transcripts, prompts, completions or scraped content.
(Migration `20260903140000_ai_usage.sql` is **not yet applied**.)

## P1 — open
- ~~Wildcard CORS on all edge functions~~ ✅ pinned to `ALLOWED_ORIGIN` / `APP_URL` across all 28 functions, with `Vary: Origin`. The `*` fallback remains only for local/preview when neither is set — production **must** set one.
- ~~No security headers / CSP~~ ✅ CSP and `referrer` meta tags added to `index.html`. `frame-ancestors` / `X-Frame-Options`, `X-Content-Type-Options` and `Permissions-Policy` are header-only and still need to be set at the CDN — see `docs/DEPLOYMENT.md`.
- **Fake share links** (`?idea=<id>&collab=1`) — see Phase 10.
- **No account deletion**, so no way to honour a deletion request.
- **Markdown/HTML sanitisation** of scraped content and AI output is unverified.
- **Prompt injection** from scraped pages and transcripts is undefended.
- ~~Phone auth is exposed without a verified SMS provider~~ ✅ gated behind `VITE_ENABLE_PHONE_AUTH`, off by default.
- `check-url` performs authenticated outbound fetches; SSRF-guarded but not rate limited (P2).

## Privacy
Product analytics (`src/lib/analytics.ts`) accept a fixed event name and an
**allowlisted** set of enum-shaped properties only; everything else is dropped
before it can leave the browser, and allowlisted strings are truncated to 32
characters. No analytics or crash-reporting provider is wired yet — `track()`
and the error sink are no-ops until one is installed and reviewed, which is
deliberate: shipping without analytics beats shipping with a provider that has
not been checked for what it collects. Note that a React error message can quote
rendered content, i.e. someone's private notes, so any crash reporter must be
configured to scrub before it is enabled.

## MCP server review (added on main, reviewed 2026-09-04)

The MCP server exposes the second brain to external AI agents. Reviewed against
the same rules as the rest of the product.

**Sound as built:**
- OAuth issuer auth against the project's own Supabase issuer, audience
  `authenticated`. Every tool calls `requireAuth`.
- Tools act as the signed-in user via `supabaseForUser` (publishable key +
  the caller's bearer token), so **row level security is what scopes them** —
  not a `user_id` filter someone has to remember. No service-role key anywhere
  in the MCP path.
- `callFunction` forwards the user's token to edge functions, so `capture_url`
  and `summarize_text` pass through `guardAiRequest` like any other caller:
  authentication, rate limits and usage accounting all apply to agents too.

**Fixed in this branch:**
- `delete_idea` ran a hard `DELETE`, bypassing Trash entirely. An agent acting
  on a fuzzy instruction could permanently destroy a captured thought with no
  undo — worse than the UI path it contradicted, because a model pulls the
  trigger. Now soft-deletes, matching the app.
- `search_ideas`, `recall_context`, `get_idea` and `list_tags` did not filter
  `deleted_at`, so items a customer deleted still surfaced through their agent,
  content included. All four now exclude trashed rows.
- `list_tags` read the tags column of every row the user owned with no limit.
  Now bounded and ordered.

**Open:**
- `supabase/functions/mcp/index.ts` is generated by Lovable's Vite plugin and
  carries a do-not-edit banner, so it is the one function **not** covered by the
  `ALLOWED_ORIGIN` CORS pinning applied to the other 28. CORS is handled inside
  the library. Edit `src/lib/mcp/**` and rebuild to change it.
- The MCP tools depend on `ideas.deleted_at`, so the trash migration
  (`20260903150000_trash.sql`) must be applied **before** this branch deploys or
  every MCP read errors.
- `recall_context` pulls up to 300 rows including `extracted_text`, which can be
  large transcripts. Bounded, but worth measuring on a big vault.

## Verified good
- Owner-scoped RLS is enabled on all 15 user-owned tables.
- The service-role key is only ever read from `Deno.env` inside edge functions;
  no service-role key appears in client code.
- `_shared/ssrf.ts` exists and is used by the URL fetchers.
