# Reusable Karpathy Second Brain Build Specification

## 1. Purpose

Build a project-agnostic, persistent second brain that can ingest real source material, compile it into durable knowledge, retrieve only the context needed for a task, explain why it knows something, and support human and agent work without turning model output into unreviewed truth.

This document defines the complete target system and an opinionated optimal reference implementation. Its contracts keep providers replaceable, but its technology choices are defaults—not an invitation to postpone decisions. Use the chosen stack unless a measured requirement justifies replacing one component.

The system combines:

- Karpathy's immutable-source LLM Wiki Compiler pattern;
- a fast loop for active execution and working context;
- a slow loop for evidence-backed knowledge compilation;
- PARA-style navigation as a user-facing organizational view;
- hybrid exact, full-text, semantic, and graph retrieval;
- evidence-gated claims and contradiction handling;
- a persistent conversational Composer;
- inspectable knowledge, source, and execution graphs;
- governed access for agents, workflows, and external tools.

Obsidian is not required. Markdown or Obsidian-compatible files may be supported as an optional import/export format, but they must never be the authoritative runtime database.

### 1.1 Chosen optimal implementation

The default build uses:

1. PostgreSQL as the canonical transactional and knowledge store.
2. PostgreSQL full-text search for deterministic exact retrieval.
3. pgvector in the same PostgreSQL data plane for semantic retrieval.
4. S3-compatible object storage for large immutable bodies and artifacts, with a content-addressed filesystem allowed for local-only deployments.
5. A durable worker or authorized local runner for ingestion, repository scanning, compilation, embedding, and graph materialization.
6. A native project/source map first; Graphify or Codebase Memory MCP may be added later only if measured code-intelligence gaps justify one of them.
7. LangGraph as the single primary stateful agent runtime.
8. Langflow as an external visual authoring and template surface.
9. n8n as an external or tenant-hosted business-automation provider.
10. Composio as the preferred managed integration marketplace and tenant-authorization broker, with MCP and native connectors behind the same governed gateway.
11. LiteLLM as the preferred model gateway, with OpenRouter as the default provider/pricing route and explicit model allowlists, fallbacks, caching, metering, and spend ceilings.
12. `3d-force-graph` with custom ThreeJS styling as the default inspectable graph renderer; its data comes from canonical graph projections.
13. Markdown, JSON, and optional Obsidian-compatible vaults for portable import/export.

Cognee, Graphiti, Qdrant, a dedicated graph database, and alternate agent runtimes are not part of the default installation. They remain evaluated extensions with explicit adoption thresholds.

## 2. Product Promise

The system should:

1. know the user's projects, sources, decisions, requirements, concepts, procedures, and operating history;
2. show exactly what it knows and why;
3. distinguish accepted knowledge from extraction, inference, similarity, opinion, and unresolved contradiction;
4. retrieve a bounded set of relevant evidence instead of repeatedly loading an entire repository or knowledge vault;
5. preserve context across conversations and agent runs;
6. let users inspect, correct, accept, reject, merge, supersede, or remove derived knowledge without mutating raw evidence;
7. give agents useful memory without granting them authority to rewrite truth;
8. remain portable across model, graph, vector, workflow, and storage providers.

## 3. Core Principles

### 3.1 Immutable sources

Raw material is append-only and versioned. Ingestion creates immutable source versions with checksums. Corrections produce a new version; they never silently rewrite the old one.

### 3.2 Compiled knowledge is separate from evidence

The maintained wiki, graph, summaries, concepts, and claims are projections derived from sources. They may evolve without altering the source record.

### 3.3 The graph is a projection, not the truth

The canonical record is the combination of source versions, evidence spans, typed knowledge records, review decisions, and version history. A graph is a query and visualization layer over that record.

### 3.4 Models propose; policy accepts

A model can extract, summarize, classify, link, and propose. It cannot silently promote its own output to accepted operating truth.

### 3.5 Every material statement has provenance

Factual claims must resolve to exact evidence spans. Opinions, decisions, hypotheses, and model inferences must be explicitly typed and labeled.

### 3.6 Contradiction is first-class

Conflicting evidence is preserved and surfaced. The system must never resolve a contradiction by quietly selecting the most recent, most confident, or most convenient statement.

### 3.7 Retrieval is selective

The system retrieves a lean index and a bounded evidence set. It does not inject the entire knowledge base, conversation history, or repository into every prompt.

### 3.8 Human-readable portability

Data must be exportable into stable, documented formats. Portability is a product capability, not the runtime architecture.

## 4. Dual-Loop Memory Architecture

### 4.1 Fast loop: active execution

The fast loop stores context required for work happening now:

