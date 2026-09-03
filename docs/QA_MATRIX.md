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

## Not yet covered (all required before launch)
Signup · email verification · magic link · password reset · session expiry ·
two-account RLS isolation across every table · capture (text, URL, voice,
transcript, duplicate, AI failure, retry, offline) · library (search,
pagination, folders, tags, archive, trash, restore, bulk) · retrieval
(citations, no-result, isolation, prompt injection, embedding fallback) ·
sharing end-to-end against a real database (valid, revoked, invalid token,
enumeration, hidden private fields, owner preview, share of a deleted idea) · billing (checkout, webhook, duplicate webhook,
failed payment, cancellation, resubscription, entitlements, export after
cancellation) · import/export · responsive and keyboard-only UX.

## Manual / visual
None recorded. This session has no browser; baseline screenshots at 320/390px,
tablet, 1280/1440px and wide desktop remain outstanding.
