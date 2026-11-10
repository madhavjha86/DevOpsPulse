import { test, expect } from '@playwright/test';

test.describe('Redesign Screenshots Capture', () => {
  test('capture redesigned clean white SaaS UI screenshots', async ({ page }) => {
    // 1440x900 desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Login page
    await page.goto('/login');
    await page.waitForTimeout(600);
    await page.screenshot({ path: '../docs/screenshots/login-redesigned.png' });

    // Login as Admin
    await page.fill('input[type="email"]', 'admin@devopspulse.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const debugInfo = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const body = document.body;
      const html = document.documentElement;
      return {
        htmlClass: html.className,
        bodyColor: window.getComputedStyle(body).color,
        bodyBg: window.getComputedStyle(body).backgroundColor,
        h1Color: h1 ? window.getComputedStyle(h1).color : null,
        h1ComputedOpacity: h1 ? window.getComputedStyle(h1).opacity : null,
      };
    });
    console.log('--- DEBUG INFO ---', JSON.stringify(debugInfo, null, 2));

    // 2. Dashboard
    await page.screenshot({ path: '../docs/screenshots/dashboard.png' });

    // 3. DORA Metrics
    await page.goto('/dora');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '../docs/screenshots/dora_metrics.png' });

    // 4. AI Copilot
    await page.goto('/ai/copilot');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '../docs/screenshots/ai_copilot.png' });

    // 5. Infrastructure (Docker Containers)
    await page.goto('/infrastructure/docker');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '../docs/screenshots/infrastructure.png' });

    // 6. Security Center
    await page.goto('/security');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '../docs/screenshots/security-redesigned.png' });
  });
});
