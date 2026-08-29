// Loads a user's personal instructions ("second brain rules") and renders them
// as a system-prompt block that every Asher / AI call injects.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export type UserInstructions = {
  general: string;
  capture: string;
  summarize: string;
  tagging: string;
  organizing: string;
};

export const emptyInstructions: UserInstructions = {
  general: "",
  capture: "",
  summarize: "",
  tagging: "",
  organizing: "",
};

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

export async function loadInstructions(userId: string): Promise<UserInstructions> {
  try {
    const { data, error } = await svc()
      .from("user_instructions")
      .select("general, capture, summarize, tagging, organizing")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return emptyInstructions;
    return {
      general: String(data.general ?? "").slice(0, 4000),
      capture: String(data.capture ?? "").slice(0, 4000),
      summarize: String(data.summarize ?? "").slice(0, 4000),
      tagging: String(data.tagging ?? "").slice(0, 4000),
      organizing: String(data.organizing ?? "").slice(0, 4000),
    };
  } catch (_e) {
    return emptyInstructions;
  }
}

type Scope = "chat" | "summarize" | "tagging" | "organizing" | "all";

/** Renders the instruction block for a given scope. Empty string when nothing is set. */
export function renderInstructions(ins: UserInstructions, scope: Scope = "all"): string {
  const rows: Array<[string, string]> = [];
  if (ins.general.trim()) rows.push(["How I think / general rules", ins.general.trim()]);
  if ((scope === "all" || scope === "chat") && ins.capture.trim()) {
    rows.push(["Capture rules", ins.capture.trim()]);
  }
  if ((scope === "all" || scope === "summarize" || scope === "chat") && ins.summarize.trim()) {
    rows.push(["Summarizing rules", ins.summarize.trim()]);
  }
  if ((scope === "all" || scope === "tagging") && ins.tagging.trim()) {
    rows.push(["Tagging rules", ins.tagging.trim()]);
  }
  if ((scope === "all" || scope === "organizing" || scope === "chat") && ins.organizing.trim()) {
    rows.push(["Organizing rules", ins.organizing.trim()]);
  }
  if (rows.length === 0) return "";
  return [
    "## The user's personal instructions (authoritative — follow these over your defaults)",
    ...rows.map(([label, body]) => `### ${label}\n${body}`),
  ].join("\n\n");
}

/** Convenience: load + render in one call. */
export async function instructionBlock(userId: string, scope: Scope = "all"): Promise<string> {
  return renderInstructions(await loadInstructions(userId), scope);
}
