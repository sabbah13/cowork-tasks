/**
 * Bridge between the live artifact and Cowork Tasks data.
 *
 * Cowork live artifacts run in a sandboxed iframe. The contract for what's
 * available there is narrow:
 *   - `window.claude.complete(prompt)` is documented (the analysis-tool API).
 *   - There is **no** documented `window.claude.callTool` in artifacts. The
 *     productivity plugin's reference dashboard uses the File System Access
 *     API (`showDirectoryPicker`) instead. So we don't rely on a JS-MCP
 *     bridge - we use:
 *
 *       1. `window.__INITIAL_STATE__` injected at artifact-creation time
 *          (the `open-board` skill bakes a snapshot of tasks + version into
 *          the HTML before handing it to Cowork). This guarantees the
 *          board is never empty on first paint when tasks exist.
 *
 *       2. The File System Access API for live updates and writes. The
 *          user grants directory permission once; subsequent visits read
 *          and write directly from `~/.cowork-tasks/tasks/`.
 *
 *       3. A `window.claude.callTool` fallback if Cowork ever ships one
 *          (matches the speculative API shape).
 *
 *       4. A dev-mode HTTP shim for `vite dev`.
 */

import type { Config, Task } from './types';

declare global {
  interface Window {
    claude?: {
      callTool?: (server: string, tool: string, args: unknown) => Promise<unknown>;
      complete?: (prompt: string) => Promise<string>;
      sendToChat?: (prompt: string) => Promise<void>;
    };
    __INITIAL_STATE__?: {
      version: number;
      tasks: Task[];
      config?: Config;
    };
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

const SERVER = 'cowork-tasks';

export interface ListTasksResult {
  version: number;
  added: Task[];
  updated: Task[];
  removed: string[];
}

// ----------------------------------------------------------------------- mcp

async function callMcp<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const bridge = window.claude?.callTool;
  if (bridge) {
    const out = (await bridge(SERVER, tool, args)) as { content?: { text?: string }[] } | T;
    if (
      typeof out === 'object' &&
      out !== null &&
      'content' in out &&
      Array.isArray((out as { content: unknown[] }).content)
    ) {
      const first = (out as { content: { text?: string }[] }).content[0];
      return first?.text ? (JSON.parse(first.text) as T) : (undefined as unknown as T);
    }
    return out as T;
  }
  const res = await fetch(`/__dev_mcp/${tool}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${tool}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------- File System Access API

interface FsHandle {
  dir: FileSystemDirectoryHandle;
  /** mtime cache for the previous poll - id -> mtimeMs. */
  seen: Map<string, number>;
}

let fsState: FsHandle | null = null;
let permissionGranted = false;

/** Returns the directory handle if a previous session granted access. */
async function tryRestoreFsHandle(): Promise<FileSystemDirectoryHandle | null> {
  // FileSystemDirectoryHandle persistence is host-specific. In Cowork's
  // iframe we may not get IndexedDB access; in claude.ai we do. Wrap so
  // failures are silent.
  try {
    const idb = await openIdb();
    if (!idb) return null;
    const handle = await idbGet<FileSystemDirectoryHandle>(idb, 'dirHandle');
    if (!handle) return null;
    // Verify permission still holds.
    const perm = await (handle as unknown as {
      queryPermission(o: { mode: string }): Promise<PermissionState>;
    }).queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      permissionGranted = true;
      return handle;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function persistFsHandle(h: FileSystemDirectoryHandle): Promise<void> {
  try {
    const idb = await openIdb();
    if (!idb) return;
    await idbPut(idb, 'dirHandle', h);
  } catch {
    /* ignore */
  }
}

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open('cowork-tasks', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => resolve(undefined);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * Prompt the user to grant access to `~/.cowork-tasks/`. Required once per
 * device. Permission persists in IndexedDB.
 */
export async function connectFolder(): Promise<boolean> {
  if (typeof window.showDirectoryPicker !== 'function') {
    return false;
  }
  try {
    const dir = await window.showDirectoryPicker({ id: 'cowork-tasks', mode: 'readwrite' });
    permissionGranted = true;
    fsState = { dir, seen: new Map() };
    await persistFsHandle(dir);
    return true;
  } catch {
    return false;
  }
}

/** Lazily reuse a persisted handle if available. */
export async function ensureFolder(): Promise<boolean> {
  if (fsState) return true;
  const restored = await tryRestoreFsHandle();
  if (restored) {
    fsState = { dir: restored, seen: new Map() };
    return true;
  }
  return false;
}

async function readAllTasksFromFs(): Promise<Task[]> {
  if (!fsState) return [];
  const { dir } = fsState;
  let tasksDir: FileSystemDirectoryHandle | null = null;
  try {
    tasksDir = await dir.getDirectoryHandle('tasks');
  } catch {
    // If the user picked the parent of `tasks/`, look one level deeper. If
    // they picked `tasks/` directly, treat that as the dir itself.
    tasksDir = dir;
  }
  const out: Task[] = [];
  // @ts-expect-error - AsyncIterable on FileSystemDirectoryHandle
  for await (const [name, h] of tasksDir.entries()) {
    if (!name.endsWith('.task.json') || h.kind !== 'file') continue;
    try {
      const file = await (h as FileSystemFileHandle).getFile();
      const text = await file.text();
      const t = JSON.parse(text) as Task;
      out.push(t);
    } catch {
      // skip malformed
    }
  }
  return out.filter((t) => t.status === 'active');
}

async function writeTaskToFs(task: Task): Promise<void> {
  if (!fsState) throw new Error('folder not connected');
  const { dir } = fsState;
  let tasksDir: FileSystemDirectoryHandle;
  try {
    tasksDir = await dir.getDirectoryHandle('tasks', { create: true });
  } catch {
    tasksDir = dir;
  }
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const filename = `${slug || task.id}.task.json`;
  const handle = await tasksDir.getFileHandle(filename, { create: true });
  const w = await handle.createWritable();
  await w.write(JSON.stringify(task, null, 2));
  await w.close();
}

// --------------------------------------------------------------------- public

export const fs = {
  isAvailable: () => typeof window.showDirectoryPicker === 'function',
  isConnected: () => permissionGranted && fsState !== null,
  connectFolder,
  ensureFolder,
  readAllTasks: readAllTasksFromFs,
  writeTask: writeTaskToFs,
};

/**
 * Listing strategy: prefer File System Access (real-time, no MCP needed),
 * fall back to MCP, fall back to whatever the open-board skill baked in.
 */
export async function listTasks(since?: number): Promise<ListTasksResult> {
  if (await ensureFolder()) {
    const tasks = await readAllTasksFromFs();
    return { version: Date.now(), added: tasks, updated: [], removed: [] };
  }
  try {
    return await callMcp<ListTasksResult>('list_tasks', since ? { since } : {});
  } catch (err) {
    if (window.__INITIAL_STATE__) {
      return {
        version: window.__INITIAL_STATE__.version,
        added: window.__INITIAL_STATE__.tasks,
        updated: [],
        removed: [],
      };
    }
    throw err;
  }
}

export const api = {
  listTasks,
  getTask: (id: string) => callMcp<Task | null>('get_task', { id }),
  createTask: (draft: Partial<Task>) =>
    fs.isConnected()
      ? Promise.resolve(draft as Task)
      : callMcp<Task>('create_task', draft as Record<string, unknown>),
  updateTask: async (id: string, patch: Partial<Task>, ifVersion?: number) => {
    if (fs.isConnected()) {
      // Read existing, merge, write back.
      const existing = (await readAllTasksFromFs()).find((t) => t.id === id);
      if (!existing) throw new Error(`task not found: ${id}`);
      const merged = { ...existing, ...patch, updated: new Date().toISOString() };
      await writeTaskToFs(merged);
      return merged;
    }
    return callMcp<Task>('update_task', { id, patch, ifVersion });
  },
  moveTask: async (id: string, column: string, position: number, ifVersion?: number) => {
    if (fs.isConnected()) {
      const all = await readAllTasksFromFs();
      const t = all.find((x) => x.id === id);
      if (!t) return { ok: false, version: Date.now() };
      const merged = { ...t, column, position, updated: new Date().toISOString() };
      await writeTaskToFs(merged);
      return { ok: true, version: Date.now() };
    }
    return callMcp<{ ok: boolean; version: number }>('move_task', {
      id,
      column,
      position,
      ifVersion,
    });
  },
  archiveTask: (id: string) => callMcp<{ ok: boolean }>('archive_task', { id }),
  deleteTask: (id: string) => callMcp<{ ok: boolean }>('delete_task', { id }),
  listConfig: async () => {
    if (window.__INITIAL_STATE__?.config) return window.__INITIAL_STATE__.config;
    return callMcp<Config>('list_config');
  },
};

/** Send a prompt back to Claude Cowork's chat surface. Falls back to complete(). */
export async function askClaude(prompt: string): Promise<string | void> {
  if (window.claude?.sendToChat) {
    await window.claude.sendToChat(prompt);
    return;
  }
  if (window.claude?.complete) {
    return window.claude.complete(prompt);
  }
  console.warn('[cowork-tasks] no Claude bridge available; prompt:', prompt);
}
