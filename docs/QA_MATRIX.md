# QA matrix

Evidence rules: a row is only "PASS" with a named automated test or a recorded
manual run. Code inspection is never evidence.

## Automated
| Area | Case | Test | Result |
|---|---|---|---|
| Auth gate | Signed-out visitor sees the sign-in screen | `ProtectedRoute.test.tsx` | PASS |
| Auth gate | No anonymous session is ever minted | `ProtectedRoute.test.tsx` | PASS |
| Auth gate | Anonymous session is rejected and signed out | `ProtectedRoute.test.tsx` | PASS |
| Auth gate | Real signed-in user reaches the app | `ProtectedRoute.test.tsx` | PASS |
| Auth gate | First run is not blocked by app-lock setup | `ProtectedRoute.test.tsx` | PASS |
| App lock | Configured passcode gates entry | `ProtectedRoute.test.tsx` | PASS |
| Sharing | Token is URL-safe and 256-bit | `share.test.ts` | PASS |
| Sharing | Tokens do not repeat across 500 draws | `share.test.ts` | PASS |
| Sharing | Hash is stable, 64-hex, and never contains the token | `share.test.ts` | PASS |
| Sharing | Expired link reports expired | `share.test.ts` | PASS |
| Sharing | Revocation wins over an unexpired link | `share.test.ts` | PASS |
| Trash | Deleting soft-deletes and issues no DELETE | `useIdeas.trash.test.tsx` | PASS |
| Trash | Restore clears `deleted_at` | `useIdeas.trash.test.tsx` | PASS |
| Trash | Permanent delete is scoped to trashed rows | `useIdeas.trash.test.tsx` | PASS |
| Trash | Empty Trash is scoped to trashed rows | `useIdeas.trash.test.tsx` | PASS |
| Library | Normal lists exclude trashed items | `useIdeas.trash.test.tsx` | PASS |
| Library | Trash view shows only trashed items | `useIdeas.trash.test.tsx` | PASS |
| Export | Token hashes and push keys are stripped | `exportAccount.test.ts` | PASS |
| Export | Ordinary content survives stripping | `exportAccount.test.ts` | PASS |
| Export | Markdown renders title, summary, note, extracted text | `exportAccount.test.ts` | PASS |
| Export | A newline in a title cannot break the heading | `exportAccount.test.ts` | PASS |
| Export | Ideas group by folder, rest under Unfiled | `exportAccount.test.ts` | PASS |
| Export | Every user-owned content table is covered | `exportAccount.test.ts` | PASS |
| Export | The share table (token hashes) is never exported | `exportAccount.test.ts` | PASS |
| Billing | Trialing / active / past_due grant paid features | `entitlements.test.ts` | PASS |
| Billing | Free / incomplete / unpaid / canceled do not | `entitlements.test.ts` | PASS |
| Billing | Read, search, export and deletion survive every status | `entitlements.test.ts` | PASS |
| Billing | Only costly actions are restricted after cancellation | `entitlements.test.ts` | PASS |
| Billing | A cancelled customer can still manage billing and resubscribe | `entitlements.test.ts` | PASS |
| Billing | Cancelled / past_due / renewal messaging is correct | `entitlements.test.ts` | PASS |
| Analytics | Note bodies, titles, queries, URLs and emails are dropped | `analytics.test.ts` | PASS |
| Analytics | Only enum-shaped allowlisted props survive, truncated | `analytics.test.ts` | PASS |
| Analytics | A broken provider cannot break the product | `analytics.test.ts` | PASS |
| Reliability | A render crash shows a recoverable screen, not a blank page | `ErrorBoundary.test.tsx` | PASS |
| Reliability | The crash screen reassures the customer their notes are safe | `ErrorBoundary.test.tsx` | PASS |
| Reliability | Crashes reach an installed sink; a broken sink is survivable | `ErrorBoundary.test.tsx` | PASS |
| Onboarding | Completed steps are remembered and never repeated | `onboarding.test.ts` | PASS |
| Onboarding | Two accounts on one device keep separate progress | `onboarding.test.ts` | PASS |
| Onboarding | Corrupted or outdated stored state degrades safely | `onboarding.test.ts` | PASS |
| Onboarding | Offered to an empty account, never to one with items | `onboarding.test.ts` | PASS |
| Onboarding | Continues after the first capture creates an item | `onboarding.test.ts` | PASS |
| Onboarding | Never shown again once finished or skipped | `onboarding.test.ts` | PASS |
| Scale | List queries never fetch the whole vault | `useIdeas.trash.test.tsx` | PASS |
| Scale | A caller-supplied page size is honoured | `useIdeas.trash.test.tsx` | PASS |

## Not yet covered (all required before launch)
Signup · email verification · magic link · password reset · session expiry ·
two-account RLS isolation across every table · capture (text, URL, voice,
transcript, duplicate, AI failure, retry, offline) · library (search,
pagination, folders, tags, archive, trash, restore, bulk) · retrieval
(citations, no-result, isolation, prompt injection, embedding fallback) ·
the full Stripe test-mode lifecycle (checkout, webhook, duplicate webhook,
failed payment, cancellation, resubscription) ·
sharing end-to-end against a real database (valid, revoked, invalid token,
enumeration, hidden private fields, owner preview, share of a deleted idea) · billing (checkout, webhook, duplicate webhook,
failed payment, cancellation, resubscription, entitlements, export after
cancellation) · import/export · responsive and keyboard-only UX.

## Manual / visual
None recorded. This session has no browser; baseline screenshots at 320/390px,
tablet, 1280/1440px and wide desktop remain outstanding.
