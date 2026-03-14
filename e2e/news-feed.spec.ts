import { test, expect } from '@playwright/test';

test.describe('News feed integrity', () => {
  test('public health endpoint reports fresh feed and summary', async ({ request }) => {
    const response = await request.get('/api/v1/news/health');
    expect(response.status()).toBeLessThan(400);

    const json = await response.json();
    expect(json.status).toBe('ok');
    expect(json.checks.stories_total).toBeGreaterThan(0);
    expect(json.checks.feed_stale).toBe(false);
    expect(json.checks.summary_stale).toBe(false);
  });

  test('mobile news page renders the live story count, not just a teaser slice', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const apiResponse = await request.get('/api/v1/news');
    expect(apiResponse.status()).toBeLessThan(400);
    const apiJson = await apiResponse.json();
    const expectedVisibleStories = Math.min(apiJson.count, 10);

    await page.goto('/news');

    await expect(page.getByTestId('news-total-count')).toContainText(String(apiJson.count));
    await expect(page.getByTestId('news-feed-freshness')).not.toContainText('feed needs refresh');

    const visibleCards = await page.getByTestId('news-story-card').count();
    expect(visibleCards).toBeGreaterThanOrEqual(expectedVisibleStories);
  });
});
