import type { NewsItem } from '@/lib/news-store';
import {
  escapeHtml,
  runPremiumQualityChecks,
  stripMarkdown,
  type CitationReference,
  type PremiumQualityIssue,
} from '@/lib/premium-content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://rareagent.work';
const BRAND_NAME = 'Rare Agent Work';
const BRAND_TAGLINE = 'Operator-grade intelligence for teams building with AI agents';
const LOGO_URL = `${SITE_URL}/logo-medallion.jpg`;

export interface PremiumNewsletterIssue {
  slug: 'weekly-newsletter';
  subject: string;
  preheader: string;
  weekRange: string;
  generatedAt: string;
  freshnessTimestamp: string;
  executiveSummary: string;
  implications: string[];
  actionSteps: string[];
  risks: string[];
  citations: CitationReference[];
  stories: Array<{
    title: string;
    summary: string;
    url: string;
    source: string;
    publishedAt: string;
    upvotes: number;
    category: string;
  }>;
}

export interface NewsletterPayload {
  slug: string;
  subject: string;
  html: string;
  text: string;
  qaIssues: PremiumQualityIssue[];
}

function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderList(items: string[], bulletColor: string) {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:0 0 10px 0; vertical-align:top; color:${bulletColor}; font-weight:700; width:18px;">•</td>
        <td style="padding:0 0 10px 0; color:#d7dce5; font-size:15px; line-height:1.6;">${escapeHtml(stripMarkdown(item))}</td>
      </tr>
    `,
    )
    .join('');
}

function buildExecutiveSummary(items: NewsItem[], weekRange: string) {
  const sourceCount = new Set(items.map((item) => item.source)).size;
  const top = items[0];
  const topCategory = items
    .map((item) => item.category)
    .filter(Boolean)
    .reduce<Record<string, number>>((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  const dominantCategory = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0];

  if (!top) {
    return `No qualified stories passed the current ingest filters for ${weekRange}. This issue is intentionally withheld rather than shipping low-confidence filler.`;
  }

  return `For ${weekRange}, we tracked ${items.length} operator-relevant developments across ${sourceCount} sources. The highest-signal item was "${top.title}" (${top.source}). ${dominantCategory ? `Coverage was concentrated in ${dominantCategory[0]} (${dominantCategory[1]} stories), which should shape prioritization this week.` : ''}`;
}

function buildImplications(items: NewsItem[]) {
  const modelReleaseCount = items.filter((item) => /model-release/i.test(item.category)).length;
  const securityCount = items.filter((item) => /security|risk|safety/i.test(`${item.category} ${item.title} ${(item.tags || []).join(' ')}`)).length;
  const frameworkCount = items.filter((item) => /framework|tool-release|platform|open-source/i.test(`${item.category} ${item.title} ${(item.tags || []).join(' ')}`)).length;

  return [
    `Release velocity remains high (${modelReleaseCount} model-focused stories this week), so benchmark drift checks should be scheduled before teams change default models.`,
    `Security and governance surfaced in ${securityCount} stories; shipping new agent capabilities without updated guardrails increases incident probability.`,
    `Framework and tooling launches represented ${frameworkCount} stories, which creates opportunity but also integration churn if adoption is not staged.`,
  ];
}

function buildActionSteps(items: NewsItem[]) {
  const topTags = items
    .flatMap((item) => item.tags || [])
    .reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});

  const prioritizedTags = Object.entries(topTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag)
    .join(', ');

  return [
    `Run a 30-minute triage on the top 3 stories and map each to current roadmap exposure (adopt / monitor / ignore).`,
    `Assign an owner to verify claims behind this week\'s dominant tags (${prioritizedTags || 'no recurring tags'}) against primary documentation before any spend decision.`,
    'Update your agent risk register with one new mitigation tied to this week\'s top security or reliability signal.',
  ];
}

