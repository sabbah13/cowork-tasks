import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { api, getDataSource } from '../api';
import { storage, mergeWithCache } from '../storage';

const DEBUG = (() => {
  try {
    return new URLSearchParams(location.search).has('debug');
  } catch {
    return false;
  }
})();

const log = (...args: unknown[]) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[cowork-tasks]', ...args);
  }
};

/**
 * Maintains the active task collection and persists local edits across
 * reloads.
 *
 * Persistence layers (in order of preference):
 *   1. **File System Access API** - direct read/write of
 *      `~/.cowork-tasks/tasks/*.task.json`. Top-bar "Connect folder"
 *      button opts in.
 *   2. **MCP server** - `window.claude.callTool('cowork-tasks', ...)`.
 *      Available in Claude Code; not exposed in Cowork's iframe today.
 *   3. **localStorage** - always available. Local edits MERGE on top of
 *      any `__INITIAL_STATE__` Cowork bakes in via `open-board`, so
 *      drag/edit/archive/delete don't get overwritten on reload.
 *
 * Tombstone log: when the user archives or deletes a task, the id is
 * recorded in localStorage. Subsequent snapshots can't resurrect it.
 */
export function useTasks(intervalMs = 2000): {
  tasks: Task[];
  version: number;
  newlyAdded: Set<string>;
  refresh: () => void;
  loading: boolean;
  setTasksLocal: (mutator: (prev: Task[]) => Task[], nextVersion?: number) => void;
  resetToSnapshot: () => void;
} {
  // Boot order:
  //   - Seed = `__INITIAL_STATE__` from open-board (or empty).
  //   - Cache = {tasks, snapshotVersion, locallyCreatedIds} from prior session.
  //   - Tombstones = ids the user explicitly removed.
  //   Snapshot-tagged merge: cache entries not in the seed are kept ONLY
  //   if they were locally created OR the cache snapshot is at least as
  //   fresh as the seed. Drops ghost ids automatically.
  const seedVersion = window.__INITIAL_STATE__?.version ?? 0;
  const [tasks, setTasks] = useState<Task[]>(() => {
    const seed = window.__INITIAL_STATE__?.tasks ?? [];
    const cache = storage.loadCache();
    const tombstones = storage.loadTombstones();
    return mergeWithCache(seed, cache, tombstones, seedVersion);
  });
  const [version, setVersion] = useState<number>(() => {
    const v = window.__INITIAL_STATE__?.version;
    if (typeof v === 'number') return v;
    return storage.loadVersion();
  });
  const [newlyAdded, setNewlyAdded] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(tasks.length === 0);

  const seenIdsRef = useRef<Set<string>>(new Set(tasks.map((t) => t.id)));
  const tombstonesRef = useRef<Set<string>>(storage.loadTombstones());
  const versionRef = useRef(version);
  versionRef.current = version;
  const seedIdsRef = useRef<Set<string>>(
    new Set(window.__INITIAL_STATE__?.tasks?.map((t) => t.id) ?? []),
  );

  const apply = useCallback(
    (added: Task[], updated: Task[], removed: string[], nextVersion: number) => {
      // Drop incoming ids the user already removed.
      const filteredAdded = added.filter((t) => !tombstonesRef.current.has(t.id));
      const filteredUpdated = updated.filter((t) => !tombstonesRef.current.has(t.id));

      const newIds: string[] = [];
      for (const t of filteredAdded) {
        if (!seenIdsRef.current.has(t.id)) {
          newIds.push(t.id);
          seenIdsRef.current.add(t.id);
        }
      }
      for (const t of filteredUpdated) seenIdsRef.current.add(t.id);
      for (const id of removed) seenIdsRef.current.delete(id);

      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));

        // Merge by `updated`. Server / snapshot wins only if its edit is
        // newer than the local one.
        const overlay = (incoming: Task) => {
          const existing = map.get(incoming.id);
          if (!existing) {
            map.set(incoming.id, incoming);
            return;
          }
          const incomingTime = Date.parse(incoming.updated || '') || 0;
          const existingTime = Date.parse(existing.updated || '') || 0;
          if (incomingTime >= existingTime) map.set(incoming.id, incoming);
        };
        for (const t of filteredAdded) overlay(t);
        for (const t of filteredUpdated) overlay(t);
        for (const id of removed) {
          map.delete(id);
          tombstonesRef.current.add(id);
        }
        if (removed.length > 0) storage.saveTombstones(tombstonesRef.current);

        const next = Array.from(map.values()).filter((t) => t.status === 'active');
        storage.saveTasks(next, nextVersion);
        return next;
      });

      if (newIds.length > 0) {
        log('newly arrived ids:', newIds);
        setNewlyAdded(new Set(newIds));
        setTimeout(() => setNewlyAdded(new Set()), 1000);
      }

      setVersion(nextVersion);
      versionRef.current = nextVersion;
      storage.saveVersion(nextVersion);
    },
    [],
  );

  /**
   * Optimistic local mutation. Persists to localStorage immediately and
   * tombstones any id that was removed (so snapshots can't bring it back).
   * App.tsx kicks off best-effort persistence to MCP / FSA in parallel.
   */
  const setTasksLocal = useCallback(
    (mutator: (prev: Task[]) => Task[], nextVersion?: number) => {
      setTasks((prev) => {
        const next = mutator(prev);
        const nextIds = new Set(next.map((t) => t.id));
        const prevIds = new Set(prev.map((t) => t.id));
        for (const t of next) {
          seenIdsRef.current.add(t.id);
          // Track ids the user just created locally (not in seed, not in
          // prev) so the merge keeps them across reseeds even if MCP/FSA
          // hasn't synced them to disk yet.
          if (!prevIds.has(t.id) && !seedIdsRef.current.has(t.id)) {
            storage.markLocallyCreated(t.id);
          }
        }
        for (const t of prev) {
          if (!nextIds.has(t.id)) {
            tombstonesRef.current.add(t.id);
            storage.unmarkLocallyCreated(t.id);
          }
        }
        storage.saveTasks(next, nextVersion);
        storage.saveTombstones(tombstonesRef.current);
        return next;
      });
      if (typeof nextVersion === 'number') {
        setVersion(nextVersion);
        versionRef.current = nextVersion;
        storage.saveVersion(nextVersion);
      }
    },
    [],
  );

  /** Wipe local edits + tombstones; re-seed from `__INITIAL_STATE__`. */
  const resetToSnapshot = useCallback(() => {
    storage.clear();
    tombstonesRef.current = new Set();
    seenIdsRef.current = new Set();
    const seed = window.__INITIAL_STATE__?.tasks ?? [];
    const v = window.__INITIAL_STATE__?.version ?? 0;
    const active = seed.filter((t) => t.status === 'active');
    setTasks(active);
    setVersion(v);
    versionRef.current = v;
    for (const t of seed) seenIdsRef.current.add(t.id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await api.listTasks(0);
      log('refresh result:', { version: result.version, added: result.added.length });
      apply(result.added, [], [], result.version);
      setLoading(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cowork-tasks] refresh failed:', err);
    }
  }, [apply]);

  useEffect(() => {
    const source = getDataSource();
    log('boot data source:', source);

    if (source === 'snapshot') {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      if (cancelled || document.hidden) return;
      try {
        const result = await api.listTasks(versionRef.current || undefined);
        if (cancelled) return;
        if (
          result.version !== versionRef.current ||
          result.added.length > 0 ||
          result.updated.length > 0 ||
          result.removed.length > 0
        ) {
          log('poll diff:', {
            from: versionRef.current,
            to: result.version,
            added: result.added.length,
            updated: result.updated.length,
            removed: result.removed.length,
          });
          apply(result.added, result.updated, result.removed, result.version);
        }
        if (loading) setLoading(false);
      } catch (err) {
        if (loading) setLoading(false);
        // eslint-disable-next-line no-console
        console.error('[cowork-tasks] poll failed:', err);
      } finally {
        if (!cancelled) {
          const next = document.hidden ? intervalMs * 5 : intervalMs;
          timer = window.setTimeout(poll, next);
        }
      }
    };

    poll();

    const onVisibility = () => {
      if (!document.hidden) {
        if (timer !== null) clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { tasks, version, newlyAdded, refresh, loading, setTasksLocal, resetToSnapshot };
}
