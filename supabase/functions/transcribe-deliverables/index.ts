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
  "Access-Control-Allow-Origin": "*",
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

    const tool = {
      type: "function",
      function: {
        name: "save_deliverables",
        description:
          "Return the verbatim transcript and the list of typed deliverables extracted from it.",
        parameters: {
          type: "object",
          properties: {
            transcript: {
              type: "string",
              description: "Verbatim transcript of the audio.",
            },
            items: {
              type: "array",
              description: "Deliverables extracted from the transcript, in spoken order.",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: allowedTypes,
                    description: "Best-fit deliverable type.",
                  },
                  text: {
                    type: "string",
                    description: "Short imperative text for the deliverable.",
                  },
                },
                required: ["type", "text"],
                additionalProperties: false,
              },
            },
          },
          required: ["transcript", "items"],
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
          {
            role: "user",
            content: [
              { type: "text", text: contextText },
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: mimeTypeToFormat(mimeType),
                },
              },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "save_deliverables" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return json({ error: "Rate limit hit. Wait a moment and try again." }, 429);
      }
      if (resp.status === 402) {
        return json(
          { error: "AI credits exhausted. Add credits in Lovable workspace." },
          402
        );
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return json({ error: "AI transcription failed" }, 500);
    }

    const data = await resp.json();
    const choice = data?.choices?.[0]?.message;
    const toolCall = choice?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      console.error("No tool call returned. choice:", JSON.stringify(choice));
      return json({ error: "Model did not return structured deliverables" }, 502);
    }

    let parsed: { transcript?: string; items?: Array<{ type?: string; text?: string }> } = {};
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch (e) {
      console.error("Failed to parse tool args:", e, argsRaw);
      return json({ error: "Couldn't parse model output" }, 502);
    }

    const transcript = (parsed.transcript ?? "").toString().trim();
    const items =
      (parsed.items ?? [])
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

/** Map a browser MediaRecorder mime type to the format string the gateway expects. */
function mimeTypeToFormat(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mp4") || lower.includes("aac") || lower.includes("m4a")) return "mp4";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  // Safe default — Gemini accepts webm-opus.
  return "webm";
}
