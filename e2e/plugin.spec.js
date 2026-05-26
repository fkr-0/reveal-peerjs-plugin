import { test, expect } from '@playwright/test';

/**
 * E2E Tests for RevealPeerJS Plugin
 *
 * Tests the core functionality of the plugin including:
 * - Plugin initialization and toolbar visibility
 * - Lobby panel and chat
 * - Settings modal
 * - Hub controls (for first visitor)
 */

test.describe('Plugin Initialization', () => {
  test('should load the plugin and display toolbar', async ({ page }) => {
    await page.goto('/example/');

    // Wait for Reveal.js and plugin to initialize
    await page.waitForTimeout(1000);

    // Check that toolbar is visible
    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Check for chat button
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeVisible();

    // Check for settings button
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await expect(settingsBtn).toBeVisible();
  });

  test('should have correct z-index for toolbar', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Get computed z-index
    const zIndex = await toolbar.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });

    // Should be a high z-index
    expect(parseInt(zIndex)).toBeGreaterThanOrEqual(9999);
  });

  test('should display connection status', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    // Check that connection is established
    // The toolbar buttons should be enabled and visible
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeVisible();
    await expect(chatBtn).toBeEnabled();
  });
});

test.describe('Lobby Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);
  });

  test('should open lobby panel when chat button is clicked', async ({ page }) => {
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await chatBtn.click();

    // Panel should be visible
    const panel = page.locator('.rpjs-lobby-panel');
    await expect(panel).toBeVisible();

    // Should have header
    const header = panel.locator('.rpjs-lobby-header');
    await expect(header).toContainText('Lobby');
  });

  test('should close lobby panel when clicking chat button again', async ({ page }) => {
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await chatBtn.click();

    const panel = page.locator('.rpjs-lobby-panel');
    await expect(panel).toBeVisible();

    // Click again to close
    await chatBtn.click();
    await page.waitForTimeout(200);

    // Panel should be hidden
    await expect(panel).not.toBeVisible();
  });

  test('should show current user in lobby list', async ({ page }) => {
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await chatBtn.click();

    const panel = page.locator('.rpjs-lobby-panel');
    await expect(panel).toBeVisible();

    // Should have at least one user (current user)
    const users = panel.locator('.rpjs-user-item');
    const count = await users.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should allow sending chat messages', async ({ page }) => {
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await chatBtn.click();

    const panel = page.locator('.rpjs-lobby-panel');
    await expect(panel).toBeVisible();

    // Type a message
    const input = panel.locator('.rpjs-chat-input');
    await input.fill('Hello from e2e test!');

    // Click send button
    const sendBtn = panel.locator('.rpjs-send-btn');
    await sendBtn.click();

    // Wait for message to appear
    await page.waitForTimeout(100);

    // Should see the message in chat
    const messages = panel.locator('.rpjs-chat-msg');
    const lastMessage = messages.last();
    await expect(lastMessage).toContainText('Hello from e2e test!');
  });
});

test.describe('Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);
  });

  test('should open settings modal when settings button is clicked', async ({ page }) => {
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await settingsBtn.click();

    // Modal overlay should be visible
    const overlay = page.locator('.rpjs-modal-overlay');
    await expect(overlay).toBeVisible();

    // Modal should be visible
    const modal = page.locator('.rpjs-modal');
    await expect(modal).toBeVisible();

    // Should have title
    await expect(modal).toContainText('Settings');
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await settingsBtn.click();

    const closeBtn = page.locator('.rpjs-modal-close');
    await closeBtn.click();

    await page.waitForTimeout(200);

    // Modal should be hidden
    const overlay = page.locator('.rpjs-modal-overlay');
    await expect(overlay).not.toBeVisible();
  });

  test('should allow changing username', async ({ page }) => {
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await settingsBtn.click();

    const modal = page.locator('.rpjs-modal');
    await expect(modal).toBeVisible();

    // Find username input
    const usernameInput = modal.locator('input[placeholder*="username" i]').or(
      modal.locator('.rpjs-field-input').first()
    );

    await usernameInput.fill('E2E Test User');

    // Save settings
    const saveBtn = modal.locator('.rpjs-save-btn');
    await saveBtn.click();

    await page.waitForTimeout(500);

    // Open lobby to verify username changed
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await chatBtn.click();

    const panel = page.locator('.rpjs-lobby-panel');
    const users = panel.locator('.rpjs-user-name');
    await expect(users).toContainText('E2E Test User');
  });

  test('should allow toggling dark mode', async ({ page }) => {
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await settingsBtn.click();

    const modal = page.locator('.rpjs-modal');
    await expect(modal).toBeVisible();

    // Find dark mode toggle
    const darkModeToggle = modal.locator('.rpjs-toggle').filter({ hasText: /dark/i });
    await darkModeToggle.click();

    // Save settings
    const saveBtn = modal.locator('.rpjs-save-btn');
    await saveBtn.click();

    await page.waitForTimeout(500);

    // Body should have dark mode class
    const body = page.locator('body');
    const hasClass = await body.getAttribute('class');
    expect(hasClass).toContain('rpjs-dark-mode');
  });
});

test.describe('Toolbar Active States', () => {
  test('should mark chat button as active when panel is open', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const chatBtn = page.locator('#rpjs-btn-lobby');

    // Initially not active
    await expect(chatBtn).not.toHaveClass(/rpjs-active/);

    // Open panel
    await chatBtn.click();
    await page.waitForTimeout(100);

    // Should be active
    await expect(chatBtn).toHaveClass(/rpjs-active/);

    // Close panel
    await chatBtn.click();
    await page.waitForTimeout(100);

    // Should not be active
    await expect(chatBtn).not.toHaveClass(/rpjs-active/);
  });
});

test.describe('Keyboard Navigation', () => {
  test('should allow tab navigation through toolbar', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    // Focus on body
    await page.keyboard.press('Tab');

    // Should focus on chat button
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeFocused();

    // Tab to settings button
    await page.keyboard.press('Tab');
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await expect(settingsBtn).toBeFocused();
  });

  test('should close panels on Escape key', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    // Open settings modal
    const settingsBtn = page.locator('#rpjs-btn-settings');
    await settingsBtn.click();

    const overlay = page.locator('.rpjs-modal-overlay');
    await expect(overlay).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Modal should close
    await expect(overlay).not.toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should be visible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Buttons should still be clickable
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeVisible();
  });

  test('should be visible on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('should be visible on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();
  });
});

test.describe('Plugin Lifecycle', () => {
  test('should cleanup properly on page navigation', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(1000);

    // Verify toolbar exists
    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Navigate away and back
    await page.goto('about:blank');
    await page.waitForTimeout(100);

    await page.goto('/example/');
    await page.waitForTimeout(1000);

    // Toolbar should be visible again
    await expect(toolbar).toBeVisible();
  });
});
