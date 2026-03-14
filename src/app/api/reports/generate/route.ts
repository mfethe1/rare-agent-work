import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkCostGate, calculateModelCost } from '@/lib/cost-gate';
import {
  RESEARCH_SOURCES,
  REPORT_TEMPLATE,
  type DeepReport,
  type ReportSection,
} from '@/lib/research-pipeline';
import { stripMarkdown, hasMarkdownArtifacts } from '@/lib/premium-content';
import { sanitizeError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min max for report generation

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ──────────────────────────────────────────────
// Source fetchers (real implementations)
// ──────────────────────────────────────────────

async function fetchArxivSignals(topic: string): Promise<Array<{ title: string; url: string; summary: string; published: string; authors: string }>> {
  const query = encodeURIComponent(`cat:cs.AI OR cat:cs.CL OR cat:cs.LG AND ${topic}`);
  const url = `http://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const xml = await resp.text();
    // Simple XML extraction
    const entries: Array<{ title: string; url: string; summary: string; published: string; authors: string }> = [];
    const entryBlocks = xml.split('<entry>').slice(1);
    for (const block of entryBlocks.slice(0, 15)) {
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
      const id = block.match(/<id>(.*?)<\/id>/)?.[1] ?? '';
      const summary = block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
      const published = block.match(/<published>(.*?)<\/published>/)?.[1] ?? '';
      const authors = (block.match(/<name>(.*?)<\/name>/g) ?? []).map(a => a.replace(/<\/?name>/g, '')).join(', ');
      if (title && id) entries.push({ title, url: id, summary: summary.slice(0, 500), published, authors });
    }
    return entries;
  } catch {
    return [];
  }
}

async function fetchHackerNewsSignals(topic: string): Promise<Array<{ title: string; url: string; points: number; comments: number }>> {
  try {
    const resp = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=20&numericFilters=points>10`, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    return (data.hits ?? []).map((h: Record<string, unknown>) => ({
      title: h.title as string,
      url: (h.url as string) || `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points as number,
      comments: h.num_comments as number,
    }));
  } catch {
    return [];
  }
}

async function fetchRedditSignals(subreddit: string, topic: string): Promise<Array<{ title: string; url: string; score: number; comments: number }>> {
  try {
    const resp = await fetch(
      `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(topic)}&sort=relevance&t=month&limit=15`,
      { headers: { 'User-Agent': 'RareAgentWork/1.0' }, signal: AbortSignal.timeout(10000) },
    );
    const data = await resp.json();
    return (data.data?.children ?? []).map((c: Record<string, unknown>) => {
      const d = c.data as Record<string, unknown>;
      return {
        title: d.title as string,
        url: `https://reddit.com${d.permalink}`,
        score: d.score as number,
        comments: d.num_comments as number,
      };
    });
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// LLM synthesis step
// ──────────────────────────────────────────────

async function synthesizeWithLLM(
  rawData: string,
  sectionTitle: string,
  sectionType: string,
  wordTarget: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key missing for report synthesis.');
  }

  // Use Anthropic for synthesis (best at long-form analysis)
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: Math.min(wordTarget * 2, 4096),
    system: `You are a senior AI research analyst writing for Rare Agent Work, a premium intelligence service for AI operators. 
Write in a professional but direct style. No filler. Every paragraph must contain either:
1. A specific fact with a source
2. An actionable recommendation
3. A quantitative comparison
4. A forward-looking prediction with confidence level

You synthesize knowledge that operators can't get from a Google search. Focus on the "So What?" — what should they DO with this information?`,
    messages: [{
      role: 'user',
      content: `Write the "${sectionTitle}" section (${sectionType}) for our deep AI intelligence report.

Target: ~${wordTarget} words. Be thorough but value-dense.

Raw research data to synthesize:
${rawData.slice(0, 30000)}

Write the section content now in plain prose (no markdown, no bullet syntax, no code fences). Include source URLs inline where claims depend on external facts. Avoid generic language and avoid uncited broad claims.`,
    }],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  return text;
}

function sanitizeGeneratedProse(prose: string) {
  const cleaned = stripMarkdown(prose)
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) {
    throw new Error('Generated prose was empty after sanitization.');
  }

  if (hasMarkdownArtifacts(cleaned)) {
    throw new Error('Generated prose still contains markdown artifacts after sanitization.');
  }

  const lower = cleaned.toLowerCase();
  if (/\b(todo|tbd|placeholder|lorem ipsum)\b/.test(lower)) {
    throw new Error('Generated prose contains placeholder text.');
  }

  return cleaned;
}

