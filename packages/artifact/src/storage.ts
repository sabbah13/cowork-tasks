import type { Task } from './types';

/**
 * localStorage warm cache.
 *
 * Boot sequence: read what we have, render immediately, then ask MCP for the
 * diff since the cached `version`. Keeps the artifact flash-free on open.
 */
const KEY_VERSION = 'cowork-tasks:version';
const KEY_TASKS = 'cowork-tasks:tasks';
const KEY_PREFS = 'cowork-tasks:prefs';

export interface UiPrefs {
  collapsedColumns: string[];
  filterOwner?: string;
  filterLabel?: string;
  search?: string;
}

const DEFAULT_PREFS: UiPrefs = {
  collapsedColumns: [],
};

export const storage = {
  loadVersion(): number {
    const raw = localStorage.getItem(KEY_VERSION);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  },
  saveVersion(version: number): void {
    localStorage.setItem(KEY_VERSION, String(version));
  },
  loadTasks(): Task[] {
    const raw = localStorage.getItem(KEY_TASKS);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Task[];
    } catch {
      return [];
    }
  },
  saveTasks(tasks: Task[]): void {
    // Cap at 5 MB to stay well under localStorage limits. Truncating keeps
    // archive history outside the warm cache (it's still in IndexedDB).
    try {
      const json = JSON.stringify(tasks);
      if (json.length < 4_500_000) {
        localStorage.setItem(KEY_TASKS, json);
      } else {
        // Overflow: keep just the active subset
        const active = tasks.filter((t) => t.status === 'active');
        localStorage.setItem(KEY_TASKS, JSON.stringify(active));
      }
    } catch {
      // QuotaExceeded - drop the cache rather than crash
      try {
        localStorage.removeItem(KEY_TASKS);
      } catch {
        /* swallow */
      }
    }
  },
  loadPrefs(): UiPrefs {
    const raw = localStorage.getItem(KEY_PREFS);
    if (!raw) return { ...DEFAULT_PREFS };
    try {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as UiPrefs) };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  },
  savePrefs(prefs: UiPrefs): void {
    localStorage.setItem(KEY_PREFS, JSON.stringify(prefs));
  },
};
