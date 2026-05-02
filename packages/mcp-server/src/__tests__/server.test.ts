import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { CoworkTasksServer } from '../server.js';

describe('CoworkTasksServer dispatch', () => {
  let home: string;
  let server: CoworkTasksServer;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-tasks-'));
    server = new CoworkTasksServer({ home });
    await server.start();
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(home, { recursive: true, force: true });
  });

  it('list_tasks returns a versioned diff', async () => {
    const result = (await dispatch(server, 'list_tasks', {})) as {
      version: number;
      added: unknown[];
    };
    expect(result.version).toBeGreaterThan(0);
    expect(result.added).toHaveLength(0);
  });

  it('create_task and list_tasks round-trip', async () => {
    const task = (await dispatch(server, 'create_task', {
      title: 'Pay invoice',
      source: { type: 'email', url: 'https://mail.example.com/123' },
    })) as { id: string; title: string };
    expect(task.id).toBeTruthy();
    expect(task.title).toBe('Pay invoice');

    const before = (await dispatch(server, 'list_tasks', { since: 1 })) as {
      added: unknown[];
    };
    expect(before.added.length).toBeGreaterThan(0);
  });

  it('mark_processed and is_processed round-trip', async () => {
    await dispatch(server, 'mark_processed', { connector: 'gmail', sourceHash: 'abc' });
    const result = (await dispatch(server, 'is_processed', {
      connector: 'gmail',
      sourceHash: 'abc',
    })) as { processed: boolean };
    expect(result.processed).toBe(true);
  });

  it('move_task changes column', async () => {
    const t = (await dispatch(server, 'create_task', { title: 'a' })) as { id: string };
    await dispatch(server, 'move_task', { id: t.id, column: 'todo', position: 0 });
    const fresh = (await dispatch(server, 'get_task', { id: t.id })) as { column: string };
    expect(fresh.column).toBe('todo');
  });

  it('check_version returns gracefully when offline', async () => {
    // No network in tests; expect latest=null and a writable cache.
    const result = (await dispatch(server, 'check_version', { force: true })) as {
      current: string;
      latest: string | null;
      outdated: boolean;
      lastChecked: string | null;
      fromCache: boolean;
    };
    expect(result.fromCache).toBe(false);
    expect(typeof result.current).toBe('string');
    expect(result.outdated).toBe(false);
  });
});

async function dispatch(
  server: CoworkTasksServer,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Reach into the private dispatch via the tool-call schema. Avoids spinning
  // up a stdio transport in tests.
  // @ts-expect-error - intentionally probing private API for unit testing
  return server.dispatch(tool, args);
}
