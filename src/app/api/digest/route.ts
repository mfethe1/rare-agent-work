import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getAllNews } from '@/lib/news-store';
import { buildPremiumNewsletterIssue } from '@/lib/newsletter-delivery';

export const runtime = 'nodejs';
export const revalidate = 3600;

async function readLatestDigest() {
  const digestPath = path.join(process.cwd(), 'data', 'digests', 'latest.json');
  const raw = await readFile(digestPath, 'utf8');
  return JSON.parse(raw);
}

export async function GET() {
  try {
    const digest = await readLatestDigest();
    return NextResponse.json(digest, {
      headers: {
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    const items = await getAllNews();
    const issue = buildPremiumNewsletterIssue(items);

    const stories = issue.stories.map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source,
      summary: item.summary,
      category: item.category,
      publishedAt: item.publishedAt,
      upvotes: item.upvotes,
    }));

    const categories = stories.reduce<Record<string, typeof stories>>((acc, story) => {
      const key = story.category || 'uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(story);
      return acc;
    }, {});

    return NextResponse.json(
      {
        week: issue.weekRange,
        freshnessTimestamp: issue.freshnessTimestamp,
        summary: issue.executiveSummary,
        executiveSummary: issue.executiveSummary,
        implications: issue.implications,
        actionSteps: issue.actionSteps,
        risks: issue.risks,
        storyCount: stories.length,
        stories,
        citations: issue.citations,
        categories: Object.fromEntries(
          Object.entries(categories).map(([cat, catItems]) => [
            cat,
            catItems.map((i) => ({ title: i.title, url: i.url, source: i.source })),
          ]),
        ),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  const expectedKey = process.env.DIGEST_API_KEY || process.env.INGEST_API_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: 'DIGEST_API_KEY or INGEST_API_KEY not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { windowHours?: number; send?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body
  }

  const { spawn } = await import('child_process');
  const args = ['scripts/run-daily-ai-news.mjs', '--window-hours', String(body.windowHours || 24)];
  if (body.send) args.push('--send');

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode: number = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    return NextResponse.json({ error: 'Digest pipeline failed', details: stderr || stdout }, { status: 500 });
  }

  return NextResponse.json(JSON.parse(stdout));
}
