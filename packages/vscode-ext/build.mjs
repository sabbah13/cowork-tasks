import { build, context } from 'esbuild';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const watch = process.argv.includes('--watch');
const root = path.resolve('.');

async function copyArtifact() {
  const src = path.resolve('..', 'artifact', 'dist', 'index.html');
  const dest = path.join(root, 'dist', 'artifact.html');
  try {
    const html = await fs.readFile(src, 'utf-8');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, html);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn('[vscode-ext] artifact not yet built; webview will show fallback message');
      return;
    }
    throw err;
  }
}

const opts = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  // `vscode` is provided by the host. `fsevents` is an optional native dep
  // of chokidar - VSCode ships its own and we don't want esbuild trying to
  // resolve the .node binary at bundle time.
  external: ['vscode', 'fsevents'],
  sourcemap: true,
  logLevel: 'info',
};

await copyArtifact();

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log('[vscode-ext] watching');
} else {
  await build(opts);
  console.log('[vscode-ext] built');
}
