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
 * The merge policy (snapshot-tagged cache, schema v3):
 *
 *   - The cache stores `{snapshotVersion, tasks, locallyCreatedIds}`.
 *   - For each task in INITIAL_STATE, compare to the cached version by
 *     `updated` timestamp; the newer one wins.
 *   - Tasks marked locally created (id in `locallyCreatedIds`) are kept
 *     unconditionally, so a card the user just made via the + button
 *     does not vanish when MCP/FSA is offline.
 *   - Cached tasks NOT in INITIAL_STATE and NOT in
 *     `locallyCreatedIds` are dropped IF their `snapshotVersion` is
 *     older than the current seed - they're ghosts from a prior open.
 *   - Tasks the user archived/deleted locally (in the tombstone log) are
 *     filtered out, even if INITIAL_STATE still has them.
 *
 * One-time dev-mock cleanup (v0.4.5+):
 *   Cached entries whose id matches the dev-mock pattern `^t\d+$` are
 *   dropped on every load, regardless of metadata. These are leftovers
 *   from the v<=0.4.3 ghost-tasks bug.
 */

const KEY_CACHE_V3 = 'cowork-tasks:cache:v3';
const KEY_TOMBSTONES = 'cowork-tasks:tombstones:v3';
const KEY_PREFS = 'cowork-tasks:prefs:v2';

// Legacy keys (v2) - read once during migration, then removed.
const LEGACY_KEY_TASKS = 'cowork-tasks:tasks:v2';
const LEGACY_KEY_TOMBSTONES = 'cowork-tasks:tombstones:v2';
const LEGACY_KEY_VERSION = 'cowork-tasks:version:v2';

const DEV_MOCK_ID_RE = /^t\d+$/;

export interface UiPrefs {
  collapsedColumns: string[];
  filterOwner?: string;
  filterLabel?: string;
  search?: string;
}

const DEFAULT_PREFS: UiPrefs = {
  collapsedColumns: [],
};

