# Rare Agent Work — A2A Agent Network Strategy

_Date: 2026-03-11_

## Decision question
Should Rare Agent Work evolve from a read-only agent-news/research site into a secure agent-to-agent and human-to-agent network, and if so, how should A2A fit into the architecture?

## Short answer
Yes, but only in a narrow way.

**A2A is a value add if we use it to make Rare Agent Work an agent directory + trust broker + operator console for specialist agents.**

**It becomes a distraction if we try to turn the site into a general-purpose agent marketplace, social network, or full-blown agent runtime before we have distribution and trust.**

The right move is:
1. keep the current research/news product,
2. add an **A2A-compatible discovery layer**,
3. add a **secure task-routing layer** for vetted agents,
4. add a **human approval and audit layer**,
5. only later add monetized agent introductions / paid private agent networks.

## What exists already in the repo
Rare Agent Work is not starting from zero. It already has the early pieces of an agent-facing surface:

- A public NLWeb-style ask endpoint that is explicitly described as usable by AI agents and returns structured JSON (`src/app/ask/route.ts`).
- A public machine-readable agent descriptor at `/.well-known/agent.json` (`public/.well-known/agent.json`).
- Product direction centered on operator context, trust, consulting, and implementation help rather than generic content (`docs/rareagent-product-roadmap-2026-03.md`).

That matters because the site is already halfway to being an **agent-accessible knowledge node**. The missing piece is interoperability and trust, not content.

## Relevant external facts
Based on the A2A spec and Google launch materials:

- A2A is an open protocol for agent-to-agent communication across frameworks/vendors.
- It uses existing web standards: HTTP, JSON-RPC, SSE.
- Core concepts are **Agent Card**, **Task**, **Message**, **Artifact**, streaming updates, and optional push notifications.
- Discovery is commonly done via `/.well-known/agent-card.json` or a curated registry.
- The spec explicitly expects enterprise auth/authz and recommends protecting sensitive cards/endpoints.
- A2A complements MCP rather than replacing it: MCP is for tools/context to an agent; A2A is for agent-to-agent collaboration.

## Why this could be a value add

### 1. It sharpens the site's positioning
Right now Rare Agent Work is mostly a premium operator media/research property with some agent-facing endpoints.

Adding A2A in the right way moves it from:
- "site about agents"

to:
- "place where agents can discover, evaluate, and securely work with other agents"

That is much more ownable.

### 2. It matches the current brand promise
The site already sells:
- operator research,
- implementation guidance,
- context on what matters,
- consulting for serious teams.

A vetted A2A network is a natural extension of that. It says: _we do not just tell you which agent patterns matter; we expose a secure network where those patterns can actually be used._

### 3. It creates a higher-value wedge than content alone
Content is easy to commoditize.

A trusted network with:
- discoverable specialist agents,
- authenticated access,
- approval gates,
- audit logs,
- and clear delegation semantics,

is harder to copy and more defensible.

### 4. It gives humans a useful role
The human-side product is not "chat with yet another bot."
It should be:
- discover specialist agents,
- inspect trust level and capabilities,
- connect your own agent to them,
- approve or reject sensitive actions,
- watch task state and artifacts,
- manage access and billing.

That is real operator value.

## Why this could become a distraction

### 1. A marketplace before trust would be fake progress
If Rare Agent Work jumps straight into "submit your agent" and "find any agent," quality will collapse fast.

Without curation, identity verification, and observable outcomes, an agent directory is just App Store spam for protocols.

### 2. Running third-party agents is not the same as connecting them
A2A lets agents communicate. It does **not** mean Rare Agent Work needs to host arbitrary remote agent execution.

If we conflate:
- discovery,
- trust,
- orchestration,
- hosting,
- billing,
- compliance,

into one launch, the project will sprawl immediately.

### 3. Security overhead can eat the whole roadmap
If we let remote agents trigger sensitive actions without:
- per-agent auth,
- scoped permissions,
- human approval on irreversible actions,
- tenant isolation,
- audit trails,

we are building incident fuel.

### 4. Distribution still matters more than protocol compliance
An A2A implementation nobody uses is still nobody using it.

So the initial feature set must improve the current business:
- better differentiation,
- better conversion,
- stronger consulting funnel,
- stronger operator trust.

## Recommendation

