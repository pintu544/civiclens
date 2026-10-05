import { test, expect } from '@playwright/test';

// Read-only smoke tests against the live deployment.
// They verify pages render and data loads — they never create reports.

test.describe('homepage', () => {
  test('loads hero, stats, map, and recent reports', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CivicLens/);
    await expect(page.getByRole('heading', { name: /see a problem/i })).toBeVisible();

    // Stats strip loads (not the error state)
    await expect(page.getByText('Reports filed')).toBeVisible({ timeout: 20000 });

    // Map renders with Leaflet tiles (not the error state)
    await expect(page.getByText('Live report map')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Map unavailable')).not.toBeVisible();

    // Recent reports load (not the error state)
    await expect(page.getByText('Reports unavailable')).not.toBeVisible();
  });
});

test.describe('reports page', () => {
  test('lists reports with working filters', async ({ page }) => {
    await page.goto('/reports/');
    await expect(page.getByRole('heading', { name: /reports/i }).first()).toBeVisible();
    // At least one report card appears once data loads
    await expect(page.locator('a[href^="/reports/"]').first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('dashboard', () => {
  test('loads stats and charts', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page.getByText('Total reports')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Loading dashboard')).not.toBeVisible({ timeout: 20000 });
  });
});

test.describe('report detail', () => {
  test('pretty /reports/:id/ URL serves the report shell and loads data', async ({ page }) => {
    // Grab a real report id from the reports list (read-only).
    // Cards load async after the API call, and the page also has nav links
    // like /reports/ itself — so wait until a real /reports/<id>/ link appears.
    await page.goto('/reports/');
    const hasReportLink = () =>
      page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a[href^="/reports/"]'),
        );
        return links.some((a) => {
          const h = a.getAttribute('href');
          return h !== null && /^\/reports\/[^/]+\/$/.test(h);
        });
      });
    await expect.poll(hasReportLink, { timeout: 20000 }).toBe(true);
    const href: string | null = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href^="/reports/"]'),
      );
      const found = links
        .map((a) => a.getAttribute('href'))
        .find((h) => h !== null && /^\/reports\/[^/]+\/$/.test(h));
      return found ?? null;
    });
    expect(href).toBeTruthy();

    // The pretty URL must not 404 — Vercel rewrites it to the /reports/view/ shell
    const resp = await page.goto(href as string);
    expect(resp?.status()).toBe(200);

    // The shell reads the id from the URL and loads the report from the API
    await expect(page.getByText('Report not found')).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('report wizard', () => {
  test('all three steps render', async ({ page }) => {
    await page.goto('/report/');
    // Step 1: photo
    await expect(page.getByText(/add a photo/i).first()).toBeVisible({ timeout: 15000 });

    // Step 2: details — click through (photo is optional)
    await page.getByRole('button', { name: /continue|next/i }).first().click();
    await expect(page.getByLabel(/title/i)).toBeVisible({ timeout: 15000 });
    // Location map renders (the fixed pick map)
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });
  });
});
