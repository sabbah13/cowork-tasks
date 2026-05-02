#!/usr/bin/env node
/**
 * Pack the plugin into a zip for local Cowork install.
 *
 * Cowork is strict about plugin packaging:
 *  - Upload dialog only accepts `.zip` (Anthropic issue #28337).
 *  - Zip must contain a single top-level folder matching the plugin id.
 *  - Plugins cannot reference files outside their directory; everything the
 *    runtime needs (MCP server, connector binaries) must live inside the
 *    plugin and be referenced via `${CLAUDE_PLUGIN_ROOT}` (per
 *    code.claude.com/docs/en/plugins-reference).
 *
 * The plugin's `.mcp.json` and `monitors.json` already follow these rules
 * and point at `bundle/...` paths produced by `pnpm --filter
 * @cowork-tasks/plugin build`. This script just stages the plugin folder
 * and zips it - no path rewrites.
 *
 * Output: `dist/cowork-tasks-local.zip`
 */
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ID = 'cowork-tasks';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const pluginDir = path.join(repo, 'packages', 'plugin');
const bundleDir = path.join(pluginDir, 'bundle');
const artifactHtml = path.join(repo, 'packages', 'artifact', 'dist', 'index.html');
const stagingDir = path.join(repo, 'dist', 'plugin-staging');
const stagingPlugin = path.join(stagingDir, PLUGIN_ID);
const outDir = path.join(repo, 'dist');
const outFile = path.join(outDir, `${PLUGIN_ID}-local.zip`);

await assertExists(
  path.join(bundleDir, 'mcp-server.js'),
  'pnpm --filter @cowork-tasks/plugin build',
);
await assertExists(artifactHtml, 'pnpm --filter @cowork-tasks/artifact build');

await fs.rm(stagingDir, { recursive: true, force: true });
await fs.mkdir(stagingPlugin, { recursive: true });

// Copy the plugin folder. Skip workspace metadata, source-only bin scripts
// (replaced by bundles), and TS build artifacts.
await copyDir(pluginDir, stagingPlugin, [
  'node_modules',
  'tsconfig.json',
  'tsconfig.tsbuildinfo',
  'package.json',
  'package-lock.json',
  'scripts',
  'dist',
  // Source-only entry scripts - the runnable bundles are shipped separately
  // under `bundle/` (see plugin/scripts/build-bundles.mjs).
  'bin',
]);

// Always include a fresh artifact bundle.
await fs.mkdir(path.join(stagingPlugin, 'artifact'), { recursive: true });
await fs.copyFile(artifactHtml, path.join(stagingPlugin, 'artifact', 'cowork-tasks.html'));

// Bundle LICENSE.
try {
  await fs.copyFile(path.join(repo, 'LICENSE'), path.join(stagingPlugin, 'LICENSE'));
} catch {
  // optional
}

// Strip an empty hooks file so the validator doesn't reject `{"hooks": {}}`.
const hooksPath = path.join(stagingPlugin, 'hooks', 'hooks.json');
try {
  const raw = await fs.readFile(hooksPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (
    parsed &&
    parsed.hooks &&
    typeof parsed.hooks === 'object' &&
    Object.keys(parsed.hooks).length === 0
  ) {
    await fs.rm(path.join(stagingPlugin, 'hooks'), { recursive: true, force: true });
  }
} catch {
  // no hooks file - fine
}

await fs.rm(outFile, { force: true });
await fs.mkdir(outDir, { recursive: true });
await zipDir(stagingDir, outFile, PLUGIN_ID);

const sizeKb = Math.round(((await fs.stat(outFile)).size / 1024) * 10) / 10;
process.stdout.write(`packed: ${path.relative(repo, outFile)} (${sizeKb} KB)\n`);
process.stdout.write(`upload: Cowork -> Customize -> Plugins -> Upload local plugin\n`);

async function copyDir(src, dst, excludes) {
  const skip = new Set(excludes);
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(d, { recursive: true });
      await copyDir(s, d, excludes);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

function zipDir(parentDir, outFile, topLevel) {
  return new Promise((resolve, reject) => {
    const child = spawn('zip', ['-rq', outFile, topLevel], { cwd: parentDir });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`zip exited with code ${code}`)),
    );
  });
}

async function assertExists(p, hint) {
  try {
    await fs.access(p);
  } catch {
    process.stderr.write(`missing: ${p}\n  run: ${hint}\n`);
    process.exit(1);
  }
}
