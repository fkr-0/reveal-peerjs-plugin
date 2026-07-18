#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer } from 'net';
import { chromium } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const suppliedUrl = process.env.RPJS_AUDIT_URL;
let server = null;
let browser = null;

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;
      probe.close(error => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error('Unable to allocate a UI audit port'));
      });
    });
  });
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`UI audit server did not become ready at ${url}`);
}

try {
  const auditPort = suppliedUrl ? null : await getFreePort();
  const baseUrl = suppliedUrl || `http://127.0.0.1:${auditPort}/example/`;
  if (!suppliedUrl) {
    server = spawn(process.execPath, ['scripts/dev-server.js', '--no-watch'], {
      cwd: projectRoot,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(auditPort) },
    });
    await waitForServer(baseUrl);
  }

  browser = await chromium.launch({ headless: true });
  const findings = [];

  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 900 },
    mobile: { width: 375, height: 667 },
  })) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}?ui-audit=${name}-${Date.now()}`);
    await page.locator('.rpjs-toolbar').waitFor({ state: 'visible' });

    for (const selector of ['#rpjs-btn-lobby', '#rpjs-btn-settings']) {
      const box = await page.locator(selector).boundingBox();
      if (!box || box.width < 43.9 || box.height < 43.9) {
        findings.push(`${name}: ${selector} is below 44x44px`);
      }
    }

    await page.locator('#rpjs-btn-lobby').click();
    const panel = page.locator('.rpjs-lobby-panel');
    await panel.waitFor({ state: 'visible' });
    const panelBox = await panel.boundingBox();
    if (!panelBox || panelBox.x < 0 || panelBox.y < 0 || panelBox.x + panelBox.width > viewport.width || panelBox.y + panelBox.height > viewport.height) {
      findings.push(`${name}: lobby panel escapes the viewport`);
    }

    const unnamedButtons = await page.locator('.rpjs-toolbar button, .rpjs-lobby-panel button').evaluateAll(buttons => buttons
      .filter(button => !button.disabled)
      .filter(button => !(button.getAttribute('aria-label') || button.getAttribute('aria-labelledby') || button.textContent.trim()))
      .map(button => button.id || button.className));
    findings.push(...unnamedButtons.map(button => `${name}: unnamed button ${button}`));

    await page.locator('#rpjs-btn-lobby').click();
    await page.locator('#rpjs-btn-settings').click();
    const modal = page.locator('.rpjs-modal');
    await modal.waitFor({ state: 'visible' });
    const modalBox = await modal.boundingBox();
    if (!modalBox || modalBox.x < 0 || modalBox.y < 0 || modalBox.x + modalBox.width > viewport.width || modalBox.y + modalBox.height > viewport.height) {
      findings.push(`${name}: settings modal escapes the viewport`);
    }
    await page.close();
  }

  if (findings.length) {
    throw new Error(findings.join('\n'));
  }
  console.log('UI audit passed for desktop and mobile viewports.');
} finally {
  await browser?.close();
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise(resolve => {
      server.once('exit', resolve);
      setTimeout(resolve, 2000);
    });
  }
}
