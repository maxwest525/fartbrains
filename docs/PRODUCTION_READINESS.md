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
- [ ] Stripe billing, subscriptions and server-side entitlement enforcement.
      (Plan limits and the entitlement lookup already exist in `_shared/ai-guard.ts`;
      it needs the `subscriptions` table and the Stripe webhook to write it.)
- [~] Secure, revocable single-idea sharing — built; migration + edge function **not deployed**, E2E unproven.
- [ ] Full data export (JSON + Markdown).
- [ ] Account deletion with derived-data cleanup.
- [ ] Durable processing-job model for long-running capture.
- [ ] Import Center.
- [ ] First-run onboarding.
- [ ] Server-side search + pagination for large libraries.
- [ ] Semantic retrieval with citations, and grounded "not in your vault" answers.
- [x] Hide phone auth until an SMS provider is configured and tested.
- [ ] Restrict CORS to production origins; add CSP and security headers.
- [ ] Error monitoring and privacy-safe product analytics.
- [ ] Production email sender-domain configuration.
- [ ] Real automated coverage: auth, two-account RLS, capture, sharing, billing.

### P2 — post launch
- [ ] Code splitting (single 1.19 MB bundle).
- [ ] Accessibility pass to WCAG 2.2 AA on core flows.
- [ ] Offline capture queue, or stop implying offline support.
- [ ] Electron hardening, or mark Beta and hide public install controls.
- [ ] Clear the 29 lint errors.

### Deferred
- Anything resembling teams, orgs, shared workspaces or collaboration.
