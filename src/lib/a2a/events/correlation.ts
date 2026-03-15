/**
 * A2A Event Correlation & Causal Tracing Engine
 *
 * Enables agents to trace causal chains of events across the entire A2A
 * platform. When a task submission triggers contract negotiation, which
 * triggers billing, which triggers governance checks — the correlation
 * engine lets any agent reconstruct that chain and understand what happened,
 * why, and in what order.
 *
 * Key concepts:
 *   - Correlation Context: A named operation spanning multiple events/domains
 *   - Causal Link: A directed edge from a cause event to an effect event
 *   - Causal Graph: The DAG of all events linked by causality within a context
 *   - Timeline: Chronological view of all correlated events with domain lanes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { A2AEvent, EventDomain } from './types';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a correlation context (operation lifecycle) */
export type CorrelationStatus = 'active' | 'completed' | 'failed' | 'cancelled';

/** Relationship between two causally-linked events */
export type CausalRelationship =
  | 'caused'       // A directly caused B
  | 'triggered'    // A triggered B (indirect / async)
  | 'compensated'  // B is a compensation/rollback of A
  | 'continued'    // B continues the work of A
  | 'branched'     // B is a parallel branch from A
  | 'merged';      // B merges results from multiple causes

/** A named correlation context representing a logical multi-event operation */
export interface CorrelationContext {
  id: string;
  name: string;
  description: string | null;
  initiator_id: string;
  root_event_id: string | null;
  status: CorrelationStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  event_count: number;
  domain_count: number;
  agent_count: number;
  error_count: number;
  duration_ms: number | null;
}

/** A directed causal link between two events */
export interface CausalLink {
  id: string;
  correlation_id: string;
  cause_event_id: string;
  effect_event_id: string;
  relationship: CausalRelationship;
  created_at: string;
  metadata: Record<string, unknown>;
}

/** A node in the causal graph, enriched with event data */
export interface CausalGraphNode {
  event_id: string;
  sequence: number;
  timestamp: string;
  topic: string;
  domain: EventDomain;
  action: string;
  source_agent_id: string | null;
  resource_id: string;
  resource_type: string;
  data: unknown;
  /** Inbound causal links (events that caused this one) */
  causes: Array<{ event_id: string; relationship: CausalRelationship }>;
  /** Outbound causal links (events this one caused) */
  effects: Array<{ event_id: string; relationship: CausalRelationship }>;
  /** True if this is the root of the causal chain */
  is_root: boolean;
  /** True if this is a leaf (no outbound effects) */
  is_leaf: boolean;
}

/** The full causal DAG for a correlation context */
export interface CausalGraph {
  correlation_id: string;
  context: CorrelationContext;
  nodes: CausalGraphNode[];
  /** Adjacency list: cause_event_id → [{ effect_event_id, relationship }] */
  edges: Array<{
    cause: string;
    effect: string;
    relationship: CausalRelationship;
  }>;
  /** Events grouped by domain for lane-based visualization */
  domain_lanes: Record<string, CausalGraphNode[]>;
  /** Summary stats */
  stats: {
    total_events: number;
    total_edges: number;
    domains_involved: string[];
    agents_involved: string[];
    root_events: string[];
    leaf_events: string[];
    max_depth: number;
    total_duration_ms: number | null;
  };
}

/** Chronological timeline entry with domain context */
export interface TimelineEntry {
  event_id: string;
  sequence: number;
  timestamp: string;
  domain: EventDomain;
  action: string;
  topic: string;
  source_agent_id: string | null;
  resource_id: string;
  resource_type: string;
  data: unknown;
  /** Relative time from the first event in the correlation (ms) */
  relative_time_ms: number;
  /** Causal parents in the correlation */
  caused_by: string[];
}

// ---------------------------------------------------------------------------
// Correlation Context Management
// ---------------------------------------------------------------------------

export interface CreateContextParams {
  name: string;
  description?: string;
  initiator_id: string;
  root_event_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new correlation context for a multi-event operation.
 *
 * Call this at the start of an operation (e.g., task submission) to get a
 * correlation_id that all subsequent related events should carry.
 */
export async function createCorrelationContext(
  params: CreateContextParams
): Promise<CorrelationContext> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  const context: CorrelationContext = {
    id,
    name: params.name,
    description: params.description ?? null,
    initiator_id: params.initiator_id,
    root_event_id: params.root_event_id ?? null,
    status: 'active',
    created_at: now,
    updated_at: now,
    completed_at: null,
    metadata: params.metadata ?? {},
    event_count: 0,
    domain_count: 0,
    agent_count: 0,
    error_count: 0,
    duration_ms: null,
  };

  const { error } = await supabase.from('a2a_correlation_contexts').insert(context);
  if (error) throw new Error(`Failed to create correlation context: ${error.message}`);

