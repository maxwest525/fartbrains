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

## Not yet covered (all required before launch)
Signup · email verification · magic link · password reset · session expiry ·
two-account RLS isolation across every table · capture (text, URL, voice,
transcript, duplicate, AI failure, retry, offline) · library (search,
pagination, folders, tags, archive, trash, restore, bulk) · retrieval
(citations, no-result, isolation, prompt injection, embedding fallback) ·
sharing (valid, expired, revoked, invalid token, enumeration, hidden fields,
owner preview, deleted idea) · billing (checkout, webhook, duplicate webhook,
failed payment, cancellation, resubscription, entitlements, export after
cancellation) · import/export · responsive and keyboard-only UX.

## Manual / visual
None recorded. This session has no browser; baseline screenshots at 320/390px,
tablet, 1280/1440px and wide desktop remain outstanding.
