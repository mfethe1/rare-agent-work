export interface CitationReference {
  label: string;
  url: string;
  accessedAt?: string;
}

export interface PremiumQualityIssue {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
}

export interface PremiumQualityInput {
  title: string;
  executiveSummary: string;
  implications?: string[];
  actionSteps?: string[];
  risks?: string[];
  citations?: CitationReference[];
  freshnessTimestamp?: string;
  renderedHtml?: string;
}

const GENERIC_PHRASES = [
  'in today\'s rapidly evolving',
  'at the end of the day',
  'it is important to note',
  'in conclusion',
  'this comprehensive report',
  'delve into',
  'game changer',
  'best-in-class',
  'leverage synergies',
  'mckinsey-style',
];

const PLACEHOLDER_PATTERN = /\b(TODO|TBD|lorem ipsum|placeholder)\b|\[Synthesis unavailable/i;

const MARKDOWN_ARTIFACTS = [
  /```/,
  /`[^`]+`/,
  /\*\*/,
  /__[^_]+__/,
  /\[[^\]]+\]\([^)]+\)/,
  /^\s{0,3}#{1,6}\s+/m,
  /^\s{0,3}(?:[-*+]\s+|\d+\.\s+)/m,
];

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasMarkdownArtifacts(value: string) {
  return MARKDOWN_ARTIFACTS.some((pattern) => pattern.test(value));
}

export function runPremiumQualityChecks(input: PremiumQualityInput): PremiumQualityIssue[] {
  const issues: PremiumQualityIssue[] = [];
  const implications = input.implications ?? [];
  const actionSteps = input.actionSteps ?? [];
  const risks = input.risks ?? [];
  const citations = input.citations ?? [];

  const summary = stripMarkdown(input.executiveSummary || '');
  const title = stripMarkdown(input.title || '');
  const allText = [
    title,
    summary,
    ...implications.map(stripMarkdown),
    ...actionSteps.map(stripMarkdown),
    ...risks.map(stripMarkdown),
  ].join('\n');

  if (summary.split(/\s+/).filter(Boolean).length < 30) {
    issues.push({
      severity: 'error',
      rule: 'executive-summary-length',
      message: 'Executive summary must be at least 30 words to avoid low-information filler.',
    });
  }

  if (implications.length < 2) {
    issues.push({
      severity: 'error',
      rule: 'implications-required',
      message: 'At least 2 operator implications are required.',
    });
  }

  if (actionSteps.length < 2) {
    issues.push({
      severity: 'error',
      rule: 'action-steps-required',
      message: 'At least 2 concrete action steps are required.',
    });
  }

  if (risks.length < 2) {
    issues.push({
      severity: 'error',
      rule: 'risks-required',
      message: 'At least 2 explicit risks are required.',
    });
  }

  if (citations.length < 2) {
    issues.push({
      severity: 'error',
      rule: 'citations-required',
      message: 'At least 2 citations are required to support claims.',
    });
  }

  if (!input.freshnessTimestamp || Number.isNaN(Date.parse(input.freshnessTimestamp))) {
    issues.push({
      severity: 'error',
      rule: 'freshness-required',
      message: 'Freshness timestamp is required and must be parseable.',
    });
  }

  if (PLACEHOLDER_PATTERN.test(allText)) {
    issues.push({
      severity: 'error',
      rule: 'placeholder-content',
      message: 'Placeholder or unavailable-copy markers detected.',
    });
  }

  const lower = allText.toLowerCase();
  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        severity: 'error',
        rule: 'anti-generic-language',
        message: `Generic filler phrase detected: "${phrase}"`,
      });
    }
  }

  if (hasMarkdownArtifacts(allText)) {
    issues.push({
      severity: 'error',
      rule: 'markdown-artifacts',
      message: 'Markdown formatting artifacts detected in output copy.',
    });
  }

  if (input.renderedHtml && hasMarkdownArtifacts(input.renderedHtml)) {
    issues.push({
      severity: 'error',
      rule: 'markdown-artifacts-html',
      message: 'Markdown artifacts detected in rendered HTML body.',
    });
  }

  return issues;
}
