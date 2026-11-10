import { test, expect } from '@playwright/test';

test.describe('Repositories Management & Detail Views', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test('lists migrated repositories (react, flask)', async ({ page }) => {
    await page.goto('/repositories');
    await expect(page.locator('main h1')).toContainText(/Repositories/i);

    // Verify migrated repositories appear
    await expect(page.locator('text=react').first()).toBeVisible();
    await expect(page.locator('text=flask').first()).toBeVisible();
  });

  test('navigates to repository details and displays commits and PRs', async ({ page }) => {
    await page.goto('/repositories');
    await expect(page.locator('text=react').first()).toBeVisible();

    // Click on react repository
    await page.locator('text=react').first().click();
    await expect(page).toHaveURL(/.*\/repositories\/\d+/, { timeout: 10000 });

    // Verify tabs
    await expect(page.locator('button:has-text("Commits"), div:has-text("Commits")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Pull Requests"), div:has-text("Pull Requests")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Issues"), div:has-text("Issues")').first()).toBeVisible();
  });
});
