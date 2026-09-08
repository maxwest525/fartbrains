import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { guardAiRequest } from "../_shared/ai-guard.ts";
import { instructionBlock } from "../_shared/instructions.ts";

/**
 * The last step of a run: turn the material into the thing.
 *
 * Everything upstream — transcribe, OCR, extract, scrape, research — exists to
 * make this call good. It is also the only step whose absence means the person
 * got nothing, and by a wide margin the most expensive one, which is why the
 * output kind is chosen deliberately before we get here (see
 * `src/lib/outputKind.ts`) rather than guessed at inside the prompt.
 *
 * Five outputs, five different jobs. A spec and an agent.md are not the same
 * document with different headings: one is written for a person deciding
 * whether to build, the other for a machine already inside a repo.
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

type OutputKind = "spec" | "agent" | "skill" | "mvp" | "playbook";

const KINDS: Record<OutputKind, { system: string; model: string }> = {
  spec: {
    model: "google/gemini-3-pro-preview",
    system: `Write an implementation spec detailed enough that a competent developer or
coding agent could build the thing without asking a follow-up question.

Structure: what it is in one paragraph; who it is for; the core flows in order;
the data it needs; what is explicitly out of scope; open questions.

Be specific where the material is specific and say "not covered by the source"
where it is not. Never invent a number, a price, a metric or a tool name that
is not in the material — a spec that quietly fabricates its inputs is worse
than a short one.`,
  },
  agent: {
    model: "google/gemini-3-pro-preview",
    system: `Write an AGENTS.md: standing instructions for a coding agent already working
inside someone's repository.

Write imperatives to the agent, not prose about the project. Cover: what this
project is, the conventions to follow, what to do and what never to do, and how
to verify work before claiming it is done.

This is read by a machine on every task, so length is a cost. Cut anything the
agent could work out by reading the code. Never invent a command, a path, a
framework or a script that is not in the material.`,
  },
  skill: {
    model: "google/gemini-3-pro-preview",
    system: `Write a reusable skill: a procedure this person can invoke again on new
inputs, shaped around how they work.

Start with when to use it and when not to. Then the steps, in order, each one
concrete enough to follow without judgement calls. End with what a good result
looks like, so it can be checked.

The value is in it being reusable, so keep it about the method and out of the
specifics of the one example that prompted it.`,
  },
  mvp: {
    model: "google/gemini-3-pro-preview",
    system: `Produce a working starting point: real, runnable code, not a description of
code.

Pick the smallest stack that does the job and say why in one line. Give the
file tree, then each file in a fenced block labelled with its path. Include the
run command and what the person should see when it works.

Scope hard. One flow that genuinely runs beats six that are stubbed. State what
you deliberately left out. Never reference a package version or an API you are
not confident exists.`,
  },
  playbook: {
    model: "google/gemini-3-flash-preview",
    system: `Write a playbook: a repeatable procedure for doing this, not building it.

Numbered steps in the order they happen. Each step says what to do, what it
needs, and how to tell it worked. Note where a step commonly goes wrong.

This is for someone executing on a Tuesday, not evaluating an idea. No
background section, no rationale essay — the reason to do it is not the
question being asked.`,
  },
};

const isKind = (k: unknown): k is OutputKind =>
  typeof k === "string" && Object.prototype.hasOwnProperty.call(KINDS, k);

/**
 * Assemble the prompt from whatever the run actually gathered.
 *
 * Every section is labelled with where it came from, because the model needs to
 * be able to tell a claim made in the source video from something a scraped
 * page said, and so does anyone reading the output afterwards.
 */
const buildMaterial = (b: Record<string, unknown>): string => {
  const parts: string[] = [];
  const add = (label: string, value: unknown, cap: number) => {
    if (typeof value === "string" && value.trim()) {
      parts.push(`## ${label}\n${value.trim().slice(0, cap)}`);
    }
  };
  add("The source, transcribed", b.transcript, 40_000);
  add("Summary", b.summary, 8_000);
  add("Research findings", b.research, 30_000);
  add("Pages it linked to", b.scraped, 30_000);
  if (Array.isArray(b.links) && b.links.length) {
    parts.push(`## Links\n${b.links.filter((l) => typeof l === "string").slice(0, 40).join("\n")}`);
  }
  return parts.join("\n\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "compose_output");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const body = await req.json();
    const { kind, intent, title } = body ?? {};
    if (!isKind(kind)) return json({ error: "Unknown output kind" }, 400);

    const material = buildMaterial(body ?? {});
    if (material.length < 40) {
      return json({ error: "Not enough material to build anything yet" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const spec = KINDS[kind];
    // "summarize" is the scope that governs generated prose. It also pulls in the
    // general "how I think" rules, which are the ones that matter most here —
    // an output shaped like the person wants is the entire point.
    const userRules = await instructionBlock(_auth.user.id, "summarize");

    // The person's own words go last and are named as the thing to satisfy.
    // "Make this but for Instagram too" is the whole job; the reel is context.
    const wanted = typeof intent === "string" && intent.trim()
      ? `\n\nWHAT THEY ASKED FOR — this is the job, the material above is context:\n${intent.trim().slice(0, 2_000)}`
      : "";

    const system = [
      spec.system,
      userRules ? `\n${userRules}\n\nThe user's rules override the generic guidance above.` : "",
      "\nOutput markdown only. No preamble, no closing commentary, no offer to help further.",
    ].join("");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `${title ? `Working title: ${title}\n\n` : ""}${material}${wanted}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("compose-output gateway error:", resp.status, detail);
      // 429 and 402 are worth distinguishing: one is wait, the other is pay.
      if (resp.status === 429) return json({ error: "Rate limited — try again shortly" }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "Couldn't build the output" }, 502);
    }

    const data = await resp.json();
    const output = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!output) return json({ error: "Came back empty" }, 502);

    return json({ kind, output });
  } catch (e) {
    console.error("compose-output error:", e);
    return json({ error: e instanceof Error ? e.message : "Couldn't build the output" }, 500);
  }
});
