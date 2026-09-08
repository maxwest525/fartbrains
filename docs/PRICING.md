# Pricing

Researched 2026-09-08. Sources at the bottom. Revised the same day after Max
ruled out briefs as the unit: the output is whatever the thing should be — an
MVP, a skill tailored to them from what they saw on Instagram, an `agent.md` —
and the meter is the **run**.

## What a run is

**One run = one loop, from an input to a delivered artifact.**

That definition has to be exact, because it is the invoice.

- **Iterations inside a loop are part of the same run.** You look at what came
  back, say "no, make it a CLI, not a web app", and it goes again — still one
  run. This is not generosity, it is the only way the product works: if
  refining costs money, people accept the first output, and the first output
  is never the good one.
- **A run that delivers nothing does not count.** Model failure, a dead
  Instagram link, a scrape that returned an empty page: not billed. A user who
  suspects the counter is lying stops trusting the counter.
- **Capture is not a run.** Paste, transcribe, summarize, tag, file, search,
  ask Ash about your vault — all unmetered, forever, on every tier.
- **Re-running the same input against a different output type** (you got the
  spec, now you want the `agent.md`) **is a second run.** It is a second
  artifact and a second full pass of work.

Runs are countable, they are what the person actually came for, and they are
where essentially all of the cost sits. That is everything you want in a meter.

## What the market charges

The comparables changed when the output changed. We are no longer next to note
apps; we are next to tools that produce working artifacts.

| Product | Price | Shape |
|---|---|---|
| v0 | $20/mo | flat + credits |
| Cursor | $20/mo | flat, usage beyond |
| Lovable | $25/mo Pro | message-metered |
| Replit Core | $25/mo | flat + usage credits |
| Gumloop | $37/mo for 10,000 credits | credit-metered |
| Devin | $500/mo entry | ACU-metered |
| — *for contrast* — | | |
| Reflect / Mem | $10–12/mo | note apps |
| ChatGPT / Claude / Perplexity | $19.99–20/mo | flat |

**$20–25 is the builder-tool line.** That is the band to sit in, and it is
above the note-app line — which is the practical reason the positioning fight
in `PRODUCT_TRUTH.md` was worth having. Framed as a vault we are a $10 product.

What the market has also settled:

- Over 60% of AI SaaS now runs a hybrid: subscription for access, meter for
  consumption. Gartner projects 70% of businesses prefer usage-based over
  per-seat by 2026.
- **Expose a unit people recognize, not tokens.** "Runs" is already that unit.
  We do not need a credit abstraction — we have one expensive operation, not a
  zoo of them. If OCR, agents and long loops later diverge wildly in cost,
  *that* is when runs become credits, and the migration is a multiplier.
- AI compresses SaaS gross margin from the classic 80–90% to 50–60%. Whatever
  we pick has to be repriceable when inference costs move.
- A tier above the standard one lifts conversion *into* the standard one, even
  for people who never buy the top.

## Our cost side

Every AI call goes through the Lovable AI gateway to Gemini:
`gemini-2.5-flash-lite` (4 functions), `gemini-2.5-flash` (3),
`gemini-3-flash-preview` (2 — now 3, with `analyze-image`),
`gemini-3.1-flash-lite` (1), `gemini-3-pro-preview` (1). A cheap fleet, and
that is what makes unmetered capture affordable.

Estimated from published token prices — **not yet measured against our logs**:

| Step | Model | Est. cost |
|---|---|---|
| Capture: transcribe + summarize + auto-tag | Flash-Lite | ~$0.001 |
| Extract links / scrape / references | Flash-Lite | ~$0.002 |
| Image OCR + object detection | Flash | ~$0.002 |
| Ash chat turn over the vault | Flash | ~$0.002 |
| Deep research (multi-hop, several pages) | Flash | ~$0.01–0.02 |
| **A full run**, including 2–3 iterations | Flash + 3 Pro | **~$0.15–0.40** |

Capture is a tenth of a cent. A run is a quarter. **The cost curve is one
step**, and it is the step we are billing. That alignment is the whole design.

The wide band on a run is real and it is the main risk: an `agent.md` is cheap,
a working MVP with five iterations is not. See "What has to be true".

## Recommendation

