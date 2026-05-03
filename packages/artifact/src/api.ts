/**
 * Bridge between the live artifact and Cowork Tasks data.
 *
 * Cowork live artifacts run in a sandboxed iframe. The contract for what's
 * available there is narrow:
 *   - `window.claude.complete(prompt)` is documented (the analysis-tool API).
 *   - `window.claude.callTool` is NOT exposed in Cowork's iframe today
 *     (returns 400 in the field). Anthropic's reference dashboard uses the
 *     File System Access API (`showDirectoryPicker`) instead.
 *
 * So we have three data paths, picked at boot time:
 *
 *   1. **fs**       - File System Access API + a granted folder handle.
 *                     Reads + writes go directly to `~/.cowork-tasks/tasks/`.
 *   2. **mcp**      - `window.claude.callTool` is callable. Standard MCP
 *                     diff polling.
 *   3. **snapshot** - neither; the seeded `__INITIAL_STATE__` is the
 *                     starting point and the artifact's in-memory state is
 *                     authoritative. Polling is a no-op in this mode.
 */

import type { Config, Task } from './types';

declare global {
  interface Window {
    /**
     * Claude Cowork's documented host API (the `window.cowork.*` surface).
     * - `callMcpTool(toolName, args)` — invoke any MCP tool the artifact
     *   was authorized for at create_artifact time.
     * - `askClaude(prompt, context?)` — quick Haiku inference for
     *   summaries / classifications.
     * - `runScheduledTask(taskId)` — fire one of the user's saved
     *   schedules; requires user activation.
     */
    cowork?: {
      callMcpTool?: (toolName: string, args: unknown) => Promise<unknown>;
      askClaude?: (prompt: string, context?: unknown) => Promise<string>;
      runScheduledTask?: (taskId: string) => void;
    };
    /**
     * Legacy `window.claude.*` surface. Older Cowork builds + some
     * Claude Code/Desktop runtimes still expose this. We prefer
     * `window.cowork.*` and fall back to claude.* only if cowork is
     * absent. This keeps the artifact functional on both runtimes.
     */
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
    /** Stamped by the MCP server's prepare_board_artifact tool. */
    __PLUGIN_VERSION__?: string;
  }
}

const SERVER = 'cowork-tasks';

export interface ListTasksResult {
  version: number;
  added: Task[];
  updated: Task[];
  removed: string[];
}

// ---------------------------------------------------------------- data source

export type DataSource = 'mcp' | 'fs' | 'snapshot';

let cachedSource: DataSource | undefined;
let bridgeHealthy = true;

/**
 * Resolve a callable MCP bridge from whichever host API surface is live.
 * Prefers the documented `window.cowork.callMcpTool`; falls back to the
 * legacy `window.claude.callTool` for older Cowork / Claude Code runtimes.
 */
function resolveBridge():
  | { kind: 'cowork'; call: (toolName: string, args: unknown) => Promise<unknown> }
  | { kind: 'claude'; call: (server: string, tool: string, args: unknown) => Promise<unknown> }
  | null {
  if (typeof window.cowork?.callMcpTool === 'function') {
    return { kind: 'cowork', call: window.cowork.callMcpTool.bind(window.cowork) };
  }
  if (typeof window.claude?.callTool === 'function') {
    return { kind: 'claude', call: window.claude.callTool.bind(window.claude) };
  }
  return null;
}

export function getDataSource(): DataSource {
  if (cachedSource) return cachedSource;
  if (fs.isConnected()) {
    cachedSource = 'fs';
  } else if (resolveBridge() !== null && bridgeHealthy) {
    cachedSource = 'mcp';
  } else {
    cachedSource = 'snapshot';
  }
  return cachedSource;
}

export function resetDataSource(): void {
  cachedSource = undefined;
  bridgeHealthy = true;
}

function markBridgeUnhealthy(): void {
  bridgeHealthy = false;
  cachedSource = undefined;
}

// ----------------------------------------------------------------------- mcp

