# Pricing

Researched 2026-09-08. Sources at the bottom. This replaces the back-of-envelope
unit economics that were sitting in my head and never written down.

## What the market actually charges

| Product | Price | Shape |
|---|---|---|
| Reflect | $10/mo | flat, paid-only, no free tier |
| Mem | $12/mo Pro | free tier capped at 25 notes/mo |
| Notion AI | $20/user/mo (Business), or $10 base + $10 AI add-on | seat + AI add-on |
| ChatGPT / Claude / Perplexity / Google AI Pro | $19.99–$20 | flat |
| ChatGPT Go | $8 | budget anchor |
| Google AI Plus | $4.99 | budget anchor |
| GitHub Copilot | $10 individual / $19 seat | flat |
| Gumloop | free → $37/mo for 10,000 credits | credit-metered |

Two things fall out of that table:

1. **$19–20 is the consumer AI standard.** It is what everyone already pays for
   one AI subscription, so it is the number a buyer compares us to whether we
   like it or not.
2. **Note-app comparables sit *below* it** — $10–12. If we present as a notes
   app we get priced as one. If we present as "save the reel, get the build
   brief" we are selling an output, and outputs price against the $20 line.
   This is a pricing argument for the positioning, not just a marketing one.

## What the market has learned about *shape*

- Over 60% of AI SaaS now uses some form of credit-based hybrid: a subscription
  for access, metered credits for consumption. Gartner projects 70% of
  businesses prefer usage-based over per-seat by 2026.
- **Expose credits or tasks, never raw tokens** — unless the audience is
  developers. The credit is an abstraction layer: one credit can be 10 tokens
  today and 50 tomorrow, and we can swap models underneath without repricing.
- AI features compress SaaS gross margin from the classic 80–90% down to
  50–60%, because every call is real compute. Whatever we pick has to be
  repriceable when inference costs move.
- A $29–30 tier above the standard tier raises conversion *into the standard
  tier* by anchoring, even for people who never buy the top one.

## Our cost side

Every AI call in the app today goes through the Lovable AI gateway to Gemini:
`gemini-2.5-flash-lite` (4 functions), `gemini-2.5-flash` (3),
`gemini-3-flash-preview` (2), `gemini-3.1-flash-lite` (1),
`gemini-3-pro-preview` (1). That is a cheap fleet, and it matters: the Flash
tier is what makes an unmetered capture step affordable.

Rough cost per unit of work (estimated from published token prices, not yet
measured against real logs — see "What to measure" below):

| Step | Model | Est. cost |
|---|---|---|
| Transcribe + summarize + auto-tag one reel | Flash-Lite | ~$0.001 |
| Extract links / scrape / references | Flash-Lite | ~$0.002 |
| Deep research (multi-hop, several pages) | Flash | ~$0.01–0.02 |
| Build brief / detailed spec (long output) | 3 Pro | ~$0.05–0.08 |
| Ash chat turn over the vault | Flash | ~$0.002 |

**Capture is ~a tenth of a cent. A brief is ~a nickel.** The whole cost curve
lives in one step. That is the single most important fact for pricing this
product, and it points at exactly one structure.

## Recommendation

Meter the brief. Do not meter the capture.

| Tier | Price | What you get |
|---|---|---|
| **Free** | $0 | Unlimited capture, transcribe, summarize, tag, file. **3 briefs/mo.** |
| **Pro** | **$19/mo** ($190/yr) | Unlimited capture. **100 briefs/mo.** Deep research, Ash over the whole vault, MCP connect, share targets. |
| **Studio** | **$49/mo** | 500 briefs/mo, priority queue, push-to-external-LLM, webhooks, API. |
| Extra briefs | $5 per 50 | Overage, never a hard stop mid-loop. |

Why this and not the alternatives:

- **Capture unmetered is the whole product.** The habit is paste-a-link-and-
  forget. A counter on that step kills the habit, and the step costs a tenth of
  a cent — metering it buys us nothing and costs us retention. Mem's 25-note
  free cap is the mistake to avoid.
- **The brief is the thing worth paying for**, it is the expensive step, and it
  is a unit a person can actually count. "Briefs" beats "credits" here: we have
  one expensive operation, not a zoo of them, so the abstraction layer that
  Gumloop needs is overhead we don't. If we later add OCR, object detection and
  multi-step loops with wildly different costs, *that* is when we convert
  briefs into credits — the migration is a rename plus a multiplier.
- **Margin check at Pro.** 100 briefs at $0.08 = $8 COGS worst case, plus
  maybe $1 of capture/chat, against $19. That is ~53% gross margin at the cap —
  the bottom of the compressed band, and only for someone who uses every last
  brief. Realistically most Pro users will run 10–20 briefs and sit at 90%+.
  The cap exists to bound the tail, not to be hit.
- **$49 anchors $19.** Per the anchoring finding, the top tier earns its keep
  even if few buy it.
- **Annual at 10 months** is standard and pulls cash forward.

### What has to be true before we ship this

1. **Measure, don't estimate.** Log tokens in/out per edge-function call and
   per user for two weeks. Every number in the cost table above is derived from
   list prices, not from our logs. If a real brief turns out to cost $0.30 the
   Pro cap has to come down to ~40.
2. **A brief must be worth $0.19.** At 100/mo the buyer is paying about 19¢ per
   brief. That is only obviously worth it if the brief is a genuinely detailed,
   professional spec. The pricing rests on the product quality of one artifact.
3. **Metering needs a counter in the UI** before the cap is enforced. A cap the
   user cannot see is a bug report.

## What to measure

- tokens in/out and wall-clock per edge function, tagged with user id
- briefs generated per user per month (the distribution, not the mean — the
  cap should sit somewhere past p95)
- capture → brief conversion: how many captures ever become a brief
- free → Pro conversion against briefs used in the first week

## Sources

- [AI SaaS Pricing Models in 2026 — Fungies](https://fungies.io/ai-saas-pricing-models-2026/)
- [SaaS Pricing Models: The Complete 2026 Guide — Pricing.io](https://www.pricingio.com/insights/saas-pricing-models-2026)
- [AI Is Killing SaaS Margins — Fraction](https://www.hirefraction.com/blog/ai-is-killing-saas-margins-outcome-based-pricing-is-how-you-get-them-back/)
- [AI SaaS Pricing Strategy: Tokens & Subscriptions — QubitTool](https://qubittool.com/blog/ai-saas-global-pricing-token-subscription)
- [How to Price Your AI Product or Feature — Reforge](https://www.reforge.com/blog/how-to-price-your-ai-product)
- [AI Pricing Guide 2026 — AIVario](https://aivario.com/blog/ai-pricing-guide-2026)
- [AI Subscription Price Comparison Table 2026 — Aizolo](https://aizolo.com/blog/ai-subscription-price-comparison-table/)
- [Gumloop Pricing Simplified for 2026 — Lindy](https://www.lindy.ai/blog/gumloop-pricing)
- [Best AI Note-Taking Apps in 2026 — Techno-Pulse](https://www.techno-pulse.com/2026/04/best-ai-note-taking-apps-in-2026-notion.html)
