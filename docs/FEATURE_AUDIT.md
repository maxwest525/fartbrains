# Feature audit

Status labels: **VERIFIED END TO END** · **WIRED BUT UNPROVEN** · **PARTIALLY
IMPLEMENTED** · **VISUAL ONLY** · **BROKEN** · **DUPLICATED** · **DEAD CODE** ·
**DEFERRED**

Nothing here is marked VERIFIED END TO END unless a test or a real run proved it.
This session has no browser and no live database access, so "verified" currently
means *proved by automated test in this repo*.

## Authentication & account lifecycle
| Feature | Status | Notes |
|---|---|---|
| Auth gate on protected routes | VERIFIED END TO END | Restored iteration 1; 6 unit tests. |
| Email + password signup / login | WIRED BUT UNPROVEN | Code present, no E2E. |
| Magic link | WIRED BUT UNPROVEN | Requires production email domain config. |
| Password reset | WIRED BUT UNPROVEN | `/reset-password` route exists. |
| Phone / SMS OTP | DEFERRED (hidden) | Gated behind `VITE_ENABLE_PHONE_AUTH`, off by default until an SMS provider is configured and tested. |
| Email verification enforcement | PARTIALLY IMPLEMENTED | Signup succeeds; app does not gate on `email_confirmed_at`. |
| Change email / change password | PARTIALLY IMPLEMENTED | `updateUser` exists on the auth screen only. |
| Reauth before destructive actions | PARTIALLY IMPLEMENTED | Enforced for account deletion only. |
| Account deletion | WIRED BUT UNPROVEN | `delete-account` edge function; requires password re-entry, a session under 15 minutes old, and the typed phrase. Not deployed. |
| Single-user email allowlist | DEAD CODE (removed) | Was a no-op returning true. |

## Onboarding
| Feature | Status | Notes |
|---|---|---|
| First-run flow (capture → find → privacy) | WIRED BUT UNPROVEN | 14 tests cover progress, per-account isolation, corrupted storage and when it is offered. Visual pass outstanding. |
| No silent sample data | VERIFIED END TO END | The first capture is the customer's own text; nothing is written into a private brain on their behalf. |

## Capture
| Feature | Status | Notes |
|---|---|---|
| Manual note / idea capture | WIRED BUT UNPROVEN | |
| Voice capture | WIRED BUT UNPROVEN | |
| URL capture + extraction | WIRED BUT UNPROVEN | `extract-url`, `scrape-url`. |
| YouTube / Instagram transcripts | WIRED BUT UNPROVEN | Third-party scraping; fragile by nature. |
| Durable processing-job model | NOT IMPLEMENTED | Everything is synchronous. Launch blocker for reliability. |
| Duplicate detection | PARTIALLY IMPLEMENTED | `useDuplicateUrl` covers URLs only. |
| Offline capture queue | NOT IMPLEMENTED | PWA implies offline; it is not real. |

## Library & organization
| Feature | Status | Notes |
|---|---|---|
| Folders, tags, favorites, pins, recent | WIRED BUT UNPROVEN | |
| Search | PARTIALLY IMPLEMENTED | Client-side filtering; no server FTS. |
| Pagination | NOT IMPLEMENTED | Scale risk. |
| Trash / restore / permanent delete / empty | WIRED BUT UNPROVEN | Soft delete with undo, 30-day retention, `purge_expired_trash()`; 6 tests assert no DELETE on the delete path. Migration not applied. Archive (distinct from trash) is still not implemented. |
| Bulk actions | NOT IMPLEMENTED | |

## AI
| Feature | Status | Notes |
|---|---|---|
| Summaries, auto-tag, prompt generation | WIRED BUT UNPROVEN | |
| Ask / Ash chat with vault context | WIRED BUT UNPROVEN | `_shared/vault-context.ts`. |
| Embeddings / semantic retrieval | NOT IMPLEMENTED | Retrieval is keyword-based only. |
| Prompt-injection defence for scraped content | UNVERIFIED | |
| Server-side usage + cost accounting | WIRED BUT UNPROVEN | `ai_usage_events` + `_shared/ai-guard.ts` on all 17 paid routes; migration not applied. |
| Rate limiting on AI routes | WIRED BUT UNPROVEN | Per-minute / per-hour / per-month weighted quotas, input-size caps. |

## Sharing
| Feature | Status | Notes |
|---|---|---|
| Secure single-idea share links | WIRED BUT UNPROVEN | Replaced the fake collab link in iteration 3. Token generation and status logic are unit-tested; the migration and edge function are **not yet deployed**, so end-to-end resolution is unproven. |
| "Brainstorm with a friend" collab link | REMOVED | Copied `/?idea=<id>&collab=1`, an owner-only URL the recipient could not open, and treated the idea UUID as authorization. |

## Billing
| Feature | Status | Notes |
|---|---|---|
| Stripe Checkout + Customer Portal | WIRED BUT UNPROVEN | Env-driven price ids; no Stripe test-mode run yet. |
| Webhook + idempotency | WIRED BUT UNPROVEN | Signature-verified; `billing_events` primary key rejects replays. |
| Entitlements | WIRED BUT UNPROVEN | Central config, server-side in `_shared/billing.ts`; 12 tests cover the client mirror. |
| Usage counters against plan limits | PARTIALLY IMPLEMENTED | Counted in `ai_usage_events`; not yet surfaced in the UI. |
| Trials, plan changes, dunning recovery | WIRED BUT UNPROVEN | Handled by Stripe + the webhook; untested. |

## Data ownership
| Feature | Status | Notes |
|---|---|---|
| Export (JSON / Markdown) | WIRED BUT UNPROVEN | 9 tests cover secret stripping, Markdown rendering and table coverage; the live query pass is unproven. Per-item export is still missing. |
| Account deletion | WIRED BUT UNPROVEN | `delete-account` edge function; requires password re-entry, a session under 15 minutes old, and the typed phrase. Not deployed. |

## Advanced / consolidation decisions
| Feature | Disposition |
|---|---|
| Graph visualization | Advanced (secondary nav) |
| Projects / project board | Useful but secondary |
| Calendar events + event gifts | Useful but secondary; `event_gifts` is a niche feature to review |
| Deep research | Advanced / Labs |
| Cross-pollination | Advanced / Labs |
| Generated + optimized prompts | Advanced / Labs |
| Personal AI instructions | Core (Settings) |
| Desktop scratchpad | Useful but secondary |
| Electron wrapper | Beta — must not block the web launch |

## Platform
| Feature | Status | Notes |
|---|---|---|
| PWA install | WIRED BUT UNPROVEN | |
| Offline behaviour | VISUAL ONLY | Nothing real behind it. |
| Push notifications | WIRED BUT UNPROVEN | VAPID + `send-test-push` present. |
| Email (transactional, queue, unsubscribe) | WIRED BUT UNPROVEN | Needs production sender domain. |
| Electron desktop app | PARTIALLY IMPLEMENTED | Unsigned; hardcoded assumptions to review. |
