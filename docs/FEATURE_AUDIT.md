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
| Phone / SMS OTP | BROKEN (must be hidden) | UI is present but no SMS provider is known to be configured. Showing it ships a dead auth method. |
| Email verification enforcement | PARTIALLY IMPLEMENTED | Signup succeeds; app does not gate on `email_confirmed_at`. |
| Change email / change password | PARTIALLY IMPLEMENTED | `updateUser` exists on the auth screen only. |
| Reauth before destructive actions | NOT IMPLEMENTED | |
| Account deletion | NOT IMPLEMENTED | Launch blocker. |
| Single-user email allowlist | DEAD CODE (removed) | Was a no-op returning true. |

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
| Archive / trash / restore | NOT IMPLEMENTED | Deletes are immediate and permanent. Launch blocker. |
| Bulk actions | NOT IMPLEMENTED | |

## AI
| Feature | Status | Notes |
|---|---|---|
| Summaries, auto-tag, prompt generation | WIRED BUT UNPROVEN | |
| Ask / Ash chat with vault context | WIRED BUT UNPROVEN | `_shared/vault-context.ts`. |
| Embeddings / semantic retrieval | NOT IMPLEMENTED | Retrieval is keyword-based only. |
| Prompt-injection defence for scraped content | UNVERIFIED | |
| Server-side usage + cost accounting | NOT IMPLEMENTED | Launch blocker for a public AI product. |
| Rate limiting on AI routes | NOT IMPLEMENTED | Launch blocker. |

## Sharing
| Feature | Status | Notes |
|---|---|---|
| "Brainstorm with a friend" | VISUAL ONLY / MISLEADING | Copies `/?idea=<id>&collab=1` — an owner-only URL. The recipient cannot open it. Must be replaced with real single-idea share links and the collaboration language removed. |

## Billing
| Feature | Status | Notes |
|---|---|---|
| Stripe / subscriptions / entitlements | NOT IMPLEMENTED | Launch blocker. |

## Data ownership
| Feature | Status | Notes |
|---|---|---|
| Export (JSON / Markdown) | NOT IMPLEMENTED | Launch blocker. |
| Account deletion | NOT IMPLEMENTED | Launch blocker. |

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
