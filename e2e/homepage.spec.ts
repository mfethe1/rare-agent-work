import { test, expect } from '@playwright/test';

const reportRoutes = [
  '/reports/agent-setup-60',
  '/reports/single-to-multi-agent',
  '/reports/empirical-agent-architecture',
];

test.describe('Production smoke', () => {
  test('homepage loads without errors', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('homepage shows current hero and current offer structure', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Rare Agent Work');
    await expect(page.locator('body')).toContainText('Newsletter');
    await expect(page.locator('body')).toContainText('Operator Access');
    await expect(page.locator('body')).toContainText('$10/mo');
    await expect(page.locator('body')).toContainText('$49/mo');
  });

  test('top navigation points to stable routes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/news"]').first()).toBeVisible();
    await expect(page.locator('a[href="/digest"]').first()).toBeVisible();
    await expect(page.locator('a[href="/reports"]').first()).toBeVisible();
    await expect(page.locator('a[href="/pricing"]').first()).toBeVisible();
  });

  test('homepage body does not expose raw markdown/UI placeholders', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('(HTML)');
    expect(bodyText).not.toMatch(/\.(md|markdown)\b/i);
    expect(bodyText).not.toMatch(/Open Report \d+/i);
  });

  test('pricing page loads and shows canonical plans', async ({ page }) => {
    const response = await page.goto('/pricing');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toContainText('Newsletter');
    await expect(page.locator('body')).toContainText('Operator Access');
  });

  test('news and digest pages load', async ({ page }) => {
    for (const route of ['/news', '/digest']) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
    }
  });

  test('report index page loads', async ({ page }) => {
    const response = await page.goto('/reports');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toContainText('Report');
  });

  test('report preview routes load without 404s', async ({ page }) => {
    for (const route of reportRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
    }
  });

  test('auth login page loads', async ({ page }) => {
    const response = await page.goto('/auth/login');
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toContainText('Rare Agent Work');
  });

  test('core public APIs respond successfully', async ({ request }) => {
    for (const route of ['/api/v1/models', '/api/v1/reports', '/api/v1/news']) {
      const response = await request.get(route);
      expect(response.status(), route).toBeLessThan(400);
    }
  });
});