function buildRisks(items: NewsItem[]) {
  const sourceEntries = Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const concentration = sourceEntries[0];
  const oldest = [...items].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())[0];

  return [
    concentration
      ? `Source concentration risk: ${concentration[1]} of ${items.length} stories came from ${concentration[0]}. Validate key claims with primary sources before acting.`
      : 'Source concentration risk: ingest did not return enough source diversity for high-confidence trend calls.',
    oldest
      ? `Freshness risk: oldest included story dates to ${formatDate(oldest.publishedAt)}. Re-check time-sensitive recommendations before execution.`
      : 'Freshness risk: no dated stories were available for temporal validation.',
    'Execution risk: teams often overreact to launch announcements. Require explicit adoption criteria before adding any new framework to production scope.',
  ];
}

export function buildPremiumNewsletterIssue(items: NewsItem[], now = new Date()): PremiumNewsletterIssue {
  const sorted = [...items].sort((a, b) => {
    const scoreA = a.upvotes * 3 + new Date(a.publishedAt).getTime();
    const scoreB = b.upvotes * 3 + new Date(b.publishedAt).getTime();
    return scoreB - scoreA;
  });

  const topStories = sorted.slice(0, 6);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekRange = `${formatDate(weekAgo)} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const citations = topStories.map((story) => ({
    label: stripMarkdown(story.title),
    url: story.url,
    accessedAt: now.toISOString().split('T')[0],
  }));

  const issue: PremiumNewsletterIssue = {
    slug: 'weekly-newsletter',
    subject: `Rare Agent Work weekly brief — ${weekRange}`,
    preheader: 'Executive signal pack: implications, action steps, and risk watchlist.',
    weekRange,
    generatedAt: now.toISOString(),
    freshnessTimestamp: now.toISOString(),
    executiveSummary: stripMarkdown(buildExecutiveSummary(topStories, weekRange)),
    implications: buildImplications(topStories).map(stripMarkdown),
    actionSteps: buildActionSteps(topStories).map(stripMarkdown),
    risks: buildRisks(topStories).map(stripMarkdown),
    citations,
    stories: topStories.map((story) => ({
      title: stripMarkdown(story.title),
      summary: stripMarkdown(story.summary),
      url: story.url,
      source: stripMarkdown(story.source),
      publishedAt: story.publishedAt,
      upvotes: story.upvotes,
      category: stripMarkdown(story.category),
    })),
  };

  return issue;
}

export function renderPremiumNewsletterText(issue: PremiumNewsletterIssue) {
  const lines = [
    BRAND_NAME,
    issue.subject,
    issue.preheader,
    '',
    `Week: ${issue.weekRange}`,
    `Freshness timestamp: ${issue.freshnessTimestamp}`,
    '',
    'Executive summary:',
    issue.executiveSummary,
    '',
    'Implications:',
    ...issue.implications.map((item) => `- ${item}`),
    '',
    'Action steps:',
    ...issue.actionSteps.map((item) => `- ${item}`),
    '',
    'Risks:',
    ...issue.risks.map((item) => `- ${item}`),
    '',
    'Top stories:',
    ...issue.stories.map((story, idx) => `${idx + 1}. ${story.title} — ${story.source} (${story.url})`),
  ];

  return lines.join('\n');
}

export function renderPremiumNewsletterHtml(issue: PremiumNewsletterIssue) {
  const storyRows = issue.stories
    .map(
      (story, idx) => `
      <tr>
        <td style="padding:0 0 16px 0; color:#64748b; font-size:13px; vertical-align:top; width:30px;">${idx + 1}.</td>
        <td style="padding:0 0 16px 0; vertical-align:top;">
          <a href="${escapeHtml(story.url)}" style="font-size:15px; line-height:1.5; color:#f8fafc; text-decoration:none; font-weight:700;">${escapeHtml(story.title)}</a>
          <div style="font-size:13px; color:#94a3b8; margin-top:4px;">${escapeHtml(story.source)} · ${escapeHtml(formatDate(story.publishedAt))} · category: ${escapeHtml(story.category)}</div>
          <div style="font-size:14px; color:#cbd5e1; line-height:1.6; margin-top:6px;">${escapeHtml(story.summary)}</div>
        </td>
      </tr>
    `,
    )
    .join('');

  const citationRows = issue.citations
    .map(
      (citation) => `
      <li style="margin:0 0 10px 0; color:#c1c8d6; line-height:1.5;">
        <strong style="color:#ffffff;">${escapeHtml(citation.label)}</strong><br />
        <a href="${escapeHtml(citation.url)}" style="color:#8bd3ff; text-decoration:none;">${escapeHtml(citation.url)}</a><br />
        <span style="color:#7b8494; font-size:12px;">Accessed ${escapeHtml(citation.accessedAt || '')}</span>
      </li>
    `,
    )
    .join('');

  return `
  <div style="margin:0; padding:24px 0; background:#0b1020; font-family:Inter, Arial, sans-serif; color:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px; margin:0 auto; background:#101827; border:1px solid #1f2937; border-radius:20px; overflow:hidden;">
      <tr>
        <td style="padding:22px 28px; border-bottom:1px solid #1f2937; background:linear-gradient(135deg, #0f172a 0%, #111827 55%, #1d4ed8 130%);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align:middle; width:56px;">
                <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="56" height="56" style="display:block; border-radius:999px; border:1px solid rgba(255,255,255,0.14);" />
              </td>
              <td style="padding-left:16px; vertical-align:middle;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#93c5fd; font-weight:700;">Weekly operator newsletter</div>
                <div style="font-size:26px; font-weight:800; color:#ffffff; margin-top:6px;">${escapeHtml(issue.weekRange)}</div>
                <div style="font-size:14px; color:#cbd5e1; margin-top:6px;">${escapeHtml(issue.preheader)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Letterhead</div>
          <div style="font-size:18px; font-weight:700; color:#ffffff;">${BRAND_NAME}</div>
          <div style="font-size:14px; color:#94a3b8; margin-top:4px;">${BRAND_TAGLINE}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:0 28px 8px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1220; border:1px solid #1f2937; border-radius:16px;">
            <tr>
              <td style="padding:16px 18px; font-size:13px; color:#cbd5e1; line-height:1.7;">
                <strong style="color:#ffffff;">Week:</strong> ${escapeHtml(issue.weekRange)}<br />
                <strong style="color:#ffffff;">Generated:</strong> ${escapeHtml(issue.generatedAt)}<br />
                <strong style="color:#ffffff;">Freshness timestamp:</strong> ${escapeHtml(issue.freshnessTimestamp)}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Executive summary</div>
          <div style="font-size:16px; line-height:1.7; color:#dbe3ee;">${escapeHtml(issue.executiveSummary)}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Implications</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderList(issue.implications, '#38bdf8')}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Action steps</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderList(issue.actionSteps, '#60a5fa')}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Risks</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderList(issue.risks, '#fca5a5')}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Top stories</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${storyRows}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Evidence and citations</div>
          <ol style="padding-left:18px; margin:0;">${citationRows}</ol>
        </td>
      </tr>

      <tr>
        <td style="padding:26px 28px 32px 28px; text-align:center;">
          <a href="${SITE_URL}/news" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; font-weight:700; padding:14px 22px; border-radius:999px;">Open live news feed</a>
        </td>
      </tr>
    </table>
  </div>`;
}

export function getNewsletterReviewPayload(items: NewsItem[], now = new Date()): NewsletterPayload {
  const issue = buildPremiumNewsletterIssue(items, now);
  const html = renderPremiumNewsletterHtml(issue);
  const qaIssues = runPremiumQualityChecks({
    title: issue.subject,
    executiveSummary: issue.executiveSummary,
    implications: issue.implications,
    actionSteps: issue.actionSteps,
    risks: issue.risks,
    citations: issue.citations,
    freshnessTimestamp: issue.freshnessTimestamp,
    renderedHtml: html,
  });

  return {
    slug: issue.slug,
    subject: issue.subject,
    html,
    text: renderPremiumNewsletterText(issue),
    qaIssues,
  };
}