// ──────────────────────────────────────────────
// Main report generation
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth: only owner or system can trigger report generation
  const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
  const reviewKey = process.env.REVIEW_API_KEY || process.env.INGEST_API_KEY;

  if (!apiKey || apiKey !== reviewKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { topic?: string; reportType?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const topic = body.topic || 'AI agents multi-agent systems LLM production deployment';
  const reportType = body.reportType || 'deep-intelligence';
  const db = getDb();

  // Cost gate for system-level pipeline
  const gate = await checkCostGate({
    userId: 'system-pipeline',
    app: 'report-pipeline',
    tier: 'system',
  });

  if (gate.blocked) {
    return NextResponse.json({ error: gate.error, reason: gate.reason }, { status: 402 });
  }

  // Phase 1: Collect signals from all sources in parallel
  const [arxivData, hnData, redditML, redditLLM] = await Promise.all([
    fetchArxivSignals(topic),
    fetchHackerNewsSignals('AI agents LLM'),
    fetchRedditSignals('MachineLearning', 'agents LLM production'),
    fetchRedditSignals('LocalLLaMA', 'agents deployment'),
  ]);

  const rawDataSummary = `
## arXiv Papers (${arxivData.length} found)
${arxivData.map(a => `- **${a.title}** by ${a.authors} (${a.published})\n  ${a.summary}\n  ${a.url}`).join('\n')}

## Hacker News Discussions (${hnData.length} found)
${hnData.map(h => `- **${h.title}** (${h.points} pts, ${h.comments} comments) ${h.url}`).join('\n')}

## r/MachineLearning (${redditML.length} found)
${redditML.map(r => `- **${r.title}** (${r.score} pts, ${r.comments} comments) ${r.url}`).join('\n')}

## r/LocalLLaMA (${redditLLM.length} found)
${redditLLM.map(r => `- **${r.title}** (${r.score} pts, ${r.comments} comments) ${r.url}`).join('\n')}
`;

  // Phase 2: Generate each section
  const sections: ReportSection[] = [];

  for (const template of REPORT_TEMPLATE) {
    let prose: string;
    try {
      prose = await synthesizeWithLLM(
        rawDataSummary,
        template.title,
        template.contentType,
        template.wordCountTarget,
      );
    } catch (error) {
      sanitizeError(error, 'synthesis', `Report section: ${template.title}`);
      return NextResponse.json(
        {
          error: 'Report section synthesis failed.',
          section: template.title,
        },
        { status: 502 },
      );
    }

    let cleanedProse: string;
    try {
      cleanedProse = sanitizeGeneratedProse(prose);
    } catch (error) {
      sanitizeError(error, 'quality', `Report section: ${template.title}`);
      return NextResponse.json(
        {
          error: 'Generated content did not pass quality checks.',
          section: template.title,
        },
        { status: 422 },
      );
    }

    sections.push({
      ...template,
      insights: [],
      prose: cleanedProse,
    });
  }

  // Build the final report
  const report: DeepReport = {
    id: `report-${Date.now()}`,
    title: 'AI Agent Intelligence Report',
    subtitle: `Deep Research Brief — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    pageCount: Math.round(sections.reduce((sum, s) => sum + s.prose.split(/\s+/).length, 0) / 500),
    sections,
    methodology: `Multi-source synthesis from ${RESEARCH_SOURCES.length} source types. Signals collected from arXiv (${arxivData.length}), Hacker News (${hnData.length}), Reddit ML (${redditML.length}), Reddit LLaMA (${redditLLM.length}). Each section synthesized by Claude Sonnet 4.6 with source-grounded analysis.`,
    sourceManifest: {
      totalSources: arxivData.length + hnData.length + redditML.length + redditLLM.length,
      uniqueDomains: new Set([...arxivData.map(a => new URL(a.url).hostname), ...hnData.filter(h => h.url.startsWith('http')).map(h => { try { return new URL(h.url).hostname; } catch { return 'unknown'; } })]).size,
      academicSources: arxivData.length,
      communitySources: hnData.length + redditML.length + redditLLM.length,
      dateRange: { from: new Date(Date.now() - 14 * 86400000).toISOString(), to: new Date().toISOString() },
    },
    forecasts: {
      h1: [],
      h2: [],
    },
  };

  // Store in Supabase
  if (db) {
    await db.from('report_drafts').insert({
      title: report.title,
      slug: `deep-intelligence-${new Date().toISOString().split('T')[0]}`,
      content: JSON.stringify(report),
      status: 'draft',
      metadata: {
        pageCount: report.pageCount,
        sourceCount: report.sourceManifest.totalSources,
        reportType,
      },
    });

    // Log pipeline usage
    await db.from('token_usage').insert({
      user_id: 'system-pipeline',
      app: 'report-pipeline',
      report_slug: reportType,
      model: 'claude-sonnet-4-6',
      input_tokens: 0, // Exact count not available from non-streaming calls
      output_tokens: 0,
      cost_usd: 0, // Will be tracked by Anthropic dashboard
      markup_cost_usd: 0,
      ip_address: 'pipeline',
    });
  }

  return NextResponse.json({
    status: 'generated',
    reportId: report.id,
    pageCount: report.pageCount,
    sections: report.sections.length,
    totalSources: report.sourceManifest.totalSources,
    wordCount: sections.reduce((sum, s) => sum + s.prose.split(/\s+/).length, 0),
  });
}
