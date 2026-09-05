// Shared CORS policy.
//
// Every function used to answer `Access-Control-Allow-Origin: *`, so any page on
// the internet could call them with a customer's token. In production these are
// only ever called by our own app, so the origin is pinned to configuration.
//
// Set ALLOWED_ORIGIN (or APP_URL) to the production origin, e.g.
// https://fartbrain.app. The "*" fallback exists only so local development and
// preview deployments keep working when neither is set — production must set one.

/**
 * Normalize a configured origin to the form a browser actually sends.
 *
 * An Origin header is scheme + host + optional port and nothing else, so a
 * value copied out of an address bar — "https://fartbrain.app/", or with a
 * path, or capitalised — never matches. The failure is silent and total: every
 * request from the real app is refused, and the only clue is a CORS error in
 * the browser console. Configuration that is one keystroke from correct should
 * not behave the same as configuration that is absent.
 *
 * "*" is passed through: it is a valid ACAO value, not an origin.
 */
export function normalizeOrigin(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value === "*") return "*";
  try {
    const u = new URL(value.includes("://") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.origin; // scheme + host + port, no path, no trailing slash
  } catch {
    return null;
  }
}

/**
 * Read configuration without assuming Deno is present.
 *
 * The functions run on Deno, but this module is also imported by the test
 * suite, which runs on Node. Reaching for `Deno` unconditionally makes the
 * whole file unloadable there, so the pure logic above could not be tested at
 * all — which is how a normalization bug would reach production unexamined.
 */
function env(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (n: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

export const ALLOWED_ORIGIN =
  normalizeOrigin(env("ALLOWED_ORIGIN")) ?? normalizeOrigin(env("APP_URL")) ?? "*";

/** Standard headers. `Vary: Origin` keeps caches from crossing origins. */
export const baseCors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
};
