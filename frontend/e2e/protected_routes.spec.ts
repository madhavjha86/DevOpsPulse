import { test, expect } from '@playwright/test';

test.describe('Protected Routes & Navigation', () => {
  const routes = [
    { path: '/workflows', title: /Workflows/i },
    { path: '/deployments', title: /Deployments/i },
    { path: '/dora', title: /DORA Metrics/i },
    { path: '/uptime', title: /Uptime|Monitoring/i },
    { path: '/security', title: /Security/i },
    { path: '/ai/copilot', title: /Copilot|AI/i },
    { path: '/ai/code-intelligence', title: /Code Review|Intelligence/i },
    { path: '/observability/telemetry', title: /Telemetry|Observability/i },
    { path: '/infrastructure/docker', title: /Docker/i },
    { path: '/infrastructure/kubernetes', title: /Kubernetes/i },
    { path: '/infrastructure/cloud', title: /Cloud/i },
    { path: '/notifications', title: /Notifications/i },
    { path: '/settings', title: /Settings/i },
  ];

  test('unauthenticated access to protected routes redirects to /login', async ({ page }) => {
    for (const route of routes.slice(0, 4)) {
      await page.goto(route.path);
      await expect(page).toHaveURL(/.*\/login/);
    }
  });

  test('authenticated user can navigate between all major views without errors', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });
});
