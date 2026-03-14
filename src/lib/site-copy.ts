export const operatorProofStats = [
  { label: 'Public reports', value: '4', detail: 'Previewable, cited, and purchasable now' },
  { label: 'Public API routes', value: '4', detail: 'News, reports, models, and NL query' },
  { label: 'Trust-gated service paths', value: '3', detail: 'Assessment, network, and submit-work intake' },
  { label: 'Machine-readable surfaces', value: '5', detail: 'OpenAPI, agent card, manifest, RSS, llms.txt' },
];

export const startHereRoutes = [
  {
    title: 'I need orientation',
    href: '/start-here',
    description: 'Read the shortest-path guide for what to build first, what to avoid, and where to go next.',
    badge: 'Best first click',
  },
  {
    title: 'I need implementation guidance',
    href: '/reports',
    description: 'Open the report catalog if you already know the problem and want a concrete playbook or scorecard.',
    badge: 'Research',
  },
  {
    title: 'I need agent-readable access',
    href: '/docs',
    description: 'Use public docs, OpenAPI, and discovery files if you are integrating Rare Agent Work into a tool or another agent.',
    badge: 'API',
  },
  {
    title: 'I need human help',
    href: '/assessment',
    description: 'Use the consulting and review path when the work is messy, urgent, or politically sensitive.',
    badge: 'Service',
  },
];

export const trustControlBullets = [
  'No credential intake in public forms.',
  'Human review before any scoped next step.',
  'No autonomous execution against client systems from intake flows.',
  'Temporary storage only for triage and routing.',
];

export const consultingPackages = [
  {
    name: 'Operator Review',
    price: 'Scoped audit',
    description: 'Short diagnostic for stack fit, failure modes, and next actions when a team needs an outside read fast.',
  },
  {
    name: 'Implementation Rescue',
    price: 'Hands-on engagement',
    description: 'For brittle workflows, orchestration drift, weak memory, or rollout stalls that need direct intervention.',
  },
  {
    name: 'Enterprise Working Session',
    price: 'Leadership package',
    description: 'For buyers aligning architecture, governance, vendor selection, and rollout sequencing across teams.',
  },
];

export const integrationPatterns = [
  {
    title: 'Route questions through `/api/v1/ask`',
    detail: 'Use the NL query endpoint for lightweight operator Q&A across reports and current news.',
  },
  {
    title: 'Use `/api/v1/news` as a freshness feed',
    detail: 'Track AI agent platform drift with tags, recency filters, RSS fallback, and machine-readable summaries.',
  },
  {
    title: 'Use `/api/v1/reports` for catalog and merchandising',
    detail: 'Pull structured report metadata, deliverables, preview sections, and subscription upsell context.',
  },
  {
    title: 'Use discovery files for agent bootstrapping',
    detail: 'OpenAPI, llms.txt, and the agent card provide the machine-readable trust package for external agent consumers.',
  },
];