interface CacheEnvelope {
  schemaVersion: 3;
  snapshotVersion: number;
  tasks: Task[];
  /** Ids the user created locally (e.g. via the + button) that have no seed origin. */
  locallyCreatedIds: string[];
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isGhostId(id: string): boolean {
  return DEV_MOCK_ID_RE.test(id);
}

/**
 * One-time migration from the v2 keys to the v3 envelope. Runs on first
 * cache read when v3 is empty and v2 keys exist. Drops dev-mock ghosts
 * (ids matching `^t\d+$`) as part of the migration.
 */
function migrateLegacyCache(): CacheEnvelope | null {
  const legacyTasks = localStorage.getItem(LEGACY_KEY_TASKS);
  if (!legacyTasks) return null;

  const tasks = safeParse(legacyTasks, [] as Task[]).filter((t) => !isGhostId(t.id));
  const versionRaw = localStorage.getItem(LEGACY_KEY_VERSION);
  const snapshotVersion = versionRaw ? Number.parseInt(versionRaw, 10) || 0 : 0;

  const env: CacheEnvelope = {
    schemaVersion: 3,
    snapshotVersion,
    tasks,
    locallyCreatedIds: [],
  };

  // Migrate tombstones.
  const legacyTomb = localStorage.getItem(LEGACY_KEY_TOMBSTONES);
  if (legacyTomb && !localStorage.getItem(KEY_TOMBSTONES)) {
    localStorage.setItem(KEY_TOMBSTONES, legacyTomb);
  }

  // Persist v3 envelope, then drop legacy keys.
  try {
    localStorage.setItem(KEY_CACHE_V3, JSON.stringify(env));
    localStorage.removeItem(LEGACY_KEY_TASKS);
    localStorage.removeItem(LEGACY_KEY_VERSION);
    localStorage.removeItem(LEGACY_KEY_TOMBSTONES);
  } catch {
    /* ignore quota */
  }

  return env;
}

function loadEnvelope(): CacheEnvelope {
  const raw = localStorage.getItem(KEY_CACHE_V3);
  if (raw) {
    const parsed = safeParse<CacheEnvelope | null>(raw, null);
    if (parsed && parsed.schemaVersion === 3) {
      // Always strip ghost ids defensively.
      parsed.tasks = parsed.tasks.filter((t) => !isGhostId(t.id));
      parsed.locallyCreatedIds = parsed.locallyCreatedIds.filter((id) => !isGhostId(id));
      return parsed;
    }
  }
  const migrated = migrateLegacyCache();
  if (migrated) return migrated;
  return { schemaVersion: 3, snapshotVersion: 0, tasks: [], locallyCreatedIds: [] };
}

function saveEnvelope(env: CacheEnvelope): void {
  try {
    const json = JSON.stringify(env);
    if (json.length < 4_500_000) {
      localStorage.setItem(KEY_CACHE_V3, json);
      return;
    }
    // Quota guard: drop everything except active and locally-created.
    const trimmed: CacheEnvelope = {
      ...env,
      tasks: env.tasks.filter((t) => t.status === 'active'),
    };
    localStorage.setItem(KEY_CACHE_V3, JSON.stringify(trimmed));
  } catch {
    try {
      localStorage.removeItem(KEY_CACHE_V3);
    } catch {
      /* swallow */
    }
  }
}

export const storage = {
  // ----- version (cursor for diff polling) -----------------------------
  loadVersion(): number {
    return loadEnvelope().snapshotVersion;
  },
  saveVersion(version: number): void {
    const env = loadEnvelope();
    env.snapshotVersion = version;
    saveEnvelope(env);
  },

  // ----- tasks ----------------------------------------------------------
  loadTasks(): Task[] {
    return loadEnvelope().tasks;
  },
  loadCache(): { tasks: Task[]; snapshotVersion: number; locallyCreatedIds: Set<string> } {
    const env = loadEnvelope();
    return {
      tasks: env.tasks,
      snapshotVersion: env.snapshotVersion,
      locallyCreatedIds: new Set(env.locallyCreatedIds),
    };
  },
  saveTasks(tasks: Task[], snapshotVersion?: number): void {
    const env = loadEnvelope();
    env.tasks = tasks.filter((t) => !isGhostId(t.id));
    if (typeof snapshotVersion === 'number') env.snapshotVersion = snapshotVersion;
    saveEnvelope(env);
  },
  /** Mark an id as locally created so the merge keeps it across reseeds. */
  markLocallyCreated(id: string): void {
    if (isGhostId(id)) return;
    const env = loadEnvelope();
    if (!env.locallyCreatedIds.includes(id)) {
      env.locallyCreatedIds.push(id);
      saveEnvelope(env);
    }
  },
  unmarkLocallyCreated(id: string): void {
    const env = loadEnvelope();
    const next = env.locallyCreatedIds.filter((x) => x !== id);
    if (next.length !== env.locallyCreatedIds.length) {
      env.locallyCreatedIds = next;
      saveEnvelope(env);
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
      localStorage.removeItem(KEY_CACHE_V3);
      localStorage.removeItem(KEY_TOMBSTONES);
      // Also strip any leftover legacy keys.
      localStorage.removeItem(LEGACY_KEY_TASKS);
      localStorage.removeItem(LEGACY_KEY_VERSION);
      localStorage.removeItem(LEGACY_KEY_TOMBSTONES);
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
 * Snapshot-tagged merge (v3): the seed's `version` is authoritative for
 * "what ids exist on disk right now". A cached task gets dropped unless:
 *
 *   1. Its id is in the seed (then merge by `updated` time), OR
 *   2. Its id is in `locallyCreatedIds` (a freshly created card whose
 *      MCP/FSA write may not have landed yet), OR
 *   3. The cache's `snapshotVersion >= seedVersion` (we're seeing a
 *      stale or equal seed - keep cache in case the user opened the
 *      board in two windows).
 *
 * Tombstoned ids are always filtered.
 */
export function mergeWithCache(
  seed: Task[],
  cache: { tasks: Task[]; snapshotVersion: number; locallyCreatedIds: Set<string> },
  tombstones: Set<string>,
  seedVersion: number,
): Task[] {
  const map = new Map<string, Task>();
  const seedIds = new Set<string>();

  for (const t of seed) {
    if (tombstones.has(t.id)) continue;
    if (isGhostId(t.id)) continue;
    seedIds.add(t.id);
    map.set(t.id, t);
  }

  const cacheIsFresher = cache.snapshotVersion >= seedVersion && seedVersion > 0;

  for (const t of cache.tasks) {
    if (tombstones.has(t.id)) continue;
    if (isGhostId(t.id)) continue;

    const existing = map.get(t.id);
    if (existing) {
      // Both have it - newer-updated wins.
      const seedTime = Date.parse(existing.updated || '') || 0;
      const cachedTime = Date.parse(t.updated || '') || 0;
      if (cachedTime >= seedTime) {
        map.set(t.id, t);
      }
      continue;
    }

    // Cache has an id the seed doesn't.
    const isLocalCreation = cache.locallyCreatedIds.has(t.id);
    if (isLocalCreation || cacheIsFresher) {
      map.set(t.id, t);
    }
    // Else: stale ghost - drop silently.
  }

  return Array.from(map.values()).filter((t) => t.status === 'active');
}
