import { describe, expect, it } from 'vitest';
import { getReviewSendPayload } from '@/lib/report-delivery';
import { getNewsletterReviewPayload } from '@/lib/newsletter-delivery';
import type { NewsItem } from '@/lib/news-store';

const sampleNews: NewsItem[] = [
  {
    id: 'n1',
    title: 'Model release with stronger tool-use benchmark results',
    summary: 'Vendor announced a new model with measurable gains on tool-use reliability.',
    url: 'https://example.com/model-release',
    source: 'Example Source',
    category: 'model-release',
    tags: ['model', 'benchmark', 'tool-use'],
    publishedAt: '2026-03-08T12:00:00Z',
    upvotes: 12,
    clicks: 4,
    createdAt: '2026-03-08T12:30:00Z',
  },
  {
    id: 'n2',
    title: 'Security incident postmortem for agent automation stack',
    summary: 'A production incident highlighted missing approval gates in autonomous actions.',
    url: 'https://example.com/security-postmortem',
    source: 'Infra Journal',
    category: 'security',
    tags: ['security', 'governance'],
    publishedAt: '2026-03-07T09:00:00Z',
    upvotes: 8,
    clicks: 2,
    createdAt: '2026-03-07T09:30:00Z',
  },
  {
    id: 'n3',
    title: 'Open-source framework adds multi-agent audit logs',
    summary: 'Framework maintainers shipped traceability hooks aimed at regulated teams.',
    url: 'https://example.com/framework-update',
    source: 'Open Agents Weekly',
    category: 'framework-release',
    tags: ['framework', 'audit', 'open-source'],
    publishedAt: '2026-03-06T08:00:00Z',
    upvotes: 5,
    clicks: 1,
    createdAt: '2026-03-06T08:15:00Z',
  },
];

describe('report delivery payloads', () => {
  it('includes premium sections and passes qa checks', () => {
    const payloads = getReviewSendPayload();
    expect(payloads.length).toBeGreaterThan(0);

    for (const payload of payloads) {
      expect(payload.html).toContain('Executive summary');
      expect(payload.html).toContain('Implications');
      expect(payload.html).toContain('Action steps');
      expect(payload.html).toContain('Risks / failure modes');
      expect(payload.html).toContain('Evidence and citations');
      expect(payload.html).not.toContain('**');
      expect(payload.qaIssues.filter((i) => i.severity === 'error')).toHaveLength(0);
    }
  });
});

describe('newsletter delivery payload', () => {
  it('renders branded newsletter html with citations and no markdown artifacts', () => {
    const payload = getNewsletterReviewPayload(sampleNews, new Date('2026-03-09T18:00:00Z'));

    expect(payload.slug).toBe('weekly-newsletter');
    expect(payload.html).toContain('Weekly operator newsletter');
    expect(payload.html).toContain('Executive summary');
    expect(payload.html).toContain('Implications');
    expect(payload.html).toContain('Action steps');
    expect(payload.html).toContain('Risks');
    expect(payload.html).toContain('Evidence and citations');
    expect(payload.html).not.toContain('```');
    expect(payload.html).not.toContain('**');
    expect(payload.qaIssues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});
