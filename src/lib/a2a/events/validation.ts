/**
 * A2A Event Streaming — Input Validation
 *
 * Validates all external inputs before they reach the event engine.
 */

import {
  CreateSubscriptionParams,
  EmitEventParams,
} from './engine';
import {
  DataFilter,
  DeliveryConfig,
  DeliveryMethod,
  EventDomain,
  EventFilter,
  ReplayRequest,
  SubscriptionStatus,
  VALID_SUBSCRIPTION_TRANSITIONS,
} from './types';

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

function merge(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

const VALID_DOMAINS: EventDomain[] = [
  'task', 'agent', 'contract', 'auction', 'billing',
  'delegation', 'governance', 'workflow', 'channel',
  'knowledge', 'federation', 'mesh', 'identity', 'observability',
];

const VALID_DELIVERY_METHODS: DeliveryMethod[] = ['webhook', 'sse', 'websocket'];

const VALID_OPERATORS: DataFilter['operator'][] = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists', 'in',
];

// ---------------------------------------------------------------------------
// Emit Event validation
// ---------------------------------------------------------------------------

export function validateEmitEventParams(params: EmitEventParams): ValidationResult {
  const errors: string[] = [];

  if (!params.domain) {
    errors.push('domain is required');
  } else if (!VALID_DOMAINS.includes(params.domain)) {
    errors.push(`Invalid domain: ${params.domain}. Valid: ${VALID_DOMAINS.join(', ')}`);
  }

  if (!params.action || typeof params.action !== 'string') {
    errors.push('action is required and must be a string');
  } else if (params.action.length > 64) {
    errors.push('action must be 64 characters or fewer');
  } else if (!/^[a-z][a-z0-9_]*$/.test(params.action)) {
    errors.push('action must be lowercase alphanumeric with underscores, starting with a letter');
  }

  if (!params.resource_id || typeof params.resource_id !== 'string') {
    errors.push('resource_id is required');
  }

  if (!params.resource_type || typeof params.resource_type !== 'string') {
    errors.push('resource_type is required');
  }

  if (params.data === undefined) {
    errors.push('data is required (use {} for empty payload)');
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

// ---------------------------------------------------------------------------
// Subscription validation
// ---------------------------------------------------------------------------

export function validateCreateSubscription(params: CreateSubscriptionParams): ValidationResult {
  return merge(
    validateAgentId(params.agent_id),
    validateSubscriptionName(params.name),
    validateDeliveryConfig(params.delivery),
    validateEventFilter(params.filter),
    params.options ? validateSubscriptionOptions(params.options) : ok()
  );
}

function validateAgentId(agent_id: string): ValidationResult {
  if (!agent_id || typeof agent_id !== 'string') {
    return fail('agent_id is required');
  }
  if (agent_id.length > 128) {
    return fail('agent_id must be 128 characters or fewer');
  }
  return ok();
}

function validateSubscriptionName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return fail('Subscription name is required');
  }
  if (name.length > 256) {
    return fail('Subscription name must be 256 characters or fewer');
  }
  return ok();
}