  return context;
}

/**
 * Complete a correlation context (operation finished successfully).
 */
export async function completeCorrelationContext(
  correlation_id: string
): Promise<CorrelationContext> {
  return updateContextStatus(correlation_id, 'completed');
}

/**
 * Mark a correlation context as failed.
 */
export async function failCorrelationContext(
  correlation_id: string
): Promise<CorrelationContext> {
  return updateContextStatus(correlation_id, 'failed');
}

/**
 * Cancel a correlation context.
 */
export async function cancelCorrelationContext(
  correlation_id: string
): Promise<CorrelationContext> {
  return updateContextStatus(correlation_id, 'cancelled');
}

async function updateContextStatus(
  correlation_id: string,
  status: CorrelationStatus
): Promise<CorrelationContext> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Compute duration from first event
  const update: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    update.completed_at = now;

    // Calculate duration from context creation
    const { data: ctx } = await supabase
      .from('a2a_correlation_contexts')
      .select('created_at')
      .eq('id', correlation_id)
      .single();

    if (ctx) {
      update.duration_ms = Date.now() - new Date(ctx.created_at).getTime();
    }
  }

  const { data, error } = await supabase
    .from('a2a_correlation_contexts')
    .update(update)
    .eq('id', correlation_id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update correlation context: ${error?.message}`);
  }

  return data as CorrelationContext;
}

/**
 * Get a correlation context by ID.
 */
export async function getCorrelationContext(
  correlation_id: string
): Promise<CorrelationContext | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('a2a_correlation_contexts')
    .select('*')
    .eq('id', correlation_id)
    .single();

  if (error) return null;
  return data as CorrelationContext;
}

/**
 * List correlation contexts for an agent, with optional status filter.
 */
export async function listCorrelationContexts(
  initiator_id: string,
  options?: { status?: CorrelationStatus; limit?: number; offset?: number }
): Promise<CorrelationContext[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('a2a_correlation_contexts')
    .select('*')
    .eq('initiator_id', initiator_id)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list contexts: ${error.message}`);
  return (data ?? []) as CorrelationContext[];
}

// ---------------------------------------------------------------------------
// Causal Link Management
// ---------------------------------------------------------------------------

export interface LinkEventsParams {
  correlation_id: string;
  cause_event_id: string;
  effect_event_id: string;
  relationship?: CausalRelationship;
  metadata?: Record<string, unknown>;
}

/**
 * Record a causal link between two events.
 *
 * Call this whenever one event is known to have caused or triggered another.
 * For example, a task.submitted event causes a billing.charge event.
 */
export async function linkEvents(params: LinkEventsParams): Promise<CausalLink> {
  const supabase = getSupabase();

  if (params.cause_event_id === params.effect_event_id) {
    throw new Error('Cannot link an event to itself');
  }

  const link: CausalLink = {
    id: randomUUID(),
    correlation_id: params.correlation_id,
    cause_event_id: params.cause_event_id,
    effect_event_id: params.effect_event_id,
    relationship: params.relationship ?? 'caused',
    created_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
  };

  const { error } = await supabase.from('a2a_event_correlations').insert(link);
  if (error) {
    if (error.code === '23505') {
      throw new Error('Causal link already exists between these events');
    }
    throw new Error(`Failed to create causal link: ${error.message}`);
  }

  return link;
}

/**
 * Record multiple causal links at once (e.g., fan-out from one event).
 */
