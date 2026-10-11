#!/usr/bin/env node
/**
 * Copy the built artifact HTML from `packages/artifact/dist/index.html` to
 * `packages/plugin/artifact/cowork-tasks.html` so the plugin tarball ships
 * with the board page the `open-board` skill publishes.
 *
 * The copy is made publishable on the way (see publishable-html.mjs): the
 * artifact tool rejects pages containing U+FFFD, and the markdown dependency
 * bundled into the board has two of them.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countReplacementChars, makePublishable } from './publishable-html.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'artifact', 'dist', 'index.html');
const destDir = path.join(here, '..', 'artifact');
const dest = path.join(destDir, 'cowork-tasks.html');

await fs.mkdir(destDir, { recursive: true });

try {
  const html = await fs.readFile(src, 'utf-8');
  const escaped = countReplacementChars(html);
  await fs.writeFile(dest, makePublishable(html));
  console.log(
    `[plugin] copied artifact -> ${path.relative(process.cwd(), dest)}` +
      (escaped > 0 ? ` (escaped ${escaped} U+FFFD for the artifact tool)` : ''),
  );
} catch (err) {
  if (err instanceof Error && err.message.includes('ENOENT')) {
    console.warn(`[plugin] artifact not yet built; run \`pnpm --filter @cowork-tasks/artifact build\` first`);
    process.exit(0);
  }
  throw err;
}
