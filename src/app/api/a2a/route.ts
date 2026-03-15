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
