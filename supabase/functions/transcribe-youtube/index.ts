/**
 * Transcribe a YouTube video by delegating to the Hyperfx MCP server.
 *
 * Hyperfx already runs a `youtube-transcriber` agent (captions → ElevenLabs
 * fallback, with its own cache). We just open an MCP session, call the tool,
 * and reshape the response for the existing frontend (`fromYoutube` in
 * src/lib/extractedContent.ts).
 *
 * Auth: Hyperfx MCP endpoint requires OAuth. We use a long-lived access token
 * the user obtained once (stored as HYPERFX_ACCESS_TOKEN). When it expires,
 * surface a 401 so the user knows to re-authorize.
 */

const HYPERFX_MCP_URL = "https://backend.hyperfx.ai/mcp/";
const MCP_PROTOCOL_VERSION = "2025-06-18";
// Substrings we look for when picking the right tool out of tools/list.
const TOOL_NAME_HINTS = ["youtube-transcriber", "youtube_transcriber", "youtube"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isYouTubeHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return (
    h === "youtube.com" ||
    h === "www.youtube.com" ||
    h === "m.youtube.com" ||
    h === "music.youtube.com" ||
    h === "youtu.be"
  );
};

type McpEnvelope = {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

/** Parse either a plain JSON response or an SSE stream containing a JSON-RPC envelope. */
async function readMcpResponse(resp: Response): Promise<{ envelope: McpEnvelope | null; raw: string }> {
  const text = await resp.text();
  if (!text.trim()) return { envelope: null, raw: "" };
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream") || text.startsWith("event:") || text.startsWith("data:")) {
    for (const block of text.split(/\n\n+/)) {
      const dataLines = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);
      if (!dataLines.length) continue;
      try {
        const payload = JSON.parse(dataLines.join("\n")) as McpEnvelope;
        if (payload.id !== undefined || payload.result !== undefined || payload.error) {
          return { envelope: payload, raw: text };
        }
      } catch {
        // ignore and continue
      }
    }
    return { envelope: null, raw: text };
  }
  try {
    return { envelope: JSON.parse(text) as McpEnvelope, raw: text };
  } catch {
    return { envelope: null, raw: text };
  }
}

async function mcpCall(opts: {
  token: string;
  sessionId?: string;
  body: Record<string, unknown>;
}): Promise<{ envelope: McpEnvelope | null; sessionId: string | undefined; status: number; raw: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  };
  if (opts.sessionId) headers["Mcp-Session-Id"] = opts.sessionId;

  const resp = await fetch(HYPERFX_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body),
  });

  const sessionId = resp.headers.get("mcp-session-id") ?? opts.sessionId;
  const { envelope, raw } = await readMcpResponse(resp);
  if (!envelope && !resp.ok) {
    console.error(`MCP ${opts.body.method} HTTP ${resp.status}:`, raw.slice(0, 500));
  }
  return { envelope, sessionId: sessionId ?? undefined, status: resp.status, raw };
}

/** Walk tools/call content[] looking for usable text/JSON. */
function extractTranscriptFromToolResult(result: unknown): {
  transcript: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  videoUrl?: string;
  finalUrl?: string;
  durationSeconds?: number;
} {
  // Standard MCP tools/call result: { content: [{ type: "text", text: "..." }], isError?: bool, structuredContent?: any }
  const out: ReturnType<typeof extractTranscriptFromToolResult> = { transcript: "" };
  if (!result || typeof result !== "object") return out;
  const r = result as Record<string, unknown>;

  // Prefer structuredContent if present.
  const structured = r.structuredContent;
  if (structured && typeof structured === "object") {
    mergeFields(out, structured as Record<string, unknown>);
  }

  const content = r.content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string") {
        const t = p.text.trim();
        // Try to parse as JSON first; fall back to raw text.
        if (t.startsWith("{") || t.startsWith("[")) {
          try {
            const parsed = JSON.parse(t);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              mergeFields(out, parsed as Record<string, unknown>);
              continue;
            }
          } catch {
            // fall through
          }
        }
        texts.push(t);
      }
    }
    if (!out.transcript && texts.length) out.transcript = texts.join("\n\n");
  }

  return out;
}

