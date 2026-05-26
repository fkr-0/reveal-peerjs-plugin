# E2E Tests for RevealPeerJS

This directory contains end-to-end tests using Playwright.

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (show browser)
npm run test:e2e:headed
```

## Test Structure

- `plugin.spec.js` - Core plugin functionality tests
- `multiplayer.spec.js` - Multi-user and peer-to-peer tests

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
npm run test:e2e:ui
```

Or use VS Code's Playwright extension for step-through debugging.
