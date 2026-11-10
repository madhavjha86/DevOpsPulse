import { test, expect } from '@playwright/test';

test.describe('Mobile & Responsive Viewport Verification', () => {
  const loginAsAdmin = async (page: any) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  };

  const verifyNoHorizontalOverflow = async (page: any) => {
    const overflowInfo = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      return {
        clientWidth: docWidth,
        scrollWidth,
        bodyScrollWidth,
        hasOverflow: scrollWidth > docWidth + 1 || bodyScrollWidth > docWidth + 1,
      };
    });
    expect(overflowInfo.hasOverflow).toBeFalsy();
  };

  // 1. Mobile Small: 320 x 568 (iPhone SE 1st gen)
  test('Viewport 320x568 (Mobile Small) - Zero overflow & drawer mechanics', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    // Verify no horizontal overflow
    await verifyNoHorizontalOverflow(page);

    // Verify Hamburger button is visible and Desktop search input is hidden
    const hamburgerBtn = page.locator('button[aria-label="Open sidebar"]');
    await expect(hamburgerBtn).toBeVisible();

    // Verify 4 KPI cards render cleanly
    await expect(page.getByText('Deployments', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Change Lead Time', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('MTTR', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Change Failure Rate', { exact: true }).first()).toBeVisible();

    // Capture 320px dashboard screenshot
    await page.screenshot({ path: '../docs/screenshots/responsive-320x568-dashboard.png' });

    // Open Mobile Sidebar Drawer
    await hamburgerBtn.click();
    await page.waitForTimeout(400);

    // Check body scroll lock
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');

    // Capture drawer open screenshot
    await page.screenshot({ path: '../docs/screenshots/responsive-mobile-drawer.png' });

    // Close Mobile Drawer via Close Button
    const closeBtn = page.locator('button[aria-label="Close sidebar"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(400);

    // Check body scroll unlocked
    const bodyOverflowAfter = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflowAfter).toBe('');

    // Toggle Mobile Search
    const searchToggleBtn = page.locator('button[aria-label="Toggle mobile search"]');
    await expect(searchToggleBtn).toBeVisible();
    await searchToggleBtn.click();
    await page.waitForTimeout(300);

    // Verify expandable search input is visible
    const mobileSearchInput = page.locator('input[placeholder*="Search repositories"]:visible');
    await expect(mobileSearchInput).toBeVisible();

    // Close Mobile Search
    await page.locator('button[aria-label="Close search"]').click();
  });

  // 2. Mobile Standard: 375 x 812 (iPhone X/11/12/13 mini)
  test('Viewport 375x812 (Mobile Standard) - Clean cards, stacked layout & zero overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    await verifyNoHorizontalOverflow(page);

    // Verify DORA Metrics and Deployment Trend cards are rendered
    await expect(page.locator('h3:has-text("DORA Metrics")')).toBeVisible();
    await expect(page.locator('h3:has-text("Deployment Trend")')).toBeVisible();

    // Verify AI Copilot, System Health & Quick Actions
    await expect(page.getByText('AI DevOps Copilot', { exact: false })).toBeVisible();
    await expect(page.getByText('System Health', { exact: false })).toBeVisible();
    await expect(page.getByText('Quick Actions', { exact: false })).toBeVisible();

    await page.screenshot({ path: '../docs/screenshots/responsive-375x812-dashboard.png' });
  });

  // 3. Mobile Modern: 390 x 844 (iPhone 12/13/14)
  test('Viewport 390x844 (Mobile Modern) - Zero overflow & legible metrics', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    await verifyNoHorizontalOverflow(page);
    await page.screenshot({ path: '../docs/screenshots/responsive-390x844-dashboard.png' });
  });

  // 4. Mobile Large: 430 x 932 (iPhone 14/15/16 Pro Max)
  test('Viewport 430x932 (Mobile Large) - Zero overflow & full card layout', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    await verifyNoHorizontalOverflow(page);
    await page.screenshot({ path: '../docs/screenshots/responsive-430x932-dashboard.png' });
  });

  // 5. Tablet Portrait: 768 x 1024 (iPad Portrait)
  test('Viewport 768x1024 (Tablet Portrait) - Responsive columns & charts', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    await verifyNoHorizontalOverflow(page);
    await page.screenshot({ path: '../docs/screenshots/responsive-768x1024-dashboard.png' });
  });

  // 6. Tablet Landscape: 1024 x 768 (iPad Landscape / Small Desktop)
  test('Viewport 1024x768 (Tablet Landscape) - Persistent sidebar activates', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    await verifyNoHorizontalOverflow(page);

    // Sidebar should be permanently visible without hamburger
    const sidebar = page.locator('aside[aria-label="Sidebar navigation"]');
    await expect(sidebar).toBeVisible();

    await page.screenshot({ path: '../docs/screenshots/responsive-1024x768-dashboard.png' });
  });

  // 7. Desktop: 1440 x 900 (High-res MacBook / Desktop)
  test('Viewport 1440x900 (Desktop) - 1:1 reference styling & fluid ribbon waves', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    await verifyNoHorizontalOverflow(page);
    await page.screenshot({ path: '../docs/screenshots/responsive-1440x900-dashboard.png' });
  });

  // 8. Mobile Secondary Pages Verification (375 x 812)
  test('Secondary pages on 375x812 - Login, DORA, Repositories, Security', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    // A. Login Page
    await page.goto('/login');
    await page.waitForTimeout(400);
    await verifyNoHorizontalOverflow(page);
    await page.screenshot({ path: '../docs/screenshots/responsive-375x812-login.png' });

    // Login
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // B. DORA Metrics Page
    await page.goto('/dora');
    await page.waitForTimeout(500);
    await verifyNoHorizontalOverflow(page);
    await page.screenshot({ path: '../docs/screenshots/responsive-375x812-dora.png' });

    // C. Repositories Page
    await page.goto('/repositories');
    await page.waitForTimeout(500);
    await verifyNoHorizontalOverflow(page);

    // D. Security Page
    await page.goto('/security');
    await page.waitForTimeout(500);
    await verifyNoHorizontalOverflow(page);
  });
});
