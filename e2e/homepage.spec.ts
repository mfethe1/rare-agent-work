import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads without errors', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('shows correct headline text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Operator-Grade AI Research');
  });

  test('no "(HTML)" text visible to users', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('(HTML)');
  });

  test('no ".md" file extensions visible to users', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    // Should not show raw markdown file extensions to users
    expect(bodyText).not.toMatch(/\.(md|markdown)\b/i);
  });

  test('report preview links work (no 404)', async ({ page }) => {
    await page.goto('/');
    // Collect all report preview links
    const links = await page.locator('a[href^="/reports/"]').all();
    expect(links.length).toBeGreaterThan(0);

    for (const link of links.slice(0, 3)) {
      const href = await link.getAttribute('href');
      if (href) {
        const res = await page.goto(href);
        expect(res?.status()).toBeLessThan(400);
        await page.goBack();
      }
    }
  });

  test('value prop section has no raw button labels', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toMatch(/Open Report \d+/i);
  });

  test('sign in link is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/auth/login"]').first()).toBeVisible();
  });

  test('free tier card shows correct features', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText('1 rotating report every 2 weeks');
    await expect(page.locator('body')).toContainText('No signup required for previews');
  });

  test('paid tier card shows AI guide', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText('AI Implementation Guide');
  });

  test('login page loads', async ({ page }) => {
    const res = await page.goto('/auth/login');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toContainText('Rare Agent Work');
  });
});
