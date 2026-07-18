#!/usr/bin/env node

/**
 * Dev server for RevealPeerJS
 *
 * Builds the plugin in watch mode and serves the project root.
 * Both /dist/ and /example/ are accessible.
 */

import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, extname, join, resolve, sep } from 'path';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const watchMode = !process.argv.includes('--no-watch');

const PORT = 8080;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
  const fullPath = resolve(rootDir, `.${filePath}`);
  if (fullPath !== rootDir && !fullPath.startsWith(`${rootDir}${sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  if (!existsSync(fullPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  try {
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      const indexPath = join(fullPath, 'index.html');
      if (existsSync(indexPath)) {
        serveFile(res, filePath + '/index.html');
        return;
      }
    }

    const data = readFileSync(fullPath);
    const mimeType = getMimeType(fullPath);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = requestUrl.pathname;

  // Default to /example/ for root
  if (pathname === '/') {
    pathname = '/example/';
  }

  // Remove trailing slash for files (but not for directory redirects)
  if (pathname.endsWith('/') && pathname !== '/') {
    // Try serving index.html from directory
    serveFile(res, pathname + 'index.html');
    return;
  }

  serveFile(res, pathname);
});

// Playwright treats an open port as a ready server. Build once before listening
// so the first test can never observe a temporarily missing dist bundle.
const initialBuild = spawnSync('pnpm', ['build'], {
  cwd: rootDir,
  shell: false,
  stdio: 'inherit',
});

if (initialBuild.status !== 0) {
  console.error(`Initial build failed with code ${initialBuild.status}`);
  process.exit(initialBuild.status || 1);
}

server.listen(PORT, () => {
  console.log('\n  RevealPeerJS Dev Server\n');
  console.log(`  Serving at http://localhost:${PORT}`);
  console.log(`  Example: http://localhost:${PORT}/example/`);
  console.log(watchMode ? '\n  Starting build in watch mode...\n' : '\n  Serving fixed production build for tests.\n');
});

// Interactive development watches the production bundle. Test mode serves the
// initial immutable build so no request can race an output rewrite.
const build = watchMode
  ? spawn('pnpm', ['dev'], {
    cwd: rootDir,
    shell: false,
    stdio: 'pipe',
  })
  : null;

build?.stdout.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[build] ${msg}`);
});

build?.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[build] ${msg}`);
});

// Handle exit
const cleanup = () => {
  console.log('\n  Shutting down dev server...');
  build?.kill();
  server.close();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

build?.on('exit', (code) => {
  console.log(`Build process exited with code ${code}`);
  cleanup();
});

setTimeout(() => {
  console.log('\n  Dev server ready!\n');
  console.log(watchMode
    ? '  - Plugin builds automatically on file changes'
    : '  - Fixed build mode: no output changes during test execution');
  console.log('  - Refresh example pages to see updates');
  console.log('  - Press Ctrl+C to stop\n');
}, 1000);
