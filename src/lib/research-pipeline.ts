/**
 * Multi-source research pipeline for synthesizing genuinely valuable AI intelligence.
 *
 * Architecture:
 * 1. Source Collection: Pull from multiple sources (arXiv, HN, Reddit, Twitter, YouTube, blogs)
 * 2. Deduplication: Suppress echo-chamber content (same story from 10 blogs = 1 insight)
 * 3. Signal Extraction: Pull out the "So What?" — operator impact, not just news
 * 4. Synthesis: Cross-reference signals across sources into actionable intelligence
 * 5. Forecasting: H1 (2-week) and H2 (2-month) predictions with confidence scores
 *
 * The key principle: synthesize knowledge people can't get from a Google search.
 * We combine signals from multiple sources into insights that require judgment.
 */

export interface ResearchSource {
  id: string;
  name: string;
  type: 'academic' | 'community' | 'social' | 'video' | 'blog' | 'official';
  credibilityScore: number; // 0-1
  fetchFn: string;          // function name to call
}

export interface RawSignal {
  sourceId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string;
  author?: string;
  metadata?: Record<string, unknown>;
}

export interface SynthesizedInsight {
  id: string;
  title: string;
  summary: string;                    // 2-3 sentence executive summary
  soWhat: string;                     // Operator impact statement
  sources: string[];                  // URLs backing this insight
  sourceCount: number;                // How many independent sources corroborate
  credibilityScore: number;           // Weighted average of source credibility
  operatorUrgency: 'critical' | 'high' | 'medium' | 'low';
  budgetImplication: string;          // Cost/savings estimate if applicable
  implementationReadiness: 'ready' | 'beta' | 'experimental' | 'research';
  tags: string[];
  forecast?: {
    h1: { prediction: string; confidence: number; horizon: '2-week' };
    h2: { prediction: string; confidence: number; horizon: '2-month' };
  };
}

export interface ReportSection {
  sectionNumber: number;
  title: string;
  contentType: 'executive-brief' | 'signal-map' | 'deep-dive' | 'case-study' |
               'comparison' | 'forecast' | 'implementation' | 'risk' | 'appendix';
  wordCountTarget: number;
  insights: SynthesizedInsight[];
  prose: string;
}

export interface DeepReport {
  id: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  version: string;
  pageCount: number;
  sections: ReportSection[];
  methodology: string;
  sourceManifest: {
    totalSources: number;
    uniqueDomains: number;
    academicSources: number;
    communitySources: number;
    dateRange: { from: string; to: string };
  };
  forecasts: {
    h1: Array<{ prediction: string; confidence: number; category: string }>;
    h2: Array<{ prediction: string; confidence: number; category: string }>;
  };
}

// ──────────────────────────────────────────────
// Source registry
// ──────────────────────────────────────────────

export const RESEARCH_SOURCES: ResearchSource[] = [
  { id: 'arxiv',      name: 'arXiv',              type: 'academic',   credibilityScore: 0.95, fetchFn: 'fetchArxiv' },
  { id: 'hn',         name: 'Hacker News',         type: 'community',  credibilityScore: 0.75, fetchFn: 'fetchHackerNews' },
  { id: 'reddit-ml',  name: 'r/MachineLearning',   type: 'community',  credibilityScore: 0.70, fetchFn: 'fetchRedditML' },
  { id: 'reddit-llm', name: 'r/LocalLLaMA',        type: 'community',  credibilityScore: 0.65, fetchFn: 'fetchRedditLLM' },
  { id: 'twitter-ai', name: 'AI Twitter/X',         type: 'social',     credibilityScore: 0.60, fetchFn: 'fetchTwitterAI' },
  { id: 'youtube-ai', name: 'AI YouTube',           type: 'video',      credibilityScore: 0.55, fetchFn: 'fetchYouTubeAI' },
  { id: 'openai-blog', name: 'OpenAI Blog',         type: 'official',   credibilityScore: 0.90, fetchFn: 'fetchOfficialBlog' },
  { id: 'anthropic-blog', name: 'Anthropic Blog',   type: 'official',   credibilityScore: 0.90, fetchFn: 'fetchOfficialBlog' },
  { id: 'google-ai',  name: 'Google AI Blog',       type: 'official',   credibilityScore: 0.90, fetchFn: 'fetchOfficialBlog' },
  { id: 'tech-blogs', name: 'Tech Blogs (aggregate)', type: 'blog',    credibilityScore: 0.50, fetchFn: 'fetchTechBlogs' },
];

