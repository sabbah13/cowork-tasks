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

  it('serverInfo carries title + description + websiteUrl per MCP 2025-11-25', async () => {
    // Reach into the underlying MCP Server instance and read the
    // implementation info it advertises in `initialize`.
    const info = (server.rawServer as unknown as { _serverInfo: Record<string, unknown> })
      ._serverInfo;
    expect(info.name).toBe('cowork-tasks');
    expect(typeof info.title).toBe('string');
    expect(typeof info.description).toBe('string');
    expect(String(info.websiteUrl)).toMatch(/^https?:\/\//);
  });

  it('serverInfo carries icons[] when pluginRoot is set', async () => {
    // Set up a temp pluginRoot with a tiny icon.png so the data-uri
    // encoder has something to read.
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-plugin-'));
    // 1x1 transparent PNG.
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    await fs.writeFile(path.join(pluginRoot, 'icon.png'), tinyPng);
    const decorated = new CoworkTasksServer({ home, pluginRoot });
    await decorated.start();
    try {
      const info = (decorated.rawServer as unknown as { _serverInfo: Record<string, unknown> })
        ._serverInfo;
      expect(Array.isArray(info.icons)).toBe(true);
      const icons = info.icons as Array<{ src: string; mimeType?: string }>;
      expect(icons.length).toBeGreaterThan(0);
      expect(icons[0]?.src.startsWith('data:image/png;base64,')).toBe(true);
      expect(icons[0]?.mimeType).toBe('image/png');
    } finally {
      await decorated.close();
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it('delete_task moves to archived/ and restore_task brings it back', async () => {
    const t = (await dispatch(server, 'create_task', { title: 'Restorable' })) as { id: string };
    await dispatch(server, 'delete_task', { id: t.id });
    // After delete, list shows it as removed.
    const afterDel = (await dispatch(server, 'list_tasks', { since: 1 })) as {
      removed: string[];
    };
    expect(afterDel.removed).toContain(t.id);

    const restoreResult = (await dispatch(server, 'restore_task', { id: t.id })) as {
      ok: boolean;
      task?: { id: string; title: string };
    };
    expect(restoreResult.ok).toBe(true);
    expect(restoreResult.task?.id).toBe(t.id);
    expect(restoreResult.task?.title).toBe('Restorable');

    // restore_task on a non-existent id returns NOT_ARCHIVED.
    const noop = (await dispatch(server, 'restore_task', { id: 'never-existed' })) as {
      ok: boolean;
      error_code?: string;
    };
    expect(noop.ok).toBe(false);
    expect(noop.error_code).toBe('NOT_ARCHIVED');
  });

  it('rename_label cascades across config and tasks', async () => {
    await dispatch(server, 'update_config', {
      patch: { labels: [{ id: 'l1', name: 'old', color: '#000' }] },
    });
    const a = (await dispatch(server, 'create_task', {
      title: 'A',
      labels: ['old', 'keep'],
    })) as { id: string };
    const b = (await dispatch(server, 'create_task', {
      title: 'B',
      labels: ['old'],
    })) as { id: string };
    await dispatch(server, 'create_task', { title: 'C', labels: ['keep'] });

    const result = (await dispatch(server, 'rename_label', { from: 'old', to: 'new' })) as {
      ok: boolean;
      updatedCount: number;
    };
    expect(result.ok).toBe(true);
    expect(result.updatedCount).toBe(2);

    const ta = (await dispatch(server, 'get_task', { id: a.id })) as { labels: string[] };
    expect(ta.labels.sort()).toEqual(['keep', 'new']);
    const tb = (await dispatch(server, 'get_task', { id: b.id })) as { labels: string[] };
    expect(tb.labels).toEqual(['new']);

    const cfg = (await dispatch(server, 'list_config', {})) as {
      labels: { name: string }[];
    };
    expect(cfg.labels.map((l) => l.name)).toContain('new');
    expect(cfg.labels.map((l) => l.name)).not.toContain('old');
  });

  it('clear_artifact_folder returns structured errors for bad input', async () => {
    // Missing args.
    const noargs = (await dispatch(server, 'clear_artifact_folder', {})) as {
      ok: boolean;
      error_code?: string;
    };
    expect(noargs.ok).toBe(false);
    expect(noargs.error_code).toBe('MISSING_ARGS');

    // Unsafe id.
    const unsafe = (await dispatch(server, 'clear_artifact_folder', {
      artifactsDir: '/tmp/some-dir',
      id: '../escape',
    })) as { ok: boolean; error_code?: string };
    expect(unsafe.ok).toBe(false);
    expect(unsafe.error_code).toBe('UNSAFE_ID');

    // Non-absolute artifactsDir.
    const rel = (await dispatch(server, 'clear_artifact_folder', {
      artifactsDir: 'not-absolute',
      id: 'cowork-tasks',
    })) as { ok: boolean; error_code?: string };
    expect(rel.ok).toBe(false);
    expect(rel.error_code).toBe('NOT_ABSOLUTE');
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
