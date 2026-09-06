import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXAMPLE_PAYLOAD } from "../webhooks";

/**
 * The delivery function fetches a URL an authenticated customer chose, which
 * is the definition of SSRF and the only place in the product where that is
 * true by design. These assert the properties that make it safe, on the
 * shipped source, since the function runs on Deno and needs live network and
 * database to execute.
 */
const SRC = readFileSync(
  resolve(__dirname, "../../../supabase/functions/deliver-webhook/index.ts"),
  "utf8",
);

describe("deliver-webhook", () => {
  it("fetches through safeFetch rather than fetch", () => {
    expect(SRC).toMatch(/import \{ safeFetch \} from "\.\.\/_shared\/ssrf\.ts"/);
    expect(SRC).toContain("await safeFetch(");
    // A bare fetch would skip validation entirely.
    expect(SRC).not.toMatch(/\bawait fetch\(/);
  });

  it("bounds redirects, so a hop cannot walk somewhere private", () => {
    expect(SRC).toMatch(/maxRedirects: \d+/);
  });

  it("requires an authenticated caller", () => {
    expect(SRC).toContain("requireUser(req, cors)");
  });

  it("scopes the webhook lookup by user_id, not only by the folder id given", () => {
    // The folder id arrives in the request body. Without this a caller could
    // name someone else's folder and read the webhook attached to it.
    const lookup = SRC.slice(SRC.indexOf('.from("folder_webhooks")'));
    expect(lookup).toMatch(/\.eq\("folder_id", folderId\)[\s\S]{0,80}\.eq\("user_id", userId\)/);
  });

  it("scopes the idea lookup by user_id too", () => {
    const lookup = SRC.slice(SRC.indexOf('.from("ideas")'));
    expect(lookup).toMatch(/\.eq\("user_id", userId\)/);
  });

  it("refuses to forward a trashed idea", () => {
    expect(SRC).toMatch(/if \(idea\.deleted_at\) return json\(\{ status: "trashed" \}\)/);
  });

  it("re-checks that the idea is still in the folder being delivered for", () => {
    expect(SRC).toMatch(/idea\.folder_id !== folderId/);
  });

  it("honours the owner's choice about note and summary", () => {
    expect(SRC).toContain("hook.include_note ? idea.raw_note : null");
    expect(SRC).toContain("hook.include_summary ? idea.ai_summary : null");
  });

  it("signs the timestamp together with the body", () => {
    // Signing the body alone lets a captured delivery be replayed with a fresh
    // timestamp header, since the header would not be covered.
    expect(SRC).toContain("`${timestamp}.${body}`");
    expect(SRC).toContain("X-Fartbrains-Signature");
    expect(SRC).toContain("X-Fartbrains-Timestamp");
  });

  it("times out and caps the body", () => {
    expect(SRC).toContain("AbortSignal.timeout(TIMEOUT_MS)");
    expect(SRC).toMatch(/MAX_BODY_BYTES/);
  });

  it("never reads the receiver's response into the vault", () => {
    expect(SRC).toContain("await resp.body?.cancel()");
  });

  it("sends the payload shape the settings page documents", () => {
    for (const key of Object.keys(EXAMPLE_PAYLOAD.idea)) {
      expect(SRC, key).toContain(`${key}:`);
    }
  });
});
