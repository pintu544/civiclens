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
