#!/usr/bin/env node
/**
 * Pack the plugin into a zip for a local install in the Claude desktop app.
 *
 * Packaging rules (https://claude.com/docs/plugins/build):
 *  - Upload accepts a `.zip` or `.plugin`; we produce a `.zip`.
 *  - The archive may hold the plugin folder or its contents, as long as there
 *    is exactly one `.claude-plugin/plugin.json`. We stage everything under a
 *    single top-level folder matching the plugin id.
 *  - A top-level `bin/` directory stops claude.ai and Cowork from installing
 *    the plugin at all, so it is never copied.
 *  - Plugins cannot reference files outside their directory; the bundled
 *    Cowork Tasks MCP server lives at `bundle/mcp-server.js` and is
 *    referenced via `${CLAUDE_PLUGIN_ROOT}` (per
 *    code.claude.com/docs/en/plugins-reference).
 *
 * The plugin's `.mcp.json` already follows these rules: the local
 * `cowork-tasks` MCP entry points at `bundle/mcp-server.js` (produced by
 * `pnpm --filter @cowork-tasks/plugin build`); every other entry is a
 * hosted HTTP connector the user adds and connects on the plugin's
 * Connectors tab. This script just stages the plugin folder and zips it - no
 * path rewrites.
 *
 * Output: `dist/cowork-tasks-local.zip`
 */
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countReplacementChars,
  makePublishable,
} from '../packages/plugin/scripts/publishable-html.mjs';

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

// Always include a fresh artifact bundle, made publishable: the artifact tool
// refuses pages containing U+FFFD (see publishable-html.mjs). Copying the raw
// dist file here would undo what the plugin build already fixed.
await fs.mkdir(path.join(stagingPlugin, 'artifact'), { recursive: true });
const stagedBoard = path.join(stagingPlugin, 'artifact', 'cowork-tasks.html');
await fs.writeFile(stagedBoard, makePublishable(await fs.readFile(artifactHtml, 'utf-8')));
if (countReplacementChars(await fs.readFile(stagedBoard, 'utf-8')) !== 0) {
  throw new Error('staged board page still contains U+FFFD; the artifact tool would refuse it');
}

await fs.rm(outFile, { force: true });
await fs.mkdir(outDir, { recursive: true });
await zipDir(stagingDir, outFile, PLUGIN_ID);

const sizeKb = Math.round(((await fs.stat(outFile)).size / 1024) * 10) / 10;
process.stdout.write(`packed: ${path.relative(repo, outFile)} (${sizeKb} KB)\n`);
process.stdout.write(`upload: Claude desktop app -> Customize > Plugins > Add > Upload plugin\n`);

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