function validateDeliveryConfig(delivery: DeliveryConfig): ValidationResult {
  const errors: string[] = [];

  if (!delivery.method || !VALID_DELIVERY_METHODS.includes(delivery.method)) {
    errors.push(`Invalid delivery method. Valid: ${VALID_DELIVERY_METHODS.join(', ')}`);
  }

  if (delivery.method === 'webhook') {
    if (!delivery.webhook_url) {
      errors.push('webhook_url is required for webhook delivery');
    } else {
      try {
        const url = new URL(delivery.webhook_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('webhook_url must use http or https protocol');
        }
      } catch {
        errors.push('webhook_url must be a valid URL');
      }
    }

    if (delivery.webhook_secret && delivery.webhook_secret.length < 16) {
      errors.push('webhook_secret must be at least 16 characters');
    }
  }

  if (delivery.timeout_ms !== undefined) {
    if (delivery.timeout_ms < 1000 || delivery.timeout_ms > 60_000) {
      errors.push('timeout_ms must be between 1000 and 60000');
    }
  }

  if (delivery.batch_size !== undefined) {
    if (delivery.batch_size < 1 || delivery.batch_size > 100) {
      errors.push('batch_size must be between 1 and 100');
    }
  }

  if (delivery.batch_window_ms !== undefined) {
    if (delivery.batch_window_ms < 0 || delivery.batch_window_ms > 30_000) {
      errors.push('batch_window_ms must be between 0 and 30000');
    }
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

function validateEventFilter(filter: EventFilter): ValidationResult {
  const errors: string[] = [];

  if (!filter.topics || !Array.isArray(filter.topics) || filter.topics.length === 0) {
    errors.push('At least one topic pattern is required');
  } else {
    for (const topic of filter.topics) {
      if (!isValidTopicPattern(topic)) {
        errors.push(`Invalid topic pattern: "${topic}". Format: "domain.action" with optional * wildcards`);
      }
    }

    if (filter.topics.length > 50) {
      errors.push('Maximum 50 topic patterns per subscription');
    }
  }

  if (filter.domains) {
    for (const domain of filter.domains) {
      if (!VALID_DOMAINS.includes(domain)) {
        errors.push(`Invalid domain in filter: ${domain}`);
      }
    }
  }

  if (filter.data_filters) {
    for (const df of filter.data_filters) {
      const dfResult = validateDataFilter(df);
      if (!dfResult.valid) errors.push(...dfResult.errors);
    }

    if (filter.data_filters.length > 10) {
      errors.push('Maximum 10 data filters per subscription');
    }
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

function isValidTopicPattern(pattern: string): boolean {
  if (pattern === '*.*') return true;
  const parts = pattern.split('.');
  if (parts.length !== 2) return false;
  for (const part of parts) {
    if (part !== '*' && !/^[a-z][a-z0-9_]*$/.test(part)) return false;
  }
  return true;
}

function validateDataFilter(df: DataFilter): ValidationResult {
  const errors: string[] = [];

  if (!df.path || typeof df.path !== 'string') {
    errors.push('Data filter path is required');
  } else if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(df.path)) {
    errors.push(`Invalid data filter path: "${df.path}"`);
  }

  if (!df.operator || !VALID_OPERATORS.includes(df.operator)) {
    errors.push(`Invalid data filter operator: "${df.operator}". Valid: ${VALID_OPERATORS.join(', ')}`);
  }

  if (df.operator !== 'exists' && df.value === undefined) {
    errors.push(`Data filter value is required for operator "${df.operator}"`);
  }

  if (df.operator === 'in' && !Array.isArray(df.value)) {
    errors.push('Data filter value must be an array for "in" operator');
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

function validateSubscriptionOptions(
  options: Partial<Record<string, unknown>>
): ValidationResult {
  const errors: string[] = [];

  if ('max_events_per_second' in options) {
    const rate = options.max_events_per_second as number;
    if (typeof rate !== 'number' || rate < 1 || rate > 10_000) {
      errors.push('max_events_per_second must be between 1 and 10000');
    }
  }

  if ('max_consecutive_failures' in options) {
    const max = options.max_consecutive_failures as number;
    if (typeof max !== 'number' || max < 1 || max > 100) {
      errors.push('max_consecutive_failures must be between 1 and 100');
    }
  }

  if ('start_from_sequence' in options) {
    const seq = options.start_from_sequence as number;
    if (typeof seq !== 'number' || seq < 0) {
      errors.push('start_from_sequence must be a non-negative integer');
    }
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

// ---------------------------------------------------------------------------
// Subscription status transition validation
// ---------------------------------------------------------------------------

export function validateStatusTransition(
  current: SubscriptionStatus,
  target: SubscriptionStatus
): ValidationResult {
  const valid = VALID_SUBSCRIPTION_TRANSITIONS[current];
  if (!valid || !valid.includes(target)) {
    return fail(
      `Invalid status transition: ${current} → ${target}. Valid transitions: ${valid?.join(', ') ?? 'none'}`
    );
  }
  return ok();
}

// ---------------------------------------------------------------------------
// Replay request validation
// ---------------------------------------------------------------------------

export function validateReplayRequest(params: ReplayRequest): ValidationResult {
  const errors: string[] = [];

  if (!params.subscription_id) {
    errors.push('subscription_id is required');
  }

  if (typeof params.from_sequence !== 'number' || params.from_sequence < 0) {
    errors.push('from_sequence must be a non-negative integer');
  }

  if (params.to_sequence !== undefined) {
    if (typeof params.to_sequence !== 'number' || params.to_sequence < params.from_sequence) {
      errors.push('to_sequence must be >= from_sequence');
    }
  }

  if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 1000) {
    errors.push('limit must be between 1 and 1000');
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

// ---------------------------------------------------------------------------
// Dead letter ID validation
// ---------------------------------------------------------------------------

export function validateDeadLetterId(id: string): ValidationResult {
  if (!id || typeof id !== 'string') {
    return fail('Dead letter ID is required');
  }
  return ok();
}
