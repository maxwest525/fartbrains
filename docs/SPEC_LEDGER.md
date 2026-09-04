# Second brain spec — implementation ledger

Format per `docs/spec/karpathy-second-brain-spec.md` §23.2. The columns are
deliberately separate: **code presence is not a deployment, configuration is not
successful execution, and a passing API test is not authenticated visual
verification.**

Legend: ✅ done · 🟡 partial · ❌ absent · n/a not applicable

## Phase 1 — trustworthy memory loop (§23.1)

| Capability | In repo | Tests pass | Provider configured | Live execution verified | Auth'd UI verified | Evidence / notes |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Canonical tenant records | ✅ | ✅ | ✅ | ✅ | ✅ | `auth.users` + `user_id` on 13 tables; isolation proven 2026-09-04 against a 222-idea control (`QA_MATRIX.md`) |
| `source` / `source_version` (immutable) | ❌ | ❌ | n/a | ❌ | ❌ | **Largest gap.** `ideas` is mutable and edited in place. §3.1 requires append-only versioned sources with checksums |
| `evidence_span` | ❌ | ❌ | n/a | ❌ | ❌ | Nothing segments or locates evidence |
| `proposal` / `review_decision` | ❌ | ❌ | n/a | ❌ | ❌ | No proposal record, no review state |
| `knowledge_object` / `relationship` | 🟡 | ❌ | n/a | ❌ | 🟡 | Only `idea_references` (typed links) and free tags. No typed knowledge objects, no relationship classes |
| Authorized capture — text, files, URLs | ✅ | 🟡 | ✅ | ✅ | ✅ | Composer, URL extraction, YouTube/Instagram transcription with shared cache |
| Authorized capture — one project source | ❌ | ❌ | ❌ | ❌ | ❌ | No repo or folder ingestion at all |
| Deterministic normalize / chunk / checksum | 🟡 | ❌ | ✅ | 🟡 | n/a | Extraction and transcription normalize; **no chunking, no checksums, no content addressing** |
| Exact search (Postgres FTS) | 🟡 | ❌ | ✅ | ❌ | ❌ | `ideas.search_vector` generated column + GIN index **exist and are queried by nothing.** Search is `ILIKE` over a 400-row window |
| Structured model proposals w/ evidence spans | ❌ | ❌ | ✅ | ❌ | ❌ | Summaries and tags are written straight onto the row as accepted truth — the exact §3.4 violation |
| Fast review (accept/reject/merge/supersede) | ❌ | ❌ | n/a | ❌ | ❌ | No review queue. Without it "models propose, policy accepts" collapses |
| Contradiction handling | ❌ | ❌ | n/a | ❌ | ❌ | Nothing detects or preserves conflict |
| Immutable accepted-knowledge versions | ❌ | ❌ | n/a | ❌ | ❌ | |
| pgvector indexing | ❌ | ❌ | ❌ | ❌ | n/a | Extension not enabled. No embeddings anywhere in the codebase |
| Composer retrieval w/ visible context budget | 🟡 | ❌ | ✅ | ✅ | ✅ | `asher-context` exposes which items were used and why — genuinely close to §11.5. But the budget is implicit and selection is keyword scoring |
| Exact citations | 🟡 | ❌ | ✅ | ✅ | ✅ | Cites source items, not evidence spans |
| Inspectable graph experience | 🟡 | ❌ | n/a | ✅ | ✅ | `GraphPage` exists. Renders item/tag relationships, not a knowledge graph with provenance |
| Markdown / JSON export with provenance | 🟡 | ✅ | n/a | ❌ | ❌ | `exportAccount.ts`, 10 tests. Exports content; no provenance because none is recorded |

## Cross-cutting (spec §15, §17, §18, §23.2)

| Capability | In repo | Tests pass | Provider configured | Live execution verified | Auth'd UI verified | Evidence / notes |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Governed tool gateway — list/describe/execute | 🟡 | ❌ | ✅ | ✅ | n/a | MCP server, 20 tools, OAuth, RLS-scoped, AI tools inherit the quota guard. **This is the product's entire integration surface** — a subscriber points their session at it and their agent does the rest. **Missing the three-operation shape**: all 20 schemas are exposed at once rather than list → describe → execute, which is the thing we criticise other servers for |
| MCP write path carries project + source context | ❌ | ❌ | ✅ | ❌ | n/a | `create_idea` / `capture_url` write mutable rows with no project, source or version. For an agent pushing repo material up, they need to write a `source_version` scoped to a `project` |
| Workspace scoping before ranking | ✅ | ✅ | ✅ | ✅ | ✅ | RLS on every user-owned table; verified two-account |
| Credentials server-side only | ✅ | ❌ | ✅ | ✅ | n/a | No service-role key in client or MCP path |
| Cost + context controls (§18) | 🟡 | ✅ | ✅ | ✅ | ❌ | `ai-guard`: model, input cap, retries, timeout, per-plan quotas, spend accounting, refunds. **Missing:** declared max output tokens, tool-call ceiling, explicit fallback policy |
| Build-time runner (§16.4) | 🟡 | ❌ | ❌ | ❌ | n/a | Everything happens inside request handlers today. Ingest / chunk / embed / compile / scan are **build-time** work and belong on our own server. `jobs` (migration `20260904150000`) defines the durable lease-based queue; the runner that consumes it does not exist yet |
| Model gateway = LiteLLM → OpenRouter (§16.1) | ❌ | n/a | ❌ | ❌ | n/a | **Documented deviation.** All 12 chat call sites hardcode `ai.gateway.lovable.dev`. `_shared/stt.ts` is already provider-configurable and shows the pattern |
| Object storage for immutable bodies | ❌ | ❌ | ❌ | ❌ | n/a | Bodies live in Postgres text columns |
| Honesty ledger | ✅ | n/a | n/a | ✅ | n/a | This file and `FEATURE_AUDIT.md` |

## Reading of the above

Fartbrains today is a **capture-and-recall product with real multitenancy,
cost control and a governed MCP surface.** Those are the expensive, unglamorous
parts and they are done and verified.

What it is not yet is a **knowledge compiler.** There are no immutable sources,
no evidence spans, no proposals, no review, no contradiction handling, and no
semantic retrieval. Summaries and tags are written directly onto records as
accepted truth. We want the opposite: a model proposes, a claim cites an exact
range of an immutable version, and nothing becomes operating truth without
passing review.

### Build time vs run time
Most of what is missing is build-time work — ingest, checksum, chunk, embed,
compile, scan. It runs on our own server, off the request path.

The subscriber installs nothing: they point their existing AI session at our MCP
endpoint, and their agent — already running in their project, with their
filesystem — pushes what matters up through the MCP write tools. We do not reach
into their machine. Our build-time work operates on what has arrived.

Postgres holds canonical state; the runner produces it. Run time stays small and
request-shaped: retrieval over chunks, plus the Composer.

### The dependency that orders everything
`source` / `source_version` (§3.1) is load-bearing. Evidence spans, provenance,
supersession, contradiction and honest citation all reference a version. Adding
embeddings or a review queue before it means building them against mutable rows
and reworking both later.

### Recommended first slice
1. `sources` + `source_versions` with checksums, alongside `ideas` rather than
   replacing it. Existing rows backfill as version 1.
2. `evidence_spans` against a version.
3. Turn on `search_vector` — the FTS path already exists and is switched off.
4. Enable pgvector; embed spans, not whole items.
5. Only then: proposals and the review queue.

Steps 3 and 4 are small. Step 1 is the real work, and doing it first is what
stops the rest being built twice.
