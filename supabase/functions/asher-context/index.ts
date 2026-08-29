import { requireUser } from "../_shared/user-auth.ts";
import { buildAsherPrompt, type IdeaContext } from "../_shared/asher-prompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Returns exactly what Asher will see for the next response: the personal
// instructions block, the idea in focus, and the retrieved vault context.
// Read-only — used by the prompt preview panel.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if ("response" in _auth) return _auth.response;

  try {
    const { query, ideaId } = await req.json().catch(() => ({ query: "", ideaId: null }));

    let idea: IdeaContext | null = null;
    if (typeof ideaId === "string" && ideaId) {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data } = await svc
        .from("ideas")
        .select("id, title, raw_note, ai_summary, generated_prompt, extracted_text")
        .eq("user_id", _auth.user.id)
        .eq("id", ideaId)
        .maybeSingle();
      idea = (data as IdeaContext | null) ?? null;
    }

    const built = await buildAsherPrompt({
      userId: _auth.user.id,
      query: typeof query === "string" ? query : "",
      idea,
    });

    return new Response(
      JSON.stringify({
        systemPrompt: built.systemPrompt,
        instructions: built.instructions,
        ideaContext: built.ideaContext,
        vaultContext: built.vaultContext,
        hits: built.hits.map((h) => ({
          id: h.id,
          title: h.title,
          tags: h.tags,
          snippet: h.snippet,
          score: h.score,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("asher-context error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
