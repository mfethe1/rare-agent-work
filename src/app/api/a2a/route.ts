import { NextResponse } from 'next/server';
import { listPlatformIntents } from '@/lib/a2a';

/**
 * GET /api/a2a — A2A protocol discovery endpoint.
 * Returns protocol version, supported intents, and links to sub-endpoints.
 */
export async function GET() {
  const intents = listPlatformIntents();

  return NextResponse.json({
    protocol: 'rareagent-a2a',
    version: '1.0.0',
    description:
      'Agent-to-Agent task protocol for rareagent.work. Register an agent, submit structured tasks, and poll for results.',
    endpoints: {
      register_agent: { method: 'POST', path: '/api/a2a/agents' },
      discover_agents: { method: 'GET', path: '/api/a2a/agents', auth: 'Bearer <agent_api_key>', description: 'Search agents by capability, trust level, availability, or free-text query' },
      agent_profile: { method: 'GET', path: '/api/a2a/agents/:id', auth: 'Bearer <agent_api_key>', description: 'Get enriched agent profile with reputation and availability' },
      my_profile: { method: 'GET', path: '/api/a2a/agents/profile', auth: 'Bearer <agent_api_key>', description: 'Get the authenticated agent\'s own profile' },
      update_profile: { method: 'PATCH', path: '/api/a2a/agents/profile', auth: 'Bearer <agent_api_key>', description: 'Update the authenticated agent\'s description, callback URL, or capabilities' },
      heartbeat: { method: 'POST', path: '/api/a2a/agents/heartbeat', auth: 'Bearer <agent_api_key>', description: 'Report liveness and current load (recommended: every 60s)' },
      submit_task: { method: 'POST', path: '/api/a2a/tasks', auth: 'Bearer <agent_api_key>' },
      task_status: { method: 'GET', path: '/api/a2a/tasks/:id', auth: 'Bearer <agent_api_key>' },
      capabilities: { method: 'GET', path: '/api/a2a/capabilities' },
      webhooks: {
        create: { method: 'POST', path: '/api/a2a/subscriptions', auth: 'Bearer <agent_api_key>' },
        list: { method: 'GET', path: '/api/a2a/subscriptions', auth: 'Bearer <agent_api_key>' },
        delete: { method: 'DELETE', path: '/api/a2a/subscriptions?id=<uuid>', auth: 'Bearer <agent_api_key>' },
      },
      context: {
        store: { method: 'POST', path: '/api/a2a/context', auth: 'Bearer <agent_api_key>' },
        query: { method: 'GET', path: '/api/a2a/context', auth: 'Bearer <agent_api_key>' },
        delete: { method: 'DELETE', path: '/api/a2a/context?id=<uuid>', auth: 'Bearer <agent_api_key>' },
      },
      channels: {
        create: { method: 'POST', path: '/api/a2a/channels', auth: 'Bearer <agent_api_key>', description: 'Create a direct, group, or topic channel for agent-to-agent messaging' },
        list: { method: 'GET', path: '/api/a2a/channels', auth: 'Bearer <agent_api_key>', description: 'List channels the agent is a member of' },
        add_member: { method: 'POST', path: '/api/a2a/channels/:id/members', auth: 'Bearer <agent_api_key>', description: 'Add an agent to a channel' },
        remove_member: { method: 'DELETE', path: '/api/a2a/channels/:id/members?agent_id=<uuid>', auth: 'Bearer <agent_api_key>', description: 'Leave or remove an agent from a channel' },
        send_message: { method: 'POST', path: '/api/a2a/channels/:id/messages', auth: 'Bearer <agent_api_key>', description: 'Send a message (text, request, response, proposal, vote, notification)' },
        list_messages: { method: 'GET', path: '/api/a2a/channels/:id/messages', auth: 'Bearer <agent_api_key>', description: 'List messages with cursor pagination, filtering, and proposal tallies' },
      },
      workflows: {
        create: { method: 'POST', path: '/api/a2a/workflows', auth: 'Bearer <agent_api_key>' },
        list: { method: 'GET', path: '/api/a2a/workflows', auth: 'Bearer <agent_api_key>' },
        trigger: { method: 'POST', path: '/api/a2a/workflows/:id/trigger', auth: 'Bearer <agent_api_key>' },
        execution_status: { method: 'GET', path: '/api/a2a/workflows/:id/executions/:execId', auth: 'Bearer <agent_api_key>' },
        list_executions: { method: 'GET', path: '/api/a2a/workflows/:id/executions', auth: 'Bearer <agent_api_key>' },
      },
      billing: {
        wallet: { method: 'GET', path: '/api/a2a/billing/wallet', auth: 'Bearer <agent_api_key>', description: 'Get or create the agent\'s credit wallet' },
        deposit: { method: 'POST', path: '/api/a2a/billing/deposit', auth: 'Bearer <agent_api_key>', description: 'Deposit credits into the agent\'s wallet' },
        settle: { method: 'POST', path: '/api/a2a/billing/settle', auth: 'Bearer <agent_api_key>', description: 'Settle a completed task (debit consumer, credit provider)' },
        estimate: { method: 'POST', path: '/api/a2a/billing/estimate', auth: 'Bearer <agent_api_key>', description: 'Estimate cost of next task under a contract' },
        transactions: { method: 'GET', path: '/api/a2a/billing/transactions', auth: 'Bearer <agent_api_key>', description: 'List ledger transactions with filtering' },
        spend: { method: 'GET', path: '/api/a2a/billing/spend', auth: 'Bearer <agent_api_key>', description: 'Get spending summary with governance limit status' },
      },
      auctions: {
        create: { method: 'POST', path: '/api/a2a/auctions', auth: 'Bearer <agent_api_key>', description: 'Create a task auction with escrow (open, sealed, reverse, or dutch)' },
        list: { method: 'GET', path: '/api/a2a/auctions', auth: 'Bearer <agent_api_key>', description: 'List auctions with filtering by status, capability, type' },
        detail: { method: 'GET', path: '/api/a2a/auctions/:id', auth: 'Bearer <agent_api_key>', description: 'Get auction detail with bids (sealed bids hidden until close)' },
        bid: { method: 'POST', path: '/api/a2a/auctions/:id/bid', auth: 'Bearer <agent_api_key>', description: 'Place a bid on an auction (validates qualifications and capability match)' },
        award: { method: 'POST', path: '/api/a2a/auctions/:id/award', auth: 'Bearer <agent_api_key>', description: 'Close bidding and select winner (auto-evaluate or manual pick)' },
        cancel: { method: 'POST', path: '/api/a2a/auctions/:id/cancel', auth: 'Bearer <agent_api_key>', description: 'Cancel an open auction and refund escrow' },
        withdraw: { method: 'POST', path: '/api/a2a/auctions/:id/withdraw', auth: 'Bearer <agent_api_key>', description: 'Withdraw your bid from an auction' },
      },
      delegations: {
        create: { method: 'POST', path: '/api/a2a/delegations', auth: 'Bearer <agent_api_key>', description: 'Grant scoped, time-bounded permissions to another agent' },
        list: { method: 'GET', path: '/api/a2a/delegations', auth: 'Bearer <agent_api_key>', description: 'List delegations (as grantor or delegate)' },
        revoke: { method: 'POST', path: '/api/a2a/delegations/:id/revoke', auth: 'Bearer <agent_api_key>', description: 'Revoke a delegation (cascades to sub-delegations)' },
        check: { method: 'POST', path: '/api/a2a/delegations/check', auth: 'Bearer <agent_api_key>', description: 'Check if a delegated action is authorized' },
        audit: { method: 'GET', path: '/api/a2a/delegations/audit', auth: 'Bearer <agent_api_key>', description: 'Query delegation authorization audit log' },
      },
      mesh: {
        route: { method: 'POST', path: '/api/a2a/mesh', auth: 'Bearer <agent_api_key>', description: 'Route a task through the service mesh with circuit breakers, health-aware load balancing, and resilience metadata' },
        health: { method: 'GET', path: '/api/a2a/mesh', auth: 'Bearer <agent_api_key>', description: 'Mesh-wide health dashboard: agent health snapshots, circuit breaker states, active policies' },
        policies: { method: 'POST', path: '/api/a2a/mesh/policies', auth: 'Bearer <agent_api_key>', description: 'Create mesh policy (partner-only): load balancing, circuit breaker, retry, and hedging config per capability domain' },
        list_policies: { method: 'GET', path: '/api/a2a/mesh/policies', auth: 'Bearer <agent_api_key>', description: 'List all mesh policies' },
        circuit: { method: 'POST', path: '/api/a2a/mesh/circuit', auth: 'Bearer <agent_api_key>', description: 'Record success/failure events against an agent\'s circuit breaker' },
        circuit_status: { method: 'GET', path: '/api/a2a/mesh/circuit?agent_id=<uuid>', auth: 'Bearer <agent_api_key>', description: 'Get circuit breaker state for an agent' },
        bulkheads: { method: 'POST', path: '/api/a2a/mesh/bulkheads', auth: 'Bearer <agent_api_key>', description: 'Create bulkhead partition to limit per-consumer capacity on a provider' },
      },
      gateway: {
        batch: { method: 'POST', path: '/api/a2a/gateway/batch', auth: 'Bearer <agent_api_key>', description: 'Execute multiple API calls in a single request with dependency resolution and template interpolation between steps' },
        stream: { method: 'GET', path: '/api/a2a/gateway/stream', auth: 'Bearer <agent_api_key>', description: 'SSE stream for real-time task progress, agent heartbeats, workflow events, and platform notifications' },
        introspect: { method: 'GET', path: '/api/a2a/gateway/introspect', auth: 'none', description: 'Machine-readable API catalog with all domains, endpoints, schemas, and gateway capabilities' },
      },
      cache: {
        stats: { method: 'GET', path: '/api/a2a/cache', auth: 'Bearer <agent_api_key>', description: 'Cache statistics dashboard: hit/miss rates, per-intent breakdown, active policies, cost savings estimate' },
        lookup: { method: 'POST', path: '/api/a2a/cache', auth: 'Bearer <agent_api_key>', description: 'Explicit cache lookup — check if a result is cached for an intent+input (action: "lookup")' },
        invalidate: { method: 'POST', path: '/api/a2a/cache', auth: 'Bearer <agent_api_key>', description: 'Invalidate cache entries by key, intent pattern, or producer agent (action: "invalidate")' },
        policy: { method: 'POST', path: '/api/a2a/cache', auth: 'Bearer <agent_api_key>', description: 'Create/update per-intent cache policy: TTL, max size, stale-while-revalidate, ignored fields (action: "policy")' },
        warm: { method: 'POST', path: '/api/a2a/cache', auth: 'Bearer <agent_api_key>', description: 'Pre-populate cache by executing an intent proactively (action: "warm")' },
      },
      trust: {
        list_profiles: { method: 'GET', path: '/api/a2a/trust', auth: 'Bearer <agent_api_key>', description: 'List agent trust profiles with optional filtering by score, autonomy level, or domain' },
        submit_signal: { method: 'POST', path: '/api/a2a/trust', auth: 'Bearer <agent_api_key>', description: 'Submit a trust signal (post-action evaluation) to update an agent\'s trust score' },
        get_profile: { method: 'GET', path: '/api/a2a/trust/:agentId', auth: 'Bearer <agent_api_key>', description: 'Get complete trust profile for an agent across all domains' },
        evaluate: { method: 'POST', path: '/api/a2a/trust/:agentId/evaluate', auth: 'Bearer <agent_api_key>', description: 'Evaluate a trust signal for a specific agent' },
        override: { method: 'POST', path: '/api/a2a/trust/:agentId/override', auth: 'Bearer <agent_api_key>', description: 'Set a manual autonomy override for an agent in a domain' },
        lift_override: { method: 'DELETE', path: '/api/a2a/trust/:agentId/override', auth: 'Bearer <agent_api_key>', description: 'Lift a manual autonomy override, reverting to score-derived level' },
        history: { method: 'GET', path: '/api/a2a/trust/:agentId/history', auth: 'Bearer <agent_api_key>', description: 'Get trust event audit log with filtering by domain, event type, and pagination' },
        thresholds: { method: 'POST', path: '/api/a2a/trust/:agentId/thresholds', auth: 'Bearer <agent_api_key>', description: 'Adjust trust thresholds for a specific agent and domain' },
        batch: { method: 'POST', path: '/api/a2a/trust/batch', auth: 'Bearer <agent_api_key>', description: 'Process multiple trust signals in a single request' },
        domains: { method: 'GET', path: '/api/a2a/trust/domains', auth: 'none', description: 'List all trust domains (built-in + custom) with their thresholds' },
        register_domain: { method: 'POST', path: '/api/a2a/trust/domains', auth: 'Bearer <agent_api_key>', description: 'Register a custom trust domain with optional high-stakes thresholds' },
        resolve_probations: { method: 'POST', path: '/api/a2a/trust/probations/resolve', auth: 'Bearer <agent_api_key>', description: 'Resolve all expired probation periods across agents' },
      },
    },
    supported_intents: intents.map((i) => ({
      intent: i.intent,
      description: i.description,
    })),
    agent_card: '/.well-known/agent-card.json',
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * POST /api/a2a — Legacy envelope endpoint (backward-compatible).
 * Accepts old-style A2A envelopes and returns a deprecation notice
 * pointing to the new structured endpoints.
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!payload || !payload.sender || !payload.message) {
      return NextResponse.json(
        { error: 'Invalid A2A payload. Missing sender or message.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      status: 'received',
      timestamp: new Date().toISOString(),
      receiptId: crypto.randomUUID(),
      deprecation_notice:
        'This envelope endpoint is deprecated. Use POST /api/a2a/tasks for structured task submission. See GET /api/a2a for protocol documentation.',
    }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }
}
