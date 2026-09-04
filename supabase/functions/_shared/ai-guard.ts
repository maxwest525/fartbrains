// Authentication + rate limiting + usage accounting for every paid operation.
//
// Every AI, transcription and scraping route must go through guardAiRequest()
// before it spends anything, and must call record() afterwards. Without this a
// single authenticated account can exhaust the provider budget for everyone.
//
// PRIVACY: only metadata is recorded. Never pass note bodies, transcripts,
// prompts, completions, scraped content or search queries into record().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { requireUser, type AuthedUser } from "./user-auth.ts";

export type AiOperation =
  | "summarize"
  | "ask"
  | "auto_tag"
  | "generate_prompt"
  | "optimize_prompt"
  | "suggest_instructions"
  | "related_ideas"
  | "cross_pollinate"
  | "deep_research"
  | "extract_url"
  | "scrape_url"
  | "extract_references"
  | "transcribe_youtube"
  | "transcribe_instagram"
  | "extract_instagram"
  | "transcribe_deliverables"
  | "context_preview";

export type Plan = "free" | "trialing" | "active";

type Limits = {
  /** Burst guard — repeated clicks and runaway loops. */
  perMinute: number;
  /** Sustained guard. */
  perHour: number;
  /** Plan allowance. */
  perMonth: number;
  /** Largest accepted input, in characters. */
  maxInputChars: number;
};

// Central plan configuration. Entitlements live here, never as scattered
// plan-name checks in components, and never as a frontend boolean.
//
// WORK IN PROGRESS: these allowances follow the draft structure in
// docs/PRICING.md and have NOT been checked against a real provider bill.
// Before launch, read a month of ai_usage_events and confirm a worst-case Pro
// customer at 1,000 weighted actions still leaves margin at the chosen price.
export const PLAN_LIMITS: Record<Plan, Limits> = {
  free: { perMinute: 5, perHour: 30, perMonth: 50, maxInputChars: 60_000 },
  trialing: { perMinute: 15, perHour: 150, perMonth: 1_000, maxInputChars: 300_000 },
  active: { perMinute: 15, perHour: 150, perMonth: 1_000, maxInputChars: 300_000 },
};

// Expensive operations count for more than a cheap one: a 20-minute
// transcription is not the same cost as an auto-tag. Mirrored in
// docs/PRICING.md — change both together.
const OPERATION_WEIGHT: Partial<Record<AiOperation, number>> = {
  deep_research: 5,
  transcribe_youtube: 3,
  transcribe_instagram: 3,
  transcribe_deliverables: 3,
  ask: 2,
};

export type UsageRecord = {
  success: boolean;
  provider?: string;
  model?: string;
  inputUnits?: number;
  outputUnits?: number;
  estimatedCost?: number;
  errorCode?: string;
  ideaId?: string;
};

export type Guard = {
  user: AuthedUser;
  plan: Plan;
  limits: Limits;
  requestId: string;
  record: (r: UsageRecord) => Promise<void>;
  /**
   * Give the reserved quota back.
   *
   * Quota is reserved before the work runs so a crash cannot become a free
   * retry loop. But a customer should not be charged an action for something we
   * never actually paid a provider for — a cache hit, a free captions track, or
   * a failure that produced nothing. Refunding flips the decision off
   * "allowed", so it stops counting against the allowance while staying in the
   * log for diagnostics.
   */
  refund: (reason: "cache_hit" | "no_cost_source" | "failed_before_spend") => Promise<void>;
};

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/**
 * Resolve the caller's plan. Billing is not wired yet, so everyone is on the
 * free plan; when subscriptions land this reads the subscription row. Kept in
 * one place so no route grows its own notion of entitlement.
 */
async function resolvePlan(
  client: ReturnType<typeof svc>,
  userId: string,
): Promise<Plan> {
  const { data, error } = await client
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "free";
  const status = String((data as { status?: string }).status ?? "");
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  return "free";
}

