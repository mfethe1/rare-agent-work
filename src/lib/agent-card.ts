export type AgentInterface = {
  url: string;
  protocol_binding: string;
  protocol_version: string;
  tenant?: string;
};

export type AgentProvider = {
  organization: string;
  url: string;
};

export type AgentExtension = {
  uri: string;
  description: string;
  required: boolean;
  params?: Record<string, unknown>;
};

export type AgentCapabilities = {
  streaming: boolean;
  push_notifications: boolean;
  extensions: AgentExtension[];
  extended_agent_card: boolean;
};

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  input_modes?: string[];
  output_modes?: string[];
  security_requirements?: Array<Record<string, string[]>>;
};

export type AgentCard = {
  name: string;
  description: string;
  supported_interfaces: AgentInterface[];
  provider: AgentProvider;
  version: string;
  documentation_url: string;
  capabilities: AgentCapabilities;
  security_schemes?: Record<string, unknown>;
  security_requirements?: Array<Record<string, string[]>>;
  default_input_modes: string[];
  default_output_modes: string[];
  skills: AgentSkill[];
  icon_url?: string;
};

const siteUrl = 'https://rareagent.work';
export const agentCardPath = '/.well-known/agent-card.json';
export const legacyAgentManifestPath = '/.well-known/agent.json';

export const agentCard: AgentCard = {
  name: 'Rare Agent Work',
  description:
    'Read-only research and discovery agent for AI operators. Exposes curated agent news, report metadata, and a natural-language ask surface over Rare Agent Work content.',
  supported_interfaces: [
    {
      url: `${siteUrl}/api/v1/ask`,
      protocol_binding: 'HTTP+JSON',
      protocol_version: '0.3',
    },
  ],
  provider: {
    organization: 'Rare Agent Work',
    url: siteUrl,
  },
  version: '0.1.0',
  documentation_url: `${siteUrl}/api/v1/openapi.json`,
  capabilities: {
    streaming: false,
    push_notifications: false,
    extended_agent_card: false,
    extensions: [
      {
        uri: `${siteUrl}/extensions/read-only-discovery/v1`,
        description:
          'This card currently exposes discovery and query surfaces only. Full A2A task execution, brokered workflows, and push notifications are intentionally not implemented yet.',
        required: false,
        params: {
          openapi: `${siteUrl}/api/v1/openapi.json`,
          llms_txt: `${siteUrl}/llms.txt`,
          rss: `${siteUrl}/feed.xml`,
        },
      },
    ],
  },
  security_schemes: {},
  security_requirements: [],
  default_input_modes: ['text/plain', 'application/json'],
  default_output_modes: ['application/json', 'text/plain'],
  skills: [
    {
      id: 'ask-research-questions',
      name: 'Ask research questions',
      description:
        'Answer natural-language questions about Rare Agent Work research, report previews, and current AI agent news using the public ask endpoint.',
      tags: ['research', 'nlweb', 'qa', 'agents', 'news'],
      examples: [
        'Which Rare Agent Work report should I start with for multi-agent systems?',
        'What are the latest AI agent security stories this week?',
      ],
      input_modes: ['text/plain', 'application/json'],
      output_modes: ['application/json', 'text/plain'],
      security_requirements: [],
    },
    {
      id: 'browse-news-feed',
      name: 'Browse curated news feed',
      description:
        'Retrieve curated AI agent news with filters for tags, recency, and result limits.',
      tags: ['news', 'feed', 'curation', 'agents'],
      examples: [
        'Show the latest open-source agent news from the last 7 days.',
        'List the newest security-tagged stories.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [],
    },
    {
      id: 'inspect-report-catalog',
      name: 'Inspect report catalog',
      description:
        'Discover report metadata, pricing, deliverables, and preview sections for Rare Agent Work research products.',
      tags: ['reports', 'catalog', 'research', 'pricing'],
      examples: [
        'What reports are available on agent architecture?',
        'Compare the deliverables for the three paid reports.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [],
    },
    {
      id: 'inspect-model-index',
      name: 'Inspect model index status',
      description:
        'Fetch the current public model index response while the methodology and refresh cadence are being rebuilt.',
      tags: ['models', 'leaderboard', 'benchmarking'],
      examples: [
        'Which provider currently has the strongest tool use score?',
        'Sort models by coding score.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [],
    },
  ],
  icon_url: `${siteUrl}/globe.svg`,
};

export const legacyAgentManifest = {
  schema_version: '1.1',
  name: agentCard.name,
  description: agentCard.description,
  url: siteUrl,
  logo: agentCard.icon_url,
  contact: 'hello@rareagent.work',
  discovery: {
    a2a_agent_card: agentCardPath,
    legacy_agent_manifest: legacyAgentManifestPath,
    openapi: '/api/v1/openapi.json',
    llms_txt: '/llms.txt',
    rss: '/feed.xml',
  },
  capabilities: {
    ask_research_questions: {
      description: 'Natural-language research and discovery endpoint.',
      endpoint: '/api/v1/ask',
      methods: ['GET', 'POST'],
      auth: 'none',
      protocol: 'nlweb',
    },
    news_feed: {
      description: 'Curated AI agent news feed.',
      endpoint: '/api/v1/news',
      method: 'GET',
      auth: 'none',
    },
    reports_catalog: {
      description: 'Research report catalog with preview content.',
      endpoint: '/api/v1/reports',
      method: 'GET',
      auth: 'none',
    },
    models_index: {
      description: 'Public model index endpoint with methodology caveats.',
      endpoint: '/api/v1/models',
      method: 'GET',
      auth: 'none',
    },
  },
  protocols: {
    a2a_agent_card: agentCardPath,
    openapi: '/api/v1/openapi.json',
    llms_txt: '/llms.txt',
    rss: '/feed.xml',
    sitemap: '/sitemap.xml',
  },
  rate_limits: {
    requests_per_minute: 60,
    note: 'Public read-only endpoints. No API key required.',
  },
  terms: {
    usage:
      'Free for programmatic access to public discovery endpoints. Attribution appreciated. Do not redistribute full paid report content.',
    data_license:
      'News and report metadata are freely usable with attribution. The A2A card reflects discovery only, not full A2A task execution.',
  },
};
