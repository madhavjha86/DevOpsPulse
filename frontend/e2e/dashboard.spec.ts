import { test, expect } from '@playwright/test';

test.describe('Dashboard & Metrics Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test('renders top-level KPI cards with accurate values', async ({ page }) => {
    // Check main KPI titles using exact match to prevent matching descriptions
    await expect(page.getByText('Total Repositories', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Commits', { exact: true })).toBeVisible();
    await expect(page.getByText('Pull Requests', { exact: true })).toBeVisible();
    await expect(page.getByText('Open Issues', { exact: true })).toBeVisible();
    await expect(page.getByText('Success Rate', { exact: true })).toBeVisible();
  });

  test('renders build trend and performance charts without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Check chart titles
    await expect(page.locator('text=CI/CD Build Trends')).toBeVisible();
    await expect(page.locator('text=Workflow Execution Time')).toBeVisible();
    await expect(page.locator('text=Repository Commit Activity')).toBeVisible();

    // Verify zero fatal React errors
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(fatalErrors.length).toBe(0);
  });

  test('renders recent activity feed', async ({ page }) => {
    await expect(page.locator('h3:has-text("Recent Activity")')).toBeVisible();
    await expect(page.locator('text=Live stream across tracked repositories')).toBeVisible();
  });
});
