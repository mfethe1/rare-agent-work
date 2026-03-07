import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { checkCostGate } from '@/lib/cost-gate';

export const runtime = 'nodejs';

// Anthropic pricing (Sonnet 4.6): $3/1M input, $15/1M output
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;
const MARKUP = 1.30; // 30% markup

function calculateCost(inputTokens: number, outputTokens: number) {
  const providerCost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;
  const markupCost = providerCost * MARKUP;
  return { providerCost, markupCost };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key);
}

// Simple cookie-based session lookup (matches our auth system)
async function getUserFromCookie(req: NextRequest): Promise<{ id: string; email: string; tier: string; tokensUsed: number; tokensBudget: number } | null> {
  const sessionToken = req.cookies.get('session')?.value;
  if (!sessionToken) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;

  // Look up user by session token
  const { data } = await db
    .from('users')
    .select('id, email, tier, tokens_used, tokens_budget')
    .eq('session_token', sessionToken)
    .single();

  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    tier: data.tier ?? 'free',
    tokensUsed: data.tokens_used ?? 0,
    tokensBudget: data.tokens_budget ?? 50000,
  };
}

const systemPrompts: Record<string, string> = {
  'agent-setup-60': `You are an expert implementation guide for Rare Agent Work. You specialize in helping operators set up their first production-safe AI workflow in under 60 minutes.

You have deep expertise in: Zapier, Make (Integromat), n8n, Relevance AI, and low-code agent orchestration. You help users choose the right platform, design safe approval gates, and avoid the common failure modes that kill adoption.

When users ask about going deeper: recommend the "From Single Agent to Multi-Agent" report ($79) or our subscription ($29/mo) for rolling updates.

Be practical, opinionated, and concise. Give specific recommendations, not vague advice.`,

  'single-to-multi-agent': `You are an expert multi-agent systems architect for Rare Agent Work. You specialize in scaling from single-bot workflows to coordinated agent teams.

You have deep expertise in: CrewAI, LangGraph, AutoGen, OpenAI Swarm, memory architecture (episodic/semantic/procedural), and planner-executor-reviewer patterns.

When users need evaluation guidance: recommend the "Agent Architecture Empirical Research" report ($299).

Be technical but practical. Give architecture recommendations with tradeoffs.`,

  'empirical-agent-architecture': `You are an expert in AI evaluation methodology and agent governance for Rare Agent Work. You specialize in production-grade evaluation protocols, reproducibility standards, and governance frameworks for enterprise AI deployments.

You have deep expertise in: LLM-as-judge calibration, benchmark design, confidence interval reporting, and pre-production governance checklists.

When users want ongoing research: recommend our subscription ($29/mo).

Be rigorous and evidence-based. Cite specific methodologies and give concrete checklists.`,

  default: `You are an expert agentic systems implementation guide for Rare Agent Work. You help operators and technical teams design, build, and deploy production-safe AI workflows.

You cover: low-code agent setup, multi-agent orchestration, evaluation methodology, and AI governance.

Reports you can recommend:
- "Agent Setup in 60 Minutes" ($29) — for beginners launching first workflow
- "From Single Agent to Multi-Agent" ($79) — for teams scaling execution
- "Agent Architecture Empirical Research" ($299) — for technical leaders
- Starter subscription ($29/mo) — all reports + AI guide + rolling updates
- Pro subscription ($99/mo) — everything + 200k tokens/mo + PDF downloads

Be practical and specific. Help users move fast without breaking things.`,
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI assistant not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const user = await getUserFromCookie(req);
  const db = getSupabaseAdmin();

  // Determine access level
  let userId = 'anon';
  let userEmail = '';
  let tier = 'free';
  let tokensUsed = 0;

  if (user) {
    userId = user.id;
    userEmail = user.email;
    tier = user.tier;
    tokensUsed = user.tokensUsed;
  }

  // Universal cost gate — enforces spend + request limits per tier
  const gate = await checkCostGate({
    userId,
    userEmail,
    ip,
    app: 'ai-guide',
    tier,
  });

  if (gate.blocked) {
    return new Response(
      JSON.stringify({
        error: gate.error,
        reason: gate.reason,
        upgrade: true,
        upgradeUrl: tier === 'free' ? '/auth/login' : '/#catalog',
        usage: {
          weeklySpend: `$${gate.weeklySpend.toFixed(4)}`,
          weeklyLimit: `$${gate.limits.weeklyLimit.toFixed(2)}`,
          dailyRequests: gate.dailyRequests,
          weeklyRequests: gate.weeklyRequests,
        },
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
  const model = 'claude-sonnet-4-6';

  const client = new Anthropic({ apiKey });

  let inputTokensFinal = 0;
  let outputTokensFinal = 0;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model,
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
          if (chunk.type === 'message_delta' && chunk.usage) {
            outputTokensFinal = chunk.usage.output_tokens ?? 0;
          }
          if (chunk.type === 'message_start' && chunk.message?.usage) {
            inputTokensFinal = chunk.message.usage.input_tokens ?? 0;
          }
        }

        // Log usage to Supabase (fire-and-forget)
        if (db && (inputTokensFinal > 0 || outputTokensFinal > 0)) {
          const { providerCost, markupCost } = calculateCost(inputTokensFinal, outputTokensFinal);
          const totalTokens = inputTokensFinal + outputTokensFinal;

          db.from('token_usage')
            .insert({
              user_id: userId,
              user_email: userEmail || null,
              app: 'ai-guide',
              report_slug: reportSlug ?? 'general',
              model,
              input_tokens: inputTokensFinal,
              output_tokens: outputTokensFinal,
              cost_usd: providerCost,
              markup_cost_usd: markupCost,
              ip_address: ip,
            })
            .then(() => {});

          // Update user token counter
          if (user) {
            db.from('users')
              .update({ tokens_used: tokensUsed + totalTokens })
              .eq('id', user.id)
              .then(() => {});
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Token-Model': model,
    },
  });
}