- active objective and definition of done;
- selected project, department, case, customer, or workspace;
- constraints and permissions;
- current task state and checklist;
- recent decisions and open questions;
- selected source evidence;
- temporary notes and scratch captures;
- recent failures, tool results, and artifacts;
- agent and workflow state;
- context pins chosen by the user.

Fast-loop records may change frequently. They remain durable enough to resume work after a browser refresh, process restart, model change, or context compression.

### 4.2 Slow loop: Karpathy knowledge compilation

The slow loop converts immutable evidence into an evolving maintained knowledge layer:

```text
Capture source
  -> create immutable source version
  -> parse and normalize deterministically
  -> create exact evidence spans
  -> propose entities, concepts, claims, decisions, procedures, and links
  -> reconcile duplicates and contradictions
  -> apply review policy
  -> materialize accepted knowledge version
  -> index for exact, semantic, and graph retrieval
  -> retain complete provenance and review history
```

The key Karpathy pattern is separation:

- the source corpus remains unchanged;
- the compiled wiki is actively maintained;
- new evidence updates or supersedes compiled pages;
- compilation is repeatable and attributable to a compiler version;
- every compiled result can be traced back to its inputs.

### 4.3 Loop interaction

The fast loop can retrieve accepted slow-loop knowledge and clearly labeled exploratory material. Completed work, decisions, artifacts, and lessons can be proposed back into the slow loop.

Temporary execution logs must not automatically become permanent knowledge. Promotion requires a defined compilation and review path.

## 5. PARA as an Organizational View

PARA provides a familiar navigation layer:

- **Inbox** — unprocessed captures and newly registered sources;
- **Projects** — active initiatives with an outcome or completion condition;
- **Areas** — ongoing responsibilities without a fixed end date;
- **Resources** — reusable concepts, entities, procedures, references, and schemas;
- **Archive** — inactive material retained for provenance and retrieval.

PARA is not the physical database schema. One record may belong to multiple projects, areas, and resources through typed memberships. Moving a record between views must not destroy its identity, citations, or relationships.

## 6. Three Graph Planes

The product maintains three related but distinct graph planes.

### 6.1 Project and source graph

Answers: **What is this system or project made of?**

Contains:

- projects and repositories;
- folders and files;
- packages and dependencies;
- declared entrypoints;
- imports, exports, containment, and references;
- source fingerprints, revisions, and scan warnings;
- linked deployments, databases, documentation, and approved external systems.

Project graph versions are immutable. Scans record adapter identity, source revision, checksum, warnings, counts, and timestamps.

### 6.2 Activity and execution graph

Answers: **What happened?**

Contains:

- user requests;
- tasks and work items;
- agent and workflow runs;
- stages, handoffs, and approvals;
- tool calls and bounded outputs;
- failures, retries, repairs, and cancellations;
- artifacts, file changes, deployments, and observed outcomes;
- time, cost, model, provider, and responsible actor.

This graph is derived from persisted execution events. It must never be a hand-authored fictional workflow diagram presented as real activity.

### 6.3 Knowledge graph

Answers: **What is known, what supports it, and what conflicts with it?**

Contains:

- sources and source versions;
- evidence spans;
- entities and concepts;
- claims and counterclaims;
- decisions and requirements;
- procedures and constraints;
- events and metrics;
- artifacts and outcomes;
- accepted, rejected, superseded, unresolved, and exploratory relationships.

Every relationship records its class, origin, explanation, confidence, evidence, review state, and version lineage.

### 6.4 Cross-plane references

The planes may be joined at retrieval time through stable IDs:

- a requirement may cite a source claim;
- a task may implement a requirement;
- a run may produce an artifact;
- an outcome may support or contradict a prior assumption;
- a source file may connect to a deployment or database identity;
- a decision may depend on both business evidence and project structure.

The planes remain visually and semantically distinguishable.

## 7. Canonical Knowledge Model

### 7.1 Core records

The canonical model should support:

- `workspace` or tenant;
- `project`;
- `source`;
- `source_version`;
- `evidence_span`;
- `knowledge_object`;
- `relationship`;
- `proposal`;
- `review_decision`;
- `knowledge_version`;
- `retrieval_event`;
- `conversation_thread` and `message`;
- `run`, `stage`, `tool_event`, and `artifact`;
- `collection_membership` for PARA and custom views;
- `provider_link` for approved external identities.

### 7.2 Knowledge object types

At minimum:

- source;
- entity;
- concept;
- claim;
- decision;
- requirement;
- procedure;
- constraint;
- question;
- event;
- metric;
- project;
- task;
- artifact;
- person or organization;
- system or tool.

### 7.3 Relationship classes

At minimum:

- contains;
- references;
- derived-from;
- supports;
- contradicts;
- supersedes;
- requires;
- depends-on;
- implements;
- produced-by;
- belongs-to;
- related-to;
- similar-to;
- observed-in;
- decided-by;
- affects.

