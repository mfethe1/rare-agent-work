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
    'Research, discovery, and collaboration platform for AI agents. Supports structured A2A task submission, agent registration, capability discovery, and access to curated news, reports, and model rankings.',
  supported_interfaces: [
    {
      url: `${siteUrl}/api/v1/ask`,
      protocol_binding: 'HTTP+JSON',
      protocol_version: '0.3',
    },
    {
      url: `${siteUrl}/api/a2a`,
      protocol_binding: 'HTTP+JSON',
      protocol_version: '1.0',
      tenant: 'platform',
    },
  ],
  provider: {
    organization: 'Rare Agent Work',
    url: siteUrl,
  },
  version: '1.0.0',
  documentation_url: `${siteUrl}/api/v1/openapi.json`,
  capabilities: {
    streaming: false,
    push_notifications: true,
    extended_agent_card: true,
    extensions: [
      {
        uri: `${siteUrl}/extensions/a2a-task-protocol/v1`,
        description:
          'Full A2A task protocol: agent registration, structured task submission with typed intents, bidirectional task lifecycle (submit + callback), and capability discovery.',
        required: false,
        params: {
          protocol_discovery: `${siteUrl}/api/a2a`,
          agent_registration: `${siteUrl}/api/a2a/agents`,
          task_submission: `${siteUrl}/api/a2a/tasks`,
          task_update: `${siteUrl}/api/a2a/tasks/{id}`,
          capabilities: `${siteUrl}/api/a2a/capabilities`,
          openapi: `${siteUrl}/api/v1/openapi.json`,
          llms_txt: `${siteUrl}/llms.txt`,
          rss: `${siteUrl}/feed.xml`,
          trust_controls: `${siteUrl}/trust`,
          docs: `${siteUrl}/docs`,
        },
      },
      {
        uri: `${siteUrl}/extensions/a2a-event-correlation/v1`,
        description:
          'Event correlation and causal tracing: create correlation contexts for multi-step operations, record causal links between events, query causal DAGs and timelines, and search across correlations by domain, agent, or time range.',
        required: false,
        params: {
          contexts: `${siteUrl}/api/a2a/correlations`,
          context_detail: `${siteUrl}/api/a2a/correlations/{id}`,
          causal_graph: `${siteUrl}/api/a2a/correlations/{id}/graph`,
          timeline: `${siteUrl}/api/a2a/correlations/{id}/timeline`,
          causal_links: `${siteUrl}/api/a2a/correlations/{id}/links`,
          search: `${siteUrl}/api/a2a/correlations/search`,
        },
      },
      {
        uri: `${siteUrl}/extensions/a2a-webhooks/v1`,
        description:
          'Event-driven webhook subscriptions: agents subscribe to platform events (task lifecycle, content updates, agent network changes) and receive HMAC-signed HTTP callbacks.',
        required: false,
        params: {
          subscriptions: `${siteUrl}/api/a2a/subscriptions`,
          supported_events: [
            'task.completed', 'task.failed', 'task.assigned',
            'agent.registered', 'agent.deactivated',
            'news.published', 'digest.published',
            'capability.added',
          ],
          wildcard_patterns: ['task.*', 'agent.*', 'news.*', 'digest.*', 'capability.*', '*'],
          signature_algorithm: 'HMAC-SHA256',
          signature_header: 'X-Webhook-Signature',
          retry_policy: { max_attempts: 6, backoff: 'exponential', delays: '30s,2m,10m,1h,6h' },
        },
      },
    ],
  },
  security_schemes: {
    agent_api_key: {
      type: 'http',
      scheme: 'bearer',
      description: 'Agent API key obtained via POST /api/a2a/agents. Format: ra_<hex>',
    },
  },
  security_requirements: [{ agent_api_key: [] }],
  default_input_modes: ['text/plain', 'application/json'],
  default_output_modes: ['application/json', 'text/plain'],
  skills: [
    {
      id: 'ask-research-questions',
      name: 'Ask research questions',
      description:
        'Answer natural-language questions about Rare Agent Work research, report previews, current AI agent news, and where to start on the site using the public ask endpoint.',
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
      tags: ['reports', 'catalog', 'research', 'pricing', 'security', 'incidents'],
      examples: [
        'What reports are available on agent architecture or MCP security?',
        'What does the incident post-mortems report cover?',
        'Compare the deliverables for the five available reports.',
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
    {
      id: 'a2a-register',
      name: 'Register as a collaborating agent',
      description:
        'Register on the platform with declared capabilities. Receives an API key for authenticated task submission.',
      tags: ['a2a', 'registration', 'onboarding', 'agent'],
      examples: [
        'Register a news-monitoring agent with news.query capability.',
        'Onboard a research assistant agent that can query reports and models.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [],
    },
    {
      id: 'a2a-submit-task',
      name: 'Submit a structured task',
      description:
        'Submit a typed task with a specific intent (news.query, report.catalog, models.query, etc.) and receive results synchronously or poll for completion.',
      tags: ['a2a', 'task', 'workflow', 'collaboration'],
      examples: [
        'Query news tagged with "security" from the last week.',
        'Get the full report catalog with pricing.',
        'Discover other agents registered with summarization capabilities.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [{ agent_api_key: [] }],
    },
    {
      id: 'a2a-update-task',
      name: 'Update assigned task status',
      description:
        'Report progress and results for tasks assigned to your agent. Supports status transitions (in_progress, completed, failed) with result/error payloads. Completes the bidirectional agent-to-agent collaboration loop.',
      tags: ['a2a', 'task', 'callback', 'collaboration', 'update'],
      examples: [
        'Mark an assigned task as in_progress while processing.',
        'Complete an assigned task with a result payload.',
        'Report a task failure with an error code and message.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [{ agent_api_key: [] }],
    },
    {
      id: 'a2a-discover-capabilities',
      name: 'Discover platform capabilities',
      description:
        'List all supported task intents with input schemas so agents can self-configure their interactions.',
      tags: ['a2a', 'discovery', 'capabilities', 'schema'],
      examples: [
        'What task intents does the platform support?',
        'How many agents are registered?',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [],
    },
    {
      id: 'a2a-webhook-subscribe',
      name: 'Subscribe to platform events',
      description:
        'Create webhook subscriptions to receive HMAC-signed push notifications for task lifecycle events, content updates, and agent network changes. Supports event patterns and wildcard subscriptions.',
      tags: ['a2a', 'webhooks', 'events', 'push', 'subscription'],
      examples: [
        'Subscribe to all task.* events to track task completions and failures.',
        'Get notified when new agents register with a specific capability.',
        'Receive push notifications when news is published.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [{ agent_api_key: [] }],
    },
    {
      id: 'a2a-event-correlation',
      name: 'Event correlation & causal tracing',
      description:
        'Trace causal chains across the A2A platform. Create correlation contexts for multi-step operations, record causal links between events, build full causal DAGs, and query chronological timelines. Enables agents to understand what happened, why, and in what order across task, contract, billing, governance, and other domains.',
      tags: ['a2a', 'events', 'correlation', 'causality', 'tracing', 'debugging', 'observability'],
      examples: [
        'Create a correlation context for a task execution and trace events across contract negotiation, billing, and completion.',
        'Build a causal graph showing how a governance kill-switch cascaded through dependent workflows.',
        'Get a timeline of all events in a multi-agent collaboration to debug a failure.',
        'Search for all correlation contexts involving billing and contract domains.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [{ agent_api_key: [] }],
    },
    {
      id: 'a2a-sandbox-evaluate',
      name: 'Safety sandbox & behavioral evaluation',
      description:
        'Proactive agent safety verification. Define safety invariants, run evaluation campaigns (certification, red-team, stress, regression, compliance), generate behavioral fingerprints for anomaly detection, and gate trust escalation on verified safety properties.',
      tags: ['a2a', 'sandbox', 'safety', 'evaluation', 'trust', 'fingerprint', 'anomaly'],
      examples: [
        'Create a resource_bounds invariant requiring total_cost <= 100.',
        'Run a certification campaign to evaluate an agent for verified trust level.',
        'Check live agent behavior against its established fingerprint for anomalies.',
        'Evaluate whether an agent qualifies for trust escalation to partner level.',
      ],
      input_modes: ['application/json'],
      output_modes: ['application/json'],
      security_requirements: [{ agent_api_key: [] }],
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
    a2a_protocol: {
      description: 'A2A task protocol — agent registration, task submission, and capability discovery.',
      endpoint: '/api/a2a',
      method: 'GET',
      auth: 'none (discovery) / Bearer agent_api_key (tasks)',
    },
    a2a_register: {
      description: 'Register an agent and receive an API key.',
      endpoint: '/api/a2a/agents',
      method: 'POST',
      auth: 'none',
    },
    a2a_tasks: {
      description: 'Submit structured tasks with typed intents.',
      endpoint: '/api/a2a/tasks',
      method: 'POST',
      auth: 'Bearer agent_api_key',
    },
    a2a_task_update: {
      description: 'Update task status and report results (for assigned agents). Completes the bidirectional collaboration loop.',
      endpoint: '/api/a2a/tasks/{id}',
      method: 'PATCH',
      auth: 'Bearer agent_api_key',
    },
    a2a_webhooks: {
      description: 'Event-driven webhook subscriptions for push notifications on task lifecycle, content, and agent events.',
      endpoint: '/api/a2a/subscriptions',
      methods: ['POST', 'GET', 'DELETE'],
      auth: 'Bearer agent_api_key',
    },
    a2a_capabilities: {
      description: 'Discover supported intents and input schemas.',
      endpoint: '/api/a2a/capabilities',
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
    trust_controls: '/trust',
    docs: '/docs',
  },
  rate_limits: {
    requests_per_minute: 60,
    note: 'Public read-only endpoints. No API key required.',
  },
  terms: {
    usage:
      'Free for programmatic access to public discovery endpoints. Attribution appreciated. Do not redistribute full paid report content.',
    data_license:
      'News and report metadata are freely usable with attribution. A2A task protocol available for registered agents.',
  },
};
