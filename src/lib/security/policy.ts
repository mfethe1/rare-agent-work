export type TrustLevel = 'anonymous' | 'verified' | 'internal' | 'privileged';

export type PrincipalKind = 'human' | 'agent' | 'service' | 'tool';

export type AuthMethod = 'public' | 'session' | 'api_key' | 'service_token' | 'delegated';

export type ResourceKind =
  | 'public_content'
  | 'tenant'
  | 'agent'
  | 'workflow'
  | 'conversation'
  | 'knowledge_base'
  | 'tool'
  | 'secret'
  | 'billing'
  | 'audit_log';

export type Action = 'read' | 'write' | 'execute' | 'approve' | 'delegate' | 'admin';

export type Effect = 'allow' | 'deny';

export type HitlMode = 'none' | 'notify' | 'approve';

export interface PrincipalIdentity {
  principalId: string;
  kind: PrincipalKind;
  tenantId?: string;
  displayName: string;
  trustLevel: TrustLevel;
  authMethod: AuthMethod;
  scopes: string[];
}

export interface ResourceIdentity {
  resourceId: string;
  kind: ResourceKind;
  tenantId?: string;
  isPublic?: boolean;
  minTrustLevel?: TrustLevel;
  labels?: string[];
}

export interface PolicyRule {
  id: string;
  effect: Effect;
  principalKinds?: PrincipalKind[];
  actions?: Action[];
  resourceKinds?: ResourceKind[];
  scopesAny?: string[];
  trustAtLeast?: TrustLevel;
  allowCrossTenant?: boolean;
}

export interface HitlRule {
  id: string;
  mode: Exclude<HitlMode, 'none'>;
  actions?: Action[];
  resourceKinds?: ResourceKind[];
  principalKinds?: PrincipalKind[];
  minTrustAtMost?: TrustLevel;
}

export interface AuthorizationInput {
  principal: PrincipalIdentity;
  resource: ResourceIdentity;
  action: Action;
  policyRules: PolicyRule[];
  hitlRules?: HitlRule[];
}

