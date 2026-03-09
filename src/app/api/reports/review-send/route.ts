import { NextRequest, NextResponse } from 'next/server';
import { getReviewSendPayload } from '@/lib/report-delivery';
import { getNewsletterReviewPayload } from '@/lib/newsletter-delivery';
import { getAllNews } from '@/lib/news-store';

export const runtime = 'nodejs';

const DESTINATION_EMAIL = 'michael.fethe@protelynx.ai';
const OWNER_EMAIL = 'michael.fethe@protelynx.ai';

async function isOwner(request: NextRequest) {
  const { createServerClient } = await import('@supabase/ssr');

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) cookies[k] = v.join('=');
  });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return false;
  }

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(cookies).map(([name, value]) => ({ name, value }));
        },
        setAll() {
          // read-only in route auth check
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  return user?.email?.toLowerCase() === OWNER_EMAIL;
}

export async function POST(request: NextRequest) {
  const owner = await isOwner(request);
  if (!owner) {
    return NextResponse.json({ error: 'Owner access only.' }, { status: 403 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 503 });
  }

  const from = process.env.CONSULTING_FROM_EMAIL || 'Rare Agent Work <hello@rareagent.work>';

  const reportPayloads = getReviewSendPayload();
  const newsItems = await getAllNews();
  const payloads = [...reportPayloads];

  if (newsItems.length > 0) {
    payloads.push(getNewsletterReviewPayload(newsItems));
  }

  const qaFailures = payloads
    .filter((payload) => payload.qaIssues.some((issue) => issue.severity === 'error'))
    .map((payload) => ({
      slug: payload.slug,
      issues: payload.qaIssues,
    }));

  if (qaFailures.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Premium quality gate failed. Emails were not sent.',
        qaFailures,
      },
      { status: 422 },
    );
  }

  const results: Array<{ slug: string; ok: boolean; details?: string }> = [];

  for (const payload of payloads) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [DESTINATION_EMAIL],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      results.push({ slug: payload.slug, ok: false, details });
      continue;
    }

    results.push({ slug: payload.slug, ok: true });
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    return NextResponse.json({ ok: false, sent: results.length - failed.length, failed }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: results.length, results });
}
