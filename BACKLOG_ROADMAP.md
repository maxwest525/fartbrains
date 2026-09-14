# Fartbrain Product Backlog and Roadmap

> Status: canonical product-direction document  
> Principle: the private brain is the core product. Outcomes and execution extend it; they never replace it.

## Product thesis

Fartbrain captures the smallest fleeting thought before it disappears, preserves its original context, expands it with research, and connects it to the user's private knowledge graph. It turns scattered inspiration into original, structured, useful outcomes.

Fartbrain is the private intelligence layer between everything a user knows and everything they may eventually build.

Fartbrain **is the graph**. It must own its graph model, relationships, reasoning semantics, provenance, and user experience. It does not borrow, embed, or merely decorate another product's graph. External systems may supply nodes and signals through MCP or API, but Fartbrain normalizes them into its own private intelligence graph and remains the authoritative reasoning layer.

The product has three distinct layers:

1. **Private Brain** — the Obsidian-plus intelligence and knowledge layer.
2. **Outcome Engine** — the deterministic reasoning layer that converts knowledge into complete, reusable outcomes.
3. **Adaptive Bridge** — an optional connected-project layer that can inspect, improve, and—with explicit permission—execute changes through MCP or API.

The first two layers remain fully valuable without connecting a project. Execution is always optional.

## Non-negotiable product boundaries

- Fartbrain remains private by default.
- Fartbrain is the canonical graph, not a wrapper around or borrower of another graph product.
- Connected projects and external services feed Fartbrain's graph; they do not replace or control it.
- The Private Brain is never reduced to a lead-generation wrapper for the execution product.
- Fartbrain produces every promised outcome without requiring MCP, API, repository, or project access.
- Selecting **Actual Build** prepares the complete execution package and then stops at **Connect this project via MCP**.
- API is supported as an alternate connection method when it is the cleaner or more capable integration.
- No project mutation occurs without an explicit connection, visible scope, preview, and approval.
- No uncontrolled autonomous rewrite loop.
- Every proposed improvement must show its evidence, reasoning, expected outcome, risk, and intended changes.
- Creator exploration is limited to public material or material the user is authorized to access.
- The user's private knowledge graph is the durable differentiator and must remain portable.

## Layer 1 — Private Brain

### Capture

- Capture a URL plus a short personal note.
- Support social posts, videos, articles, audio, images, documents, and plain thoughts.
- Reduce capture friction through share sheets, browser extensions, shortcuts, email forwarding, and API ingestion.
- Preserve source URL, creator, timestamp, media type, user note, and original context.
- Route captures into the user's existing folder/file organization when requested.
- Maintain private-by-default access with deliberate sharing of individual ideas.

### Extraction and enrichment

- Transcribe source audio/video.
- Produce concise and detailed summaries.
- Extract claims, strategies, steps, examples, entities, tools, datasets, and relevant URLs.
- Deep-research the idea and attach corroborating or conflicting sources.
- Separate sourced facts, creator claims, user interpretation, and model inference.
- Identify the creator and build a public creator map.
- Offer **Extract this creator's other public ideas**.
- Cluster a creator's recurring strategies, frameworks, contradictions, evolutions, and adjacent ideas.
- Preserve citations and provenance for every extracted item.

### Private knowledge graph

- Build and own the underlying graph architecture, node model, edge model, relationship semantics, provenance, permissions, and traversal logic.
- Treat notes, sources, creators, strategies, claims, decisions, projects, features, functions, outcomes, and validations as first-class graph entities where appropriate.
- Connect captures using metadata, semantic similarity, explicit tags, shared entities, goals, projects, people, and outcomes.
- Maintain an interactive note-cluster graph.
- Surface relationships the user would not remember to search for.
- Explain why two nodes are connected.
- Support user-approved, user-rejected, and user-strengthened relationships.
- Track temporal evolution: what the user believed, added, changed, or abandoned.
- Keep the graph useful as a thinking surface, not visual decoration.

### Ash

- Start conversations with the source, user note, research, related captures, and relevant private context already loaded.
- Brainstorm without cold-start prompting.
- Challenge weak assumptions and surface contradictions.
- Help turn multiple fragments into one stronger original idea.
- Convert conversations back into durable nodes, decisions, and outcomes.

## Layer 2 — Deterministic Outcome Engine

### Purpose

The engine does not merely summarize content or create a generic skill. It reconstructs the human operator behind a strategy:

- What signals they notice.
- What inputs they ignore.
- The order in which they evaluate information.
- The conditions that change the decision.
- The actions attached to each branch.
- The validations that determine whether the strategy worked.

It then combines that operator model with the user's tweak, private graph, goals, constraints, and research.

