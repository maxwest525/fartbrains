# Fartbrains — Product Truth

Fartbrains is a **reusable second brain you can attach to your work**.

One account is one private brain. It may be sold to many customers — that is
multitenancy, and every tenant is isolated from every other. Multitenancy is not
teams: it means many separate customers, not many people inside one account.

## The promise
1. Put anything in — a thought, a link, a reel, a repo, a folder.
2. It becomes durable, structured, attributable knowledge.
3. Find it, ask it, or hand it to an agent that builds from it.
4. It stays yours, and you can see exactly what it knows and why.

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

## What it is NOT
Not a team workspace, company knowledge base, collaborative editor, or
project-management tool for groups. There are no organizations, team accounts,
shared workspaces, member roles, seat-based billing, workspace invitations,
shared vaults, shared folders, or real-time collaborative editing — and none may
be introduced.

"Projects" here means **the customer's own repos and folders that their brain is
attached to.** It never means a shared workspace with other people in it.

Review and approval in the knowledge compiler are single-owner: the reviewer is
the account holder. Do not build a reviewer role, an approver hierarchy, or a
permissions matrix over people.

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
`docs/spec/karpathy-second-brain-spec.md` is the build specification. Where this
document and that specification disagree about people and permissions, **this
document wins**: the spec's tenancy and review language assumes an organization,
and Fartbrains is single-owner per tenant.
