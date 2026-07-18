import { test, expect } from '@playwright/test';

/**
 * Visual verification tests for the toolbar
 * These tests specifically check the toolbar is visible on top of Reveal.js content
 */

test.describe('Toolbar Visual Verification', () => {
  test('toolbar is visible and clickable above Reveal.js content', async ({ page }) => {
    await page.goto('/example/');

    // Wait for everything to load
    await page.waitForTimeout(2000);

    // Take a screenshot to verify visually
    await page.screenshot({
      path: 'test-results/toolbar-visible.png',
      fullPage: false,
    });

    // Verify toolbar exists in DOM
    const toolbar = page.locator('.rpjs-toolbar');
    await expect(toolbar).toBeVisible();

    // Verify toolbar is positioned correctly
    const boundingBox = await toolbar.boundingBox();
    expect(boundingBox).toBeTruthy();

    // Should be near bottom left
    expect(boundingBox.x).toBeLessThan(100);
    expect(boundingBox.y).toBeGreaterThan(500);

    // Verify buttons are clickable
    const chatBtn = page.locator('#rpjs-btn-lobby');
    await expect(chatBtn).toBeVisible();
    await expect(chatBtn).toBeEnabled();

    // Actually click to verify it works
    await chatBtn.click();

    // Panel should open
    const panel = page.locator('.rpjs-lobby-panel');
    await expect(panel).toBeVisible();

    // Screenshot with panel open
    await page.screenshot({
      path: 'test-results/panel-open.png',
    });
  });

  test('toolbar maintains visibility during slide navigation', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.rpjs-toolbar');

    // Navigate through slides
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);

      // Toolbar should still be visible after each slide change
      await expect(toolbar).toBeVisible();
    }
  });

  test('toolbar is visible on all slides', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.rpjs-toolbar');

    // Check first slide
    await expect(toolbar).toBeVisible();

    // Navigate to last slide
    await page.keyboard.press('End');
    await page.waitForTimeout(500);

    // Should still be visible
    await expect(toolbar).toBeVisible();

    // Navigate back to first
    await page.keyboard.press('Home');
    await page.waitForTimeout(500);

    await expect(toolbar).toBeVisible();
  });

  test('toolbar has proper stacking context', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.rpjs-toolbar');

    // Get computed z-index
    const zIndex = await toolbar.evaluate((el) => {
      return parseInt(window.getComputedStyle(el).zIndex);
    });

    // Should be very high to appear above Reveal.js
    expect(zIndex).toBeGreaterThanOrEqual(9999);

    // Check position is fixed
    const position = await toolbar.evaluate((el) => {
      return window.getComputedStyle(el).position;
    });
    expect(position).toBe('fixed');
  });

  test('toolbar buttons have correct contrast', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const chatBtn = page.locator('#rpjs-btn-lobby');

    const contrast = await chatBtn.evaluate((el) => {
      const parse = value => {
        const values = value.match(/[\d.]+/g).map(Number);
        return { rgb: values.slice(0, 3), alpha: values.length > 3 ? values[3] : 1 };
      };
      const composite = (front, back) => front.rgb.map((channel, index) => (
        channel * front.alpha + back[index] * (1 - front.alpha)
      ));
      const luminance = rgb => {
        const channels = rgb.map(value => {
          const normalized = value / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };

      const foreground = parse(getComputedStyle(el).color).rgb;
      const pageBackground = parse(getComputedStyle(document.body).backgroundColor).rgb;
      const toolbarBackground = composite(parse(getComputedStyle(el.closest('.rpjs-toolbar')).backgroundColor), pageBackground);
      const values = [luminance(foreground), luminance(toolbarBackground)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });

    // Icon controls need at least 3:1 non-text contrast against their toolbar surface.
    expect(contrast).toBeGreaterThanOrEqual(3);
  });

  test('toolbar works with Reveal.js fullscreen', async ({ page }) => {
    await page.goto('/example/');
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.rpjs-toolbar');

    // Enter fullscreen (if browser supports it)
    try {
      await page.evaluate(() => {
        return document.documentElement.requestFullscreen();
      });
      await page.waitForTimeout(500);
    } catch (e) {
      // Fullscreen might not work in test environment, that's ok
      console.log('Fullscreen not supported in test environment');
    }

    // Toolbar should still be visible
    await expect(toolbar).toBeVisible();
  });
});
