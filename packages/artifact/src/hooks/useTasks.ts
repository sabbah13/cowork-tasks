import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { api, getDataSource } from '../api';
import { storage } from '../storage';

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
 * Maintains the active task collection.
 *
 * Boot order:
 *   1. `__INITIAL_STATE__` snapshot baked by the `open-board` skill.
 *   2. localStorage warm cache.
 *   3. Empty - let polling fill it.
 *
 * After boot, behavior depends on the data source (see `getDataSource()`):
 *   - `mcp`  - poll `list_tasks(since)` every 2s; only NEW ids glow.
 *   - `fs`   - poll the file system; same diff semantics.
 *   - `snapshot` (Cowork's iframe with no callTool bridge) - state is
 *     authoritative and local; polling is disabled to prevent the
 *     "every-card-glows" feedback loop.
 */
export function useTasks(intervalMs = 2000): {
  tasks: Task[];
  version: number;
  newlyAdded: Set<string>;
  refresh: () => void;
  loading: boolean;
  setTasksLocal: (mutator: (prev: Task[]) => Task[], nextVersion?: number) => void;
} {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const initial = window.__INITIAL_STATE__?.tasks;
    if (initial && initial.length > 0) return initial.filter((t) => t.status === 'active');
    return storage.loadTasks();
  });
  const [version, setVersion] = useState<number>(() => {
    const v = window.__INITIAL_STATE__?.version;
    return typeof v === 'number' ? v : storage.loadVersion();
  });
  const [newlyAdded, setNewlyAdded] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(tasks.length === 0);

  // Track ids the artifact has already seen so we only glow tasks that
  // genuinely arrive AFTER first paint. Without this, every list_tasks
  // response (which always carries the full active set) was retriggering
  // the new-card pulse on every poll.
  const seenIdsRef = useRef<Set<string>>(new Set(tasks.map((t) => t.id)));
  const versionRef = useRef(version);
  versionRef.current = version;

  const apply = useCallback(
    (added: Task[], updated: Task[], removed: string[], nextVersion: number) => {
      const newIds: string[] = [];
      for (const t of added) {
        if (!seenIdsRef.current.has(t.id)) {
          newIds.push(t.id);
          seenIdsRef.current.add(t.id);
        }
      }
      for (const t of updated) seenIdsRef.current.add(t.id);
      for (const id of removed) seenIdsRef.current.delete(id);

      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        for (const t of added) map.set(t.id, t);
        for (const t of updated) map.set(t.id, t);
        for (const id of removed) map.delete(id);
        const next = Array.from(map.values()).filter((t) => t.status === 'active');
        storage.saveTasks(next);
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
   * Local-only mutation. Used by App.tsx for optimistic updates - drag,
   * inline add, side-panel edits - so the UI responds immediately even
   * when the persistence layer (MCP / FSA) is unavailable.
   */
  const setTasksLocal = useCallback(
    (mutator: (prev: Task[]) => Task[], nextVersion?: number) => {
      setTasks((prev) => {
        const next = mutator(prev);
        for (const t of next) seenIdsRef.current.add(t.id);
        storage.saveTasks(next);
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
      // No live source - the artifact runs on the seeded INITIAL_STATE
      // plus optimistic local mutations. Polling here would just re-feed
      // the same snapshot and retrigger the new-card glow on every tick.
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

  return { tasks, version, newlyAdded, refresh, loading, setTasksLocal };
}
