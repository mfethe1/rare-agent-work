import { describe, expect, it } from 'vitest';

import {
  buildAuditEvent,
  evaluateAuthorization,
  type AuthorizationInput,
  type HitlRule,
  type PolicyRule,
  type PrincipalIdentity,
  type ResourceIdentity,
} from '@/lib/security';

const basePrincipal: PrincipalIdentity = {
  principalId: 'agent-1',
  kind: 'agent',
  tenantId: 'tenant-a',
  displayName: 'Research Agent',
  trustLevel: 'internal',
  authMethod: 'delegated',
  scopes: ['reports:read', 'tools:execute', 'research:write'],
};

const baseResource: ResourceIdentity = {
  resourceId: 'kb-1',
  kind: 'knowledge_base',
  tenantId: 'tenant-a',
};

function makeInput(overrides: Partial<AuthorizationInput> = {}): AuthorizationInput {
  return {
    principal: basePrincipal,
    resource: baseResource,
    action: 'read',
    policyRules: [],
    hitlRules: [],
    ...overrides,
  };
}

describe('evaluateAuthorization()', () => {
  it('defaults to deny when no allow rule matches', () => {
    const decision = evaluateAuthorization(makeInput());

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('deny');
    expect(decision.reasonCodes).toContain('no_matching_allow_rule');
  });

  it('allows tenant-scoped access when an allow rule matches', () => {
    const rules: PolicyRule[] = [
      {
        id: 'allow-kb-read',
        effect: 'allow',
        principalKinds: ['agent'],
        actions: ['read'],
        resourceKinds: ['knowledge_base'],
        scopesAny: ['reports:read'],
      },
    ];

    const decision = evaluateAuthorization(makeInput({ policyRules: rules }));

    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe('allow');
    expect(decision.matchedPolicyRuleIds).toEqual(['allow-kb-read']);
  });

  it('denies cross-tenant access by default even when an allow rule matches', () => {
    const rules: PolicyRule[] = [
      {
        id: 'allow-kb-read',
        effect: 'allow',
        actions: ['read'],
        resourceKinds: ['knowledge_base'],
        scopesAny: ['reports:read'],
      },
    ];

    const decision = evaluateAuthorization(
      makeInput({
        policyRules: rules,
        resource: { ...baseResource, tenantId: 'tenant-b' },
      }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain('tenant_mismatch');
  });

  it('lets an explicit deny rule override a matching allow rule', () => {
    const rules: PolicyRule[] = [
      {
        id: 'allow-secret-read',
        effect: 'allow',
        actions: ['read'],
        resourceKinds: ['secret'],
        scopesAny: ['reports:read'],
      },
      {
        id: 'deny-agent-secret-read',
        effect: 'deny',
        principalKinds: ['agent'],
        actions: ['read'],
        resourceKinds: ['secret'],
      },
    ];

    const decision = evaluateAuthorization(
      makeInput({
        action: 'read',
        resource: { resourceId: 'secret-1', kind: 'secret', tenantId: 'tenant-a' },
        policyRules: rules,
      }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('deny');
    expect(decision.matchedPolicyRuleIds).toEqual(['deny-agent-secret-read']);
  });

  it('escalates to HITL approval when a risky action matches an approval rule', () => {
    const rules: PolicyRule[] = [
      {
        id: 'allow-tool-exec',
        effect: 'allow',
        actions: ['execute'],
        resourceKinds: ['tool'],
        scopesAny: ['tools:execute'],
        trustAtLeast: 'internal',
      },
    ];

    const hitlRules: HitlRule[] = [
      {
        id: 'approve-tool-exec',
        mode: 'approve',
        actions: ['execute'],
        resourceKinds: ['tool'],
      },
    ];

    const decision = evaluateAuthorization(
      makeInput({
        action: 'execute',
        resource: { resourceId: 'tool-1', kind: 'tool', tenantId: 'tenant-a' },
        policyRules: rules,
        hitlRules,
      }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('require_hitl');
    expect(decision.hitlMode).toBe('approve');
    expect(decision.matchedHitlRuleIds).toEqual(['approve-tool-exec']);
  });

  it('builds an audit event from an authorization decision', () => {
    const input = makeInput({
      policyRules: [
        {
          id: 'allow-kb-read',
          effect: 'allow',
          actions: ['read'],
          resourceKinds: ['knowledge_base'],
          scopesAny: ['reports:read'],
        },
      ],
    });

    const decision = evaluateAuthorization(input);
    const event = buildAuditEvent(input, decision, {
      eventId: 'evt-1',
      timestamp: '2026-03-11T15:00:00.000Z',
      correlationId: 'corr-1',
      requestId: 'req-1',
      metadata: { endpoint: '/api/agents/run' },
    });

    expect(event.eventId).toBe('evt-1');
    expect(event.decision).toBe('allow');
    expect(event.actorPrincipalId).toBe('agent-1');
    expect(event.resourceKind).toBe('knowledge_base');
    expect(event.metadata).toEqual({ endpoint: '/api/agents/run' });
  });
});
