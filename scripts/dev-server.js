#!/usr/bin/env node

/**
 * Dev server for RevealPeerJS
 *
 * Builds the plugin in watch mode and serves the project root.
 * Both /dist/ and /example/ are accessible.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { parse } from 'url';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

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
  const fullPath = join(rootDir, filePath);

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
  const parsedUrl = parse(req.url);
  let pathname = parsedUrl.pathname;

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

server.listen(PORT, () => {
  console.log('\n  RevealPeerJS Dev Server\n');
  console.log(`  Serving at http://localhost:${PORT}`);
  console.log(`  Example: http://localhost:${PORT}/example/`);
  console.log('\n  Starting build in watch mode...\n');
});

// Build process (vite build --watch)
const build = spawn('npm', ['run', 'dev'], {
  cwd: rootDir,
  shell: true,
  stdio: 'pipe',
});

build.stdout.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.log(`[build] ${msg}`);
});

build.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[build] ${msg}`);
});

// Handle exit
const cleanup = () => {
  console.log('\n  Shutting down dev server...');
  build.kill();
  server.close();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

build.on('exit', (code) => {
  console.log(`Build process exited with code ${code}`);
  cleanup();
});

setTimeout(() => {
  console.log('\n  Dev server ready!\n');
  console.log('  - Plugin builds automatically on file changes');
  console.log('  - Refresh example pages to see updates');
  console.log('  - Press Ctrl+C to stop\n');
}, 1000);
