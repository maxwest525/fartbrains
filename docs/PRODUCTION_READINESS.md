# Production readiness

**Current verdict: NOT READY FOR LAUNCH.**

## Backlog

### P0 — security / data loss
- [x] Authentication gate disabled; anonymous session minted for every visitor.
- [x] `notes-feed` edge function leaked every tenant's notes, todos and reminders.
- [~] RLS `UPDATE` policies missing `WITH CHECK` — migration written, **not applied**.
- [x] No rate limiting or server-side usage accounting on AI routes.
- [x] Immediate permanent deletes with no trash and no undo (data loss).

### P1 — launch blockers
- [~] Stripe billing, subscriptions and entitlements — built (checkout, portal,
      signature-verified idempotent webhook, plan config, billing UI).
      **Nothing has been run against Stripe test mode**, which the release gate
      requires. See the Stripe checklist in `docs/DEPLOYMENT.md`.
- [~] Secure, revocable single-idea sharing — built; migration + edge function **not deployed**, E2E unproven.
- [x] Full data export (JSON + Markdown).
- [x] Account deletion with derived-data cleanup.
- [ ] Durable processing-job model for long-running capture.
- [ ] Import Center.
- [x] First-run onboarding.
- [~] Server-side search + pagination — every list is now bounded and indexed; true infinite scroll / "load more" is still missing, so a library past one page is silently truncated in the UI.
- [ ] Semantic retrieval with citations, and grounded "not in your vault" answers.
- [x] Hide phone auth until an SMS provider is configured and tested.
- [x] Restrict CORS to production origins; add CSP (remaining response headers documented for the CDN).
- [~] Error monitoring and privacy-safe product analytics — error boundary and a content-safe analytics layer exist; no provider is wired.
- [~] Production email sender-domain configuration — documented in `docs/DEPLOYMENT.md`, not verified.
- [ ] Real automated coverage: auth, two-account RLS, capture, sharing, billing.

### P2 — post launch
- [ ] Code splitting (single 1.19 MB bundle).
- [ ] Accessibility pass to WCAG 2.2 AA on core flows.
- [ ] Offline capture queue, or stop implying offline support.
- [ ] Electron hardening, or mark Beta and hide public install controls.
- [ ] Clear the 29 lint errors.

### Deferred
- Anything resembling teams, orgs, shared workspaces or collaboration.
