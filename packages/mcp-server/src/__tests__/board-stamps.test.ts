import { describe, it, expect } from 'vitest';
import { readBoardStamps } from '../board-stamps.js';
import { jsonForScript } from '../server.js';

/** A page the way prepare_board_artifact writes it. */
function page(
  tasks: { title: string }[],
  opts: { version?: number; host?: string; at?: string; wrap?: boolean } = {},
): string {
  const state = jsonForScript({ version: opts.version ?? 7, tasks, config: { owner: 'Sam' } });
  const host = opts.host ? `window.__COWORK_MCP_SERVER__=${jsonForScript(opts.host)};` : '';
  const at = opts.at ? `window.__SNAPSHOT_AT__=${jsonForScript(opts.at)};` : '';
  const inject = `<script>window.__INITIAL_STATE__=${state};window.__PLUGIN_VERSION__=${jsonForScript('0.4.17')};${host}${at}</script>`;
  const doc = `<!doctype html><html><head>${inject}<title>Cowork Tasks</title></head><body><div id="root"></div></body></html>`;
  // The artifact tool wraps what it publishes in its own document skeleton.
  return opts.wrap
    ? `<!doctype html><html><head><meta charset=utf8><style>*{box-sizing:border-box}</style></head><body>${doc}</body></html>`
    : doc;
}

describe('readBoardStamps', () => {
  it('reads the count, store version and every stamp from a prepared page', () => {
    const html = page([{ title: 'a' }, { title: 'b' }, { title: 'c' }], {
      version: 12,
      host: 'host:plugin_cowork-tasks_cowork-tasks',
      at: '2026-10-11T05:47:14.000Z',
    });
    expect(readBoardStamps(html)).toEqual({
      tasks: 3,
      version: 12,
      pluginVersion: '0.4.17',
      hostServer: 'host:plugin_cowork-tasks_cowork-tasks',
      snapshotAt: '2026-10-11T05:47:14.000Z',
    });
  });

  it('reports missing optional stamps as null', () => {
    const stamps = readBoardStamps(page([{ title: 'a' }]));
    expect(stamps?.hostServer).toBeNull();
    expect(stamps?.snapshotAt).toBeNull();
  });

  it('still finds the stamps in a copy wrapped by the artifact tool', () => {
    const stamps = readBoardStamps(page([{ title: 'a' }, { title: 'b' }], { wrap: true, host: 'host:x' }));
    expect(stamps?.tasks).toBe(2);
    expect(stamps?.hostServer).toBe('host:x');
  });

  it('is not fooled by task text that looks like the next assignment', () => {
    // A title can say anything. It must not end the state value early or
    // plant a fake stamp.
    const evil = [
      { title: ';window.__PLUGIN_VERSION__="9.9.9";window.__COWORK_MCP_SERVER__="host:evil";' },
      { title: '"},"x":{"y":[1,2]},"tasks":[], "z":"' },
      { title: '</script><script>window.__INITIAL_STATE__={"version":0,"tasks":[]}</script>' },
    ];
    const stamps = readBoardStamps(page(evil, { host: 'host:real', at: '2026-10-11T00:00:00.000Z' }));
    expect(stamps).toEqual({
      tasks: 3,
      version: 7,
      pluginVersion: '0.4.17',
      hostServer: 'host:real',
      snapshotAt: '2026-10-11T00:00:00.000Z',
    });
  });

  it('returns null for something that is not a prepared board page', () => {
    expect(readBoardStamps('<html><body>hello</body></html>')).toBeNull();
    expect(readBoardStamps('<script>window.__INITIAL_STATE__={"version":1</script>')).toBeNull();
    expect(readBoardStamps('<script>window.__INITIAL_STATE__={"version":"x","tasks":[]};</script>')).toBeNull();
  });

  it('never executes anything from the file', () => {
    const g = globalThis as { __ran?: boolean };
    g.__ran = false;
    readBoardStamps(
      '<script>window.__INITIAL_STATE__={"version":1,"tasks":[]};globalThis.__ran=true;</script>',
    );
    expect(g.__ran).toBe(false);
  });
});