`related-to` and `similar-to` must never be presented as factual causal relationships.

### 7.4 Required provenance

Every durable derived object or relationship stores:

- stable ID;
- workspace and authorization scope;
- type;
- current version and immutable lineage;
- origin: deterministic extraction, model inference, semantic similarity, user confirmation, or observed execution;
- compiler or adapter version;
- exact evidence references;
- author or responsible actor;
- confidence where applicable;
- review state and reviewer;
- timestamps;
- content checksum;
- supersession and contradiction state.

## 8. Source Capture and Ingestion

### 8.1 Supported source classes

The architecture should support adapters for:

- direct text and quick captures;
- uploaded documents;
- public and authenticated web pages;
- repositories and approved local folders;
- conversations and selected message ranges;
- transcripts, audio, and video;
- email and calendar records;
- CRM, support, analytics, and operational records;
- workflow results and generated artifacts;
- structured APIs and databases.

Support for a source class is considered real only when the corresponding adapter can retrieve, version, parse, bound, and attribute the content safely.

### 8.2 Ingestion contract

Every adapter must:

1. verify workspace authorization;
2. create or identify the source;
3. retrieve content without exposing credentials;
4. normalize supported content deterministically;
5. create a content-addressed immutable version;
6. produce precise evidence spans or structural locators;
7. report warnings and unsupported content honestly;
8. queue optional model and embedding work separately;
9. preserve retry, cancellation, and idempotency semantics;
10. avoid partial activation when processing fails.

### 8.3 Project ingestion

A project may be registered from an explicitly approved local folder or authorized repository. Inspection can detect:

- sanitized Git remote identity;
- branch, revision, and dirty state;
- package name and declared entrypoints;
- dependencies and internal imports;
- recognized deployment and database identifiers;
- architecture documents and operator-selected knowledge sources.

Detection is not provider verification. A local identifier may propose a Git hosting, deployment, or database link; a scoped provider authorization must confirm the live resource.

Source code should not be bulk-copied into conversational memory. Structural project intelligence belongs in the project graph. Selected documentation, decisions, requirements, and evidence may be compiled into durable knowledge with project and revision provenance.

## 9. Karpathy Knowledge Compiler

### 9.1 Deterministic stage

Perform low-cost repeatable work first:

- validate and checksum source versions;
- parse structure and metadata;
- segment exact evidence spans;
- extract explicit identifiers and links;
- normalize dates, authors, and source locators;
- detect exact duplicates;
- compare prior compiler inputs;
- identify changed, removed, and newly added evidence.

### 9.2 Model proposal stage

The model receives bounded evidence and a schema. It may propose:

- concise source summaries;
- entities and aliases;
- concepts and definitions;
- factual claims with exact evidence spans;
- decisions, requirements, and procedures;
- typed relationships;
- duplicate or merge candidates;
- contradiction candidates;
- suggested updates to existing compiled pages.

Invalid structure, missing evidence, excessive output, or cross-scope references fail closed.

### 9.3 Reconciliation stage

Reconciliation must:

- compare proposals with existing knowledge;
- resolve exact duplicates deterministically;
- suggest merges without destroying lineage;
- recognize renamed entities and aliases;
- identify contradictions without silently choosing a winner;
- detect when a source change invalidates existing claims;
- preserve rejected and superseded history;
- assign review risk and downstream impact.

### 9.4 Review and materialization

Deterministic low-risk metadata may be accepted by policy. Factual claims, destructive merges, contradiction resolution, permissions, regulated statements, and high-impact decisions require explicit review policy.

Accepted proposals create a new immutable knowledge version. Rejected proposals remain auditable and do not enter accepted retrieval.

## 10. Fast Evidence Review

Review must be operationally lightweight so the knowledge system does not depend on continuous manual maintenance.

The default review interface presents compact cards containing:

- proposed statement or relationship;
- object type;
- exact supporting evidence spans;
- source and source version;
- contradiction state;
- affected existing knowledge;
- confidence and origin;
- downstream consequences of accepting it.

Actions:

- accept;
- reject;
- merge;
- supersede;
- defer;
- edit and accept;
- open exact source evidence.

Keyboard, swipe, and multi-select review should support ten-second batch decisions. Only proposals sharing compatible source, evidence quality, object type, and policy class may be batched. Contradictions, destructive merges, permission changes, regulated claims, and high-impact decisions cannot be hidden inside bulk approval.

The queue is prioritized by risk, contradiction, recurrence, downstream use, source changes, and age. An unattended queue must not block capture, exact search, or clearly labeled exploratory retrieval.

## 11. Retrieval and Context Assembly

### 11.1 Retrieval pipeline

