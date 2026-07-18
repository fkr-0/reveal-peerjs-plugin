# E2E Tests for RevealPeerJS

This directory contains end-to-end tests using Playwright.

## Running Tests

### Install Dependencies

```bash
pnpm install
```

### Run Tests

```bash
# Run all tests
pnpm test:e2e

# Run the optional public PeerJS signaling integration
pnpm test:live-peerjs

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (show browser)
pnpm test:e2e:headed

# Syntax-check source, scripts, and tests
pnpm check

# Run standalone target-size, naming, and viewport checks
pnpm test:ui-audit
```

## Test Structure

The default suite avoids third-party availability as a release dependency. The four real shared-room tests run only when `RPJS_LIVE_PEERJS=1` or through `pnpm test:live-peerjs`.

- `plugin.spec.js` - Core plugin functionality tests
- `multiplayer.spec.js` - Multi-user and peer-to-peer tests
- `hub-sync.spec.js` - Hub routing, identity binding, and game session lifecycle
- `networking-logic.spec.js` - Hub epoch, ordering, and direct-peer rejection guards
- `arena-logic.spec.js` - Character, item, collision, weapon, and Arena simulation primitives
- `poll-options.spec.js` - Poll modes, result sharing, aggregation, and visualization
- `ui-quality.spec.js` - Target sizing, focus, contrast, responsive bounds, menus, settings, and reduced motion

## Writing Tests

Tests use Playwright's API. See [Playwright Docs](https://playwright.dev/) for reference.

### Example Test

```javascript
import { test, expect } from '@playwright/test';

test('toolbar is visible', async ({ page }) => {
  await page.goto('/example/');
  await page.waitForTimeout(1000);

  const toolbar = page.locator('.rpjs-toolbar');
  await expect(toolbar).toBeVisible();
});
```

## Debugging

Run tests in UI mode for debugging:

```bash
pnpm test:e2e:ui
```

Or use VS Code's Playwright extension for step-through debugging.