### Recommended strategy: "Trusted Agent Exchange," not "Agent Social Network"
Do **not** build a general social graph for agents.
Do **not** build a broad open marketplace first.
Do **not** try to host all agent logic.

Build Rare Agent Work as a **trusted exchange layer** with three jobs:

1. **Discovery** — who are the good specialist agents?
2. **Connection** — how can my agent or team connect to them?
3. **Control** — how do we do this securely, with human oversight and logs?

That is aligned with the current site and with A2A's strengths.

## Product concept

### For agents
Rare Agent Work becomes a place where an agent can:
- discover A2A-compatible specialist agents,
- read their Agent Cards,
- understand auth requirements and supported skills,
- request a task,
- stream status/artifacts,
- optionally route through a Rare Agent Work broker for trust, logging, and approval.

### For humans
Rare Agent Work becomes a place where a human can:
- browse vetted agents by specialty,
- compare capabilities and trust posture,
- connect their own stack,
- create connection policies,
- require approval for risky actions,
- see execution history and artifacts,
- pay for premium agents, access, or introductions.

## Proposed architecture

### Layer 0 — Keep existing public knowledge endpoints
Preserve and improve the current agent-readable layer:
- `GET/POST /api/v1/ask`
- `GET /api/v1/news`
- `GET /api/v1/reports`
- `/.well-known/agent.json`

This remains the top-of-funnel and public discovery surface.

### Layer 1 — Add A2A discovery
Add an **A2A Agent Card** at:
- `/.well-known/agent-card.json`

This should describe Rare Agent Work as an A2A server with skills such as:
- discover agents
- search vetted specialists
- retrieve agent trust profile
- request introduction / connection
- broker delegated task
- fetch task status

Important: the public card should expose only low-risk/public skills.
Sensitive/private capabilities should require authenticated or extended cards.

### Layer 2 — Add a curated agent registry
Create an internal registry table for agents with fields like:
- agent_id
- name
- provider
- endpoint_url
- public_agent_card_url
- verified_identity_status
- supported_skills
- auth_scheme
- trust_tier
- tenant_visibility
- allowed_modalities
- rate_limits
- billing_model
- last_healthcheck_at
- compliance_notes

This is the actual product wedge.
A2A gives interoperability; the registry gives value.

### Layer 3 — Add a brokered task API
Instead of letting humans directly wire arbitrary agents together, Rare Agent Work should provide a broker service:
- human or client agent chooses a vetted remote agent,
- Rare Agent Work validates policy,
- creates task envelope,
- injects auth/tenant context,
- optionally pauses for approval,
- forwards task via A2A,
- streams status/artifacts back,
- stores audit logs.

This makes Rare Agent Work the trusted middle layer.

### Layer 4 — Human approval + audit
Every high-risk action must support:
- pre-execution approval,
- post-execution artifact review,
- immutable audit trail,
- revocation / disconnect,
- scoped credentials.

Examples that should require approval by default:
- sending email,
- spending money,
- modifying production systems,
- sharing private files,
- writing to external SaaS.

### Layer 5 — Private network / paid access
Only after the above works:
- team-private agent networks,
- premium vetted agents,
- paid routing volume,
- private operator circles / introductions,
- consulting-assisted custom agent matching.

## Security model

This is the part that decides whether the idea is real or cosplay.

### Principles
1. **Never trust remote agents by default.**
2. **Separate discovery from execution.**
3. **Separate execution from authorization.**
4. **Default sensitive operations to HITL approval.**
5. **Use scoped, revocable credentials only.**
6. **Keep tenant boundaries explicit everywhere.**

### Minimum secure design

#### Identity
- Every registered agent gets a stable identity record.
- Verified agents require domain verification plus signed control of their A2A endpoint.
- Prefer OAuth2 client credentials, signed JWT assertions, or mTLS for higher-trust connections.

#### Authorization
- Permissions must be skill-scoped, tenant-scoped, and action-scoped.
- Example scopes:
  - `discover:agents`
  - `invoke:research-agent`
  - `read:task-status`
  - `approve:sensitive-action`

#### Approval gates
- Sensitive skills are disabled unless explicitly enabled per tenant.
- Irreversible actions require human approval or pre-approved policy.

#### Observability
- Log every delegation event, status change, artifact receipt, and approval decision.
- Persist enough metadata to reconstruct who requested what and why.

#### Isolation
- Do not give remote agents direct access to Rare Agent Work internals.
- Use broker-issued short-lived tokens for any downstream session.

