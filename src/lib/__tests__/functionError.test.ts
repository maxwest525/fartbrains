import { describe, it, expect } from "vitest";
import { functionErrorMessage } from "../functionError";

/** A FunctionsHttpError as supabase-js actually shapes it. */
const httpError = (body: unknown, ok = false) => {
  const err = new Error("Edge Function returned a non-2xx status code") as Error & {
    context: Response;
  };
  err.context = new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "application/json" },
  });
  return err;
};

describe("functionErrorMessage", () => {
  it("reads the error the function actually returned", async () => {
    const e = httpError({ error: "There is not enough here to build from yet." });
    expect(await functionErrorMessage(e)).toBe("There is not enough here to build from yet.");
  });

  it("never surfaces the generic wrapper, which tells the user nothing", async () => {
    const bare = new Error("Edge Function returned a non-2xx status code");
    expect(await functionErrorMessage(bare, "Couldn't build the output")).toBe(
      "Couldn't build the output",
    );
  });

  it("falls back to the body text when it is not JSON", async () => {
    expect(await functionErrorMessage(httpError("upstream exploded"))).toBe("upstream exploded");
  });

  it("uses the fallback when the body has no error field", async () => {
    expect(await functionErrorMessage(httpError({ ok: true }), "nope")).toBe("nope");
  });

  it("keeps a genuinely useful message that is not the wrapper", async () => {
    expect(await functionErrorMessage(new Error("Failed to fetch"))).toBe("Failed to fetch");
  });

  it("survives an error with no context at all", async () => {
    expect(await functionErrorMessage(null, "fallback")).toBe("fallback");
    expect(await functionErrorMessage({}, "fallback")).toBe("fallback");
    expect(await functionErrorMessage("a string", "fallback")).toBe("fallback");
  });

  it("trims and caps an over-long text body", async () => {
    const long = await functionErrorMessage(httpError("x".repeat(1000)));
    expect(long.length).toBe(300);
  });
});