### Deterministic reasoning model

Canonical sequence:

`Signals → Rules → Branches → Validations → Outcomes`

Every generated reasoning package should contain:

- Inputs and required evidence.
- Explicit assumptions.
- Decision rules.
- Conditional branches and fallback branches.
- Confidence and uncertainty.
- Conflicts and missing information.
- Validation criteria.
- Expected outcome for each branch.
- Traceable links back to supporting graph nodes.

### Output types

Fartbrain should be able to produce all applicable outcomes before any project connection:

- Product or MVP brief.
- Build specification.
- System architecture.
- Research dossier.
- Implementation prompt.
- Reusable skill.
- Agent design.
- Workflow or automation.
- Operating playbook.
- Decision tree.
- Experiment plan.
- Marketing or distribution strategy.
- Structured data/API contract.
- Execution-ready project package.

### Required quality bar

- Outcomes must reflect the user's unique combination of sources and ideas.
- Outputs must include provenance and reasoning traces.
- Outputs must be editable and versioned.
- Regeneration must preserve accepted decisions.
- The user must be able to compare outcome revisions.
- A completed output must remain exportable without subscribing to execution.

## Layer 3 — Adaptive Bridge

### Role

The Adaptive Bridge is a separate downstream product layer. It does not replace the Private Brain or Outcome Engine. Those layers create the idea and prove its value; the Bridge becomes the natural high-value conversion point.

Positioning:

> Fartbrain found what this could become. Connect your project and let it improve what already exists.

### Connected project graph

After a user deliberately connects a project through MCP or API, Fartbrain maps:

- Repositories and code structure.
- Existing features and functions.
- Services, APIs, tools, and integrations.
- Data models and information flows.
- Workflows and automations.
- Prompts, models, agents, and skills.
- Tests, observability, errors, and technical debt.
- Product requirements and unfinished work.
- Customer feedback and requested improvements.
- Business goals, constraints, costs, and success metrics.
- Relevant nodes from the user's Private Brain.

This is not a borrowed project graph. Fartbrain ingests authorized project evidence and represents it inside Fartbrain's own graph ontology, linked to the existing private intelligence graph.

### Improvement engine

The Bridge reasons across the private and project graphs to identify:

- Missing connections between nodes.
- Gaps between intended and actual outcomes.
- Features that exist but do not work together.
- Weak, missing, or contradictory decision logic.
- Repeated manual work suitable for automation.
- Unused research, captures, or product ideas.
- Opportunities to improve an existing function.
- Opportunities to extend a feature or the idea as a whole.
- Duplicated capabilities and unnecessary cost.
- Broken paths, incomplete implementation, and validation gaps.

### Controlled improvement loop

Canonical internal loop:

`Observe → Compare → Detect gap → Design improvement → Simulate → Approve → Execute → Validate → Learn`

The user-facing experience should feel like a self-improving magic adapter, while remaining controlled, explainable, and reversible.

For every recommendation, show:

- What Fartbrain noticed.
- Why it matters.
- Which nodes produced the conclusion.
- The deterministic logic used.
- The proposed improvement.
- Expected outcome and success metric.
- Confidence, uncertainty, and risk.
- Exact systems/files/functions it would affect.
- Whether it can be saved as an outcome or executed.

### Execution boundary

Default execution flow:

1. Produce all outcomes.
2. User selects **Actual Build**.
3. Show **Connect this project via MCP** with API as an alternate supported path.
4. Establish read-only access first.
5. Map and inspect the project.
6. Generate a scoped change plan and preview.
7. Request explicit approval for the defined mutation.
8. Use scoped credentials and the least required permissions.
9. Execute in a branch, sandbox, preview environment, or equivalent reversible boundary.
10. Run validation and show evidence.
11. Require separate approval before production promotion when applicable.
12. Write validated results and learning back into the graph.

### Adaptive Bridge control panel

- Project graph beside the Private Brain graph.
- Gap/opportunity inbox.
- Recommendation evidence panel.
- Reasoning and decision-rule view.
- Impact, risk, effort, and cost estimates.
- Proposed change preview.
- Approval and scope controls.
- Execution status and audit log.
- Validation results and rollback path.
- Loop controls: paused, observe-only, recommend, or approved execution.
- Budget and model controls.

## Product funnel and monetization

### Funnel

1. Capture a thought with almost no friction.
2. Watch Fartbrain extract and enrich it.
3. See unexpected connections from the private graph.
4. Use Ash to turn fragments into an original idea.
5. Receive deterministic, complete outcomes.
6. See that the outcome could improve a real connected project.
7. Upgrade to the Adaptive Bridge for project mapping and controlled execution.

