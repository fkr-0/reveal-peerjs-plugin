#!/usr/bin/env node

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoots = ['src', 'scripts', 'e2e'];
const ignoredDirectories = new Set(['fixtures']);

function collectJavaScriptFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) collectJavaScriptFiles(path, files);
    } else if (entry.endsWith('.js')) {
      files.push(path);
    }
  }
  return files;
}

const files = sourceRoots.flatMap(directory => collectJavaScriptFiles(join(root, directory)));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);

