#!/usr/bin/env node
/**
 * Bundle plugin executables into self-contained .js files inside
 * `packages/plugin/bundle/`. The plugin's `.mcp.json` references these via
 * `${CLAUDE_PLUGIN_ROOT}/bundle/...` so they survive the Cowork plugin
 * cache copy.
 *
 * Why bundles:
 *  - The Cowork plugin cache copies the plugin directory in isolation. It
 *    does not preserve the workspace's `node_modules` symlinks. Anything
 *    that does `import '@cowork-tasks/core'` would fail to resolve at
 *    runtime.
 *  - Absolute paths to repo-local `dist/cli.js` violate the
 *    "no-out-of-plugin paths" rule in the Plugins reference.
 *
 * Source connectors / triage runner are intentionally NOT bundled into the
 * plugin: in Cowork the plugin uses Anthropic's hosted connectors (Slack,
 * Gmail, Atlassian, Fathom, ...) declared in `.mcp.json`, not our own
 * polling daemons. The CLI binaries in `packages/plugin/bin/` and the
 * `connector-*` packages remain available for advanced/local use.
 */
import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const pluginDir = path.resolve(here, '..');
const bundleDir = path.join(pluginDir, 'bundle');

await fs.rm(bundleDir, { recursive: true, force: true });
await fs.mkdir(bundleDir, { recursive: true });

const targets = [
  {
    name: 'mcp-server',
    entry: path.join(repo, 'packages', 'mcp-server', 'src', 'cli.ts'),
    out: path.join(bundleDir, 'mcp-server.js'),
  },
];

for (const t of targets) {
  await build({
    entryPoints: [t.entry],
    outfile: t.out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'error',
    external: ['fsevents'],
    banner: {
      js: `import { createRequire as __cowork_createRequire } from 'node:module';
import { fileURLToPath as __cowork_fileURLToPath } from 'node:url';
const require = __cowork_createRequire(import.meta.url);
const __filename = __cowork_fileURLToPath(import.meta.url);
const __dirname = __cowork_fileURLToPath(new URL('.', import.meta.url));
`,
    },
  });
  await fs.chmod(t.out, 0o755);
  const sizeKb = Math.round(((await fs.stat(t.out)).size / 1024) * 10) / 10;
  process.stdout.write(
    `[bundle] ${t.name.padEnd(22)} ${path.relative(repo, t.out)} (${sizeKb} KB)\n`,
  );
}
