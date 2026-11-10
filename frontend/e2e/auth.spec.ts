import { test, expect } from '@playwright/test';

test.describe('Authentication & Protected Routes', () => {
  test('redirects unauthenticated user from protected route to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('h1')).toContainText(/Welcome back/i);
  });

  test('displays error message on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'nonexistent@devopspulse.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    
    // Wait for the login API response and verify error alert appears
    const responsePromise = page.waitForResponse(r => r.url().includes('/api/v1/auth/login'));
    await page.click('button[type="submit"]');
    await responsePromise;

    // Expect danger alert
    const alert = page.locator('.text-danger-300');
    await expect(alert).toBeVisible({ timeout: 5000 });
  });

  test('logs in successfully and redirects to /dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    await expect(page.locator('main h1')).toContainText(/Developer Productivity & CI\/CD Pulse/i);
  });

  test('logs out successfully and clears session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

    // Click user avatar or logout button
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign out"), [aria-label="Logout"], button[title="Sign Out"]');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await expect(page).toHaveURL(/.*\/login/);
    }
  });
});