export async function linkEventsBatch(
  links: LinkEventsParams[]
): Promise<CausalLink[]> {
  const results: CausalLink[] = [];
  for (const params of links) {
    results.push(await linkEvents(params));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Causal Graph Construction
// ---------------------------------------------------------------------------

/**
 * Build the full causal graph for a correlation context.
 *
 * This is the primary query for agents that want to understand the complete
 * chain of events for an operation. Returns a DAG of events with causal
 * edges, domain lanes for visualization, and summary statistics.
 */
export async function getCausalGraph(
  correlation_id: string
): Promise<CausalGraph> {
  const supabase = getSupabase();

  // Fetch context, events, and links in parallel
  const [contextResult, eventsResult, linksResult] = await Promise.all([
    supabase
      .from('a2a_correlation_contexts')
      .select('*')
      .eq('id', correlation_id)
      .single(),
    supabase
      .from('a2a_events')
      .select('*')
      .eq('correlation_id', correlation_id)
      .order('sequence', { ascending: true }),
    supabase
      .from('a2a_event_correlations')
      .select('*')
      .eq('correlation_id', correlation_id),
  ]);

  if (contextResult.error || !contextResult.data) {
    throw new Error('Correlation context not found');
  }

  const context = contextResult.data as CorrelationContext;
  const events = (eventsResult.data ?? []) as A2AEvent[];
  const links = (linksResult.data ?? []) as CausalLink[];

  // Build cause/effect lookup maps
  const causeMap = new Map<string, Array<{ event_id: string; relationship: CausalRelationship }>>();
  const effectMap = new Map<string, Array<{ event_id: string; relationship: CausalRelationship }>>();

  for (const link of links) {
    if (!effectMap.has(link.cause_event_id)) effectMap.set(link.cause_event_id, []);
    effectMap.get(link.cause_event_id)!.push({
      event_id: link.effect_event_id,
      relationship: link.relationship,
    });

    if (!causeMap.has(link.effect_event_id)) causeMap.set(link.effect_event_id, []);
    causeMap.get(link.effect_event_id)!.push({
      event_id: link.cause_event_id,
      relationship: link.relationship,
    });
  }

  // Build graph nodes
  const nodes: CausalGraphNode[] = events.map((event) => {
    const causes = causeMap.get(event.id) ?? [];
    const effects = effectMap.get(event.id) ?? [];
    return {
      event_id: event.id,
      sequence: event.sequence,
      timestamp: event.timestamp,
      topic: event.topic,
      domain: event.domain as EventDomain,
      action: event.action,
      source_agent_id: event.source_agent_id,
      resource_id: event.resource_id,
      resource_type: event.resource_type,
      data: event.data,
      causes,
      effects,
      is_root: causes.length === 0,
      is_leaf: effects.length === 0,
    };
  });

  // Build edges list
  const edges = links.map((link) => ({
    cause: link.cause_event_id,
    effect: link.effect_event_id,
    relationship: link.relationship,
  }));

  // Group by domain for lane-based visualization
  const domainLanes: Record<string, CausalGraphNode[]> = {};
  for (const node of nodes) {
    if (!domainLanes[node.domain]) domainLanes[node.domain] = [];
    domainLanes[node.domain].push(node);
  }

  // Compute max depth via BFS from roots
  const rootEvents = nodes.filter((n) => n.is_root).map((n) => n.event_id);
  const leafEvents = nodes.filter((n) => n.is_leaf).map((n) => n.event_id);
  const maxDepth = computeMaxDepth(rootEvents, effectMap);

  // Unique domains and agents
  const domains = [...new Set(nodes.map((n) => n.domain))];
  const agents = [...new Set(nodes.map((n) => n.source_agent_id).filter(Boolean))] as string[];

  // Duration
  let totalDuration: number | null = null;
  if (events.length >= 2) {
    const first = new Date(events[0].timestamp).getTime();
    const last = new Date(events[events.length - 1].timestamp).getTime();
    totalDuration = last - first;
  }

  return {
    correlation_id,
    context,
    nodes,
    edges,
    domain_lanes: domainLanes,
    stats: {
      total_events: nodes.length,
      total_edges: edges.length,
      domains_involved: domains,
      agents_involved: agents,
      root_events: rootEvents,
      leaf_events: leafEvents,
      max_depth: maxDepth,
      total_duration_ms: totalDuration,
    },
  };
}

function computeMaxDepth(
  roots: string[],
  effectMap: Map<string, Array<{ event_id: string; relationship: CausalRelationship }>>
): number {
  if (roots.length === 0) return 0;

  let maxDepth = 0;
  const queue: Array<{ id: string; depth: number }> = roots.map((id) => ({ id, depth: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    maxDepth = Math.max(maxDepth, depth);

    const effects = effectMap.get(id) ?? [];
    for (const effect of effects) {
      if (!visited.has(effect.event_id)) {
        queue.push({ id: effect.event_id, depth: depth + 1 });
      }
    }
  }

  return maxDepth;
}

// ---------------------------------------------------------------------------
// Timeline View
// ---------------------------------------------------------------------------

/**
 * Get a chronological timeline of all events in a correlation context.
 *
 * Returns events ordered by time with relative timestamps and causal
 * parent references — ideal for rendering activity feeds or debugging.
 */
export async function getCorrelationTimeline(
  correlation_id: string
): Promise<TimelineEntry[]> {
  const supabase = getSupabase();

  const [eventsResult, linksResult] = await Promise.all([
    supabase
      .from('a2a_events')
      .select('*')
      .eq('correlation_id', correlation_id)
      .order('sequence', { ascending: true }),
    supabase
      .from('a2a_event_correlations')
      .select('cause_event_id, effect_event_id')
      .eq('correlation_id', correlation_id),
  ]);

  const events = (eventsResult.data ?? []) as A2AEvent[];
  const links = (linksResult.data ?? []) as CausalLink[];

  // Build cause lookup
  const causeMap = new Map<string, string[]>();
  for (const link of links) {
    if (!causeMap.has(link.effect_event_id)) causeMap.set(link.effect_event_id, []);
    causeMap.get(link.effect_event_id)!.push(link.cause_event_id);
  }

  const firstTimestamp = events.length > 0
    ? new Date(events[0].timestamp).getTime()
    : 0;

  return events.map((event) => ({
    event_id: event.id,
    sequence: event.sequence,
    timestamp: event.timestamp,
    domain: event.domain as EventDomain,
    action: event.action,
    topic: event.topic,
    source_agent_id: event.source_agent_id,
    resource_id: event.resource_id,
    resource_type: event.resource_type,
    data: event.data,
    relative_time_ms: new Date(event.timestamp).getTime() - firstTimestamp,
    caused_by: causeMap.get(event.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

/**
 * Find all events correlated with a specific event (by following its
 * correlation_id). Useful when an agent encounters a single event and
 * wants to see the broader context.
 */
export async function getCorrelatedEvents(
  event_id: string
): Promise<A2AEvent[]> {
  const supabase = getSupabase();

  // First get the event to find its correlation_id
  const { data: event, error: eventError } = await supabase
    .from('a2a_events')
    .select('correlation_id')
    .eq('id', event_id)
    .single();

  if (eventError || !event?.correlation_id) {
    return [];
  }

  const { data, error } = await supabase
    .from('a2a_events')
    .select('*')
    .eq('correlation_id', event.correlation_id)
    .order('sequence', { ascending: true });

  if (error) throw new Error(`Failed to get correlated events: ${error.message}`);
  return (data ?? []) as A2AEvent[];
}

/**
 * Get the direct causes of a specific event.
 */
export async function getEventCauses(event_id: string): Promise<A2AEvent[]> {
  const supabase = getSupabase();

  const { data: links } = await supabase
    .from('a2a_event_correlations')
    .select('cause_event_id')
    .eq('effect_event_id', event_id);

  if (!links || links.length === 0) return [];

  const causeIds = links.map((l) => l.cause_event_id);
  const { data, error } = await supabase
    .from('a2a_events')
    .select('*')
    .in('id', causeIds)
    .order('sequence', { ascending: true });

  if (error) throw new Error(`Failed to get event causes: ${error.message}`);
  return (data ?? []) as A2AEvent[];
}

/**
 * Get the direct effects of a specific event.
 */
export async function getEventEffects(event_id: string): Promise<A2AEvent[]> {
  const supabase = getSupabase();

  const { data: links } = await supabase
    .from('a2a_event_correlations')
    .select('effect_event_id')
    .eq('cause_event_id', event_id);

  if (!links || links.length === 0) return [];

  const effectIds = links.map((l) => l.effect_event_id);
  const { data, error } = await supabase
    .from('a2a_events')
    .select('*')
    .in('id', effectIds)
    .order('sequence', { ascending: true });

  if (error) throw new Error(`Failed to get event effects: ${error.message}`);
  return (data ?? []) as A2AEvent[];
}

/**
 * Search correlation contexts by name pattern, time range, or domain involvement.
 */
export async function searchCorrelations(params: {
  name_pattern?: string;
  initiator_id?: string;
  status?: CorrelationStatus;
  min_events?: number;
  domains?: EventDomain[];
  from_date?: string;
  to_date?: string;
  limit?: number;
}): Promise<CorrelationContext[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('a2a_correlation_contexts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  if (params.name_pattern) {
    query = query.ilike('name', `%${params.name_pattern}%`);
  }
  if (params.initiator_id) {
    query = query.eq('initiator_id', params.initiator_id);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.min_events) {
    query = query.gte('event_count', params.min_events);
  }
  if (params.from_date) {
    query = query.gte('created_at', params.from_date);
  }
  if (params.to_date) {
    query = query.lte('created_at', params.to_date);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to search correlations: ${error.message}`);

  let results = (data ?? []) as CorrelationContext[];

  // Post-filter by domain involvement (requires subquery not easily done in PostgREST)
  if (params.domains && params.domains.length > 0) {
    const contextIds = results.map((r) => r.id);
    if (contextIds.length > 0) {
      const { data: domainData } = await supabase
        .from('a2a_events')
        .select('correlation_id, domain')
        .in('correlation_id', contextIds);

      const contextDomains = new Map<string, Set<string>>();
      for (const row of domainData ?? []) {
        if (!contextDomains.has(row.correlation_id)) {
          contextDomains.set(row.correlation_id, new Set());
        }
        contextDomains.get(row.correlation_id)!.add(row.domain);
      }

      results = results.filter((ctx) => {
        const domains = contextDomains.get(ctx.id);
        return domains && params.domains!.some((d) => domains.has(d));
      });
    }
  }

  return results;
}
