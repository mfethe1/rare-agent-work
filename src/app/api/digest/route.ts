import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

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
    return NextResponse.json(
      {
        error: 'Digest artifact not generated yet.',
        hint: 'Run `npm run digest:daily` (or `npm run digest:daily -- --send`) to create the daily digest artifact.',
      },
      { status: 404 },
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
