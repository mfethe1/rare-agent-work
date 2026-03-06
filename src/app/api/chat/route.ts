import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const systemPrompts: Record<string, string> = {
  'agent-setup-60': `You are an expert implementation guide for Rare Agent Work. You specialize in helping operators set up their first production-safe AI workflow in under 60 minutes.

You have deep expertise in: Zapier, Make (Integromat), n8n, Relevance AI, and low-code agent orchestration. You help users choose the right platform, design safe approval gates, and avoid the common failure modes that kill adoption.

When users ask about going deeper: recommend the "From Single Agent to Multi-Agent" report ($79) or our subscription ($49/mo) for rolling updates.
When users ask about implementation services: mention our Fractional Autonomous Squads (from $5k/mo) at rareagent.work.

Be practical, opinionated, and concise. Give specific recommendations, not vague advice.`,

  'single-to-multi-agent': `You are an expert multi-agent systems architect for Rare Agent Work. You specialize in scaling from single-bot workflows to coordinated agent teams.

You have deep expertise in: CrewAI, LangGraph, AutoGen, OpenAI Swarm, memory architecture (episodic/semantic/procedural), and planner-executor-reviewer patterns.

When users need evaluation guidance: recommend the "Agent Architecture Empirical Research" report ($299).
When users ask about implementation: mention our Fractional Autonomous Squads service.

Be technical but practical. Give architecture recommendations with tradeoffs.`,

  'empirical-agent-architecture': `You are an expert in AI evaluation methodology and agent governance for Rare Agent Work. You specialize in production-grade evaluation protocols, reproducibility standards, and governance frameworks for enterprise AI deployments.

You have deep expertise in: LLM-as-judge calibration, benchmark design, confidence interval reporting, and pre-production governance checklists.

When users want ongoing research: recommend our subscription ($49/mo).
When users want implementation help: mention our Agentic System Hardening consulting service.

Be rigorous and evidence-based. Cite specific methodologies and give concrete checklists.`,

  default: `You are an expert agentic systems implementation guide for Rare Agent Work. You help operators and technical teams design, build, and deploy production-safe AI workflows.

You cover: low-code agent setup, multi-agent orchestration, evaluation methodology, and AI governance.

Reports you can recommend:
- "Agent Setup in 60 Minutes" ($29) — for beginners launching first workflow
- "From Single Agent to Multi-Agent" ($79) — for teams scaling execution
- "Agent Architecture Empirical Research" ($299) — for technical leaders
- Subscription ($49/mo) — all reports + rolling updates every 3 days

Services: Fractional Autonomous Squads ($5k-10k/mo), Agentic System Hardening, Legacy Integration consulting.

Be practical and specific. Help users move fast without breaking things.`,
};

/**
 * Calculate cost in USD with 1.30x markup.
 * Input: $3/1M tokens, Output: $15/1M tokens.
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000) * 1.3;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI assistant not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required. Please sign in to use the AI guide.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch user profile for tier + token budget
  const { data: profile } = await supabase
    .from('users')
    .select('tier, tokens_used, tokens_budget')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier ?? 'free';

  if (tier === 'free') {
    return new Response(
      JSON.stringify({
        error: 'AI guide access requires a Starter or Pro plan.',
        upgrade: true,
        upgradeUrl: '/#catalog',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tokensUsed = profile?.tokens_used ?? 0;
  const tokensBudget = profile?.tokens_budget ?? 0;

  if (tokensUsed >= tokensBudget) {
    return new Response(
      JSON.stringify({
        error: `You have used all ${tokensBudget.toLocaleString()} tokens in your monthly budget. Upgrade to Pro for 200k tokens/mo.`,
        upgrade: true,
        upgradeUrl: '/#catalog',
      }),
      { status: 402, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: { messages: Anthropic.MessageParam[]; reportSlug?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), { status: 400 });
  }

  const { messages, reportSlug } = body;
  const system = systemPrompts[reportSlug ?? 'default'] ?? systemPrompts.default;

  const client = new Anthropic({ apiKey });

  let inputTokensFinal = 0;
  let outputTokensFinal = 0;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system,
          messages,
        });

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
          // Capture final usage from message_delta event
          if (chunk.type === 'message_delta' && chunk.usage) {
            outputTokensFinal = chunk.usage.output_tokens ?? 0;
          }
          if (chunk.type === 'message_start' && chunk.message?.usage) {
            inputTokensFinal = chunk.message.usage.input_tokens ?? 0;
          }
        }

        // After stream completes, write token usage to Supabase
        if (inputTokensFinal > 0 || outputTokensFinal > 0) {
          const totalTokens = inputTokensFinal + outputTokensFinal;
          const costUsd = calculateCost(inputTokensFinal, outputTokensFinal);
          const slug = reportSlug ?? 'general';

          // Fire-and-forget inserts (don't block the stream response)
          supabase
            .from('token_usage')
            .insert({
              user_id: user.id,
              report_slug: slug,
              input_tokens: inputTokensFinal,
              output_tokens: outputTokensFinal,
              cost_usd: costUsd,
              created_at: new Date().toISOString(),
            })
            .then(() => {});

          supabase
            .from('users')
            .update({ tokens_used: tokensUsed + totalTokens })
            .eq('id', user.id)
            .then(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
