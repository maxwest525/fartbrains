// Reading what a gateway call actually cost.
//
// `ai_usage_events` has had `model`, `input_units`, `output_units` and
// `estimated_cost` columns since it was created, and every one of them is NULL
// on every row in production. Thirteen functions call the AI gateway; four call
// record() at all, and the four that do report string lengths and byte counts
// rather than tokens. So there is no way to answer what a capture or an output
// costs, which is the single thing pricing is waiting on.
//
// The gateway returns the numbers already. Nothing was reading them.
//
// Design note: the tokens and the model name are the ground truth and are
// always recorded. `estimated_cost` is derived from a price table that goes
// stale the moment a provider reprices, so it is recorded only for models we
// have a price for and left null otherwise — a null is honest, a wrong number
// silently poisons every margin calculation built on it. Recorded tokens let
// cost be recomputed later at whatever the price turns out to have been.

/** Usage as the OpenAI-compatible gateway reports it. */
type GatewayUsage = {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
};

export type AiCost = {
  model: string | null;
  inputUnits: number | null;
  outputUnits: number | null;
  /** USD. Null when we have no price for the model — see the note above. */
  estimatedCost: number | null;
};

export const NO_COST: AiCost = {
  model: null,
  inputUnits: null,
  outputUnits: null,
  estimatedCost: null,
};

/**
 * USD per million tokens, as [input, output].
 *
 * MAINTENANCE: these are list prices and they move. A model missing from here
 * is not an error — it records tokens and a null cost. Add a row when you have
 * checked the price, not when you can guess it.
 */
const PRICES: Record<string, [number, number]> = {
  "google/gemini-2.5-flash-lite": [0.10, 0.40],
  "google/gemini-2.5-flash": [0.30, 2.50],
};

const asCount = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

/**
 * Pull model and token counts out of a parsed gateway response.
 *
 * @param data   the already-parsed JSON body
 * @param fallbackModel the model we asked for, used when the response omits it
 *   — which is the common case on some providers, and the model we requested is
 *   still the right answer.
 */
export function costFrom(data: unknown, fallbackModel?: string): AiCost {
  const body = (data ?? {}) as { model?: unknown; usage?: GatewayUsage };
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : (fallbackModel ?? null);

  const usage = (body.usage ?? {}) as GatewayUsage;
  const inputUnits = asCount(usage.prompt_tokens);
  let outputUnits = asCount(usage.completion_tokens);

  // Some responses give only a total. A total minus a known input is a real
  // output count; without the input it is not, and guessing would be worse
  // than recording nothing.
  if (outputUnits === null) {
    const total = asCount(usage.total_tokens);
    if (total !== null && inputUnits !== null) outputUnits = Math.max(0, total - inputUnits);
  }

  return { model, inputUnits, outputUnits, estimatedCost: estimate(model, inputUnits, outputUnits) };
}

/**
 * Cost in USD, or null when we cannot say.
 *
 * Requires both counts: pricing input and output at different rates is the
 * whole point, so half the data gives a number that is wrong in an unknown
 * direction.
 */
export function estimate(
  model: string | null,
  inputUnits: number | null,
  outputUnits: number | null,
): number | null {
  if (!model || inputUnits === null || outputUnits === null) return null;
  const price = PRICES[model];
  if (!price) return null;
  const usd = (inputUnits * price[0] + outputUnits * price[1]) / 1_000_000;
  // Six decimals: a Flash-Lite call costs fractions of a cent and rounding to
  // cents would record every single one of them as zero.
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Whether we have a price for this model, for reporting coverage. */
export const hasPrice = (model: string | null): boolean => !!model && !!PRICES[model];
