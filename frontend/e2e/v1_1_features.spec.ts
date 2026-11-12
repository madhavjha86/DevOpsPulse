import { test, expect } from '@playwright/test';

test.describe('DevOpsPulse v1.1 Four Major Features', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test('1. Smart Incident Management page loads and renders incident lifecycle controls', async ({ page }) => {
    await page.goto('/incidents');
    await expect(page).toHaveURL(/.*\/incidents/);
    await expect(page.locator('h1')).toContainText(/Smart Incident Management/i);

    // KPI cards present
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('MTTR', { exact: true })).toBeVisible();

    // Report incident button
    await expect(page.getByRole('button', { name: /Report Incident/i })).toBeVisible();

    // Filter tabs
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'OPEN' })).toBeVisible();
  });

  test('2. AI Root Cause Analysis page renders telemetry analyzer and evidence view', async ({ page }) => {
    await page.goto('/ai/rca');
    await expect(page).toHaveURL(/.*\/ai\/rca/);
    await expect(page.locator('h1')).toContainText(/AI Root Cause Analysis/i);

    // Triage form
    await expect(page.getByText(/Analyze Failure Logs & CI\/CD Telemetry/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Root Cause Analysis/i })).toBeVisible();
  });

  test('3. Cloud Cost Intelligence page renders multi-cloud spend and budgets', async ({ page }) => {
    await page.goto('/infrastructure/cost');
    await expect(page).toHaveURL(/.*\/infrastructure\/cost/);
    await expect(page.locator('h1')).toContainText(/Cloud Cost Intelligence/i);

    // Provider cards (AWS, AZURE, GCP)
    await expect(page.getByText('AWS', { exact: true })).toBeVisible();
    await expect(page.getByText('AZURE', { exact: true })).toBeVisible();
    await expect(page.getByText('GCP', { exact: true })).toBeVisible();

    // Budget and optimization sections
    await expect(page.getByText(/Configured Cloud Budgets/i)).toBeVisible();
    await expect(page.getByText(/Actionable Cost Optimization Recommendations/i)).toBeVisible();
  });

  test('4. Engineering Team Productivity Analytics renders team DORA and non-ranking disclaimer', async ({ page }) => {
    await page.goto('/analytics/team-productivity');
    await expect(page).toHaveURL(/.*\/analytics\/team-productivity/);
    await expect(page.locator('h1')).toContainText(/Engineering Team Productivity Analytics/i);

    // Mandatory psychological safety / non-ranking disclaimer
    await expect(page.getByText(/Team Health & Collaboration Focus/i)).toBeVisible();
    await expect(page.getByText(/prohibits individual developer rankings/i)).toBeVisible();

    // DORA cards
    await expect(page.getByText(/Team DORA Delivery Performance/i)).toBeVisible();
    await expect(page.getByText(/Deployment Frequency/i).first()).toBeVisible();
    await expect(page.getByText(/Lead Time for Changes/i).first()).toBeVisible();

    // PR Size Hygiene
    await expect(page.getByText(/Pull Request Size Hygiene/i)).toBeVisible();
  });
});
