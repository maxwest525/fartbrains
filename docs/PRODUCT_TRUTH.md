# Fartbrains — Product Truth

Fartbrains is a **reusable second brain you can attach to your work**.

One account is one private brain. It may be sold to many customers — that is
multitenancy, and every tenant is isolated from every other. Multitenancy is not
teams: it means many separate customers, not many people inside one account.

## The promise
1. Put anything in — a thought, a link, a reel, a repo.
2. It becomes durable, structured, attributable knowledge.
3. Ask for a prompt, and your own agent builds from it.
4. It stays yours, and you can see exactly what it knows and why.

## We do not build anything
That is the load-bearing sentence. Fartbrains ships **a prompt**, not code.

You save a reel of someone explaining an SEO tactic, or showing off their
personal CEO agent. Today that is a bookmark you never open again. Here it
becomes a brief good enough that the agent already sitting in your project can
build the thing.

The chain is: capture → transcribe → summarize → **prompt**. The last step is the
product; the rest is what makes it good. Whoever holds the filesystem does the
building, and that is never us.

## The differentiator
Today, giving an AI access to your knowledge means installing a pile of plugins
and MCP servers, each injecting unaudited schemas and unknown behaviour into
your context and your machine.

Fartbrains is **one governed surface instead of N ungoverned ones.** Capabilities
are listed, described and executed through a single gateway with real
authorization, bounded output, and a durable record of what ran. Nothing is
injected wholesale into a prompt.

That is the product. The second brain is what makes it worth connecting to.

## What it is
- A private knowledge store with immutable sources and compiled knowledge on top
- Attachable to a customer's own projects, repos and folders
- Reachable over MCP, so an agent can read, search and build from it
- Able to turn captured material — including a transcript or a rough idea — into
  a working prompt, spec, or solution

## Current scope
The brain belongs to one account. "Projects" means **the customer's own repos
and folders their brain is attached to** — not a shared workspace with other
people in it. Review in the knowledge compiler is single-owner: the reviewer is
the account holder, so there is no reviewer role, approver hierarchy, or
permissions matrix over people to build.

That is a scope choice, not a principle. Multi-person scope is a real product
question — people attaching work repos will ask for it — and if we decide to
add it, it is a deliberate decision with its own design, not something that
arrives by accident through a permissions column.

What the product is not, and gains nothing from becoming: a general
collaborative document editor or a project-management tool.

## The only interpersonal feature
A customer may deliberately share **one specific idea** through a secure,
revocable, read-only link. The recipient never gains access to the account,
folders, other ideas, graph, conversations, raw vault, or private metadata. No
comments, presence, or shared editing.

## Vocabulary
The database table is `ideas` for historical reasons and is not renamed. The
customer-facing umbrella is **Library** / **items**. Under the target
architecture (`docs/spec/karpathy-second-brain-spec.md`), an item resolves to an
immutable `source_version` plus compiled knowledge derived from it.

## Target architecture
`docs/spec/karpathy-second-brain-spec.md` is the build specification.

Its tenancy and review language assumes an organization. We are single-owner per
tenant today, so read those sections as describing one person's own review loop
until we decide otherwise.

**Build time and run time are different systems.** Ingest, chunk, embed, compile
and scan run on our own server, off the request path. Postgres holds canonical
state. Run time is retrieval and the Composer, and stays request-shaped.

## How a subscriber connects
They subscribe, do their own setup, and are told to point their existing AI
session at our MCP endpoint. That is the whole integration.

**Their agent already has their filesystem.** It is running on their machine, in
their project. We never reach for it, clone it, or ask them to install anything
of ours — we expose one endpoint and their agent brings the local context.

This is why the differentiator holds. The alternative is a pile of plugins and
MCP servers each injecting unaudited code into someone's machine; we are one
governed endpoint they point at.

It also sets the direction of flow: local project material comes **in through
the MCP write tools**, pushed by their agent, rather than out through an
ingester of ours. Our own build-time work — chunk, embed, compile — runs on our
server against what has arrived.
