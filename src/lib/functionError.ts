/**
 * The real message behind a failed edge-function call.
 *
 * `supabase.functions.invoke` collapses every non-2xx response into a
 * FunctionsHttpError whose message is the literal string "Edge Function
 * returned a non-2xx status code", and puts the actual response in `.context`.
 * So a function that carefully explains itself in a 400 reaches the user as
 * "Edge function failed" — which is what happened on the first real use of the
 * Build panel, and cost more time to diagnose than the underlying bug.
 *
 * Functions in this repo should return 200 with an `error` field, and most do.
 * This exists for the ones that do not, and for anything genuinely 5xx.
 */
export const functionErrorMessage = async (
  error: unknown,
  fallback = "That didn't work. Try again.",
): Promise<string> => {
  const ctx = (error as { context?: unknown })?.context;

  // `context` is the raw Response on a FunctionsHttpError. Reading it is the
  // only way to see what the function actually said.
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      const message = (body as { error?: unknown })?.error;
      if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text.trim()) return text.trim().slice(0, 300);
      } catch { /* nothing readable — fall through */ }
    }
  }

  const raw = error instanceof Error ? error.message : "";
  // Never show the generic wrapper: it tells the person nothing and reads like
  // the app is broken rather than the request being unusable.
  if (!raw || /non-2xx status code/i.test(raw)) return fallback;
  return raw;
};
