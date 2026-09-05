import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // Malformed dictionary; fall through to legacy names.
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}

/** Forwards the verified bearer token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Invoke another edge function in this project as the signed-in user. */
export async function callFunction<T = unknown>(
  ctx: ToolContext,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = ctx.getToken();
  if (!token) throw new Error("callFunction requires a verified OAuth token");
  const res = await fetch(`${supabaseProjectUrl()}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabasePublishableKey(),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json?.error ?? `${name} failed (${res.status})`));
  }
  return json as T;
}

/** Standard guard used by every authed tool. */
export function requireAuth(ctx: ToolContext): string {
  if (!ctx.isAuthenticated()) throw new Error("Not authenticated");
  const userId = ctx.getUserId();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * Confirms an idea exists and is not in Trash, for tools that reach it by id.
 *
 * Trash means gone to the person who put it there: the app hides it, search
 * skips it, and a share link stops resolving. An agent holding an id from an
 * earlier turn is the one caller that can still reach past that, so the tools
 * which take an `idea_id` check here rather than trusting the id.
 *
 * RLS already scopes the row to its owner, so a missing row and someone else's
 * row are the same answer — which is also why the message says only that it
 * was not found.
 */
export async function requireLiveIdea(
  supabase: ReturnType<typeof supabaseForUser>,
  ideaId: string,
): Promise<{ error: string } | null> {
  const { data, error } = await supabase
    .from("ideas")
    .select("id, deleted_at")
    .eq("id", ideaId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Idea not found" };
  if ((data as { deleted_at: string | null }).deleted_at) {
    return { error: "That idea is in the Trash. Restore it in the app first." };
  }
  return null;
}

export const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });

export const jsonResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

export const errorResult = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});
