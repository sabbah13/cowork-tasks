import type { Task } from './types';

/**
 * Persistent task store for the live artifact.
 *
 * The artifact has three persistence layers, in order of preference:
 *
 *   1. **File System Access API** - direct read/write of
 *      `~/.cowork-tasks/tasks/*.task.json`. Granted by the user once;
 *      handled in `api.ts`.
 *   2. **MCP server** - `window.claude.callTool('cowork-tasks', ...)`.
 *      Works in Claude Code but NOT in Cowork's iframe today.
 *   3. **localStorage** (this file) - the always-available fallback.
 *      Survives reloads in the same browser. **Local edits MERGE on top
 *      of any `__INITIAL_STATE__` Cowork bakes in via `open-board`** so
 *      drag/edit/archive/delete mutations don't get overwritten when the
 *      user re-runs the skill.
 *
 * The merge policy:
 *   - For each task in INITIAL_STATE, compare to the cached version by
 *     `updated` timestamp; the newer one wins.
 *   - Tasks created locally (id not in INITIAL_STATE) are kept.
 *   - Tasks the user archived/deleted locally (in the tombstone log) are
 *     filtered out, even if INITIAL_STATE still has them.
 *
 * This means: drag a card; reload Cowork; the card stays where you put it.
 * Re-run `/cowork-tasks:open-board` and Claude bakes a fresh snapshot;
 * if Claude's snapshot has a NEWER `updated` for that card, it wins.
 */

const KEY_TASKS = 'cowork-tasks:tasks:v2';
const KEY_TOMBSTONES = 'cowork-tasks:tombstones:v2';
const KEY_VERSION = 'cowork-tasks:version:v2';
const KEY_PREFS = 'cowork-tasks:prefs:v2';

export interface UiPrefs {
  collapsedColumns: string[];
  filterOwner?: string;
  filterLabel?: string;
  search?: string;
}

const DEFAULT_PREFS: UiPrefs = {
  collapsedColumns: [],
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const storage = {
  // ----- version (cursor for diff polling) -----------------------------
  loadVersion(): number {
    const raw = localStorage.getItem(KEY_VERSION);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  },
  saveVersion(version: number): void {
    try {
      localStorage.setItem(KEY_VERSION, String(version));
    } catch {
      /* ignore quota */
    }
  },

  // ----- tasks ----------------------------------------------------------
  loadTasks(): Task[] {
    return safeParse(localStorage.getItem(KEY_TASKS), [] as Task[]);
  },
  saveTasks(tasks: Task[]): void {
    try {
      const json = JSON.stringify(tasks);
      if (json.length < 4_500_000) {
        localStorage.setItem(KEY_TASKS, json);
      } else {
        const active = tasks.filter((t) => t.status === 'active');
        localStorage.setItem(KEY_TASKS, JSON.stringify(active));
      }
    } catch {
      try {
        localStorage.removeItem(KEY_TASKS);
      } catch {
        /* swallow */
      }
    }
  },

  // ----- tombstones (locally archived/deleted ids) ---------------------
  loadTombstones(): Set<string> {
    return new Set(safeParse(localStorage.getItem(KEY_TOMBSTONES), [] as string[]));
  },
  saveTombstones(ids: Set<string>): void {
    try {
      localStorage.setItem(KEY_TOMBSTONES, JSON.stringify(Array.from(ids)));
    } catch {
      /* ignore quota */
    }
  },
  addTombstone(id: string): void {
    const set = this.loadTombstones();
    set.add(id);
    this.saveTombstones(set);
  },

  /** Wipe local state entirely. Used by the "Reset to snapshot" action. */
  clear(): void {
    try {
      localStorage.removeItem(KEY_TASKS);
      localStorage.removeItem(KEY_TOMBSTONES);
      localStorage.removeItem(KEY_VERSION);
    } catch {
      /* ignore */
    }
  },

  // ----- ui prefs -------------------------------------------------------
  loadPrefs(): UiPrefs {
    return { ...DEFAULT_PREFS, ...safeParse(localStorage.getItem(KEY_PREFS), {} as UiPrefs) };
  },
  savePrefs(prefs: UiPrefs): void {
    try {
      localStorage.setItem(KEY_PREFS, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  },
};

/**
 * Merge a freshly-seeded snapshot (from `__INITIAL_STATE__` or a
 * server-driven `list_tasks`) with locally-cached state.
 *
 *   - For each id present in both: prefer the one with the newer
 *     `updated` timestamp.
 *   - For ids only in `seed`: include them, unless tombstoned.
 *   - For ids only in `cached` (locally created): keep them.
 *   - Filter tombstoned ids out unconditionally.
 */
export function mergeWithCache(
  seed: Task[],
  cached: Task[],
  tombstones: Set<string>,
): Task[] {
  const map = new Map<string, Task>();
  for (const t of seed) {
    if (tombstones.has(t.id)) continue;
    map.set(t.id, t);
  }
  for (const t of cached) {
    if (tombstones.has(t.id)) continue;
    const existing = map.get(t.id);
    if (!existing) {
      // Locally-created task that the seed doesn't know about - keep it.
      map.set(t.id, t);
      continue;
    }
    const seedTime = Date.parse(existing.updated || '') || 0;
    const cachedTime = Date.parse(t.updated || '') || 0;
    if (cachedTime >= seedTime) {
      // Local edits are at least as fresh as the seed - keep them.
      map.set(t.id, t);
    }
  }
  return Array.from(map.values()).filter((t) => t.status === 'active');
}
