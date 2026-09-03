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
- **Wildcard CORS** (`Access-Control-Allow-Origin: *`) on all 26 edge functions.
- **No security headers / CSP** on the deployed app.
- **Fake share links** (`?idea=<id>&collab=1`) — see Phase 10.
- **No account deletion**, so no way to honour a deletion request.
- **Markdown/HTML sanitisation** of scraped content and AI output is unverified.
- **Prompt injection** from scraped pages and transcripts is undefended.
- ~~Phone auth is exposed without a verified SMS provider~~ ✅ gated behind `VITE_ENABLE_PHONE_AUTH`, off by default.
- `check-url` performs authenticated outbound fetches; SSRF-guarded but not rate limited (P2).

## Verified good
- Owner-scoped RLS is enabled on all 15 user-owned tables.
- The service-role key is only ever read from `Deno.env` inside edge functions;
  no service-role key appears in client code.
- `_shared/ssrf.ts` exists and is used by the URL fetchers.
