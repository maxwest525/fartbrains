import { describe, expect, it } from "vitest";
import { connectPrompt, mcpEndpoint } from "../mcpEndpoint";

describe("mcpEndpoint", () => {
  it("builds the endpoint from the Supabase URL", () => {
    expect(mcpEndpoint("https://abc123.supabase.co")).toBe(
      "https://abc123.supabase.co/functions/v1/mcp",
    );
  });

  it("tolerates a trailing slash rather than emitting a double slash", () => {
    expect(mcpEndpoint("https://abc123.supabase.co/")).toBe(
      "https://abc123.supabase.co/functions/v1/mcp",
    );
  });

  it("ignores any path already on the configured URL", () => {
    expect(mcpEndpoint("https://abc123.supabase.co/rest/v1")).toBe(
      "https://abc123.supabase.co/functions/v1/mcp",
    );
  });

  // Passing undefined falls through to the env default by design, so an
  // unset value reaches this function as an empty string.
  it("returns null when unconfigured, so the UI can say so instead of showing a broken URL", () => {
    expect(mcpEndpoint("")).toBeNull();
    expect(mcpEndpoint("   ")).toBeNull();
  });

  it("refuses a non-https URL — this address is handed out to be trusted", () => {
    expect(mcpEndpoint("http://abc123.supabase.co")).toBeNull();
    expect(mcpEndpoint("not a url")).toBeNull();
  });

  it("puts the endpoint in the connect prompt", () => {
    expect(connectPrompt("https://x.supabase.co/functions/v1/mcp")).toContain(
      "https://x.supabase.co/functions/v1/mcp",
    );
  });
});
