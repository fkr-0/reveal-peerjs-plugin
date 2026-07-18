import { expect, test } from '@playwright/test';

function isolatedUrl(label) {
  return `/example/?ui=${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function openLobby(page) {
  await page.goto(isolatedUrl('lobby'));
  await expect(page.locator('.rpjs-toolbar')).toBeVisible();
  await page.locator('#rpjs-btn-lobby').click();
  await expect(page.locator('.rpjs-lobby-panel')).toBeVisible();
}

async function openSettings(page) {
  await page.goto(isolatedUrl('settings'));
  const trigger = page.locator('#rpjs-btn-settings');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('.rpjs-modal')).toBeVisible();
  return trigger;
}

test.describe('UI quality and interaction conventions', () => {
  test('primary plugin controls meet common 44px target sizing', async ({ page }) => {
    await openLobby(page);

    const controls = page.locator([
      '#rpjs-btn-lobby',
      '#rpjs-btn-settings',
      '#rpjs-lobby-close',
      '#rpjs-target-btn',
      '#rpjs-chat-input',
      '#rpjs-send-btn',
    ].join(','));

    for (let index = 0; index < await controls.count(); index++) {
      const box = await controls.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(43.9);
      expect(box?.width || 0).toBeGreaterThanOrEqual(43.9);
    }
  });

  test('chat exposes connection text, empty state, and readiness feedback', async ({ page }) => {
    await openLobby(page);

    await expect(page.locator('#rpjs-status-label')).toHaveText(/Connected|Connecting|Offline/);
    await expect(page.locator('.rpjs-empty-state')).toContainText('No messages yet');

    const input = page.locator('#rpjs-chat-input');
    const send = page.locator('#rpjs-send-btn');
    await expect(send).toBeDisabled();
    await input.fill('Hello');
    await expect(send).toBeEnabled();
    await input.fill('   ');
    await expect(send).toBeDisabled();

    await input.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.rpjs-lobby-panel')).not.toBeVisible();
    await expect(page.locator('#rpjs-btn-lobby')).toBeFocused();
  });

  test('message target menu follows keyboard menu conventions', async ({ page }) => {
    await openLobby(page);

    const trigger = page.locator('#rpjs-target-btn');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('#rpjs-target-dropdown');
    await expect(menu).toHaveAttribute('role', 'menu');
    await expect(menu).toBeVisible();
    await expect(page.locator(':focus')).toHaveAttribute('role', 'menuitemradio');

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('settings behaves as a modal and restores focus on escape', async ({ page }) => {
    const trigger = await openSettings(page);
    const dialog = page.locator('.rpjs-modal');

    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#rpjs-settings-arena-character')).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.locator('#rpjs-settings-save').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#rpjs-settings-close')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('settings changes are staged until Save and validation is explicit', async ({ page }) => {
    await openSettings(page);

    const darkSwitch = page.getByRole('switch', { name: /darken presentation/i });
    await darkSwitch.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/rpjs-dark-mode/);

    await page.locator('#rpjs-btn-settings').click();
    await page.locator('#rpjs-settings-color-hex').fill('not-a-color');
    await page.locator('#rpjs-settings-save').click();
    await expect(page.locator('#rpjs-settings-error')).toContainText('six-digit color');
    await expect(page.locator('#rpjs-settings-color-hex')).toBeFocused();

    await page.locator('#rpjs-settings-color-hex').fill('#4fc3f7');
    await page.getByRole('switch', { name: /darken presentation/i }).click();
    await page.locator('#rpjs-settings-save').click();
    await expect(page.locator('body')).toHaveClass(/rpjs-dark-mode/);
  });

  test('custom identity colors do not reduce username text contrast', async ({ page }) => {
    await page.goto('/e2e/fixtures/hub-sync-harness.html');
    await page.waitForFunction(() => Boolean(window.__rpjsHubSync));

    const result = await page.evaluate(async () => {
      const [{ LobbyPanel }, { injectStyles }] = await Promise.all([
        import('/src/lobby-panel.js'),
        import('/src/styles.js'),
      ]);
      injectStyles();
      const network = {
        myId: 'self',
        chatMessages: [],
        getUserList: () => [
          { id: 'self', username: 'Self', color: '#000000', isHub: true, number: 0, arenaCharacter: 'vanguard' },
          { id: 'peer', username: 'Low Contrast Name', color: '#111111', isHub: false, number: 1, arenaCharacter: 'scout' },
        ],
        sendChat: () => {},
      };
      const panel = new LobbyPanel(network, { goOffline: false });
      panel.show();
      const row = panel.el.querySelector('[data-peer-id="peer"]');
      const name = row.querySelector('.rpjs-user-name');
      const dot = row.querySelector('.rpjs-user-dot');
      return {
        textColor: getComputedStyle(name).color,
        dotColor: getComputedStyle(dot).backgroundColor,
        actionsVisible: Boolean(panel.el.querySelector('.rpjs-user-actions')),
      };
    });

    expect(result.textColor).not.toBe('rgb(17, 17, 17)');
    expect(result.dotColor).toBe('rgb(17, 17, 17)');
    expect(result.actionsVisible).toBe(true);

    const actions = page.locator('.rpjs-user-actions');
    await actions.click();
    const menu = page.locator('.rpjs-context-menu');
    await expect(menu).toHaveAttribute('role', 'menu');
    await expect(menu.locator('[role="menuitem"]').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.locator('[role="menuitem"]').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(actions).toBeFocused();
  });

  test('Hub controls expose state and close with Escape', async ({ page }) => {
    await page.goto(isolatedUrl('hub-popover'));
    const trigger = page.locator('#rpjs-btn-hub');
    await expect(trigger).toBeVisible();
    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rpjs-hub-jump')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.rpjs-hub-menu')).not.toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(page.locator('.rpjs-hub-menu')).toBeVisible();
    await trigger.click();
    await expect(page.locator('.rpjs-hub-menu')).not.toBeVisible();
  });

  test('form controls have a discernible non-text boundary', async ({ page }) => {
    await openSettings(page);

    const ratio = await page.locator('#rpjs-settings-username').evaluate(element => {
      const parse = value => {
        const values = value.match(/[\d.]+/g).map(Number);
        return {
          rgb: values.slice(0, 3),
          alpha: values.length > 3 ? values[3] : 1,
        };
      };
      const luminance = rgb => {
        const channels = rgb.map(value => {
          const normalized = value / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const border = parse(getComputedStyle(element).borderTopColor);
      const surface = parse(getComputedStyle(element.closest('.rpjs-modal')).backgroundColor).rgb;
      const effectiveBorder = border.rgb.map((channel, index) => channel * border.alpha + surface[index] * (1 - border.alpha));
      const values = [luminance(effectiveBorder), luminance(surface)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });

    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  test('mobile lobby and settings remain inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openLobby(page);

    const lobby = await page.locator('.rpjs-lobby-panel').boundingBox();
    expect(lobby?.x || 0).toBeGreaterThanOrEqual(0);
    expect(lobby?.y || 0).toBeGreaterThanOrEqual(0);
    expect((lobby?.x || 0) + (lobby?.width || 0)).toBeLessThanOrEqual(375);
    expect((lobby?.y || 0) + (lobby?.height || 0)).toBeLessThanOrEqual(667);

    await page.locator('#rpjs-btn-lobby').click();
    await page.locator('#rpjs-btn-settings').click();
    const modal = await page.locator('.rpjs-modal').boundingBox();
    expect(modal?.x || 0).toBeGreaterThanOrEqual(0);
    expect(modal?.y || 0).toBeGreaterThanOrEqual(0);
    expect((modal?.x || 0) + (modal?.width || 0)).toBeLessThanOrEqual(375);
    expect((modal?.y || 0) + (modal?.height || 0)).toBeLessThanOrEqual(667);
  });

  test('reduced-motion preference suppresses decorative animation', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(isolatedUrl('motion'));
    await expect(page.locator('.rpjs-toolbar')).toBeVisible();
    await page.locator('#rpjs-btn-settings').click();

    const animationName = await page.locator('.rpjs-modal').evaluate(element => getComputedStyle(element).animationName);
    const transitionDuration = await page.locator('.rpjs-toggle').first().evaluate(element => getComputedStyle(element, '::after').transitionDuration);
    expect(animationName).toBe('none');
    expect(parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);
    await context.close();
  });
});