// ──────────────────────────────────────────────
// Report template: 10-section format
// ──────────────────────────────────────────────

export const REPORT_TEMPLATE: Omit<ReportSection, 'insights' | 'prose'>[] = [
  { sectionNumber: 1,  title: 'Executive Brief',                    contentType: 'executive-brief', wordCountTarget: 1500 },
  { sectionNumber: 2,  title: 'Signal Map: What Changed This Period', contentType: 'signal-map',    wordCountTarget: 3000 },
  { sectionNumber: 3,  title: 'Research Frontiers',                  contentType: 'deep-dive',      wordCountTarget: 5000 },
  { sectionNumber: 4,  title: 'Operator Impact Analysis',           contentType: 'deep-dive',      wordCountTarget: 5000 },
  { sectionNumber: 5,  title: 'Model & Tool Comparison',            contentType: 'comparison',      wordCountTarget: 4000 },
  { sectionNumber: 6,  title: 'Case Studies: What Worked / Failed', contentType: 'case-study',      wordCountTarget: 4000 },
  { sectionNumber: 7,  title: 'Implementation Playbook',            contentType: 'implementation',  wordCountTarget: 4000 },
  { sectionNumber: 8,  title: 'Risk & Governance Watch',            contentType: 'risk',            wordCountTarget: 3000 },
  { sectionNumber: 9,  title: 'Forecasts: 2-Week & 2-Month Horizons', contentType: 'forecast',     wordCountTarget: 3000 },
  { sectionNumber: 10, title: 'Appendix: Sources, Methodology, Data', contentType: 'appendix',     wordCountTarget: 2500 },
];

// Total target: ~35,000 words ≈ 70 pages at 500 words/page

// ──────────────────────────────────────────────
// Value filters — what makes knowledge worth paying for
// ──────────────────────────────────────────────

export interface ValueCriteria {
  /** Is this insight actionable (can an operator do something with it)? */
  actionable: boolean;
  /** Does it require synthesis across multiple sources (not just one blog post)? */
  multiSourceCorroboration: boolean;
  /** Would a competent operator NOT find this in 10 minutes of Googling? */
  beyondGoogleable: boolean;
  /** Does it have a clear time dimension (urgency, window of opportunity)? */
  timeSensitive: boolean;
  /** Does it include quantitative data or benchmarks? */
  hasQuantitativeEvidence: boolean;
  /** Score 0-1: estimated value to a paying subscriber */
  valueScore: number;
}

/**
 * Score whether an insight meets our value bar.
 * We reject insights that are freely available commodity knowledge.
 */
export function scoreInsightValue(insight: SynthesizedInsight): ValueCriteria {
  const actionable = insight.operatorUrgency !== 'low' && insight.implementationReadiness !== 'research';
  const multiSource = insight.sourceCount >= 2;
  const beyondGoogle = insight.soWhat.length > 50 && insight.sourceCount >= 3;
  const timeSensitive = insight.operatorUrgency === 'critical' || insight.operatorUrgency === 'high';
  const hasQuant = /\d+%|\$\d|\d+x|benchmark|performance|latency|throughput/i.test(insight.summary + ' ' + insight.soWhat);

  let score = 0;
  if (actionable) score += 0.25;
  if (multiSource) score += 0.20;
  if (beyondGoogle) score += 0.25;
  if (timeSensitive) score += 0.15;
  if (hasQuant) score += 0.15;

  return {
    actionable,
    multiSourceCorroboration: multiSource,
    beyondGoogleable: beyondGoogle,
    timeSensitive,
    hasQuantitativeEvidence: hasQuant,
    valueScore: Math.round(score * 100) / 100,
  };
}

/**
 * Filter insights to only those worth including in a paid report.
 * Minimum value score: 0.45 (must be at least actionable + one other criterion)
 */
export function filterForPaidValue(insights: SynthesizedInsight[]): SynthesizedInsight[] {
  return insights
    .map(i => ({ insight: i, value: scoreInsightValue(i) }))
    .filter(({ value }) => value.valueScore >= 0.45)
    .sort((a, b) => b.value.valueScore - a.value.valueScore)
    .map(({ insight }) => insight);
}