```text
Resolve workspace and permissions
  -> resolve active project and task
  -> normalize query and intent
  -> exact identifier and citation lookup
  -> full-text retrieval
  -> optional semantic retrieval
  -> bounded graph expansion
  -> optional project and activity evidence
  -> deduplicate and diversify sources
  -> rank by relevance, trust, freshness, and authority
  -> apply contradiction and review-state penalties
  -> fit the explicit context budget
  -> persist retrieval event
  -> answer with citations
```

### 11.2 Ranking signals

Ranking should consider:

- exact lexical match;
- semantic similarity;
- graph distance;
- active project and task affinity;
- evidence authority;
- review status;
- freshness and effective time;
- user pins and exclusions;
- source diversity;
- contradiction penalty;
- supersession state;
- prior retrieval usefulness.

### 11.3 Context budget

Context assembly is explicit and measurable. Store:

- maximum evidence items;
- maximum characters or tokens;
- reserved response budget;
- selected evidence and rejected candidates;
- truncation reasons;
- retrieval latency;
- graph expansion limits;
- model and compiler versions.

Prefer compact summaries plus exact evidence excerpts. Never repeatedly inject entire files, repositories, vaults, tool catalogs, or conversation histories.

### 11.4 Exploratory retrieval

Unreviewed extracted knowledge may participate in exploratory retrieval when policy allows it, but it must:

- receive lower trust and ranking priority;
- remain visibly labeled;
- retain exact source evidence;
- never satisfy an approval requirement;
- never trigger an external action;
- never become a standing decision;
- never support a published factual page as accepted truth;
- never be described as established knowledge.

Users can exclude exploratory material or explicitly request it.

### 11.5 Retrieval transparency

Every answer offers a **Used context** inspector showing:

- source title and version;
- exact locator or evidence span;
- knowledge type;
- review state;
- retrieval channel and reason;
- graph plane;
- contradiction or supersession warnings.

The user can open, pin, exclude, correct, or report a mismatch from this inspector.

## 12. Persistent Composer

The Composer is both:

- a full workspace for complex conversations and creation; and
- a persistent sidekick available throughout the product.

It carries the same thread, user, workspace, project, task, selected evidence, and permission scope across pages.

Core intents:

- ask;
- capture;
- ingest;
- research;
- distill;
- compare;
- decide;
- create work;
- run an approved workflow;
- inspect provenance;
- remember or forget through governed memory actions.

The Composer should resolve obvious reversible details independently. It interrupts the user only for material ambiguity, missing authorization, destructive operations, external communication, sensitive data transmission, or spending beyond policy.

Natural language is not authorization. The system resolves requested actions into typed operations with visible effects, bounded permissions, and durable run records.

## 13. Visual Knowledge System

The product exposes two complementary visual modes backed by the same canonical graph contract.

### 13.1 Universe mode

An immersive spatial view for discovery and sense-making:

- communities and high-value bridges at wide zoom;
- entities, projects, concepts, and sources at medium zoom;
- claims, evidence, review state, and provenance at close zoom;
- typed color and shape language by graph plane and object class;
- search, filters, saved views, camera focus, and progressive labels;
- selectable nodes and edges with a shared evidence inspector.

The visualization may use a 2D or 3D renderer, but product state, filtering, selection, evidence, and graph semantics must remain renderer-independent.

### 13.2 Evidence mode

A precise operational view for verification:

- source-to-claim-to-page flow;
- contradiction and support matrices;
- relationship tables;
- provenance timelines;
- review queue;
- exact evidence spans;
- knowledge version comparison;
- source and compiler lineage.

### 13.3 Honest rendering

- Never create decorative relationships.
- Semantic similarity uses its own visual class.
- Unreviewed and contradicted material remains visibly distinct.
- Hidden edges and filtered nodes are disclosed.
- Aggregate clusters show counts and expansion behavior.
- Selecting any node or edge resolves to stored evidence.
- WebGL failure falls back to a searchable evidence list.
- Keyboard navigation, reduced motion, readable contrast, and non-canvas alternatives are required.

### 13.4 Time as a real dimension

Time controls may replay:

- source-version changes;
- claim acceptance and supersession;
- contradiction emergence and resolution;
- project and workflow activity;
- decision effective periods;
- entity and relationship evolution.

Playback reflects persisted timestamps and versions. It is not decorative animation.

## 14. Agents and Workflows

Agents and workflows consume the same retrieval service as the Composer.

Before execution, a run receives:

- objective and acceptance criteria;
- workspace and project scope;
- bounded retrieved evidence;
- current task and decision state;
- allowed capabilities;
- tool, token, time, step, and spending ceilings;
- interruption and approval policy.

During execution, the system persists:

