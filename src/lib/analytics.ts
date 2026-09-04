/**
 * Product analytics — metadata only, never content.
 *
 * The whole product is private notes. Analytics must therefore be able to
 * answer "did onboarding work" without ever being a second copy of someone's
 * brain. Nothing here may carry note bodies, transcripts, chats, extracted page
 * content, search queries, titles, tags, URLs or email addresses.
 *
 * `track()` accepts only a fixed event name and a small map of primitive
 * properties, and strips anything that looks like content before sending.
 */

export type AnalyticsEvent =
  | "signup_completed"
  | "onboarding_started"
  | "onboarding_completed"
  | "first_capture_completed"
  | "capture_completed"
  | "import_started"
  | "import_completed"
  | "search_used"
  | "ask_used"
  | "reminder_created"
  | "share_created"
  | "share_revoked"
  | "export_downloaded"
  | "checkout_started"
  | "subscription_activated"
  | "subscription_canceled"
  | "account_deleted";

/** Only these property keys are ever allowed to leave the browser. */
const ALLOWED_PROPS = new Set([
  "source_type",   // "manual" | "webpage" | "transcript" | "audio"
  "count",         // how many, never what
  "duration_ms",
  "format",        // "json" | "markdown" | "csv"
  "plan",
  "status",
  "step",
  "result",        // "success" | "partial" | "failure"
  "surface",       // "mobile" | "desktop"
]);

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Drops any property not on the allowlist, and truncates strings, so a future
 * caller cannot accidentally leak content by inventing a new property name.
 */
export function sanitizeProps(props: AnalyticsProps = {}): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      // Even allowlisted strings are enums; anything long is a mistake.
      out[k] = v.slice(0, 32);
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

type Sink = (event: AnalyticsEvent, props: AnalyticsProps) => void;

let sink: Sink | null = null;

/**
 * Install the destination. Left unset, `track()` is a no-op — no analytics
 * provider is wired yet, and shipping without one is better than shipping with
 * one that has not been reviewed for what it collects.
 */
export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  const safe = sanitizeProps(props);
  try {
    sink?.(event, safe);
  } catch {
    // Analytics must never break the product.
  }
}
