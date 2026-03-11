import { NextResponse } from 'next/server';
import { getAllNews, getNewsSummary } from '@/lib/news-store';
import { getNewsFreshnessSnapshot } from '@/lib/news-helpers';

const MAX_FEED_AGE_HOURS = 6;
const MAX_SUMMARY_AGE_HOURS = 6;

function getAgeHours(date?: string): number | null {
  if (!date) return null;
  return (Date.now() - new Date(date).getTime()) / 3600000;
}

export async function GET() {
  const items = await getAllNews();
  const summary = await getNewsSummary();
  const freshness = getNewsFreshnessSnapshot(
    items.map((item) => item.publishedAt),
    MAX_FEED_AGE_HOURS,
  );
  const summaryAgeHours = getAgeHours(summary?.updatedAt);
  const summaryStale = summaryAgeHours === null || summaryAgeHours > MAX_SUMMARY_AGE_HOURS;

  const status = freshness.stale || summaryStale ? 'stale' : 'ok';

  return NextResponse.json(
    {
      status,
      checks: {
        stories_total: freshness.totalItems,
        stories_last_24h: freshness.hotItems,
        latest_story_published_at: freshness.latestPublishedAt ?? null,
        latest_story_age_hours: getAgeHours(freshness.latestPublishedAt),
        summary_updated_at: summary?.updatedAt ?? null,
        summary_age_hours: summaryAgeHours,
        feed_stale: freshness.stale,
        summary_stale: summaryStale,
      },
      thresholds: {
        max_feed_age_hours: MAX_FEED_AGE_HOURS,
        max_summary_age_hours: MAX_SUMMARY_AGE_HOURS,
      },
      updated_at: new Date().toISOString(),
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
