import { test, expect } from '@playwright/test';

async function openLobby(page) {
  await page.goto('/example/');
  const lobbyButton = page.locator('#rpjs-btn-lobby');
  await expect(lobbyButton).toBeVisible();
  await lobbyButton.click();
  const panel = page.locator('.rpjs-lobby-panel');
  await expect(panel).toBeVisible();
  return panel;
}

async function openHubMenu(page) {
  await page.goto('/example/');
  const hubButton = page.locator('#rpjs-btn-hub');
  await expect(hubButton).toBeVisible();
  await hubButton.click();
  const menu = page.locator('.rpjs-hub-menu');
  await expect(menu).toBeVisible();
  return menu;
}

test.describe('Accessibility And Arena', () => {
  test('lobby controls expose basic aria semantics', async ({ page }) => {
    const panel = await openLobby(page);

    const targetBtn = panel.locator('#rpjs-target-btn');
    await expect(targetBtn).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(targetBtn).toHaveAttribute('aria-expanded', 'false');

    await targetBtn.click();
    await expect(targetBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.locator('#rpjs-target-dropdown')).toHaveAttribute('role', 'listbox');
  });

  test('hub follow toggle exposes aria-pressed', async ({ page }) => {
    await openHubMenu(page);

    const followBtn = page.locator('#rpjs-hub-follow');
    await expect(followBtn).toHaveAttribute('aria-pressed', 'false');
    await followBtn.click();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('hub can launch arena and exit with escape', async ({ page }) => {
    await openHubMenu(page);
    await page.locator('#rpjs-hub-arena').click();

    const overlay = page.locator('.rpjs-arena-overlay');
    await expect(overlay).toBeVisible();

    const hud = page.locator('#rpjs-arena-player-count');
    await expect(hud).toContainText('HP');
    await expect(hud).toContainText('Alive');

    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });

  test('single-player arena switches to zombie mode and spawns enemies', async ({ page }) => {
    await openHubMenu(page);
    await page.locator('#rpjs-hub-arena').click();

    const hud = page.locator('#rpjs-arena-player-count');
    await expect(hud).toContainText('ZM');

    const scoreboard = page.locator('#rpjs-arena-scoreboard');
    await expect(scoreboard).toContainText('Zombies');
    await expect(scoreboard).toContainText('Wave');
    await expect(scoreboard).toContainText('Defeated');

    await expect(scoreboard).toContainText(/Zombies\s*[1-9]/, { timeout: 6000 });
  });
});