async function callMcp<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const bridge = resolveBridge();
  if (bridge) {
    try {
      // window.cowork.callMcpTool takes (toolName, args) directly. Tool
      // names follow the canonical MCP wire format: `mcp__<server>__<tool>`.
      // Cowork's mcp_tools allowlist requires the same form (other formats
      // are silently dropped at create_artifact time, leaving the artifact
      // unauthorized to call anything).
      const out =
        bridge.kind === 'cowork'
          ? ((await bridge.call(`mcp__${SERVER}__${tool}`, args)) as
              | { content?: { text?: string }[] }
              | T)
          : ((await bridge.call(SERVER, tool, args)) as
              | { content?: { text?: string }[] }
              | T);
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
    } catch (err) {
      // First failure - mark the bridge unhealthy so subsequent calls
      // short-circuit to snapshot mode instead of hammering a broken pipe.
      markBridgeUnhealthy();
      throw err;
    }
  }
  // Dev-server fallback for `vite dev`.
  const res = await fetch(`/__dev_mcp/${tool}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${tool}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

function safe<T>(promise: Promise<T>): Promise<T | undefined> {
  return promise.catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[cowork-tasks] persistence call failed:', err?.message ?? err);
    return undefined;
  });
}

// ---------------------------------------------------- File System Access API

interface FsHandle {
  dir: FileSystemDirectoryHandle;
  seen: Map<string, number>;
}

let fsState: FsHandle | null = null;
let permissionGranted = false;

async function tryRestoreFsHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const idb = await openIdb();
    if (!idb) return null;
    const handle = await idbGet<FileSystemDirectoryHandle>(idb, 'dirHandle');
    if (!handle) return null;
    const perm = await (
      handle as unknown as {
        queryPermission(o: { mode: string }): Promise<PermissionState>;
      }
    ).queryPermission({ mode: 'readwrite' });
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

export async function connectFolder(): Promise<boolean> {
  if (typeof window.showDirectoryPicker !== 'function') return false;
  try {
    const dir = await window.showDirectoryPicker({ id: 'cowork-tasks', mode: 'readwrite' });
    permissionGranted = true;
    fsState = { dir, seen: new Map() };
    await persistFsHandle(dir);
    resetDataSource();
    return true;
  } catch {
    return false;
  }
}

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
      /* skip malformed */
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

export const fs = {
  isAvailable: () => typeof window.showDirectoryPicker === 'function',
  isConnected: () => permissionGranted && fsState !== null,
  connectFolder,
  ensureFolder,
  readAllTasks: readAllTasksFromFs,
  writeTask: writeTaskToFs,
};

// ----------------------------------------------------------------- listTasks

/**
 * - 'fs'        : read the folder directly. Always returns a fresh
 *                 snapshot; version = `Date.now()`.
 * - 'mcp'       : call `list_tasks(since)` for a versioned diff.
 * - 'snapshot'  : the bridge is missing or unhealthy. Return the seeded
 *                 payload ONCE (initial poll), then empty diffs forever.
 *                 Without this guard, the artifact re-fed itself the same
 *                 7 tasks every 2 s and re-triggered the new-card glow.
 */
export async function listTasks(since?: number): Promise<ListTasksResult> {
  const source = getDataSource();

  if (source === 'fs' && (await ensureFolder())) {
    const tasks = await readAllTasksFromFs();
    return { version: Date.now(), added: tasks, updated: [], removed: [] };
  }

  if (source === 'mcp') {
    try {
      return await callMcp<ListTasksResult>('list_tasks', since ? { since } : {});
    } catch {
      // Bridge marked unhealthy; fall through to snapshot.
    }
  }

  const seeded = window.__INITIAL_STATE__;
  if (seeded && (since === undefined || since === 0)) {
    return {
      version: seeded.version,
      added: seeded.tasks,
      updated: [],
      removed: [],
    };
  }
  return {
    version: seeded?.version ?? since ?? 0,
    added: [],
    updated: [],
    removed: [],
  };
}

// -------------------------------------------------------------------- writes

export const api = {
  listTasks,
  getTask: (id: string) => callMcp<Task | null>('get_task', { id }),

  createTask: async (draft: Partial<Task>) => {
    const source = getDataSource();
    if (source === 'fs') {
      const t = draft as Task;
      await writeTaskToFs(t);
      return t;
    }
    if (source === 'mcp') {
      const out = await safe(callMcp<Task>('create_task', draft as Record<string, unknown>));
      if (out) return out;
    }
    return draft as Task;
  },

  updateTask: async (id: string, patch: Partial<Task>, ifVersion?: number) => {
    const source = getDataSource();
    if (source === 'fs') {
      const existing = (await readAllTasksFromFs()).find((t) => t.id === id);
      if (!existing) throw new Error(`task not found: ${id}`);
      const merged = { ...existing, ...patch, updated: new Date().toISOString() };
      await writeTaskToFs(merged);
      return merged;
    }
    if (source === 'mcp') {
      const out = await safe(callMcp<Task>('update_task', { id, patch, ifVersion }));
      if (out) return out;
    }
    return { id, ...patch } as Task;
  },

  moveTask: async (id: string, column: string, position: number, ifVersion?: number) => {
    const source = getDataSource();
    if (source === 'fs') {
      const all = await readAllTasksFromFs();
      const t = all.find((x) => x.id === id);
      if (!t) return { ok: false, version: Date.now() };
      const merged = { ...t, column, position, updated: new Date().toISOString() };
      await writeTaskToFs(merged);
      return { ok: true, version: Date.now() };
    }
    if (source === 'mcp') {
      const out = await safe(
        callMcp<{ ok: boolean; version: number }>('move_task', {
          id,
          column,
          position,
          ifVersion,
        }),
      );
      if (out) return out;
    }
    return { ok: true, version: Date.now() };
  },

  archiveTask: async (id: string) => {
    const source = getDataSource();
    if (source === 'mcp') {
      const out = await safe(callMcp<{ ok: boolean }>('archive_task', { id }));
      if (out) return out;
    }
    return { ok: true };
  },

  deleteTask: async (id: string) => {
    const source = getDataSource();
    if (source === 'mcp') {
      const out = await safe(callMcp<{ ok: boolean }>('delete_task', { id }));
      if (out) return out;
    }
    return { ok: true };
  },

  listConfig: async (): Promise<Config> => {
    if (window.__INITIAL_STATE__?.config) return window.__INITIAL_STATE__.config;
    if (getDataSource() === 'mcp') {
      const out = await safe(callMcp<Config>('list_config'));
      if (out) return out;
    }
    return {
      defaultBoard: 'main',
      triageIntervalMinutes: 60,
      labels: [],
      boards: [
        {
          id: 'main',
          name: 'Main Board',
          columns: [
            { id: 'inbox', name: 'Inbox', color: '#6b6a64' },
            { id: 'todo', name: 'To Do', color: '#6a9bcc' },
            { id: 'in-progress', name: 'In Progress', color: '#d97757' },
            { id: 'blocked', name: 'Blocked', color: '#c89a3f' },
            { id: 'done', name: 'Done', color: '#788c5d' },
          ],
        },
      ],
    };
  },

  updateConfig: async (patch: Partial<Config>): Promise<Config | null> => {
    if (getDataSource() === 'mcp') {
      const out = await safe(callMcp<Config>('update_config', { patch }));
      if (out) return out;
    }
    return null; // best-effort - local state is already updated optimistically
  },
};

/**
 * Ask Claude something. Prefers the documented `window.cowork.askClaude`
 * (Haiku inline inference, returns a string). Falls back to legacy
 * `window.claude.sendToChat` for hand-off-to-chat semantics, then
 * `window.claude.complete` for inline. The "ai buttons" in the side
 * panel call this; nothing else should bypass it.
 */
export async function askClaude(prompt: string, context?: unknown): Promise<string | void> {
  if (window.cowork?.askClaude) {
    return window.cowork.askClaude(prompt, context);
  }
  if (window.claude?.sendToChat) {
    await window.claude.sendToChat(prompt);
    return;
  }
  if (window.claude?.complete) {
    return window.claude.complete(prompt);
  }
  // eslint-disable-next-line no-console
  console.warn('[cowork-tasks] no Claude bridge available; prompt:', prompt);
}
