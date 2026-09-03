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

## P0 — open
### 2. `notes-feed` returns every tenant's data
The function queries `ideas`, `todos`, `idea_reminders` and `folders` with the
service-role key and **no `user_id` filter**, gated only by a shared
`NOTES_FEED_TOKEN`. Its own comment states the project is "effectively
single-tenant". In a multi-customer product this is a full cross-tenant dump.
Fix: scope to a single owner and authenticate as a user, or remove the function.

### 3. RLS `UPDATE` policies have no `WITH CHECK`
`ideas`, `folders`, `calendar_events`, `idea_reminders`, `idea_references`,
`event_gifts` and `todos` define `FOR UPDATE USING (auth.uid() = user_id)` with
no `WITH CHECK`. A user can therefore update a row they own and set
`user_id` to another account, pushing rows into someone else's brain.

### 4. No rate limiting or usage accounting on AI routes
Every AI edge function is unlimited per user. One authenticated account can
exhaust the provider budget.

## P1 — open
- **Wildcard CORS** (`Access-Control-Allow-Origin: *`) on all 26 edge functions.
- **No security headers / CSP** on the deployed app.
- **Fake share links** (`?idea=<id>&collab=1`) — see Phase 10.
- **No account deletion**, so no way to honour a deletion request.
- **Markdown/HTML sanitisation** of scraped content and AI output is unverified.
- **Prompt injection** from scraped pages and transcripts is undefended.
- **Phone auth is exposed** without a verified SMS provider.

## Verified good
- Owner-scoped RLS is enabled on all 15 user-owned tables.
- The service-role key is only ever read from `Deno.env` inside edge functions;
  no service-role key appears in client code.
- `_shared/ssrf.ts` exists and is used by the URL fetchers.