### Packaging hypothesis

- **Private Brain** — capture, enrichment, graph, search, and Ash.
- **Outcome Engine** — advanced research, deterministic reasoning, and premium outcome generation.
- **Adaptive Bridge** — connected-project mapping, continuous gap detection, previews, and controlled execution.
- Meter expensive research, model inference, and execution separately from knowledge storage.
- Never hold a user's notes or completed exports hostage to an execution subscription.

## Architecture direction

### Hosting and data

- Move the frontend from Lovable hosting to Vercel after preview validation.
- Keep Supabase for authentication, private data, storage, database, and edge functions unless a later technical reason justifies moving it.
- Do not change `fartbrain.app` DNS until the Vercel deployment passes production-equivalent verification.
- Maintain an immediate rollback path during cutover.

### Provider-neutral AI layer

Remove hard dependencies on Lovable's AI gateway. Use a shared provider-neutral client across Supabase functions.

Suggested configuration:

- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL_FAST`
- `AI_MODEL_REASONING`
- `AI_MODEL_RESEARCH`
- `AI_MODEL_VISION`
- `AI_MODEL_EMBEDDING`
- task-specific timeouts, budgets, and fallback models

Preferred routing options include the existing self-hosted LiteLLM/OpenRouter stack or direct provider APIs. Model selection must be based on task quality and cost rather than a single model everywhere.

### Model-routing principles

- Cheap fast models for tagging, extraction, routing, and lightweight summaries.
- Strong reasoning models only for operator reconstruction, deterministic outcome design, and difficult synthesis.
- Specialized models for transcription, vision, embeddings, or deep research when they provide measurable value.
- Cache source processing and reusable graph context.
- Track cost per capture, outcome, user, and task.
- Add hard budgets, graceful degradation, and fallbacks.
- Preserve existing AI cost accounting during gateway migration.

### MCP and API

- MCP is the primary product narrative for connecting agent-aware projects and tools.
- API connections are first-class when a service lacks MCP or direct integration is more reliable.
- Normalize both behind a connector capability model.
- Every connector declares read/write capabilities, scopes, available actions, and approval requirements.
- Project connections are isolated per user/workspace.
- Credentials must be encrypted, revocable, scoped, and never exposed to the model unnecessarily.

## Delivery roadmap

### Phase 0 — Preserve and clarify the product

- [x] Establish Private Brain → Outcome Engine → Adaptive Bridge product architecture.
- [x] Preserve every existing outcome before the connection boundary.
- [x] Add deterministic-reasoning positioning to the landing experience.
- [x] Add creator-map and creator-idea extraction positioning.
- [x] Add the **Actual Build → Connect Project via MCP** handoff.
- [ ] Add the canonical three-layer product language to in-app onboarding and pricing.
- [ ] Add analytics for capture → outcome → connection conversion.

### Phase 1 — Strengthen the Private Brain

- [ ] Define and version Fartbrain's owned graph ontology, node types, edge types, provenance, permissions, and temporal model.
- [ ] Select and implement the graph persistence and traversal architecture without surrendering the product's graph model to a vendor.
- [ ] Audit capture pathways and remove friction.
- [ ] Implement public creator identity and creator-corpus extraction.
- [ ] Store extraction provenance and citations.
- [ ] Improve relationship explanations and graph controls.
- [ ] Add graph feedback: accept, reject, strengthen, merge.
- [ ] Add graph filters for source, creator, project, goal, time, and outcome.
- [ ] Add portable export and backup.
- [ ] Validate strict private-by-default permissions.

### Phase 2 — Deterministic Outcome Engine

- [ ] Define a versioned outcome schema.
- [ ] Define the operator-model schema.
- [ ] Implement signals, rules, branches, validations, and outcomes.
- [ ] Add reasoning provenance linked to graph nodes.
- [ ] Add assumption/conflict/missing-evidence handling.
- [ ] Implement all core output types.
- [ ] Add outcome revision, comparison, acceptance, and export.
- [ ] Add outcome-quality evaluations and regression tests.

### Phase 3 — Leave Lovable runtime dependencies

- [ ] Attach the GitHub repository to the Vercel `fartbrains` project.
- [ ] Configure Vercel preview environment variables.
- [ ] Create and verify a full preview deployment.
- [ ] Build a shared provider-neutral AI client.
- [ ] Replace all `LOVABLE_API_KEY` inference dependencies in Supabase functions.
- [ ] Configure task-specific LiteLLM/OpenRouter model routing.
- [ ] Preserve AI guardrails and cost tracking.
- [ ] Run authentication, capture, transcription, graph, Ash, research, and outcome smoke tests.
- [ ] Cut `fartbrain.app` over only after approval and verification.
- [ ] Monitor production and retain rollback during stabilization.

### Phase 4 — Project connection foundation

- [ ] Define the connector capability and permission schema.
- [ ] Build MCP connection onboarding.
- [ ] Add API connection onboarding and credential management.
- [ ] Implement read-only project inspection.
- [ ] Build the connected-project graph schema.
- [ ] Map repositories, services, workflows, data, agents, and goals.
- [ ] Connect project nodes to relevant Private Brain nodes.
- [ ] Add connection health, scope, revocation, and audit logs.

### Phase 5 — Adaptive Bridge recommendations

- [ ] Implement gap and opportunity detection.
- [ ] Generate deterministic improvement plans.
- [ ] Show evidence, affected nodes, risk, cost, confidence, and expected outcome.
- [ ] Add recommendation prioritization and dismissal feedback.
- [ ] Save any recommendation as a normal Fartbrain outcome without execution.
- [ ] Add observe-only and recommendation modes.
- [ ] Validate recommendations against real project state.

### Phase 6 — Controlled Actual Build

- [ ] Generate scoped execution packages.
- [ ] Add change previews and approval checkpoints.
- [ ] Execute only within branches, sandboxes, or preview environments first.
- [ ] Run automated validation and surface evidence.
- [ ] Add rollback and failure recovery.
- [ ] Add separate production-promotion approval.
- [ ] Record execution, validation, cost, and learning in the graph.
- [ ] Add budget, rate, and loop controls.

### Phase 7 — Self-improving adapter experience

- [ ] Build the Adaptive Bridge control panel.
- [ ] Visualize private nodes, project nodes, and bridge opportunities without creating graph clutter.
- [ ] Add continuous observation with explicit user-controlled modes.
- [ ] Measure whether accepted improvements achieve their intended outcomes.
- [ ] Use validated results to refine future recommendations.
- [ ] Never convert measured learning into unapproved autonomous mutation.

## Immediate backlog

### P0

- [ ] Complete Vercel GitHub connection and preview deployment.
- [ ] Inventory the 19 Supabase function files currently referencing `LOVABLE_API_KEY`.
- [ ] Design and implement the shared provider-neutral AI client.
- [ ] Migrate one low-risk function first and validate cost, output, errors, and fallback behavior.
- [ ] Define creator-corpus ingestion and provenance schema.
- [ ] Define deterministic operator/outcome schemas.
- [ ] Write the MCP/API connector permission model.

### P1

- [ ] Migrate remaining AI functions by task family.
- [ ] Add model-routing configuration and cost dashboard.
- [ ] Build creator-map extraction.
- [ ] Build outcome versioning and evidence display.
- [ ] Prototype read-only GitHub project mapping through MCP/API.
- [ ] Prototype the bridge recommendation card and approval experience.

### P2

- [ ] Add additional project connectors.
- [ ] Add controlled branch execution.
- [ ] Add validation and rollback workflows.
- [ ] Add Adaptive Bridge subscription and usage metering.
- [ ] Add outcome-performance learning.

## Success metrics

- Capture completion rate and time to capture.
- Percentage of captures successfully enriched.
- Useful-connection acceptance rate.
- Creator-map ideas saved or converted into outcomes.
- Percentage of captures that become structured outcomes.
- Outcome export/use rate.
- Outcome-to-project-connection conversion rate.
- Recommendation acceptance rate.
- Validation pass rate after execution.
- Measured outcome improvement after execution.
- Inference cost per capture, outcome, and successful improvement.
- Retention driven by Private Brain use independent of execution.

## Open product decisions

- Final commercial name for **Adaptive Bridge**.
- Whether the connection CTA should mention only MCP or display MCP/API together after click-through.
- Connector launch order after GitHub.
- Which execution actions require approval every time versus reusable policies.
- Pricing boundary between Outcome Engine and Adaptive Bridge.
- How much continuous observation is included by plan.
- Which reasoning traces are user-facing versus stored for audit.

## Canonical product language

**Short version**

> Fartbrain remains the private Obsidian-plus intelligence layer and still produces every outcome. Execution is optional. When someone chooses Actual Build, Fartbrain prepares everything, then stops at Connect this project via MCP.

**Expanded version**

> Fartbrain captures what you almost forgot, connects it to everything you already know, and reconstructs the strategy behind it as deterministic, reusable outcomes. When you choose to connect a real project, the Adaptive Bridge maps what already exists, finds the missing connections, and proposes controlled improvements. It executes only when you approve it.

**Product hierarchy**

`Private Brain → Deterministic Outcomes → Optional Adaptive Bridge → Approved Execution`
