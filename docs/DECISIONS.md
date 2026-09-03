# Decisions log

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| 1 | 2026-09-03 | Restore the real authentication gate; delete `signInAnonymously()` fallback. | The app signed every visitor in anonymously, giving unauthenticated traffic a valid JWT and therefore access to the paid AI edge functions (all of which authorize with `requireUser`). Not sellable, and an open cost/abuse hole. |
| 2 | 2026-09-03 | Anonymous Supabase sessions are treated as signed-out and actively signed out in `useAuth`. | Defence in depth: stale anonymous tokens already in customers' browsers must not resurrect access. |
| 3 | 2026-09-03 | Removed the single-user email allowlist (`src/lib/allowlist.ts`). | It was already a no-op returning `true` for everything; keeping a fake gate around is misleading. Public signup is the product. |
| 4 | 2026-09-03 | App lock (local passcode) moved out of first run into Settings → App lock. | A device passcode prompt before a new customer has seen the product is a conversion killer, and it is not an account credential. |
| 5 | 2026-09-03 | `notes-feed` authenticates the caller and runs as that user instead of using the service-role key with a shared `NOTES_FEED_TOKEN`. | The shared-token design returned every customer's notes, todos and reminders to any holder of one token. Nothing in this repo calls the function, so the only consumer to update is the external desktop poller, which must now send the customer's own access token. |
| 6 | 2026-09-03 | RLS `UPDATE` policies get an explicit `WITH CHECK` matching their `USING`. | `USING` alone permits a customer to reassign `user_id` on a row they own, moving it into another account's brain. |
| 7 | 2026-09-03 | Share links are `/s/<token>` with a 256-bit token; only its SHA-256 is stored. | The idea UUID must never be authorization, and a database dump must not yield working links. The raw token is shown once and cannot be recovered — a lost link is regenerated. |
| 8 | 2026-09-03 | Public share resolution goes through the `resolve-share` edge function calling a SECURITY DEFINER RPC, not through an anonymous RLS policy on `ideas`. | Keeps `public.ideas` closed to anon entirely, returns only the opted-in fields, and gives somewhere to rate-limit. |
| 9 | 2026-09-03 | Unknown, revoked and expired tokens return the same response. | Otherwise the endpoint distinguishes live links from dead ones, which is an enumeration oracle. |
| 10 | 2026-09-03 | Default shared fields: title + note + summary. Extracted source text, AI chats, tags, folder, reminders, related ideas and owner identity are never shareable. | Matches the product promise that sharing one idea reveals nothing else. |