- stage transitions;
- model and provider;
- tool calls and bounded outputs;
- retrieved context IDs;
- decisions and assumptions;
- failures and retries;
- artifacts and observed outcomes;
- approvals and human interventions.

An agent cannot mark its own factual output authoritative, dismiss its own contradiction, or promote its own result into accepted knowledge. Completed artifacts and lessons enter the slow loop as proposals.

## 15. Tool and Integration Gateway

Do not inject every connected tool schema into every prompt.

Expose three stable operations:

1. **List capabilities** available to the active workspace, user, role, and project.
2. **Describe capability** to load one selected schema and its effects.
3. **Execute capability** through a schema-validated, policy-checked call.

The gateway must:

- resolve credentials server-side;
- verify tenant authorization and scopes;
- classify reads, writes, external communication, destructive effects, and spending;
- require approval where policy demands it;
- record provider and runtime provenance;
- bound and sanitize output;
- use idempotency for retriable writes;
- return a stable result envelope;
- persist evidence into the activity graph.

Integration catalogs and marketplace listings are not proof of readiness. A capability is usable only when authorization, scopes, schema, policy, and a verified connection exist.

## 16. Storage and Provider Architecture

Use a canonical transactional store for:

- identity and tenancy;
- source metadata and immutable versions;
- evidence spans;
- accepted knowledge and proposals;
- graph version metadata;
- retrieval events;
- conversation and run ledgers;
- permissions, policies, and audit records.

A relational database with transactional guarantees is the default authority. Specialized systems may be attached behind interfaces:

- object storage for immutable source bodies;
- vector indexing for semantic retrieval;
- graph databases for traversal at scale;
- search engines for high-volume full text;
- workflow runtimes for durable execution;
- model gateways for routing, fallback, metering, and provider controls.

No specialized provider becomes the only copy of accepted knowledge or provenance.

### 16.1 Chosen optimal default stack

The following stack is the implementation decision. Do not replace it with a menu of equivalent-looking options during initial delivery.

