import { describe, expect, it } from 'vitest';
import {
  stripMarkdown,
  hasMarkdownArtifacts,
  runPremiumQualityChecks,
} from '@/lib/premium-content';

describe('premium-content helpers', () => {
  it('strips common markdown syntax', () => {
    const input = '## Heading\n**Bold** and `code` with [link](https://example.com)';
    const output = stripMarkdown(input);

    expect(output).toContain('Heading');
    expect(output).toContain('Bold');
    expect(output).toContain('code');
    expect(output).toContain('link (https://example.com)');
    expect(output).not.toContain('**');
    expect(output).not.toContain('`code`');
  });

  it('detects markdown artifacts', () => {
    expect(hasMarkdownArtifacts('**bold** text')).toBe(true);
    expect(hasMarkdownArtifacts('Normal prose only.')).toBe(false);
  });

  it('flags anti-generic and markdown quality failures', () => {
    const issues = runPremiumQualityChecks({
      title: 'Test',
      executiveSummary: 'In today\'s rapidly evolving landscape, this comprehensive report is a game changer.',
      implications: ['**Generic implication**'],
      actionSteps: ['TBD'],
      risks: ['placeholder risk'],
      citations: [{ label: 'Only one citation', url: 'https://example.com', accessedAt: '2026-03-09' }],
      freshnessTimestamp: 'invalid-date',
      renderedHtml: '<p>**markdown**</p>',
    });

    const rules = issues.map((i) => i.rule);
    expect(rules).toContain('anti-generic-language');
    expect(rules).toContain('markdown-artifacts-html');
    expect(rules).toContain('placeholder-content');
    expect(rules).toContain('freshness-required');
    expect(rules).toContain('citations-required');
  });
});
