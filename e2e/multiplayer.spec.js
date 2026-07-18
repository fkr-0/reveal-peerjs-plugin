import { test, expect } from '@playwright/test';

const RUN_LIVE_PEERJS = process.env.RPJS_LIVE_PEERJS === '1';

function isolatedRoom(label) {
  return `/example/?multiplayer=${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createConnectedPair(browser, label) {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  const url = isolatedRoom(label);

  await page1.goto(url);
  await expect(page1.locator('.rpjs-toolbar')).toBeVisible();
  await expect(page1.locator('#rpjs-btn-hub')).toBeVisible({ timeout: 30000 });

  await page2.goto(url);
  await expect(page2.locator('.rpjs-toolbar')).toBeVisible();
  await expect(page2.locator('#rpjs-btn-hub')).not.toBeVisible();

  return { context1, context2, page1, page2 };
}

async function openConnectedLobbies(page1, page2) {
  await page1.locator('#rpjs-btn-lobby').click();
  await page2.locator('#rpjs-btn-lobby').click();
  await expect(page1.locator('.rpjs-lobby-panel')).toBeVisible();
  await expect(page2.locator('.rpjs-lobby-panel')).toBeVisible();
  await expect.poll(() => page1.locator('.rpjs-user-item').count(), { timeout: 30000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page2.locator('.rpjs-user-item').count(), { timeout: 30000 }).toBeGreaterThanOrEqual(2);
}

async function openHubControls(page, label) {
  await page.goto(`/e2e/fixtures/hub-sync-harness.html?hub-ui=${label}`);
  await page.waitForFunction(() => Boolean(window.__rpjsHubSync));
  await page.evaluate(async () => {
    const [{ HubMenu }, { injectStyles }] = await Promise.all([
      import('/src/hub-menu.js'),
      import('/src/styles.js'),
    ]);
    injectStyles();
    const trigger = document.createElement('button');
    trigger.id = 'rpjs-btn-hub';
    trigger.type = 'button';
    trigger.textContent = 'Hub controls';
    trigger.setAttribute('aria-expanded', 'false');
    document.body.appendChild(trigger);

    const network = {
      jumpAllToSlide: () => {},
      setFollowMode: active => { window.__rpjsFollowMode = active; },
      startPoll: () => {},
    };
    const menu = new HubMenu(
      network,
      { getIndices: () => ({ h: 0, v: 0 }) },
      () => {},
      (visible, restoreFocus = true) => {
        trigger.setAttribute('aria-expanded', visible ? 'true' : 'false');
        if (!visible && restoreFocus) trigger.focus();
      },
    );
    trigger.addEventListener('click', () => menu.toggle());
    window.__rpjsTestHubMenu = menu;
  });
  const hubButton = page.locator('#rpjs-btn-hub');
  await expect(hubButton).toBeVisible();
  await hubButton.click();
  const menu = page.locator('.rpjs-hub-menu');
  await expect(menu).toBeVisible();
  return { hubButton, menu };
}

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
  test.skip(!RUN_LIVE_PEERJS, 'Set RPJS_LIVE_PEERJS=1 to exercise the public PeerJS signaling service.');
  test.describe.configure({ timeout: 90000 });
  test('first visitor becomes hub', async ({ browser }) => {
    const { context1, context2, page1, page2 } = await createConnectedPair(browser, 'roles');

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
    const { context1, context2, page1, page2 } = await createConnectedPair(browser, 'presence');
    await openConnectedLobbies(page1, page2);

    // Both should see users in lobby
    const users1 = page1.locator('.rpjs-user-item');
    const users2 = page2.locator('.rpjs-user-item');

    await expect(users1).toHaveCount(2);
    await expect(users2).toHaveCount(2);

    await context1.close();
    await context2.close();
  });

  test('chat messages appear for both users', async ({ browser }) => {
    const { context1, context2, page1, page2 } = await createConnectedPair(browser, 'chat');
    await openConnectedLobbies(page1, page2);

    // Send message from user 1
    await page1.locator('.rpjs-chat-input').fill('Hello from user 1!');
    await page1.locator('.rpjs-send-btn').click();

    // User 2 should see the message
    const messages2 = page2.locator('.rpjs-chat-msg');
    await expect(messages2).toContainText('Hello from user 1!', { timeout: 10000 });

    await context1.close();
    await context2.close();
  });

  test('hub can launch poll', async ({ browser }) => {
    const { context1, context2, page1, page2 } = await createConnectedPair(browser, 'poll');
    await openConnectedLobbies(page1, page2);
    await page1.locator('#rpjs-btn-lobby').click();
    await page2.locator('#rpjs-btn-lobby').click();

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

    // Visitor should see poll vote overlay
    const voteOverlay = page2.locator('.rpjs-poll-vote-overlay');
    await expect(voteOverlay).toBeVisible({ timeout: 10000 });

    await context1.close();
    await context2.close();
  });
});

test.describe('Multiplayer - Hub Controls', () => {
  test('hub menu opens and closes', async ({ page }) => {
    const { hubButton, menu } = await openHubControls(page, 'hub-toggle');
    await hubButton.click();
    await expect(menu).not.toBeVisible();
  });

  test('hub menu contains expected options', async ({ page }) => {
    const { menu } = await openHubControls(page, 'hub-options');
    await expect(menu).toContainText('Jump All');
    await expect(menu).toContainText('Follow Mode');
    await expect(menu).toContainText('Launch Poll');
    await expect(menu).toContainText('Launch Arena');
  });

  test('follow mode can be toggled', async ({ page }) => {
    const { menu } = await openHubControls(page, 'hub-follow');
    const followItem = menu.locator('.rpjs-hub-menu-item').filter({ hasText: /follow/i });
    await followItem.click();
    await expect(followItem).toHaveClass(/rpjs-active-feature/);
    await followItem.click();
    await expect(followItem).not.toHaveClass(/rpjs-active-feature/);
  });
});

test.describe('Multiplayer - User States', () => {
  test('Hub-assigned identity colors render as distinct participant markers', async ({ page }) => {
    await page.goto('/e2e/fixtures/hub-sync-harness.html');
    await page.waitForFunction(() => Boolean(window.__rpjsHubSync));

    const colors = await page.evaluate(async () => {
      const [{ LobbyPanel }, { injectStyles }] = await Promise.all([
        import('/src/lobby-panel.js'),
        import('/src/styles.js'),
      ]);
      const { LobbyNetwork, MSG } = window.__rpjsHubSync;
      injectStyles();

      const hub = new LobbyNetwork();
      hub.isHub = true;
      hub.myId = 'hub';
      hub.myUser = {
        id: 'hub', username: 'Hub', color: '#4fc3f7', arenaCharacter: 'vanguard', isHub: true, number: 0,
      };
      hub.users.set('hub', { ...hub.myUser, conn: null });
      hub._handleHubMessage({
        type: MSG.JOIN,
        payload: { username: 'Visitor', color: '#4fc3f7', arenaCharacter: 'scout' },
      }, { peer: 'visitor-a', send: () => {} });

      const panel = new LobbyPanel({
        myId: hub.myId,
        chatMessages: [],
        getUserList: () => hub.getUserList(),
        sendChat: () => {},
      }, { goOffline: false });
      panel.show();
      return Array.from(panel.el.querySelectorAll('.rpjs-user-dot'))
        .map(dot => getComputedStyle(dot).backgroundColor);
    });

    expect(new Set(colors).size).toBeGreaterThanOrEqual(2);
  });

  test('self is marked in user list', async ({ page }) => {
    await page.goto('/e2e/fixtures/hub-sync-harness.html');
    await page.waitForFunction(() => Boolean(window.__rpjsHubSync));
    await page.evaluate(async () => {
      const [{ LobbyPanel }, { injectStyles }] = await Promise.all([
        import('/src/lobby-panel.js'),
        import('/src/styles.js'),
      ]);
      injectStyles();
      const user = {
        id: 'self', username: 'Self', color: '#4fc3f7', arenaCharacter: 'vanguard', isHub: true, number: 0,
      };
      const panel = new LobbyPanel({
        myId: 'self',
        chatMessages: [],
        getUserList: () => [user],
        sendChat: () => {},
      }, { goOffline: false });
      panel.show();
    });

    await expect(page.locator('.rpjs-user-self-tag')).toHaveCount(1);
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

  test('exposes connection progress without disabling local controls', async ({ page }) => {
    await page.goto(isolatedRoom('connection-state'));

    // Should be connected - no error indicators visible
    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Buttons should be enabled
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeEnabled();
    await chatBtn.click();
    await expect(page.locator('#rpjs-status-label')).toHaveText(/^(Connecting|Connected|Offline)$/);
  });
});
