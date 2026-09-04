# Pricing — WORK IN PROGRESS

**These numbers are a starting point, not a decision.** They are set so the
product is shippable and coherent; edit them and the code follows (see
"Where to change it" below).

## Comparable products
Personal knowledge / second-brain tools cluster in a narrow band. From memory of
the market rather than a live check — verify current prices before publishing:

| Product | Roughly |
|---|---|
| Obsidian Sync | ~$4–8 / mo |
| Heptabase | ~$7–12 / mo |
| Readwise Reader | ~$10 / mo |
| Reflect | ~$10 / mo |
| Mem | ~$10 / mo |
| Notion AI add-on | ~$10 / mo per member |
| Tana | ~$10–16 / mo |

**$8–12/month is the expected band.** Below it you look like a toy; above it you
are competing with Notion on breadth, which Fartbrains does not have.

## Proposed structure

### Free — $0
The point of the free plan is that **your notes are never held hostage**. It is
a real, permanent tier, not a trial.

- Unlimited items, folders, tags, reminders and tasks
- Full search
- Share links
- Full export (JSON + Markdown) and account deletion
- **50 AI actions per month**

### Pro — $9 / month, or $90 / year (2 months free)
- Everything in Free
- **1,000 AI actions per month**
- Higher rate limits and larger inputs (longer transcripts, bigger pages)
- Priority support

### Trial
14 days of Pro, no card required. Card-free trials convert worse but generate
far less refund noise for a solo operator — worth it at this scale.

## What counts as an "AI action"
Operations are weighted, because a 20-minute transcription is not the same cost
as an auto-tag:

| Operation | Weight |
|---|---|
| Deep research | 5 |
| Transcription (YouTube, Instagram, audio) | 3 |
| Ask your brain | 2 |
| Summarize, auto-tag, prompts, references, URL extraction | 1 |

So 50 free actions is roughly *50 summaries*, or *~16 transcriptions*, or a mix.

## Reasoning behind these numbers
- **$9** sits mid-band, reads as deliberate rather than as a rounded guess, and
  leaves room to raise to $12 later without a re-platform.
- **Annual at 10× monthly** is the standard "two months free" framing and is the
  easiest discount to explain.
- **50 free actions** is enough to genuinely feel the product on real notes, and
  small enough that a heavy user hits the wall inside a couple of weeks.
- **1,000 Pro actions** is far above normal personal use, so the limit exists to
  catch abuse and runaway loops, not to nickel-and-dime customers. Watch actual
  usage in `ai_usage_events` for a month before tightening it.

## Cost check — do this before publishing
Nothing above is grounded in your real provider bill. Before committing:
1. Run a month of real usage and read `ai_usage_events`.
2. Work out the cost of a worst-case Pro customer at 1,000 weighted actions.
3. If that exceeds roughly a third of $9, either lower the allowance or raise the
   price. A second-brain product where heavy users lose money is a trap.

## Where to change it
| What | Where |
|---|---|
| The price itself | Stripe dashboard; then set `STRIPE_PRICE_ID_PRO`. No code change. |
| Monthly allowances and rate limits | `PLAN_LIMITS` in `supabase/functions/_shared/ai-guard.ts` |
| Operation weights | `OPERATION_WEIGHT`, same file |
| Which features are paid | `PAID_ONLY` / `ALWAYS_AVAILABLE` in `_shared/billing.ts` (server, authoritative) and `src/lib/entitlements.ts` (UI mirror) |
| Trial length | Stripe price configuration |

## Not decided
- Whether to offer a lifetime or founding-member deal at launch.
- Whether transcription should be metered separately — it is by far the most
  expensive operation and the weighting may not be enough.
- Regional pricing.
