/**
 * Folder webhooks — forwarding captures to an endpoint the owner chooses.
 *
 * The URL is checked here before it is saved, and checked again server-side
 * before anything is fetched. This copy exists to tell someone their address
 * is wrong while they are still typing it, not to be the security boundary:
 * the browser cannot resolve DNS, so it cannot know that a public-looking
 * hostname points at a private address. `_shared/ssrf.ts` decides that.
 */

export type FolderWebhook = {
  folder_id: string;
  url: string;
  secret: string;
  enabled: boolean;
  include_note: boolean;
  include_summary: boolean;
  last_status: number | null;
  last_error: string | null;
  last_delivered_at: string | null;
  delivery_count: number;
};

export type UrlProblem =
  | "empty"
  | "unparseable"
  | "not_http"
  | "local"
  | "too_long"
  | null;

/** Obvious local addresses. The server rejects the rest, including by DNS. */
const LOCAL_HOSTS = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\[?::1\]?)/i;

export function urlProblem(raw: string): UrlProblem {
  const value = raw.trim();
  if (!value) return "empty";
  if (value.length > 2048) return "too_long";
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "unparseable";
  }
  if (!["http:", "https:"].includes(u.protocol)) return "not_http";
  if (LOCAL_HOSTS.test(u.hostname) || u.hostname.endsWith(".local")) return "local";
  return null;
}

export const urlProblemMessage = (p: UrlProblem): string | null => {
  switch (p) {
    case "empty":
      return "Enter the address your endpoint listens on.";
    case "unparseable":
      return "That doesn't look like a URL. It should start with https://";
    case "not_http":
      return "Only http:// and https:// addresses can receive a webhook.";
    case "local":
      return "That address is on a private network, so our servers can't reach it.";
    case "too_long":
      return "That URL is too long.";
    default:
      return null;
  }
};

/**
 * The shape a receiver should expect. Kept next to the code that documents it
 * so the example in the UI cannot drift from what the edge function sends.
 */
export const EXAMPLE_PAYLOAD = {
  event: "idea.captured",
  sent_at: "2026-09-06T04:00:00.000Z",
  folder_id: "…",
  idea: {
    id: "…",
    title: "Cold email angle worth testing",
    note: "the one about leading with the refund stat",
    summary: null,
    source_url: "https://example.com/article",
    tags: ["marketing"],
    captured_at: "2026-09-06T03:59:00.000Z",
  },
} as const;

/**
 * How a receiver verifies a delivery, written out because "HMAC the body" is
 * ambiguous about what exactly gets signed.
 */
export const VERIFY_SNIPPET = `// Node — verify a Fartbrains delivery
import crypto from "node:crypto";

app.post("/hook", express.raw({ type: "*/*" }), (req, res) => {
  const ts  = req.get("X-Fartbrains-Timestamp");
  const sig = req.get("X-Fartbrains-Signature");        // "sha256=<hex>"
  const body = req.body.toString("utf8");

  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.FARTBRAINS_SECRET)
    .update(\`\${ts}.\${body}\`)                            // timestamp, dot, body
    .digest("hex");

  const ok = sig?.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return res.sendStatus(401);

  // Reject anything older than five minutes so a captured delivery
  // cannot be replayed at you later.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401);

  res.sendStatus(200);
  handle(JSON.parse(body));
});`;

/** One line describing the last attempt, for the settings screen. */
export function deliveryStatusLine(hook: FolderWebhook): string {
  if (!hook.last_delivered_at) return "Not sent yet.";
  const when = new Date(hook.last_delivered_at).toLocaleString();
  if (hook.last_error) return `Last attempt ${when} failed: ${hook.last_error}`;
  const n = hook.delivery_count;
  return `Last delivered ${when}. ${n} ${n === 1 ? "delivery" : "deliveries"} so far.`;
}
