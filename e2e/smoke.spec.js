import { test, expect } from '@playwright/test';

/**
 * Smoke tests - Quick checks for basic functionality
 *
 * Run these first to verify the plugin is working at all.
 */

test.describe('Smoke Tests', () => {
  test('plugin loads without errors', async ({ page }) => {
    const errors = [];

    page.on('pageerror', (error) => {
      errors.push(error.toString());
    });

    await page.goto('/example/');
    await page.waitForTimeout(2000);

    // Should have no JavaScript errors
    expect(errors.length).toBe(0);
  });

  test('toolbar is present', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeAttached();
  });

  test('toolbar buttons are present', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const chatBtn = page.locator('#rpjs-btn-lobby');
    const settingsBtn = page.locator('#rpjs-btn-settings');

    await expect(chatBtn).toBeAttached();
    await expect(settingsBtn).toBeAttached();
  });

  test('can open and close lobby panel', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const chatBtn = page.locator('#rpjs-btn-lobby');
    await chatBtn.click();

    const panel = page.locator('.rpjs-lobby-panel');
    await expect(panel).toBeVisible();

    await chatBtn.click();
    await page.waitForTimeout(200);

    await expect(panel).not.toBeVisible();
  });

  test('can open and close settings modal', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const settingsBtn = page.locator('#rpjs-btn-settings');
    await settingsBtn.click();

    const modal = page.locator('.rpjs-modal');
    await expect(modal).toBeVisible();

    const closeBtn = page.locator('.rpjs-modal-close');
    await closeBtn.click();

    await page.waitForTimeout(200);
    await expect(modal).not.toBeVisible();
  });
});
