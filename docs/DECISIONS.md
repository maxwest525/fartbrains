# Decisions log

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| 1 | 2026-09-03 | Restore the real authentication gate; delete `signInAnonymously()` fallback. | The app signed every visitor in anonymously, giving unauthenticated traffic a valid JWT and therefore access to the paid AI edge functions (all of which authorize with `requireUser`). Not sellable, and an open cost/abuse hole. |
| 2 | 2026-09-03 | Anonymous Supabase sessions are treated as signed-out and actively signed out in `useAuth`. | Defence in depth: stale anonymous tokens already in customers' browsers must not resurrect access. |
| 3 | 2026-09-03 | Removed the single-user email allowlist (`src/lib/allowlist.ts`). | It was already a no-op returning `true` for everything; keeping a fake gate around is misleading. Public signup is the product. |
| 4 | 2026-09-03 | App lock (local passcode) moved out of first run into Settings → App lock. | A device passcode prompt before a new customer has seen the product is a conversion killer, and it is not an account credential. |
| 5 | 2026-09-03 | `notes-feed` authenticates the caller and runs as that user instead of using the service-role key with a shared `NOTES_FEED_TOKEN`. | The shared-token design returned every customer's notes, todos and reminders to any holder of one token. Nothing in this repo calls the function, so the only consumer to update is the external desktop poller, which must now send the customer's own access token. |
| 6 | 2026-09-03 | RLS `UPDATE` policies get an explicit `WITH CHECK` matching their `USING`. | `USING` alone permits a customer to reassign `user_id` on a row they own, moving it into another account's brain. |
