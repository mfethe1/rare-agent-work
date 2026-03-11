import { test, expect } from '@playwright/test';

test.describe('Production SEO & Discoverability checks', () => {
  const baseURL = 'https://rareagent.work';

  test('Homepage has correct H1 and no generic RareAgent collision', async ({ page }) => {
    await page.goto(baseURL);
    
    // Check H1 is properly formatted
    const h1 = page.locator('h1');
    await expect(h1).toContainText(/Rare Agent Work/i);
    
    // Check for the old typo/collision
    const pageText = await page.evaluate(() => document.body.innerText);
    expect(pageText).not.toContain('therare agents');
    expect(pageText).not.toContain('RareAgent.work');
  });

  test('Robots.txt explicitly disallows low value routes', async ({ request }) => {
    const response = await request.get(`${baseURL}/robots.txt`);
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    
    // Make sure we are disallowing /ask to save crawl budget
    expect(text).toContain('Disallow: /ask');
  });

  test('Sitemap.xml is clean of noise', async ({ request }) => {
    const response = await request.get(`${baseURL}/sitemap.xml`);
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    
    // Should NOT contain the low value routes
    expect(text).not.toContain('/ask');
    expect(text).not.toContain('/llms-full.txt');
    
    // Should contain core routes
    expect(text).toContain('/pricing');
    expect(text).toContain('/reports');
    expect(text).toContain('/news');
  });

  test('News route has structured CollectionPage schema data', async ({ request }) => {
    const response = await request.get(`${baseURL}/news`);
    const text = await response.text();
    expect(text).toContain('CollectionPage');
  });
});