async function weightedCountSince(
  client: ReturnType<typeof svc>,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { data, error } = await client
    .from("ai_usage_events")
    .select("operation")
    .eq("user_id", userId)
    .eq("decision", "allowed")
    .gte("created_at", sinceIso);
  if (error) {
    // Fail closed on the burst window would lock users out of a working
    // product on a transient database error; fail open but leave a trace.
    console.error("ai-guard: usage count failed", error.message);
    return 0;
  }
  return (data ?? []).reduce(
    (n, r) => n + (OPERATION_WEIGHT[(r as { operation: AiOperation }).operation] ?? 1),
    0,
  );
}

/**
 * Authenticate, enforce quota, and hand back a recorder.
 *
 * Returns `{ response }` to send immediately (401 / 413 / 429), or a Guard.
 * `inputChars` lets a route reject an oversized payload before paying for it.
 */
export async function guardAiRequest(
  req: Request,
  cors: Record<string, string>,
  operation: AiOperation,
  inputChars = 0,
): Promise<Guard | { response: Response }> {
  const auth = await requireUser(req, cors);
  if ("response" in auth) return auth;

  const client = svc();
  const userId = auth.user.id;
  const requestId = crypto.randomUUID();
  const plan = await resolvePlan(client, userId);
  const limits = PLAN_LIMITS[plan];

  const log = async (decision: string, extra: Partial<UsageRecord> = {}): Promise<string | null> => {
    const { data, error } = await client.from("ai_usage_events").insert({
      user_id: userId,
      operation,
      decision,
      plan,
      request_id: requestId,
      success: extra.success ?? decision === "allowed",
      provider: extra.provider ?? null,
      model: extra.model ?? null,
      input_units: extra.inputUnits ?? null,
      output_units: extra.outputUnits ?? null,
      estimated_cost: extra.estimatedCost ?? null,
      error_code: extra.errorCode ?? null,
      idea_id: extra.ideaId ?? null,
    }).select("id").single();
    if (error) {
      console.error("ai-guard: usage insert failed", error.message);
      return null;
    }
    return (data as { id: string }).id;
  };

  if (inputChars > limits.maxInputChars) {
    await log("input_too_large", { success: false, errorCode: "input_too_large" });
    return {
      response: json(
        {
          error: "That's too much content to process in one go.",
          code: "input_too_large",
        },
        413,
        cors,
      ),
    };
  }

  const now = Date.now();
  const [minute, hour, month] = await Promise.all([
    weightedCountSince(client, userId, new Date(now - 60_000).toISOString()),
    weightedCountSince(client, userId, new Date(now - 3_600_000).toISOString()),
    weightedCountSince(
      client,
      userId,
      new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
    ),
  ]);
  const weight = OPERATION_WEIGHT[operation] ?? 1;

  if (minute + weight > limits.perMinute || hour + weight > limits.perHour) {
    await log("rate_limited", { success: false, errorCode: "rate_limited" });
    return {
      response: json(
        {
          error: "You're going a bit fast. Try again in a minute.",
          code: "rate_limited",
        },
        429,
        cors,
      ),
    };
  }

  if (month + weight > limits.perMonth) {
    await log("quota_exceeded", { success: false, errorCode: "quota_exceeded" });
    return {
      response: json(
        {
          error: "You've used this month's AI allowance.",
          code: "quota_exceeded",
          plan,
        },
        429,
        cors,
      ),
    };
  }

  // Reserve the quota BEFORE the work happens, so a route that crashes or
  // forgets to call record() still counts against the allowance. record() then
  // fills in the outcome.
  const eventId = await log("allowed", { success: true });

  return {
    user: auth.user,
    plan,
    limits,
    requestId,
    refund: async (reason) => {
      if (!eventId) return;
      const { error } = await client
        .from("ai_usage_events")
        .update({ decision: reason, success: true, estimated_cost: 0 })
        .eq("id", eventId);
      if (error) console.error("ai-guard: refund failed", error.message);
    },
    record: async (r: UsageRecord) => {
      if (!eventId) return;
      const { error } = await client
        .from("ai_usage_events")
        .update({
          success: r.success,
          provider: r.provider ?? null,
          model: r.model ?? null,
          input_units: r.inputUnits ?? null,
          output_units: r.outputUnits ?? null,
          estimated_cost: r.estimatedCost ?? null,
          error_code: r.errorCode ?? null,
          idea_id: r.ideaId ?? null,
        })
        .eq("id", eventId);
      if (error) console.error("ai-guard: usage update failed", error.message);
    },
  };
}