| Layer | Chosen default | Boundary |
|---|---|---|
| Canonical data | PostgreSQL | Owns tenant identity, source/version metadata, proposals, accepted knowledge, reviews, runs, policies, and audit evidence. |
| Exact retrieval | PostgreSQL full-text search | First retrieval path; deterministic and inexpensive. |
| Semantic retrieval | [pgvector](https://github.com/pgvector/pgvector) | Lives beside canonical records and retains model, dimensions, and source-version lineage. |
| Immutable bodies | S3-compatible object storage; content-addressed filesystem for local-only use | Stores large source bodies and artifacts; PostgreSQL stores checksums and authoritative references. |
| Background work | Durable worker or authorized local runner | Performs ingestion, repository scanning, compilation, embedding, and other long-running jobs. |
| Agent runtime | [LangGraph](https://github.com/langchain-ai/langgraph) | Executes stateful agent workflows; the product retains tenant-facing run truth, policy, cost, and evidence. |
| Visual flow authoring | [Langflow](https://github.com/langflow-ai/langflow) | Optional authoring and template surface; never the execution ledger. |
| Business automation | [n8n](https://github.com/n8n-io/n8n) | External or tenant-hosted automation adapter; do not embed or resell without a fresh license review. |
| Tool marketplace | [Composio](https://github.com/ComposioHQ/composio), with MCP/native tools behind the same gateway | Preferred managed discovery and tenant authorization layer. Capability readiness still requires scopes, health, policy, and verification. |
| Model gateway and provider | [LiteLLM](https://github.com/BerriAI/litellm) routing to OpenRouter | Self-hosted routing, fallbacks, metering, caching, and policy; OpenRouter provides the default model/pricing route. |
| Knowledge graph UI | [3d-force-graph](https://github.com/vasturiano/3d-force-graph) with custom ThreeJS styling | Chosen renderer. It consumes graph projections and never defines truth. |
| Human-readable portability | Markdown and optional Obsidian-compatible vaults | Import/export projection, never the runtime database. |

This stack remains replaceable by design, but replacement is an evidence-based exception. A replacement is acceptable only when a measured requirement cannot be met and the new component preserves stable IDs, immutable source lineage, review history, tenant boundaries, retrieval evidence, and exportability.

### 16.2 Repository and component decision matrix

| Project or pattern | Role | Decision | Adoption rule |
|---|---|---|---|
| [Karpathy LLM Wiki Compiler](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | Immutable source plus maintained compiled knowledge | **ADOPT PATTERN** | Use as the foundational separation. It is a design reference, not a runtime dependency. |
| [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) | Local Markdown and AI-workflow reference | **ADAPT** | Reuse export, command, and vault ideas without making Claude-specific files canonical. |
| [pgvector](https://github.com/pgvector/pgvector) | Semantic index in PostgreSQL | **ADOPT FIRST** | Prefer before adding a separate vector service. Keep model and dimension lineage per embedding. |
| [Cognee](https://github.com/topoteretes/cognee) | Knowledge compilation and retrieval engine | **OPTIONAL ADAPTER SPIKE** | Evaluate behind the compiler/retrieval contracts. Never make it the authoritative store. |
| [Graphify](https://github.com/Graphify-Labs/graphify) | Deterministic local code-graph enrichment | **OPTIONAL ADAPTER** | Use for repository structure only after verifying component licenses and output provenance. |
| [Codebase Memory MCP](https://github.com/DeusData/codebase-memory-mcp) | Local code intelligence, MCP, and visual reference | **OPTIONAL USER-INSTALLED ADAPTER** | Use when its symbol/reference intelligence materially outperforms the native project map. Do not install alongside Graphify by default. |
| [Graphiti](https://github.com/getzep/graphiti) | Temporal knowledge graph engine | **DEFER** | Add only when temporal traversal requirements exceed the native versioned model. |
| [Qdrant](https://github.com/qdrant/qdrant) | Dedicated vector database | **DEFER** | Add only after measured Postgres scale or latency limits. |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) | Low-level 3D graph renderer | **ADOPT DEFAULT** | Use for direct ThreeJS control and custom inspectable interaction. |
| [react-force-graph](https://github.com/vasturiano/react-force-graph) | React wrapper for the force-graph family | **ADOPTABLE ALTERNATIVE** | Prefer when React lifecycle integration is worth the wrapper; it does not change graph contracts. |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Stateful agent execution | **ADOPT PRIMARY** | Use one primary runtime unless measured requirements justify another. |
| [Langflow](https://github.com/langflow-ai/langflow) | Visual flow authoring and templates | **KEEP EXTERNAL** | Store installed template identity and real call results in the product. A canvas is not run evidence. |
| [n8n](https://github.com/n8n-io/n8n) | Business automation | **KEEP EXTERNAL** | Connect to self-hosted or tenant-owned instances. Recheck licensing before any bundled or resale model. |
| [Composio](https://github.com/ComposioHQ/composio) | Integration catalog and tenant authorization | **OPTIONAL MANAGED CONNECTOR** | Catalog presence is not readiness. Require tenant auth, scopes, health, policy, and verified execution. |
| [LiteLLM](https://github.com/BerriAI/litellm) | Model gateway and routing | **PREFER WHEN CONFIGURED** | Centralize allowlists, fallbacks, metering, caching, and provider policy without exposing credentials. |
| Obsidian-compatible Markdown | Portable human knowledge surface | **ADOPT EXPORT/IMPORT** | Keep stable IDs and provenance in frontmatter or manifests. Never use folders as canonical tenancy or graph state. |

Repository licenses, service terms, and hosted-product restrictions must be rechecked against the exact version before distribution. Architectural approval is not legal approval.

### 16.3 Provider roles must not collapse into one another

- PostgreSQL stores accepted truth and governance state.
- Object storage holds large immutable bodies and artifacts.
- A vector index proposes semantic neighbors; it does not establish factual relationships.
- A graph engine accelerates traversal; it does not become the only source of edges or evidence.
- A graph renderer displays a projection; it does not infer business truth.
- A model gateway routes calls; it does not own conversations, budgets, or accepted knowledge.
- An agent runtime executes workflows; it does not own the product's tenant-facing run ledger.
- An integration marketplace discovers capabilities; it does not prove authorization or successful execution.
- An Obsidian vault makes knowledge portable; it does not become a multi-tenant runtime database.

### 16.4 Deployment topology

```text
Browser / desktop client
          |
          v
Application API --------------------> PostgreSQL + pgvector
          |                                  |
          |                                  +--> canonical knowledge and run state
          |
          +--> object storage                +--> retrieval and audit events
          |
          +--> durable job queue / worker / authorized local runner
          |          |
          |          +--> repository and filesystem ingestion
          |          +--> parsing, chunking, compilation, and embedding
          |          +--> graph materialization and export
          |
          +--> model gateway --> model providers
          |
          +--> governed tool gateway --> LangGraph / Langflow / n8n / Composio / MCP
```

Serverless request handlers may register sources, validate commands, create jobs, read state, and return run IDs. They must not perform unbounded repository scans, long compilation, development-server execution, or large graph builds. Those operations belong on workers or authorized local runners with leases, cancellation, idempotency, and bounded authority.

### 16.5 Durable API and event boundaries

The implementation should preserve these resource families even if endpoint syntax differs:

- `sources` and immutable `source-versions`;
- `ingestion-runs`, child items, attempts, cancellation, and retry;
- `evidence-spans` and content checksums;
- `proposals`, review decisions, merge/supersession, and contradictions;
- immutable `knowledge-versions` and materialized graph versions;
- `retrieval-events`, citations, context budgets, and evaluation results;
- Composer threads, messages, selected scope, and memory actions;
- agent/workflow runs, stages, tool calls, artifacts, spend, and approvals;
- capability list, describe, execute, and verification records;
- export jobs and portable manifests.

State changes should emit workspace-scoped events. Events describe persisted transitions; they are not a substitute for canonical state. Long-running creation requests return a recoverable and cancellable run ID before waiting on external providers.

## 17. Security, Privacy, and Tenancy

- Every record and query is workspace scoped before ranking or graph expansion.
- Source-level ACLs may be stricter than project or workspace access.
- Credentials remain server-side and are never included in model context, graph exports, logs, or browser responses.
- Ingestion rejects credential-bearing paths and sanitizes remote URLs.
- Retrieval records which access policy admitted each item.
- Exports include only explicitly selected authorized data.
- Deletion uses governed retention and tombstone policy without falsifying historical audit evidence.
- Sensitive data classes support redaction, exclusion, and restricted model routing.
- External actions require typed effects, authorized scopes, and appropriate confirmation.

## 18. Cost and Context Controls

Every model or provider operation should declare:

- selected role and model;
- maximum input and output tokens;
- maximum steps and retries;
- maximum spending;
- tool-call ceiling;
- timeout;
- fallback policy;
- whether prompt caching is available;
- whether the operation may run in the background.

Use deterministic parsing, exact search, metadata extraction, and incremental compilation before model calls. Cache compiler inputs and unchanged results. Recompile only affected sources and dependent knowledge.

## 19. Failure Recovery

- Create durable jobs before starting long work.
- Return recoverable run IDs immediately.
- Use leases and idempotency for worker claims.
- Separate parent job state from child source state.
- Make cancellation atomic across parent and incomplete children.
- Retry the same operation at most three times unless an explicit policy says otherwise.
- Preserve partial evidence without activating partial knowledge versions.
- Fail closed on permission, evidence, schema, or spending uncertainty.
- Let ordinary conversation continue in a visibly reduced-context mode when retrieval fails.
- Preserve sanitized errors, attempts, outputs, and repair decisions.
- Never broaden permissions or spending during an automatic retry.

## 20. Observability and Evaluation

Measure:

- ingestion success and failure by adapter;
- duplicate and changed-source rates;
- proposal acceptance, rejection, merge, and contradiction rates;
- review latency and backlog;
- retrieval precision and source diversity;
- citation coverage;
- answer-level evidence availability;
- context tokens and cost per useful answer;
- stale or superseded knowledge usage;
- graph nodes and edges with inspectable evidence;
- agent outcomes linked to retrieved evidence;
- provider latency, failure, fallback, and spend;
- user corrections and reported mismatches.

Evaluation sets should include exact lookup, multi-source synthesis, contradiction detection, temporal questions, permission isolation, project-scoped retrieval, and action decisions requiring evidence.

## 21. Portability

Provide documented export/import contracts for:

- canonical JSON records and relationships;
- immutable source manifests and checksums;
- evidence spans and citations;
- accepted knowledge versions;
- review and supersession history;
- Markdown knowledge pages;
- optional Obsidian-compatible folders, frontmatter, and wikilinks.

An Obsidian-compatible export is a human-readable projection. Folder placement and wikilinks must not replace stable IDs or canonical relationships. Import marks claims as unreviewed until evidence and identity are reconciled.

## 22. Required Product Interfaces

The system should expose stable interfaces for:

- source registration and version ingestion;
- ingestion job status, retry, and cancellation;
- evidence-span retrieval;
- proposal review and batch decisions;
- accepted knowledge query and version history;
- exact, full-text, semantic, graph, and hybrid retrieval;
- saved retrieval-event inspection;
- graph overview, search, neighborhood, filters, and evidence detail;
- project identity and source-map inspection;
- Composer threads, messages, scope, citations, and memory actions;
- agent runs, stages, tools, artifacts, cost, and approvals;
- tool capability list, describe, and execute;
- export and import.

Interface implementations may use REST, GraphQL, RPC, events, or MCP, but the underlying contracts and provenance requirements remain stable.

## 23. Build Acceptance Criteria

The system is complete only when an authorized user can:

1. register a source or approved project;
2. observe an immutable source version and checksum;
3. open exact evidence spans derived from that version;
4. compile proposals through deterministic and model stages;
5. accept, reject, merge, supersede, and defer proposals;
6. inspect a contradiction without either claim disappearing;
7. materialize a new immutable knowledge version;
8. retrieve accepted knowledge within a visible context budget;
9. optionally include clearly labeled exploratory knowledge;
10. inspect why each response used each source;
11. open the same object in Composer, Universe mode, and Evidence mode;
12. inspect project, activity, and knowledge graph planes without conflation;
13. resume a conversation or run without reconstructing all context manually;
14. let an agent use scoped retrieval and approved tools without receiving the entire workspace;
15. trace agent output to models, tools, sources, costs, and approvals;
16. cancel and retry long-running ingestion safely;
17. export authorized knowledge and provenance in documented portable formats;
18. prove cross-workspace isolation and source-level permission enforcement;
19. operate with honest empty, unavailable, unreviewed, contradicted, and reduced-context states;
20. replace model, graph, vector, workflow, or visualization providers without losing canonical knowledge.

### 23.1 Reference delivery order

Build the system as vertical product paths rather than installing every optional dependency first.

#### Phase 1 — trustworthy memory loop

1. Canonical tenant, source, source-version, evidence, proposal, review, and accepted-knowledge records.
2. Authorized capture from text, files, URLs, and one approved project source.
3. Deterministic normalization, chunking, checksums, and exact search.
4. Structured model proposals with exact evidence spans.
5. Fast review with accept, reject, merge, supersede, and contradiction handling.
6. Immutable accepted-knowledge versions and pgvector indexing.
7. Composer retrieval with visible context budgets and exact citations.
8. One inspectable knowledge graph/list experience backed by the same records.
9. Markdown/JSON export with provenance.

#### Phase 2 — project and portability adapters

1. Native repository/project map with symbols, references, dependencies, entrypoints, and file evidence.
2. Approved desktop, GitHub, Vercel, VPS, folder, and vault import contracts.
3. Obsidian-compatible import/export.
4. Evaluate one—not several—of Cognee, Graphify, or Codebase Memory MCP against measured gaps.
5. Improve visual graph scale, accessibility, provenance inspection, and time replay.

#### Phase 3 — governed action system

1. Persistent agent and workflow runs using the same retrieval service.
2. LangGraph execution with product-owned policy, cost, and evidence records.
3. Langflow template linkage where visual authoring is useful.
4. External n8n automation through verified tenant connections.
5. Composio/MCP marketplace discovery followed by explicit tenant authorization and capability verification.
6. List/describe/execute tool gateway with approvals, idempotency, and audit evidence.

#### Phase 4 — measured scale extensions

Only after evaluation shows a real limitation:

- add Qdrant for vector scale or latency that pgvector cannot meet;
- add Graphiti for temporal traversal that native versioning cannot express efficiently;
- add a dedicated graph database for traversal workloads that PostgreSQL projections cannot serve;
- add another agent runtime only when LangGraph cannot meet a documented requirement.

### 23.2 Reusable implementation honesty ledger

Every implementation of this specification should maintain a ledger with one row per capability:

| Capability | Repository present | Automated tests pass | Provider configured | Live execution verified | Authenticated UI verified | Notes/evidence |
|---|---:|---:|---:|---:|---:|---|
| Example: immutable source capture | yes/no | yes/no | n/a | yes/no | yes/no | Commit, test, deployment, or run reference |

The columns are deliberately separate. Code presence is not a deployment. Configuration is not successful execution. A provider catalog is not an authorized tenant connection. A passing API test is not authenticated visual verification. Planned work must never be displayed as completed tenant activity.

## 24. Prohibited Shortcuts

- Do not let an LLM rewrite immutable raw evidence.
- Do not treat a summary as its own source.
- Do not display inferred or semantic edges as confirmed facts.
- Do not resolve contradictions silently.
- Do not publish unreviewed factual material as accepted truth.
- Do not load the entire repository, vault, conversation history, or tool catalog into every prompt.
- Do not make a graph renderer the canonical data model.
- Do not use an Obsidian folder tree as runtime state.
- Do not treat a configured connector as verified authorization.
- Do not let an agent approve its own factual output.
- Do not fabricate graph activity, agent work, review items, or provider state for presentation.
- Do not create a second memory system for one workflow or integration.
- Do not retry indefinitely or broaden authority during recovery.

## 25. Final Architecture Statement

The second brain is an evidence-bearing knowledge operating system, not a notes folder, vector search wrapper, or graph visualization.

Its foundation is the Karpathy separation between immutable source material and a maintained compiled knowledge layer. The dual-loop model keeps active work fast while allowing reusable knowledge to compound. Evidence-gated claims, explicit contradiction handling, bounded hybrid retrieval, persistent Composer context, inspectable graph planes, and governed agent access make the system useful without allowing generated confidence to become invisible truth.

Provider choices remain replaceable. Obsidian remains optional portability. The canonical system is the versioned evidence, knowledge, retrieval, review, and execution contract.
