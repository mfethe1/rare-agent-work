import { describe, it, expect } from 'vitest';
import { getReport, getAllReports, reports } from '@/lib/reports';

describe('getReport()', () => {
  it('returns the correct report for a valid slug', () => {
    const report = getReport('agent-setup-60');
    expect(report).not.toBeNull();
    expect(report?.slug).toBe('agent-setup-60');
    expect(report?.title).toBe('Agent Setup in 60 Minutes');
  });

  it('returns null for an unknown slug', () => {
    expect(getReport('nonexistent-report')).toBeNull();
  });

  it('returns report with all required fields', () => {
    const report = getReport('single-to-multi-agent');
    expect(report).toMatchObject({
      slug: expect.any(String),
      planKey: expect.any(String),
      title: expect.any(String),
      subtitle: expect.any(String),
      price: expect.any(String),
      priceLabel: expect.any(String),
      audience: expect.any(String),
      edition: expect.any(String),
      revision: expect.any(String),
      updatedAt: expect.any(String),
      freshnessTimestamp: expect.any(String),
      executiveSummary: expect.any(String),
      implications: expect.any(Array),
      actionSteps: expect.any(Array),
      risks: expect.any(Array),
      citations: expect.any(Array),
      deliverables: expect.any(Array),
      excerpt: expect.any(Array),
      color: expect.any(String),
    });
  });

  it('returns empirical report with correct price', () => {
    const report = getReport('empirical-agent-architecture');
    expect(report?.price).toBe('$299');
  });
});

describe('getAllReports()', () => {
  it('returns an array of reports', () => {
    const all = getAllReports();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('returns exactly 4 reports', () => {
    const all = getAllReports();
    expect(all).toHaveLength(4);
  });

  it('returns all known report slugs', () => {
    const slugs = getAllReports().map((r) => r.slug);
    expect(slugs).toContain('agent-setup-60');
    expect(slugs).toContain('single-to-multi-agent');
    expect(slugs).toContain('empirical-agent-architecture');
    expect(slugs).toContain('mcp-security');
  });

  it('does not include any "(HTML)" text in titles', () => {
    const all = getAllReports();
    for (const report of all) {
      expect(report.title).not.toContain('(HTML)');
      expect(report.subtitle).not.toContain('(HTML)');
    }
  });
});

describe('planKey mapping', () => {
  it('each report has a unique planKey', () => {
    const planKeys = Object.values(reports).map((r) => r.planKey);
    const unique = new Set(planKeys);
    expect(unique.size).toBe(planKeys.length);
  });

  it('planKeys match expected values', () => {
    expect(reports['agent-setup-60'].planKey).toBe('report_60');
    expect(reports['single-to-multi-agent'].planKey).toBe('report_multi');
    expect(reports['empirical-agent-architecture'].planKey).toBe('report_empirical');
    expect(reports['mcp-security'].planKey).toBe('report_mcp');
  });

  it('each report has deliverables with icon and title', () => {
    for (const report of getAllReports()) {
      for (const d of report.deliverables) {
        expect(d.icon).toBeTruthy();
        expect(d.title).toBeTruthy();
      }
    }
  });

  it('each report has implications, citations, action steps, and risks for premium review delivery', () => {
    for (const report of getAllReports()) {
      expect(report.implications.length).toBeGreaterThan(0);
      expect(report.citations.length).toBeGreaterThan(0);
      expect(report.actionSteps.length).toBeGreaterThan(0);
      expect(report.risks.length).toBeGreaterThan(0);
      expect(report.revision).toMatch(/^Rev\s/);
      expect(report.edition.toLowerCase()).not.toContain('mckinsey-style');
    }
  });
});
