# Verified state — 2026-09-08

Queried against the live Lovable Cloud database (project
`3b7c6670-e618-4911-95aa-5636ac438f11`, Supabase ref `uwuhfvhqnpozhndrabwl`),
read-only. This is measured, not inferred. Where something is still unverified
it says so.

Written because "I have no idea if the second brain works" was a fair thing to
say and nobody had actually looked.

## The app is real and used

| | |
|---|---|
| registered users | **167** |
| ideas | **259** |
| folders | **126** |
| extracted references | **442** |
| idea chats | **36** |
| ideas with an AI summary | 146 of 259 |
| ideas with extracted text | 145 of 259 |
| ideas with a generated prompt | 32 |

Folders outnumber ideas 126 to 259 — roughly one folder for every two captures.
Worth noting against the subject-based folder routing added earlier: people are
making folders, which is what makes routing into them worth anything.

## Three defects, in order of how much they matter

### 1. Instagram transcription fails 100% of the time in production

Every attempt ever recorded:

| when | decision | result |
|---|---|---|
| 2026-09-05 02:01 | allowed | `provider_error` |
| 2026-09-05 18:29 | allowed | `provider_error` |
| 2026-09-05 18:29 | **rate_limited** | blocked by our own guard |
| 2026-09-05 18:29 | **rate_limited** | blocked by our own guard |
| 2026-09-05 18:33 | allowed | `provider_error` |

Three attempts reached the provider and all three failed. The other two were
refused by our own rate limiter — someone retried three times inside 44 seconds
after a failure, which is exactly what a person does when something breaks, and
the limiter treated it as abuse.

This is the one path. "Paste an Instagram reel" is the headline, and it has
never once succeeded for a real user. The failure is at the provider (Apify for
the media, ElevenLabs for the speech-to-text), so the next step is finding out
which of the two and whether it is a key, a quota, or Instagram blocking the
fetch — and `provider_error` does not say which, which is its own bug.

### 2. We cannot measure cost, which is what pricing is waiting on

`ai_usage_events` has exactly the right columns — `model`, `input_units`,
`output_units`, `estimated_cost`. **Every one of them is NULL on every row.**

And there are only 14 rows, all from 2026-09-05, nothing since. All 13 functions
that call the AI gateway do go through `guardAiRequest`, so the hook is in the
right place; what is missing is that almost nothing passes the numbers to it.
Four functions report anything at all, and they report *character and byte
counts*, not tokens:

- `summarize` — input/output string lengths
- `transcribe-deliverables`, `transcribe-youtube` — audio bytes and duration
- `transcribe-instagram` — output length only

Nothing anywhere records the model it used or an estimated cost.

So every cost figure in `docs/PRICING.md` is derived from published list prices,
and that is not going to change until the gateway response's `usage` block is
read and written through. This is the concrete blocker on pricing — not a
product decision, a missing field.

### 3. The second brain is keyword retrieval, not semantic

- `pgvector` is **not installed**. No embeddings table, no `source_versions`, no
  compiled knowledge. The architecture in
  `docs/spec/karpathy-second-brain-spec.md` is not built.
- `retrieveVaultContext` pulls the **400 most recently updated ideas** and scores
  them in memory by substring match: title hit +6, tag hit +4, body hit +2, plus
  a recency boost up to +2. Top 5 go into the prompt.

It does work, and the scoring is sensible — it returns a human-readable reason
per hit, which is better than most vector search. Two real limits:

- **Substring, not meaning.** A note about "churn" will not surface for
  "retention". This is the thing people mean when they say second brain, and we
  do not do it.
- **It was capped at 400 ideas.** Fixed: the term filter now runs in the
  database, so every idea is a candidate regardless of vault size. The cap was
  closer to biting than it looked — the largest single account holds **224
  ideas** against a 400-row window.

## What is still unverified

Everything behind login. Supabase is unreachable from this sandbox's browser, so
every gated route correctly renders the sign-in screen and stops. All 20 routes
were confirmed to render; the in-app views — folders, calendar, graph, Ash,
trash, detail — have not been seen working by me, and neither has the new Build
panel or `compose-output`, which is not deployed yet.

## Next, in this order

1. Diagnose and fix Instagram transcription. Start by splitting `provider_error`
   into which provider failed and why.
2. Loosen the retry rate limit, or exempt retries that follow a failure. Being
   rate-limited for retrying a broken feature is insult on top of injury.
3. Read `usage` off every gateway response and write `model`, tokens and
   `estimated_cost` through `record()`. Two weeks of that unparks pricing.
4. Decide on embeddings. The retrieval cap is fixed, but substring matching
   still cannot find "churn" from "retention", which is what people mean by a
   second brain.
5. Add a trigram index (`pg_trgm` + GIN) before any single account reaches the
   low thousands of ideas. Retrieval now runs four unindexed ilike clauses per
   term, which is free at 224 ideas and will not stay free.
