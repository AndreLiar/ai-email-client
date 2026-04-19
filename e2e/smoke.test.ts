import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

test('homepage loads with no JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(BASE);
  await expect(page).toHaveTitle(/GetCleanInbox/i);
  expect(errors).toHaveLength(0);
});

test('sign-in page renders Clerk card', async ({ page }) => {
  await page.goto(`${BASE}/sign-in`);
  await expect(page.locator('input[name="identifier"], input[type="email"]')).toBeVisible({ timeout: 10000 });
});

test('sign-up page renders Clerk card', async ({ page }) => {
  await page.goto(`${BASE}/sign-up`);
  await expect(page.locator('input[name="emailAddress"], input[type="email"]')).toBeVisible({ timeout: 10000 });
});

test('privacy page returns content', async ({ page }) => {
  await page.goto(`${BASE}/privacy`);
  await expect(page.locator('h1')).toContainText('Privacy Policy');
});

test('terms page returns content', async ({ page }) => {
  await page.goto(`${BASE}/terms`);
  await expect(page.locator('h1')).toContainText('Terms of Service');
});

test('/cleaner redirects unauthenticated users to sign-in', async ({ page }) => {
  await page.goto(`${BASE}/cleaner`);
  await expect(page).toHaveURL(/sign-in/);
});