function mergeFields(out: Record<string, unknown>, src: Record<string, unknown>) {
  const pickStr = (keys: string[]) => {
    for (const k of keys) {
      const v = src[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };
  const pickNum = (keys: string[]) => {
    for (const k of keys) {
      const v = src[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };
  out.transcript ||= pickStr(["transcript", "text"]) ?? "";
  out.title ||= pickStr(["title", "videoTitle"]);
  out.author ||= pickStr(["author", "channel", "channelName", "uploader"]);
  out.thumbnail ||= pickStr(["thumbnail", "thumbnailUrl"]);
  out.videoUrl ||= pickStr(["videoUrl", "url"]);
  out.finalUrl ||= pickStr(["finalUrl", "canonicalUrl", "url"]);
  out.durationSeconds ||= pickNum(["durationSeconds", "duration"]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || typeof url !== "string") return json({ error: "URL required" }, 400);

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return json({ error: "Invalid URL" }, 400);
    }
    if (!isYouTubeHost(target.hostname)) {
      return json({ error: "URL must be a youtube.com or youtu.be link" }, 400);
    }
    if (target.pathname.startsWith("/playlist")) {
      return json({ error: "Playlists aren't supported — paste a single video URL." }, 400);
    }

    const token = Deno.env.get("HYPERFX_ACCESS_TOKEN");
    if (!token) {
      return json(
        { error: "HYPERFX_ACCESS_TOKEN not configured. Authorize Hyperfx and add the token." },
        500,
      );
    }

    // 1) initialize
    const init = await mcpCall({
      token,
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          clientInfo: { name: "lovable-app", version: "1.0.0" },
          capabilities: {},
        },
      },
    });

    if (init.status === 401) {
      return json({ error: "Hyperfx token rejected (401). Re-authorize and update HYPERFX_ACCESS_TOKEN." }, 401);
    }
    if (!init.envelope?.result) {
      console.error("Hyperfx initialize failed", init.status, init.envelope);
      return json({ error: `Hyperfx initialize failed (${init.status})` }, 502);
    }
    const sessionId = init.sessionId;

    // 2) notifications/initialized (fire and forget — no id)
    await mcpCall({
      token,
      sessionId,
      body: { jsonrpc: "2.0", method: "notifications/initialized" },
    });

    // 3) Find the youtube-transcriber agent via agents_list, then run it via agents_run.
    const agentsList = await mcpCall({
      token,
      sessionId,
      body: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "agents_list", arguments: { limit: 100 } },
      },
    });
    if (!agentsList.envelope?.result) {
      console.error("agents_list failed", agentsList.status);
      return json({ error: "Couldn't list Hyperfx agents" }, 502);
    }

    // Extract agent_id by walking the tool result text for an agent matching our hints.
    const listText = JSON.stringify(agentsList.envelope.result);
    let agentId: string | null = null;
    // Try parsing structured: result.content[].text often has JSON with agents array.
    const ac = (agentsList.envelope.result as Record<string, unknown>).content;
    if (Array.isArray(ac)) {
      for (const part of ac) {
        if (part && typeof part === "object" && (part as Record<string, unknown>).type === "text") {
          const t = (part as Record<string, unknown>).text as string;
          try {
            const parsed = JSON.parse(t);
            const agents = (parsed?.agents ?? parsed?.items ?? parsed) as Array<Record<string, unknown>>;
            if (Array.isArray(agents)) {
              const match = agents.find((a) => {
                const name = String(a.name ?? a.slug ?? "").toLowerCase();
                return TOOL_NAME_HINTS.some((h) => name.includes(h));
              });
              if (match) {
                agentId = String(match.id ?? match.agent_id ?? "");
                if (agentId) break;
              }
            }
          } catch {
            // fallback regex below
          }
        }
      }
    }
    if (!agentId) {
      // Fallback: regex hunt for an id near the agent name
      const m = listText.match(/"id"\s*:\s*"([^"]+)"[^}]*?(youtube|transcribe)/i)
        ?? listText.match(/(youtube|transcribe)[^}]*?"id"\s*:\s*"([^"]+)"/i);
      if (m) agentId = m[1].startsWith("agent") || m[1].length > 8 ? m[1] : m[2];
    }
    if (!agentId) {
      console.error("youtube agent not found in:", listText.slice(0, 1000));
      return json({ error: "youtube-transcriber agent not found on Hyperfx" }, 502);
    }

    // 4) Run the agent.
    const call = await mcpCall({
      token,
      sessionId,
      body: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "agents_run",
          arguments: {
            agent_id: agentId,
            message: `Transcribe this YouTube video and return only the transcript text: ${target.toString()}`,
            async_execution: false,
          },
        },
      },
    });

    if (call.envelope?.error) {
      console.error("Hyperfx tools/call error", call.envelope.error);
      return json({ error: `Hyperfx error: ${call.envelope.error.message}` }, 502);
    }
    if (!call.envelope?.result) {
      console.error("Hyperfx tools/call no result", call.status);
      return json({ error: `Hyperfx returned no result (${call.status})` }, 502);
    }

    const extracted = extractTranscriptFromToolResult(call.envelope.result);
    if (!extracted.transcript || extracted.transcript.trim().length < 5) {
      console.error("Hyperfx empty transcript", JSON.stringify(call.envelope.result).slice(0, 500));
      return json(
        { error: "Hyperfx returned no transcript for this video." },
        422,
      );
    }

    return json({
      transcript: extracted.transcript,
      title: extracted.title ?? "YouTube video",
      author: extracted.author ?? null,
      thumbnail: extracted.thumbnail ?? null,
      videoUrl: extracted.videoUrl ?? null,
      finalUrl: extracted.finalUrl ?? target.toString(),
      durationSeconds: extracted.durationSeconds ?? null,
      caption: "",
    });
  } catch (e) {
    console.error("transcribe-youtube error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
