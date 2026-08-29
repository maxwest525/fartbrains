import { requireUser } from "../_shared/user-auth.ts";
import { buildAsherPrompt, type IdeaContext } from "../_shared/asher-prompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
// Streaming chat endpoint for the Asher prompt bar and idea brainstorming.
// Injects the user's personal instructions + retrieved vault context, then
// streams SSE deltas back to the client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function fetchIdea(userId: string, ideaId: string): Promise<IdeaContext | null> {
  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await svc
      .from("ideas")
      .select("id, title, raw_note, ai_summary, generated_prompt, extracted_text")
      .eq("user_id", userId)
      .eq("id", ideaId)
      .maybeSingle();
    return (data as IdeaContext | null) ?? null;
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if ("response" in _auth) return _auth.response;

  try {
    const { messages, ideaId, retrieve } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Drop any client-supplied system messages — the server owns the system prompt.
    const convo = messages.filter(
      (m: { role?: string }) => m?.role === "user" || m?.role === "assistant",
    );
    const lastUser = [...convo].reverse().find((m: { role: string }) => m.role === "user");
    const idea = typeof ideaId === "string" && ideaId ? await fetchIdea(_auth.user.id, ideaId) : null;

    const { systemPrompt } = await buildAsherPrompt({
      userId: _auth.user.id,
      query: String(lastUser?.content ?? ""),
      idea,
      retrieve: retrieve !== false,
    });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...convo],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit hit. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("ash-chat gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pass the SSE stream straight through.
    return new Response(resp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("ash-chat error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
