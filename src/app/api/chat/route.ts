import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { checkCostGate, calculateModelCost } from '@/lib/cost-gate';

export const runtime = 'nodejs';

// ──────────────────────────────────────────────
// Multi-model provider configuration
// ──────────────────────────────────────────────

type Provider = 'anthropic' | 'openai' | 'google';

interface ModelConfig {
  provider: Provider;
  apiModel: string;       // Model ID sent to the provider API
  costKey: string;        // Key into MODEL_PRICING registry
  maxTokens: number;
  label: string;
  /** Which tiers can access this model */
  tiers: string[];
}

const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  'claude-sonnet': {
    provider: 'anthropic',
    apiModel: 'claude-sonnet-4-6',
    costKey: 'claude-sonnet-4-6',
    maxTokens: 1024,
    label: 'Claude Sonnet 4.6',
    tiers: ['free', 'starter', 'pro'],
  },
  'gpt-5.4': {
    provider: 'openai',
    apiModel: 'gpt-5.4',
    costKey: 'gpt-5.4',
    maxTokens: 1024,
    label: 'GPT-5.4',
    tiers: ['free', 'starter', 'pro'],
  },
  'gemini-3.1-pro': {
    provider: 'google',
    apiModel: 'gemini-3.1-pro-preview',
    costKey: 'gemini-3.1-pro',
    maxTokens: 1024,
    label: 'Gemini 3.1 Pro',
    tiers: ['free', 'starter', 'pro'],
  },
};

const DEFAULT_MODEL = 'claude-sonnet';

// ──────────────────────────────────────────────
// Provider clients
// ──────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key);
}

async function getUserFromCookie(req: NextRequest) {
  const sessionToken = req.cookies.get('session')?.value;
  if (!sessionToken) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;

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

// ──────────────────────────────────────────────
// System prompts
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Provider streaming implementations
// ──────────────────────────────────────────────

interface StreamResult {
  stream: ReadableStream<Uint8Array>;
  getUsage: () => { inputTokens: number; outputTokens: number };
}

function streamAnthropic(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Anthropic.MessageParam[],
): StreamResult {
  let inputTokens = 0;
  let outputTokens = 0;

  const client = new Anthropic({ apiKey });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = client.messages.stream({ model, max_tokens: maxTokens, system, messages });
        for await (const chunk of s) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
          if (chunk.type === 'message_delta' && chunk.usage) {
            outputTokens = chunk.usage.output_tokens ?? 0;
          }
          if (chunk.type === 'message_start' && chunk.message?.usage) {
            inputTokens = chunk.message.usage.input_tokens ?? 0;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
      }
      controller.close();
    },
  });

  return { stream, getUsage: () => ({ inputTokens, outputTokens }) };
}

function streamOpenAI(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Array<{ role: string; content: string }>,
): StreamResult {
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_completion_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
            messages: [{ role: 'system', content: system }, ...messages],
          }),
        });

        if (!response.ok || !response.body) {
          const errText = await response.text();
          controller.enqueue(new TextEncoder().encode(`[Error: OpenAI ${response.status} — ${errText.slice(0, 200)}]`));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(new TextEncoder().encode(delta));
              if (data.usage) {
                inputTokens = data.usage.prompt_tokens ?? 0;
                outputTokens = data.usage.completion_tokens ?? 0;
              }
            } catch { /* skip malformed SSE */ }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
      }
      controller.close();
    },
  });

  return { stream, getUsage: () => ({ inputTokens, outputTokens }) };
}

function streamGemini(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: Array<{ role: string; content: string }>,
): StreamResult {
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Map messages to Gemini format
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: system }] },
              contents,
              generationConfig: { maxOutputTokens: maxTokens },
            }),
          },
        );

        if (!response.ok || !response.body) {
          const errText = await response.text();
          controller.enqueue(new TextEncoder().encode(`[Error: Gemini ${response.status} — ${errText.slice(0, 200)}]`));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(new TextEncoder().encode(text));
              if (data.usageMetadata) {
                inputTokens = data.usageMetadata.promptTokenCount ?? 0;
                outputTokens = data.usageMetadata.candidatesTokenCount ?? 0;
              }
            } catch { /* skip malformed SSE */ }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
      }
      controller.close();
    },
  });

  return { stream, getUsage: () => ({ inputTokens, outputTokens }) };
}

// ──────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const user = await getUserFromCookie(req);
  const db = getSupabaseAdmin();

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

  // Cost gate
  const gate = await checkCostGate({ userId, userEmail, ip, app: 'ai-guide', tier });
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
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: { messages: Array<{ role: string; content: string }>; reportSlug?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), { status: 400 });
  }

  const { messages, reportSlug } = body;
  const systemPrompt = systemPrompts[reportSlug ?? 'default'] ?? systemPrompts.default;

  // Resolve model
  const requestedModel = body.model || DEFAULT_MODEL;
  const modelConfig = AVAILABLE_MODELS[requestedModel] ?? AVAILABLE_MODELS[DEFAULT_MODEL];

  // Tier access check
  if (!modelConfig.tiers.includes(tier)) {
    return new Response(
      JSON.stringify({
        error: `${modelConfig.label} requires a ${modelConfig.tiers[modelConfig.tiers.length - 1]} plan or higher.`,
        upgrade: true,
        upgradeUrl: '/#catalog',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Resolve API key for the provider
  const providerKeys: Record<Provider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
  };

  const apiKey = providerKeys[modelConfig.provider];
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `${modelConfig.label} is not configured. Try a different model.` }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Stream based on provider
  let result: StreamResult;
  switch (modelConfig.provider) {
    case 'anthropic':
      result = streamAnthropic(apiKey, modelConfig.apiModel, modelConfig.maxTokens, systemPrompt, messages as Anthropic.MessageParam[]);
      break;
    case 'openai':
      result = streamOpenAI(apiKey, modelConfig.apiModel, modelConfig.maxTokens, systemPrompt, messages);
      break;
    case 'google':
      result = streamGemini(apiKey, modelConfig.apiModel, modelConfig.maxTokens, systemPrompt, messages);
      break;
  }

  // Wrap the stream to log usage on completion
  const encoder = new TextEncoder();
  const wrappedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Stream error]`));
      }

      // Log usage after stream completes
      const usage = result.getUsage();
      if (db && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
        const { providerCost, markupCost } = calculateModelCost(modelConfig.costKey, usage.inputTokens, usage.outputTokens);
        const totalTokens = usage.inputTokens + usage.outputTokens;

        db.from('token_usage')
          .insert({
            user_id: userId,
            user_email: userEmail || null,
            app: 'ai-guide',
            report_slug: reportSlug ?? 'general',
            model: modelConfig.costKey,
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
            cost_usd: providerCost,
            markup_cost_usd: markupCost,
            ip_address: ip,
          })
          .then(() => {});

        if (user) {
          db.from('users')
            .update({ tokens_used: tokensUsed + totalTokens })
            .eq('id', user.id)
            .then(() => {});
        }
      }

      controller.close();
    },
  });

  return new Response(wrappedStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Model': modelConfig.label,
    },
  });
}

// GET /api/chat — return available models for the client
export async function GET() {
  const available = Object.entries(AVAILABLE_MODELS)
    .filter(([, config]) => {
      const providerKeys: Record<Provider, string | undefined> = {
        anthropic: process.env.ANTHROPIC_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        google: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
      };
      return !!providerKeys[config.provider];
    })
    .map(([key, config]) => ({
      id: key,
      label: config.label,
      provider: config.provider,
      tiers: config.tiers,
    }));

  return new Response(JSON.stringify({ models: available, default: DEFAULT_MODEL }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
