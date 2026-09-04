# Production readiness

**Current verdict: NOT READY FOR LAUNCH.**

## Backlog

### P0 — security / data loss
- [x] Authentication gate disabled; anonymous session minted for every visitor.
- [x] `notes-feed` edge function leaked every tenant's notes, todos and reminders.
- [x] RLS `UPDATE` policies missing `WITH CHECK` — **applied 2026-09-04**.
- [x] No rate limiting or server-side usage accounting on AI routes.
- [x] Immediate permanent deletes with no trash and no undo (data loss).

### P1 — launch blockers
- [~] Privacy policy and terms — WIP drafts live at `/privacy` and `/terms`, banner-marked as unreviewed. **Must be replaced with legally reviewed text before taking customers.**
- [~] Public pricing — draft structure in `docs/PRICING.md` ($9/mo, $90/yr, 50 free / 1,000 Pro AI actions). Not validated against a real provider bill; no Stripe price created.
- [~] Stripe billing, subscriptions and entitlements — built (checkout, portal,
      signature-verified idempotent webhook, plan config, billing UI).
      **Nothing has been run against Stripe test mode**, which the release gate
      requires. See the Stripe checklist in `docs/DEPLOYMENT.md`.
- [~] Secure, revocable single-idea sharing — built, schema **applied 2026-09-04**; edge function not yet deployed, E2E unproven.
- [x] Full data export (JSON + Markdown).
- [x] Account deletion with derived-data cleanup.
- [ ] Durable processing-job model for long-running capture.
- [ ] Import Center.
- [x] Capture from the OS share sheet (PWA share target) — PR #7.
- [x] First-run onboarding.
- [x] Server-side search + pagination — lists are bounded to 100 rows, indexed, and paged with an explicit "Load more" so nothing is truncated silently.
- [ ] Semantic retrieval with citations, and grounded "not in your vault" answers.
- [x] Hide phone auth until an SMS provider is configured and tested.
- [~] Restrict CORS to production origins; add CSP (remaining response headers documented for the CDN).
      **Code shipped, control inert.** Verified 2026-09-04: neither `ALLOWED_ORIGIN`
      nor `APP_URL` is set on the deployed functions, so every one still answers
      `Access-Control-Allow-Origin: *`. Setting the secret is the whole fix — see
      the check in `docs/DEPLOYMENT.md`. Ticked too early once; a control that
      exists in code and not in the environment is worse than one never written,
      because it reads as done.
- [x] Trash retention is actually scheduled (nightly pg_cron job).
- [~] Error monitoring and privacy-safe product analytics — error boundary and a content-safe analytics layer exist; no provider is wired.
- [~] Production email sender-domain configuration — documented in `docs/DEPLOYMENT.md`, not verified.
- [~] Real automated coverage: auth, two-account RLS, capture, sharing, billing.
      CI now runs typecheck, tests and build on every push and PR, and asserts the
      generated MCP server matches `src/lib/mcp`. The flows above are still not
      themselves covered end to end.

### P2 — post launch
- [ ] Code splitting (single 1.19 MB bundle).
- [ ] Accessibility pass to WCAG 2.2 AA on core flows.
- [ ] Offline capture queue, or stop implying offline support.
- [ ] Electron hardening, or mark Beta and hide public install controls.
- [ ] Clear the 29 lint errors.

### Waiting on the owner (code and config are ready)
- [x] Deploy edge functions — **done 2026-09-04**, all 32 live and spot-checked
      with curl (see `docs/QA_MATRIX.md`).
- [x] Publish, which is the only thing that deploys the `mcp` function —
      **done 2026-09-04**. Lovable reports the published commit as the squash
      merge of #6, which carries the soft-delete fix and `build_prompt`. Not
      independently confirmed against the running function: Supabase denied
      function-source read and `tools/list` needs auth. Confirm by pointing a
      session at the endpoint and checking `build_prompt` is listed.
- [ ] Run `docs/rls-two-account-test.sql` with two real accounts.
- [ ] Work through `docs/STRIPE_SETUP.md` in test mode.

### Target architecture (new track, see `docs/SPEC_LEDGER.md`)
- [ ] `sources` / `source_versions` — immutable, checksummed. Blocks everything else.
- [ ] `evidence_spans` against a version.
- [x] Turn on `ideas.search_vector` — now queried as `build_prompt`'s third
      retrieval pass. Still unused by `search_ideas`, which remains `ilike`.
- [ ] Enable pgvector; embed spans rather than whole items.
- [ ] Proposals + review queue (accept / reject / merge / supersede / contradiction).
- [ ] Durable worker — spec §16.4 forbids long compilation in edge functions.
- [ ] Route models through LiteLLM → OpenRouter instead of the Lovable gateway.
- [ ] MCP gateway to list/describe/execute rather than exposing 20 schemas at once.
- [ ] Project / repo / folder ingestion.

### Deferred
- Anything resembling teams, orgs, shared workspaces or collaboration.
