# Launch handoff — status

**This is a status handoff, not a launch sign-off. The release gate is NOT
satisfied and the completion marker has not been issued.**

Twelve production-readiness iterations have landed. What blocks the gate is not
unwritten code so much as unrun verification: this environment has no database,
no browser, and no Stripe account, so five new migrations are written but never
applied, and no user journey has been executed end to end.

---

## 1. What the product is
A private second brain for one person. Each account is one private brain. See
`docs/PRODUCT_TRUTH.md`.

## 2. The customer promise
Put anything in. Fartbrains organizes it. Find it later or ask about it.
Everything stays private unless you deliberately share one item.

## 3. What changed in this pass
| # | Work | Why it mattered |
|---|---|---|
| 1 | Restored the authentication gate | The app signed **every visitor in anonymously** and skipped the sign-in screen. Since all edge functions accept any valid JWT, unauthenticated traffic could spend the AI budget — and the product could not be sold at all. |
| 2 | Fixed `notes-feed` | Returned **every tenant's** notes, todos and reminders to any holder of one shared token. |
| 3 | RLS `WITH CHECK` migration | A customer could reassign `user_id` and push rows into another account. |
| 4 | Real single-idea sharing | Replaced a fake "collab" link that was just the owner's own URL. |
| 5 | AI rate limiting + usage accounting | Every paid route was unlimited; `transcribe-instagram` had **no authentication at all**. |
| 6 | Trash, undo, 30-day retention | Deletion was instant and permanent. |
| 7 | Data export + account deletion | Neither existed; a deletion request could not be honoured. |
| 8 | Stripe billing and entitlements | No billing existed. |
| 9 | CORS pinning, CSP, error boundary, content-safe analytics | Wildcard CORS on 28 functions; crashes showed a blank page. |
| 10 | First-run onboarding | New customers landed on an empty composer with no explanation. |
| 11–12 | Bounded, indexed, paged lists | Lists fetched the customer's entire vault into browser memory. |

## 4. Verified — by automated test in this repository
71 tests pass (baseline: one trivial test). `tsc --noEmit` clean; `vite build`
passes. Per-case evidence is in `docs/QA_MATRIX.md`. Covered: the auth gate and
anonymous-session rejection, share token entropy/hashing/expiry/revocation, the
trash model's query shapes, export secret-stripping and Markdown rendering, the
entitlement matrix, analytics content-stripping, the error boundary, onboarding
progress, and list-query bounding.

## 5. NOT verified — the gate blockers
1. **No migration has been applied.** Five migrations are written and unrun:
   RLS `WITH CHECK`, `idea_shares`, `ai_usage_events`, trash, search indexes,
   billing. Order and per-migration verification: `docs/DEPLOYMENT.md`.
2. **No Stripe test-mode lifecycle has been run.** The gate requires checkout →
   webhook → duplicate webhook → failed payment → cancellation → resubscription.
3. **No two-account RLS test has been run.**
4. **No share flow has resolved end to end.**
5. **No E2E journey and no visual check at any viewport.** No screenshots exist;
   accessibility is unaudited.
6. **`purge_expired_trash()` has no schedule.**
7. **No error-reporting or analytics provider is wired** (deliberately — both
   are no-ops until one is reviewed for what it collects).

## 6. Still unbuilt (tracked in `docs/PRODUCTION_READINESS.md`)
Durable processing-job model for long-running capture; Import Center; semantic
retrieval with citations and grounded "not in your vault" answers; offline
capture queue; email-verification enforcement; archive (distinct from trash);
per-item export; usage-against-limits UI; accessibility pass; code splitting
(one 1.19 MB bundle); 29 pre-existing lint errors.

## 7. Authentication
Enabled: email + password, magic link, password reset. **Phone/SMS is hidden**
behind `VITE_ENABLE_PHONE_AUTH` (default off) — no SMS provider is configured.
No OAuth providers. Anonymous sign-in must be disabled in Supabase Auth
settings; the client no longer creates one.

