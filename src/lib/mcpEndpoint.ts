/**
 * Where a subscriber points their own agent.
 *
 * Derived from the same Supabase URL the app already uses rather than
 * hardcoded, so a preview deployment or a self-hosted instance shows its own
 * endpoint instead of confidently handing out production's.
 */
export function mcpEndpoint(
  supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string | null {
  const base = (supabaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:") return null;
    return `${url.origin}/functions/v1/mcp`;
  } catch {
    return null;
  }
}

/**
 * The line a subscriber pastes into their own agent session.
 *
 * Deliberately plain language rather than a vendor-specific command: the
 * product's claim is that you point whatever agent you already use at one
 * governed endpoint, and a command that only works in one client undercuts
 * that. Clients that support remote MCP servers handle the rest, including
 * the sign-in.
 */
export function connectPrompt(endpoint: string): string {
  return `Connect to my Fart Brains second brain at ${endpoint} — it is a remote MCP server. Sign in when prompted, then call get_instructions and recall_context before we start, so you are working from what I have already saved.`;
}
