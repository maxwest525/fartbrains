import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { guardAiRequest } from "../_shared/ai-guard.ts";
/**
 * Transcribes a short audio clip and extracts typed deliverables in one shot.
 *
 * Request body:
 *   {
 *     audioBase64: string,         // raw base64 (no data: prefix)
 *     mimeType: string,            // e.g. "audio/webm" or "audio/mp4"
 *     allowedTypes: string[],      // deliverable type keys (task, buy, build, …)
 *     projectName?: string,        // optional context for the model
 *     existingItems?: string[]     // optional context (item texts already present)
 *   }
 *
 * Response:
 *   { transcript: string, items: Array<{ type: string, text: string }> }
 *
 * Uses Lovable AI Gateway with google/gemini-2.5-flash, which accepts inline
 * audio and tool-calls. No third-party STT key required.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "transcribe_deliverables");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const { audioBase64, mimeType, allowedTypes, projectName, existingItems } =
      (await req.json()) as {
        audioBase64?: string;
        mimeType?: string;
        allowedTypes?: string[];
        projectName?: string;
        existingItems?: string[];
      };

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return json({ error: "audioBase64 is required" }, 400);
    }
    if (!mimeType || typeof mimeType !== "string") {
      return json({ error: "mimeType is required" }, 400);
    }
    if (!allowedTypes || !Array.isArray(allowedTypes) || allowedTypes.length === 0) {
      return json({ error: "allowedTypes must be a non-empty array" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are a project assistant that turns spoken brain-dumps into a clean, typed to-do list.

You will receive a short audio recording. Do two things:
1. Transcribe it faithfully (verbatim, in the original language).
2. Split the transcript into discrete deliverables, each tagged with the single best type from this exact list: ${allowedTypes.join(", ")}.

Rules:
- One deliverable per actionable item. Merge filler/repeats. Drop pure chatter.
- Keep each item short, imperative, and action-oriented (e.g. "Order resistance bands", "Call dentist about Tuesday", "Build landing hero").
- Pick the most specific type. Use "task" only when nothing else fits. Use "other" as a last resort.
- Heuristics: "buy/order/get" things → buy or order, "talk to/call" → call, "meet/sync with" → meeting, "research/look up/find out" → research, "build/design/create" → build, "ship/launch/publish" → ship, "decide/choose/pick" → decide.
- Return ONLY the function call, no prose.`;

    const contextLines: string[] = [];
    if (projectName) contextLines.push(`Project: ${projectName}`);
    if (existingItems && existingItems.length > 0) {
      contextLines.push(
        `Items already in this project (do NOT repeat these):\n- ${existingItems
          .slice(0, 30)
          .join("\n- ")}`
      );
    }
    const contextText =
      contextLines.length > 0
        ? `${contextLines.join("\n\n")}\n\nNow process the audio:`
        : "Process the audio:";

    // 1) Transcribe via Lovable AI's dedicated STT endpoint (more reliable
    //    than passing inline audio to a chat model).
    const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const ext = mimeTypeToExt(mimeType);
    const sttForm = new FormData();
    sttForm.append(
      "file",
      new File([audioBytes], `recording.${ext}`, { type: mimeType }),
    );
    sttForm.append("model", "openai/gpt-4o-mini-transcribe");

    const sttResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: sttForm,
      },
    );

    if (!sttResp.ok) {
      if (sttResp.status === 429) {
        return json({ error: "Rate limit hit. Wait a moment and try again." }, 429);
      }
      if (sttResp.status === 402) {
        return json({ error: "AI credits exhausted. Add credits in Lovable workspace." }, 402);
      }
      const t = await sttResp.text().catch(() => "");
      console.error("STT error:", sttResp.status, t);
      return json({ error: `Transcription failed (${sttResp.status})` }, 500);
    }

    const sttData = await sttResp.json().catch(() => ({} as Record<string, unknown>));
    const transcript = typeof (sttData as { text?: unknown }).text === "string"
      ? ((sttData as { text: string }).text).trim()
      : "";

    if (!transcript) {
      return json({ transcript: "", items: [] });
    }

    // 2) Ask Gemini to split the transcript into typed deliverables.
    const tool = {
      type: "function",
      function: {
        name: "save_deliverables",
        description: "Return the list of typed deliverables extracted from a transcript.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Deliverables extracted from the transcript, in spoken order.",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: allowedTypes },
                  text: { type: "string" },
                },
                required: ["type", "text"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${contextText}\n\nTranscript:\n${transcript}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "save_deliverables" } },
      }),
    });

    if (!resp.ok) {
      // Transcript is the important thing — return it even if extraction fails.
      console.error("Deliverable extraction failed:", resp.status, await resp.text().catch(() => ""));
      return json({ transcript, items: [] });
    }

    const data = await resp.json();
    const argsRaw = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { items?: Array<{ type?: string; text?: string }> } = {};
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : (argsRaw ?? {});
    } catch {
      parsed = {};
    }

    const items = (parsed.items ?? [])
      .map((i) => ({
        type: typeof i?.type === "string" ? i.type : "task",
        text: typeof i?.text === "string" ? i.text.trim() : "",
      }))
      .filter((i) => i.text.length > 0 && allowedTypes.includes(i.type));

    return json({ transcript, items });
  } catch (e) {
    console.error("transcribe-deliverables error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});

/** Map a browser MediaRecorder mime type to a file extension OpenAI's STT recognizes. */
function mimeTypeToExt(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mp4") || lower.includes("aac") || lower.includes("m4a")) return "mp4";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  return "webm";
}

