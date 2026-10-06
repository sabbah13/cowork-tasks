import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countReplacementChars, makePublishable } from '../publishable-html.mjs';

// Built from code points so no tool or editor can rewrite these in this file.
const FFFD = String.fromCharCode(0xfffd);
const ESC = String.fromCharCode(92) + 'uFFFD';

describe('makePublishable', () => {
  it('escapes U+FFFD inside script blocks, leaving the code meaning the same', () => {
    const html = `<html><head><script>var a="${FFFD}";var b=/${FFFD}/;</script></head></html>`;
    const out = makePublishable(html);
    expect(countReplacementChars(out)).toBe(0);
    expect(out).toContain(`var a="${ESC}";`);
    // The escape evaluates to the very same character.
    const script = out.slice(out.indexOf('<script>') + 8, out.indexOf('</script>'));
    const ctx = {};
    new Function('ctx', script.replace('var a=', 'ctx.a=').replace('var b=', 'ctx.b='))(ctx);
    expect(ctx.a).toBe(FFFD);
    expect(ctx.b.test(FFFD)).toBe(true);
  });

  it('leaves a page without U+FFFD untouched', () => {
    const html = '<html><body><script>var a=1;</script></body></html>';
    expect(makePublishable(html)).toBe(html);
  });

  it('refuses a U+FFFD outside a script, where an escape would not mean the same thing', () => {
    const html = `<html><body><p>${FFFD}</p><script>var a=1;</script></body></html>`;
    expect(() => makePublishable(html)).toThrow(/outside a <script> block/);
  });
});

describe('the shipped board page', () => {
  it('has no U+FFFD, so the artifact tool will accept it (regression: open-board fell back to improvising)', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.join(here, '..', '..', 'artifact', 'cowork-tasks.html');
    const html = await fs.readFile(file, 'utf-8');
    expect(html.length).toBeGreaterThan(100_000); // it is the real board, not a stub
    expect(countReplacementChars(html)).toBe(0);
  });
});
