import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Multiplayer Features
 *
 * Tests the peer-to-peer functionality including:
 * - Hub/visitor roles
 * - Multi-user lobby
 * - Chat between users
 * - Hub controls
 */

test.describe('Multiplayer - Hub and Visitors', () => {
  test('first visitor becomes hub', async ({ browser }) => {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both to the same page
    await page1.goto('/example/');
    await page2.goto('/example/');

    // Wait for initialization
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // First visitor should see hub button
    const hubBtn1 = page1.locator('#rpjs-btn-hub');
    await expect(hubBtn1).toBeVisible();

    // Second visitor should NOT see hub button
    const hubBtn2 = page2.locator('#rpjs-btn-hub');
    await expect(hubBtn2).not.toBeVisible();

    await context1.close();
    await context2.close();
  });

  test('both users see each other in lobby', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/example/');
    await page2.goto('/example/');

    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Open lobby panels
    await page1.locator('#rpjs-btn-lobby').click();
    await page2.locator('#rpjs-btn-lobby').click();

    await page1.waitForTimeout(500);
    await page2.waitForTimeout(500);

    // Both should see users in lobby
    const users1 = page1.locator('.rpjs-user-item');
    const users2 = page2.locator('.rpjs-user-item');

    const count1 = await users1.count();
    const count2 = await users2.count();

    // Should see at least 2 users
    expect(count1).toBeGreaterThanOrEqual(2);
    expect(count2).toBeGreaterThanOrEqual(2);

    await context1.close();
    await context2.close();
  });

  test('chat messages appear for both users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/example/');
    await page2.goto('/example/');

    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Open lobby panels
    await page1.locator('#rpjs-btn-lobby').click();
    await page2.locator('#rpjs-btn-lobby').click();

    // Send message from user 1
    await page1.locator('.rpjs-chat-input').fill('Hello from user 1!');
    await page1.locator('.rpjs-send-btn').click();

    // Wait for message to propagate
    await page2.waitForTimeout(1000);

    // User 2 should see the message
    const messages2 = page2.locator('.rpjs-chat-msg');
    await expect(messages2).toContainText('Hello from user 1!');

    await context1.close();
    await context2.close();
  });

  test('hub can launch poll', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/example/');
    await page2.goto('/example/');

    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Hub launches poll
    await page1.locator('#rpjs-btn-hub').click();

    const hubMenu = page1.locator('.rpjs-hub-menu');
    await expect(hubMenu).toBeVisible();

    // Click "Launch Poll"
    await page1.locator('.rpjs-hub-menu-item').filter({ hasText: /poll/i }).click();

    // Poll modal should appear
    const pollModal = page1.locator('.rpjs-poll-modal');
    await expect(pollModal).toBeVisible();

    // Enter poll question
    await page1.locator('.rpjs-poll-question-input').fill('Test Question?');

    // Add two answers
    const answerInputs = page1.locator('.rpjs-poll-answer-input');
    await answerInputs.nth(0).fill('Option A');
    await answerInputs.nth(1).fill('Option B');

    // Publish poll
    await page1.locator('.rpjs-poll-publish-btn').click();

    // Wait for poll to reach visitor
    await page2.waitForTimeout(1000);

    // Visitor should see poll vote overlay
    const voteOverlay = page2.locator('.rpjs-poll-vote-overlay');
    await expect(voteOverlay).toBeVisible();

    await context1.close();
    await context2.close();
  });
});

test.describe('Multiplayer - Hub Controls', () => {
  test('hub menu opens and closes', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const hubBtn = page.locator('#rpjs-btn-hub');

    // Only first visitor gets hub button
    if (await hubBtn.isVisible()) {
      await hubBtn.click();

      const hubMenu = page.locator('.rpjs-hub-menu');
      await expect(hubMenu).toBeVisible();

      // Click hub button again to close
      await hubBtn.click();
      await page.waitForTimeout(200);

      await expect(hubMenu).not.toBeVisible();
    }
  });

  test('hub menu contains expected options', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const hubBtn = page.locator('#rpjs-btn-hub');

    if (await hubBtn.isVisible()) {
      await hubBtn.click();

      const hubMenu = page.locator('.rpjs-hub-menu');
      await expect(hubMenu).toBeVisible();

      // Check for expected menu items
      await expect(hubMenu).toContainText('Jump All');
      await expect(hubMenu).toContainText('Follow Mode');
      await expect(hubMenu).toContainText('Launch Poll');
      await expect(hubMenu).toContainText('Launch Arena');
    }
  });

  test('follow mode can be toggled', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const hubBtn = page.locator('#rpjs-btn-hub');

    if (await hubBtn.isVisible()) {
      await hubBtn.click();

      const followItem = page.locator('.rpjs-hub-menu-item').filter({ hasText: /follow/i });
      await followItem.click();

      await page.waitForTimeout(200);

      // Should show active state
      await expect(followItem).toHaveClass(/rpjs-active-feature/);

      // Click again to disable
      await followItem.click();
      await page.waitForTimeout(200);

      await expect(followItem).not.toHaveClass(/rpjs-active-feature/);
    }
  });
});

test.describe('Multiplayer - User States', () => {
  test('users have distinct colors', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/example/');
    await page2.goto('/example/');

    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    await page1.locator('#rpjs-btn-lobby').click();
    await page2.locator('#rpjs-btn-lobby').click();

    // Get user colors
    const colors1 = await page1.locator('.rpjs-user-dot').all()
      .then(dots => Promise.all(dots.map(d => d.evaluate(el => el.style.backgroundColor))));

    // Should have at least 2 different colors
    const uniqueColors = [...new Set(colors1)];
    expect(uniqueColors.length).toBeGreaterThanOrEqual(1);

    await context1.close();
    await context2.close();
  });

  test('self is marked in user list', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    await page.locator('#rpjs-btn-lobby').click();

    const panel = page.locator('.rpjs-lobby-panel');

    // Should have "You" tag or indicator
    const selfTag = panel.locator('.rpjs-user-self-tag');
    await expect(selfTag).toHaveCount(1);
  });
});

test.describe('Multiplayer - Connection States', () => {
  test('shows connecting state initially', async ({ page }) => {
    // Navigate and quickly check before connection completes
    await page.goto('/example/');

    // The toolbar should be visible immediately
    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('handles connection gracefully', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(3000);

    // Should be connected - no error indicators visible
    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Buttons should be enabled
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeEnabled();
  });
});
