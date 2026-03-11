# Agent Network Security Foundation (Phase 1)

## Purpose

Rare Agent Work is evolving from a content/report site into an operator-facing agent system. Before building agent-to-agent coordination, tool execution, or multi-tenant automations, the platform needs a clear trust model.

This document defines the **minimum viable security foundation** for an eventual agent network. It is intentionally practical:

- concrete enough to guide Phase 1 implementation
- conservative enough to avoid unsafe fake integrations
- small enough to fit the current codebase and product stage

## Goals

1. Give every acting entity a stable identity.
2. Make authorization explicit, default-deny, and tenant-scoped.
3. Require human approval for irreversible or risky operations.
4. Produce an audit trail that explains who did what, when, and why.
5. Prevent accidental cross-tenant data access.

## Non-goals (for Phase 1)

- No distributed PKI or cross-organization federation yet.
- No blockchain, cryptographic settlement, or reputation markets.
- No autonomous self-escalation or self-issued admin privileges.
- No fake “secure enclave” claims without real infrastructure.
- No automatic approval of destructive external actions.

---

## 1) Trust boundaries

The future agent network has five core boundaries:

1. **Human operator boundary** — an authenticated human owns a tenant and can approve sensitive actions.
2. **Tenant boundary** — customer/org data must never bleed across tenants unless explicitly shared.
3. **Agent runtime boundary** — an agent session acts on behalf of a tenant and must carry scoped identity.
4. **Tool boundary** — every external tool/API call is a privilege escalation event and must be policy-checked.
5. **Audit boundary** — decisions must be reconstructable after the fact.

### Threats we are designing against

- Agent acts outside its tenant scope.
- Agent uses a tool it should not have.
- Agent performs a high-risk action without human approval.
- Internal service token is reused across unrelated tenants.
- Audit logs are too weak to explain or reverse a bad action.
- "Helpful" defaults accidentally create admin behavior.

---

## 2) Identity model

Every principal in the agent network must be represented as a typed identity.

### Principal types

- **human** — an authenticated operator/admin/user
- **agent** — a named automation actor running a session
- **service** — backend/server components acting without a UI session
- **tool** — an external integration invoked by an agent or service

### Required identity fields

Every principal should have, at minimum:

- `principalId` — stable unique identifier
- `kind` — human/agent/service/tool
- `tenantId` — owning tenant (required except for explicitly public resources)
- `displayName` — human-readable label
- `trustLevel` — anonymous / verified / internal / privileged
- `authMethod` — session, api_key, service_token, delegated, or public

### Session requirements

Every agent session should carry:

- `sessionId`
- `principalId`
- `tenantId`
- `issuedAt`
- `expiresAt`
- `delegatedBy` (optional human approver)
- `purpose` (why the session exists)
- `scopes` (approved capabilities)

### Phase 1 rule

**No anonymous write-capable agent sessions.**

Read-only access to public resources can remain anonymous, but any write, tool execution, or side-effecting action must be tied to a tenant-scoped authenticated identity.

---

## 3) Authorization model

Authorization should be **default deny**.

A decision is made from:

- principal
- resource
- action
- tenant relationship
- trust level
- matching policy rules
- HITL requirements

### Resource kinds

Phase 1 resource categories:

- `public_content`
- `tenant`
- `agent`
- `workflow`
- `conversation`
- `knowledge_base`
- `tool`
- `secret`
- `billing`
- `audit_log`

### Action families

Phase 1 action set:

- `read`
- `write`
- `execute`
- `approve`
- `delegate`
- `admin`

### Policy principles

1. **Default deny** if no rule explicitly allows the action.
2. **Deny overrides allow** when both match.
3. **Tenant mismatch denies by default** unless the resource is public or explicit sharing is implemented.
4. **Minimum trust level** can be attached to sensitive resources.
5. **Tool execution is separate from data access** — reading a record does not imply permission to call an external API with it.

### Phase 1 practical scopes

Use simple, human-auditable scopes such as:

- `reports:read`
- `research:write`
- `agents:execute`
- `tools:execute`
- `billing:read`
- `billing:admin`
- `tenants:admin`
- `audit:read`

Avoid free-form privilege strings and avoid role explosion. Roles can be layered later, but Phase 1 should center on explicit scopes + typed policy rules.

---

## 4) Human-in-the-loop (HITL)

Some actions are too risky to auto-execute even if technically authorized.

### HITL modes

- `none` — no human action required
- `notify` — action proceeds, but operator is notified
- `approve` — action is blocked until approved

