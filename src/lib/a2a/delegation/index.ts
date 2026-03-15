// ── A2A Agent Delegation & Scoped Authorization ──

export {
  createDelegation,
  listDelegations,
  checkAuthorization,
  recordDelegatedSpend,
  revokeDelegation,
  queryDelegationAudit,
} from './engine';

export type { AuthorizationResult } from './engine';

export {
  delegationCreateSchema,
  delegationListSchema,
  delegationCheckSchema,
} from './validation';

export type {
  DelegationCreateInput,
  DelegationListInput,
  DelegationCheckInput,
} from './validation';

export type {
  DelegationStatus,
  DelegatableAction,
  AgentDelegation,
  DelegationAuditEntry,
  DelegationCreateRequest,
  DelegationCreateResponse,
  DelegationListResponse,
  DelegationRevokeResponse,
  DelegationCheckRequest,
  DelegationCheckResponse,
} from './types';