#### Disclosure control
- Public cards expose marketing-safe/public skills.
- Authenticated extended cards expose detailed private capabilities only to permitted clients.

## How this fits with what the repo already has

### Current state
The repo already presents Rare Agent Work as an agent-readable surface:
- the ask endpoint explicitly says it is for AI agents and returns structured JSON,
- the site publishes `/.well-known/agent.json`,
- the roadmap emphasizes trust, context, and consulting.

### Gap analysis
What is missing for A2A-grade functionality:
- no A2A Agent Card yet,
- no task lifecycle objects for remote delegation,
- no curated registry of third-party agents,
- no auth model for agent-to-agent execution,
- no approval workflow for risky delegated actions,
- no execution audit console.

So the move is not a rewrite. It is a focused extension.

## Product scope recommendation

### Build now
1. A2A discovery compatibility
2. Curated registry of vetted agents
3. Brokered task routing for a small number of specialist agent types
4. Human approval center
5. Audit log + trust badges
6. "Connect your agent" docs and onboarding

### Do later
1. Open submission marketplace
2. Social/feed features for agents
3. In-platform arbitrary agent hosting
4. Cross-agent payments/revenue sharing automation
5. Open public write access between agents

### Avoid entirely for now
1. Unvetted agent-to-agent auto-execution
2. Anonymous agent submission with public activation
3. Broad claims about a decentralized agent internet before trust controls exist

## Suggested initial agent categories
Start with high-signal, narrow categories where Rare Agent Work already has credibility:

- research agents
- monitoring / news agents
- model evaluation agents
- architecture review agents
- implementation planning agents
- QA / release verification agents

Do **not** start with:
- payments
- production infrastructure mutation
- unrestricted email/posting agents

Those should come only after approval/audit is battle-tested.

## 30/60/90 day plan

### 0-30 days: prove the wedge
- Publish `/.well-known/agent-card.json`
- Create internal agent registry schema
- Add a public "Agent Network" landing page
- Support browsing vetted agents and reading normalized capability cards
- Add waitlist / consulting CTA for teams that want their agents connected

Success criteria:
- can discover and display vetted agents,
- can explain why each agent is trustworthy / useful,
- can convert interest into leads.

### 30-60 days: prove secure routing
- Implement brokered task creation for 1-2 low-risk skills
- Add auth for agent registration and invocation
- Add human approval UI for flagged tasks
- Add task detail pages with artifacts/status history

Success criteria:
- at least one real end-to-end A2A flow works,
- approvals and logs are visible and understandable,
- no direct raw trust in remote agents.

### 60-90 days: prove commercial value
- Add paid/private network tier
- Add per-tenant policy controls
- Add verified badges / trust tiers
- Add health checks and uptime/reliability scoring for agents
- Add premium operator workflows around introductions and audits

Success criteria:
- measurable consulting or subscription lift,
- at least a few recurring users/teams using the network,
- clear evidence that the network improves retention or revenue.

## Commercial angle
This should not be sold as "come chat with our bot."

It should be sold as:
- **Find the right specialist agent faster**
- **Connect your stack without writing custom glue for every vendor**
- **Keep a human in control for risky actions**
- **Get operator-grade trust, policy, and auditability**

Possible monetization:
- free public discovery
- paid private/team network
- paid verified-agent listing
- paid brokered execution volume
- consulting for enterprise rollout / custom integrations

## Final judgment

### Is this a value add?
**Yes — if Rare Agent Work becomes the trusted connective tissue between agents, not just another content site.**

### Is it a distraction?
**Yes — if we interpret A2A as permission to build a sprawling open agent marketplace before trust, identity, and approval controls exist.**

## Final recommendation
Proceed, but keep the thesis tight:

> Rare Agent Work should become a curated A2A-compatible agent exchange for serious operators.

Not:
- an everything marketplace,
- an agent social network,
- or a generic orchestration platform.

The next best move is to ship the discovery layer first, because it compounds with the existing site instead of fighting it.

## Concrete next build steps
1. Add `/.well-known/agent-card.json` with public discovery-only skills.
2. Add `docs/agent-network-product-spec.md` translating this strategy into DB schema, endpoints, UI flows, and auth rules.
3. Add a new `/network` page explaining the trust model and early access offer.
4. Design the brokered task model before exposing any third-party execution.
5. Gate all sensitive agent actions behind approval from day one.
