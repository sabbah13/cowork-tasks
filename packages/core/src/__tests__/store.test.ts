import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStore } from '../store.js';
import type { FsAdapter } from '../fs-adapter.js';

class MemFs implements FsAdapter {
  files = new Map<string, string>();
  dirs = new Set<string>(['/']);
  async readFile(p: string) {
    const v = this.files.get(p);
    if (v === undefined) throw new Error(`ENOENT ${p}`);
    return v;
  }
  async writeFile(p: string, c: string) {
    this.files.set(p, c);
  }
  async exists(p: string) {
    return this.files.has(p) || this.dirs.has(p);
  }
  async mkdir(p: string) {
    let cur = '';
    for (const part of p.split('/')) {
      cur = cur === '' ? part || '/' : `${cur}/${part}`.replace(/\/+/g, '/');
      this.dirs.add(cur);
    }
  }
  async rename(from: string, to: string) {
    const v = this.files.get(from);
    if (v === undefined) throw new Error('ENOENT');
    this.files.set(to, v);
    this.files.delete(from);
  }
  async unlink(p: string) {
    this.files.delete(p);
  }
  async readdir(p: string) {
    const result: string[] = [];
    const prefix = p === '/' ? '/' : `${p}/`;
    const seen = new Set<string>();
    for (const f of this.files.keys()) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      const head = rest.split('/')[0];
      if (head && !seen.has(head)) {
        seen.add(head);
        result.push(head);
      }
    }
    for (const d of this.dirs) {
      if (!d.startsWith(prefix) || d === p) continue;
      const rest = d.slice(prefix.length);
      const head = rest.split('/')[0];
      if (head && !seen.has(head)) {
        seen.add(head);
        result.push(head);
      }
    }
    return result;
  }
  async stat(p: string) {
    if (this.files.has(p)) return { isFile: true, isDirectory: false, mtimeMs: Date.now() };
    if (this.dirs.has(p)) return { isFile: false, isDirectory: true, mtimeMs: Date.now() };
    throw new Error('ENOENT');
  }
}

describe('TaskStore', () => {
  let fs: MemFs;
  let store: TaskStore;

  beforeEach(async () => {
    fs = new MemFs();
    store = new TaskStore({ rootPath: '/home', fs, tasksDir: '/home/tasks' });
    await store.initialize();
  });

  it('starts empty', () => {
    expect(store.getAllTasks()).toEqual([]);
    expect(store.version).toBeGreaterThan(0);
  });

  it('creates a task with required fields', async () => {
    const task = await store.createTask({
      title: 'Review the design doc',
      source: { type: 'email', url: 'https://mail.example.com/123' },
    });
    expect(task.title).toBe('Review the design doc');
    expect(task.column).toBe('inbox');
    expect(task.status).toBe('active');
    expect(task.id).toMatch(/^email_/);
    const all = store.getAllTasks();
    expect(all).toHaveLength(1);
  });

  it('emits a versioned diff after each write', async () => {
    const v0 = store.version;
    await store.createTask({ title: 'a' });
    expect(store.version).toBeGreaterThan(v0);
    const diff = store.diffSince(v0);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.title).toBe('a');
  });

  it('returns no diff when cursor matches version', async () => {
    await store.createTask({ title: 'x' });
    const diff = store.diffSince(store.version);
    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('moves a task between columns', async () => {
    const t = await store.createTask({ title: 'a' });
    await store.moveTask(t.id, 'todo', 0);
    const updated = store.getTask(t.id);
    expect(updated?.column).toBe('todo');
  });

  it('rejects update with stale ifVersion', async () => {
    const t = await store.createTask({ title: 'a' });
    await expect(
      store.updateTask(t.id, { title: 'b' }, 999_999),
    ).rejects.toThrow(/version mismatch/);
  });

  it('returns full snapshot when cursor is 0', async () => {
    await store.createTask({ title: 'a' });
    await store.createTask({ title: 'b' });
    const diff = store.diffSince(0);
    expect(diff.added).toHaveLength(2);
  });

  it('archives a task without losing it', async () => {
    const t = await store.createTask({ title: 'a' });
    await store.archiveTask(t.id);
    expect(store.getAllTasks()).toHaveLength(0);
  });

  it('deletes a task and emits a tombstone in next diff', async () => {
    const t = await store.createTask({ title: 'a' });
    const beforeDelete = store.version;
    await store.deleteTask(t.id);
    const diff = store.diffSince(beforeDelete);
    expect(diff.removed).toContain(t.id);
  });

  it('validates task schema on save', async () => {
    await expect(store.createTask({ title: '' })).rejects.toBeTruthy();
  });
});