export interface AuthorizationDecision {
  allowed: boolean;
  decision: 'allow' | 'deny' | 'require_hitl';
  hitlMode: HitlMode;
  reasonCodes: string[];
  matchedPolicyRuleIds: string[];
  matchedHitlRuleIds: string[];
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  tenantId?: string;
  actorPrincipalId: string;
  actorKind: PrincipalKind;
  sessionId?: string;
  action: Action;
  resourceKind: ResourceKind;
  resourceId: string;
  decision: AuthorizationDecision['decision'];
  reasonCodes: string[];
  policyRuleIds: string[];
  correlationId?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const TRUST_ORDER: Record<TrustLevel, number> = {
  anonymous: 0,
  verified: 1,
  internal: 2,
  privileged: 3,
};

function includesOrWildcard<T extends string>(list: T[] | undefined, value: T): boolean {
  if (!list || list.length === 0) return true;
  return list.includes(value);
}

function hasRequiredTrust(actual: TrustLevel, required: TrustLevel): boolean {
  return TRUST_ORDER[actual] >= TRUST_ORDER[required];
}

function matchesRule(rule: PolicyRule, input: AuthorizationInput): boolean {
  if (!includesOrWildcard(rule.principalKinds, input.principal.kind)) return false;
  if (!includesOrWildcard(rule.actions, input.action)) return false;
  if (!includesOrWildcard(rule.resourceKinds, input.resource.kind)) return false;

  if (rule.scopesAny && rule.scopesAny.length > 0) {
    const hasScope = rule.scopesAny.some((scope) => input.principal.scopes.includes(scope));
    if (!hasScope) return false;
  }

  if (rule.trustAtLeast && !hasRequiredTrust(input.principal.trustLevel, rule.trustAtLeast)) {
    return false;
  }

  return true;
}

function matchesHitlRule(rule: HitlRule, input: AuthorizationInput): boolean {
  if (!includesOrWildcard(rule.principalKinds, input.principal.kind)) return false;
  if (!includesOrWildcard(rule.actions, input.action)) return false;
  if (!includesOrWildcard(rule.resourceKinds, input.resource.kind)) return false;

  if (rule.minTrustAtMost) {
    return TRUST_ORDER[input.principal.trustLevel] <= TRUST_ORDER[rule.minTrustAtMost];
  }

  return true;
}

export function evaluateAuthorization(input: AuthorizationInput): AuthorizationDecision {
  const reasonCodes: string[] = [];
  const matchedPolicyRuleIds: string[] = [];
  const matchedHitlRuleIds: string[] = [];

  if (!input.resource.isPublic) {
    if (!input.principal.tenantId || !input.resource.tenantId) {
      return {
        allowed: false,
        decision: 'deny',
        hitlMode: 'none',
        reasonCodes: ['missing_tenant_context'],
        matchedPolicyRuleIds,
        matchedHitlRuleIds,
      };
    }
  }

  const matchingRules = input.policyRules.filter((rule) => matchesRule(rule, input));
  const denyRules = matchingRules.filter((rule) => rule.effect === 'deny');
  const allowRules = matchingRules.filter((rule) => rule.effect === 'allow');

  const crossTenantAllowed = allowRules.some((rule) => rule.allowCrossTenant === true);
  const tenantMismatch =
    !input.resource.isPublic
    && input.principal.tenantId !== undefined
    && input.resource.tenantId !== undefined
    && input.principal.tenantId !== input.resource.tenantId;

  if (tenantMismatch && !crossTenantAllowed) {
    return {
      allowed: false,
      decision: 'deny',
      hitlMode: 'none',
      reasonCodes: ['tenant_mismatch'],
      matchedPolicyRuleIds,
      matchedHitlRuleIds,
    };
  }

  if (input.resource.minTrustLevel && !hasRequiredTrust(input.principal.trustLevel, input.resource.minTrustLevel)) {
    return {
      allowed: false,
      decision: 'deny',
      hitlMode: 'none',
      reasonCodes: ['insufficient_trust_level'],
      matchedPolicyRuleIds,
      matchedHitlRuleIds,
    };
  }

  if (denyRules.length > 0) {
    matchedPolicyRuleIds.push(...denyRules.map((rule) => rule.id));
    return {
      allowed: false,
      decision: 'deny',
      hitlMode: 'none',
      reasonCodes: ['policy_denied'],
      matchedPolicyRuleIds,
      matchedHitlRuleIds,
    };
  }

  if (allowRules.length === 0) {
    return {
      allowed: false,
      decision: 'deny',
      hitlMode: 'none',
      reasonCodes: ['no_matching_allow_rule'],
      matchedPolicyRuleIds,
      matchedHitlRuleIds,
    };
  }

  matchedPolicyRuleIds.push(...allowRules.map((rule) => rule.id));
  reasonCodes.push('policy_allowed');

  const matchingHitlRules = (input.hitlRules ?? []).filter((rule) => matchesHitlRule(rule, input));

  if (matchingHitlRules.length > 0) {
    matchedHitlRuleIds.push(...matchingHitlRules.map((rule) => rule.id));

    const requiresApproval = matchingHitlRules.some((rule) => rule.mode === 'approve');
    if (requiresApproval) {
      return {
        allowed: false,
        decision: 'require_hitl',
        hitlMode: 'approve',
        reasonCodes: [...reasonCodes, 'hitl_required'],
        matchedPolicyRuleIds,
        matchedHitlRuleIds,
      };
    }

    return {
      allowed: true,
      decision: 'allow',
      hitlMode: 'notify',
      reasonCodes: [...reasonCodes, 'hitl_notify'],
      matchedPolicyRuleIds,
      matchedHitlRuleIds,
    };
  }

  return {
    allowed: true,
    decision: 'allow',
    hitlMode: 'none',
    reasonCodes,
    matchedPolicyRuleIds,
    matchedHitlRuleIds,
  };
}

export function buildAuditEvent(
  input: AuthorizationInput,
  decision: AuthorizationDecision,
  options: {
    eventId: string;
    timestamp: string;
    sessionId?: string;
    correlationId?: string;
    requestId?: string;
    metadata?: AuditEvent['metadata'];
  },
): AuditEvent {
  return {
    eventId: options.eventId,
    timestamp: options.timestamp,
    tenantId: input.resource.tenantId ?? input.principal.tenantId,
    actorPrincipalId: input.principal.principalId,
    actorKind: input.principal.kind,
    sessionId: options.sessionId,
    action: input.action,
    resourceKind: input.resource.kind,
    resourceId: input.resource.resourceId,
    decision: decision.decision,
    reasonCodes: decision.reasonCodes,
    policyRuleIds: decision.matchedPolicyRuleIds,
    correlationId: options.correlationId,
    requestId: options.requestId,
    metadata: options.metadata,
  };
}