### HITL should be mandatory for

- Any destructive action with external side effects
- Sending external messages or performing account changes
- Secret creation, rotation, or reveal
- Cross-tenant access requests
- Billing/admin mutations
- Policy changes that expand access
- Tool execution against production systems with write capability
- Any action above a configured risk threshold

### Approval payload should include

- who is requesting the action
- tenant
- target resource
- tool/environment
- natural-language reason
- exact requested action
- expiry time for approval
- correlation/audit id

### Phase 1 rule

**Authorization success is not enough.** If a matching HITL rule says approval is required, the decision remains blocked until a human approves.

---

## 5) Audit model

Every sensitive decision should create an append-only audit event.

### Required audit fields

- `eventId`
- `timestamp`
- `tenantId`
- `actorPrincipalId`
- `actorKind`
- `sessionId` (if present)
- `action`
- `resourceKind`
- `resourceId`
- `decision` (allow / deny / require_hitl)
- `reasonCodes`
- `policyRuleIds`
- `correlationId`
- `requestId`
- `metadata` (sanitized)

### Audit principles

- Append-only, never hard delete.
- Store decision reasons, not just boolean outcomes.
- Keep sensitive payloads redacted by default.
- Preserve enough context to reproduce why a decision happened.
- Link approval events back to the original blocked action.

### Phase 1 recommendation

Start with structured audit events in application storage. Do not wait for a perfect SIEM pipeline before logging decisions.

---

## 6) Tenant isolation

Tenant isolation is the core safety property for a future multi-customer agent network.

### Isolation rules

1. Every non-public resource must have a `tenantId`.
2. Every acting principal must carry a `tenantId`.
3. Authorization denies access when `principal.tenantId !== resource.tenantId`, unless an explicit public/share mechanism exists.
4. Secrets must be tenant-scoped.
5. Background jobs and agent sessions must be tenant-scoped.
6. Audit logs should be queryable per tenant.
7. Cross-tenant analytics should use aggregation, not raw shared access.

### Implementation warning

A service role key is not a security model. Supabase service credentials can bypass row-level protections, so application-layer tenant checks remain mandatory around agent/tool actions.

---

## 7) Decision flow

Recommended authorization pipeline for Phase 1:

1. Resolve the acting principal.
2. Resolve the target resource.
3. Reject if either lacks tenant identity (unless explicitly public).
4. Enforce tenant isolation.
5. Evaluate matching deny rules.
6. Evaluate matching allow rules.
7. Evaluate HITL rules.
8. Emit audit event.
9. Execute only if decision is `allow`.

This order matters. HITL is a gate after authorization, not a replacement for it.

---

## 8) Phase 1 implementation shape for this repo

The safest near-term path in Rare Agent Work is:

### Deliver now

- Typed policy primitives for principals, resources, rules, HITL, and audit events
- A small deterministic evaluator with default-deny and tenant isolation
- Tests proving deny precedence, tenant isolation, and HITL escalation
- This security design doc

### Integrate next

- Wrap future agent/tool endpoints with the evaluator before execution
- Attach correlation IDs to API requests that can trigger agent work
- Persist structured audit events for sensitive endpoints
- Introduce tenant-scoped policy storage only after the model stabilizes

### Do later

- Approval queue UI
- Signed delegated session tokens
- Policy administration flows
- Per-tool trust registries
- Formal key rotation and secret custody workflows

---

## 9) Suggested initial policy defaults

Good default posture for the first networked agent features:

- Public site content: readable by anyone
- Tenant content: readable only within tenant
- Tool execution: allowed only for verified/internal/privileged principals with explicit scope
- Secret access: approval required, privileged only
- Billing/admin changes: approval required, privileged only
- Cross-tenant requests: denied unless a future share contract exists
- Policy mutation: approval required, privileged only

---

## 10) Open questions before production rollout

1. Will Rare Agent Work support single-tenant workspaces first, or true multi-tenant orgs immediately?
2. Which operations count as externally visible side effects on day one?
3. Where should approval decisions live: app DB, queue, or both?
4. Which actor types are allowed to mint delegated sessions?
5. Do audit logs need immutable export on day one, or is append-only application storage enough?

---

## Summary

The Phase 1 trust model is simple on purpose:

- stable identities
- default-deny authz
- explicit tenant boundaries
- mandatory HITL for risky actions
- structured audit trails

That is enough to safely start building agent-facing features without pretending the platform already has a mature trust fabric.