## 8. Billing
Stripe Checkout + Customer Portal. Prices are environment-driven
(`STRIPE_PRICE_ID_PRO`) — **public pricing has not been chosen and is the
owner's decision**. Entitlements are centralised in
`supabase/functions/_shared/billing.ts` (authoritative) and mirrored for the UI
in `src/lib/entitlements.ts`. `past_due` keeps access during dunning. Losing a
subscription never restricts reading, searching, exporting or account deletion.

## 9. Real limitations, stated plainly
- Offline support is **not real**; the PWA implies more than it does.
- Retrieval is keyword search, not semantic — there are no embeddings.
- Imports beyond typed/pasted capture do not exist.
- Long-running capture is synchronous and can be lost if a request fails.
- The Electron app is unsigned and should be treated as **Beta or hidden**.
- Social transcription depends on third-party scrapers and will break.

## 10. Privacy and AI processing
Content is sent to the configured AI gateway for summaries, tagging, prompts and
answers; to transcription providers for audio; and pages are fetched for URL
capture. `ai_usage_events` records **metadata only** — never note bodies,
transcripts, prompts, completions or scraped content. Analytics take a fixed
event name plus an allowlist of enum-shaped properties.
**Do not claim providers do not train on customer data** unless that has been
verified for the exact production provider and contract. It has not.

## 11. Security controls
Owner-scoped RLS on every user-owned table; `requireUser` on every edge
function; the service-role key is server-side only; SSRF guards on URL fetchers;
share tokens are 256-bit with only the SHA-256 stored, resolved through a
`SECURITY DEFINER` function granted to `service_role` alone and never through an
anonymous policy on `ideas`; per-IP rate limiting on the one public route with
unknown/revoked/expired reported identically; CORS pinned to a configured
origin; CSP shipped. Full review: `docs/SECURITY_REVIEW.md`.

## 12. Route map
`/` app shell (gated) · `/auth` · `/reset-password` · `/unsubscribe` ·
`/profile` · `/settings/instructions` · `/settings/prompt-rules` ·
**`/s/:token` public read-only shared idea** · `*` not found.

## 13–18. Environment, Stripe, Supabase, email, monitoring checklists
All in `docs/DEPLOYMENT.md`.

## 19. Recommended landing-page screenshots
Capture composer · Library with folders and tags · an idea detail with its AI
summary · Ask answering with cited sources · the share dialog showing what a
recipient sees · Settings showing export and deletion.
**None of these exist yet** — take them after a real deployment.

## 20. Claims that are safe once verification is done
"Your private second brain." · "Capture anything — a thought, a link, a voice
note." · "Ask questions and get answers from your own notes, with sources." ·
"Share one idea with a friend, read-only, and revoke it any time." · "Export
everything or delete your account whenever you want." · "No teams, no shared
folders — one brain, yours."

## 21. Claims that must NOT be made
- Any offline capability.
- That AI providers do not train on customer data (unverified).
- Team, collaboration, shared-workspace or multi-user language of any kind.
- Import formats that have not been built (PDF, DOCX, Notion, Evernote…).
- Uptime, SLA, encryption-at-rest specifics, or compliance certifications.
- That the desktop app is a supported, signed product.

## 22. Final manual steps before launch
1. Apply the five migrations in order and run each verification in
   `docs/DEPLOYMENT.md`.
2. Regenerate `src/integrations/supabase/types.ts` from the live schema (the
   entries added by hand in this branch are a stand-in).
3. Disable anonymous sign-ins in Supabase Auth; require email confirmation.
4. Run the two-account RLS test across every table.
5. Run the full Stripe test-mode lifecycle, then repeat on live keys.
6. Exercise the share flow: valid, revoked, expired, invalid token, and confirm
   private fields never appear.
7. Schedule `purge_expired_trash()` daily.
8. Configure the sending domain (SPF, DKIM, DMARC) and send a real reminder.
9. Set `ALLOWED_ORIGIN` / `APP_URL`; add the header-only security headers at the
   CDN; confirm the CSP does not break anything in a real browser.
10. Wire and review an error reporter and an analytics provider.
11. Walk every journey at 320px, 390px, tablet, 1280px, 1440px and 200% zoom.
12. Decide public pricing and set `STRIPE_PRICE_ID_PRO`.
13. Write the privacy policy and terms; link them from Settings.
