import { NextResponse } from 'next/server';

export async function GET() {
  const agentCard = {
    name: 'Rare Agent Work',
    description:
      'AI agent research service providing model leaderboard data, curated news, operator-grade reports, and implementation guidance for agent builders.',
    url: 'https://rareagent.work',
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      {
        id: 'search-agent-news',
        name: 'Search AI Agent News',
        description:
          'Search curated, verified AI agent news. Updated daily, max 14 days old. Covers framework releases, model launches, security advisories, research papers, and community developments.',
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
        examples: [
          'What are the latest AI agent framework releases?',
          'Any security news about AI agents this week?',
          'What did OpenAI release recently?',
        ],
      },
      {
        id: 'get-model-rankings',
        name: 'Get Agentic Model Rankings',
        description:
          'Get LLMs ranked for agentic use — tool calling accuracy, context recall, coding ability, cost efficiency. Compare models for agent deployment decisions.',
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
        examples: [
          'Which model is best for tool use in agents?',
          'Compare Claude vs GPT for agentic workloads',
          'What is the cheapest model with good coding scores?',
        ],
      },
      {
        id: 'get-report-catalog',
        name: 'Get Report Catalog',
        description:
          'Browse operator-grade reports on low-code automation, multi-agent orchestration, and empirical evaluation methodology. Returns metadata, pricing, and content previews.',
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
        examples: [
          'What reports are available on multi-agent systems?',
          'Show me reports about agent evaluation',
          'What implementation guides do you offer?',
        ],
      },
      {
        id: 'get-weekly-digest',
        name: 'Get Weekly AI Agent Digest',
        description:
          'Get the executive summary of this week\'s most important AI agent developments, categorized by theme.',
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
        examples: [
          'What happened in AI agents this week?',
          'Give me this week\'s digest',
        ],
      },
      {
        id: 'ask-natural-language',
        name: 'Ask in Natural Language (NLWeb)',
        description:
          'Ask any question about AI models, agent news, reports, or weekly developments in natural language. Returns structured JSON with answers and source citations. NLWeb-compatible endpoint.',
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
        examples: [
          'Which model is best for tool use?',
          'Compare Claude vs GPT for agentic workloads',
          'Latest security news about AI agents',
          'What reports do you offer on multi-agent systems?',
          'Cheapest model with good coding scores',
        ],
        endpoint: 'https://rareagent.work/ask?q={query}',
      },
    ],
    authentication: {
      schemes: ['none'],
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json'],
  };

  return NextResponse.json(agentCard, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
