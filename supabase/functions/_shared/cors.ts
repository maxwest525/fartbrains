// Shared CORS policy.
//
// Every function used to answer `Access-Control-Allow-Origin: *`, so any page on
// the internet could call them with a customer's token. In production these are
// only ever called by our own app, so the origin is pinned to configuration.
//
// Set ALLOWED_ORIGIN (or APP_URL) to the production origin, e.g.
// https://fartbrains.app. The "*" fallback exists only so local development and
// preview deployments keep working when neither is set — production must set one.

export const ALLOWED_ORIGIN =
  Deno.env.get("ALLOWED_ORIGIN") ?? Deno.env.get("APP_URL") ?? "*";

/** Standard headers. `Vary: Origin` keeps caches from crossing origins. */
export const baseCors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
};