| Tier | Price | Runs/mo | Everything else |
|---|---|---|---|
| **Free** | $0 | **2** | Unlimited capture, transcribe, OCR, tag, file, search, Ash |
| **Pro** | **$25/mo** ($250/yr) | **50** | + deep research, MCP connect, share targets, all output types |
| **Studio** | **$75/mo** | **250** | + priority queue, push-to-external-LLM, webhooks, API |
| Overage | **$10 / 25 runs** | — | Never a hard stop mid-loop |

Why this shape:

- **Capture stays free forever, on every tier.** The habit is paste-a-link-and-
  forget, and a counter on that step kills the habit for a tenth of a cent of
  saved cost. Mem's 25-note free cap is the mistake to avoid. It also means the
  free tier is a genuinely useful product, which is what makes the vault worth
  enough material that the runs are good when someone does upgrade.
- **Free gets 2 runs, not 0 and not 10.** One run does not prove anything —
  the first output of anything is disappointing. Two lets someone iterate once
  and see the loop actually work, which is the moment that sells this.
- **$25 puts us on the builder line**, next to Lovable and Replit Core, not
  next to Reflect. 50 runs is roughly 12 a week, which is more than a working
  person gets through.
- **Margin at the Pro cap:** 50 runs × $0.40 worst case = $20 against $25.
  That is 20% margin — **too thin, and it is the number to watch.** At the more
  likely $0.20 average it is $10 against $25, or 60%. A realistic Pro user
  running 12 runs a month costs ~$2.50, which is 90%.
  The cap bounds the tail; the tail is where this model breaks. If measurement
  shows runs averaging north of $0.30, Pro drops to 35 runs or rises to $29.
- **Overage instead of a wall.** Hitting a hard stop halfway through the loop
  you are paying for is the single worst experience this product could have.
- **$75 anchors $25** and is the natural home for anyone actually shipping.

### What has to be true before this goes live

1. **Measure, don't estimate.** Log tokens in/out and wall-clock per edge
   function, tagged with user and run id, for two weeks. Every cost number
   above is from list prices. The $0.15–0.40 band on a run is the one that
   decides whether Pro is 35, 50, or 75 runs.
2. **A run has to be worth ~50¢.** At the Pro cap that is what a buyer pays per
   run. A spec is not obviously worth 50¢. A working MVP obviously is. The
   pricing rests on the run producing a real artifact, which is the same bet
   the product rests on.
3. **The counter has to be visible before it is enforced.** Runs remaining,
   what consumed them, and what a failed run did *not* consume. A cap the user
   cannot see is a bug report.
4. **Failed runs must be provably uncounted.** Needs a run record with a
   terminal state, not a decrement at kickoff.

## What to measure

- tokens in/out and wall-clock per edge function, tagged with user id and run id
- **cost per run, by output type** — spec vs `agent.md` vs skill vs MVP. If
  those diverge by more than ~3×, runs have to become weighted credits.
- iterations per run (the distribution) — this is the number that decides
  whether "iterations are free" survives
- runs per user per month, p50 and p95 — the cap belongs past p95
- capture → run conversion: how many captures ever become a run
- free → Pro conversion against runs used in the first week

## Sources

- [AI SaaS Pricing Models in 2026 — Fungies](https://fungies.io/ai-saas-pricing-models-2026/)
- [SaaS Pricing Models: The Complete 2026 Guide — Pricing.io](https://www.pricingio.com/insights/saas-pricing-models-2026)
- [AI Is Killing SaaS Margins — Fraction](https://www.hirefraction.com/blog/ai-is-killing-saas-margins-outcome-based-pricing-is-how-you-get-them-back/)
- [AI SaaS Pricing Strategy: Tokens & Subscriptions — QubitTool](https://qubittool.com/blog/ai-saas-global-pricing-token-subscription)
- [How to Price Your AI Product or Feature — Reforge](https://www.reforge.com/blog/how-to-price-your-ai-product)
- [AI Pricing Guide 2026 — AIVario](https://aivario.com/blog/ai-pricing-guide-2026)
- [AI Subscription Price Comparison Table 2026 — Aizolo](https://aizolo.com/blog/ai-subscription-price-comparison-table/)
- [Gumloop Pricing Simplified for 2026 — Lindy](https://www.lindy.ai/blog/gumloop-pricing)
