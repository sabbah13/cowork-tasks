import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { api } from '../api';
import { storage } from '../storage';

/**
 * Maintains the active task collection. Hydrates from localStorage warm
 * cache, then polls the MCP server with a `since: version` cursor every
 * `intervalMs`. Pauses while the tab is hidden (Page Visibility API).
 *
 * Returns:
 *  - tasks (active only),
 *  - version (cursor),
 *  - newlyAdded ids since last apply (for the "new card" pulse animation),
 *  - refresh (force a full re-read).
 */
export function useTasks(intervalMs = 2000): {
  tasks: Task[];
  version: number;
  newlyAdded: Set<string>;
  refresh: () => void;
  loading: boolean;
} {
  const [tasks, setTasks] = useState<Task[]>(() => storage.loadTasks());
  const [version, setVersion] = useState<number>(() => storage.loadVersion());
  const [newlyAdded, setNewlyAdded] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(tasks.length === 0);
  const versionRef = useRef(version);
  versionRef.current = version;

  const apply = useCallback(
    (added: Task[], updated: Task[], removed: string[], nextVersion: number) => {
      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        for (const t of added) map.set(t.id, t);
        for (const t of updated) map.set(t.id, t);
        for (const id of removed) map.delete(id);
        const next = Array.from(map.values()).filter((t) => t.status === 'active');
        storage.saveTasks(next);
        return next;
      });
      if (added.length > 0) {
        setNewlyAdded(new Set(added.map((t) => t.id)));
        setTimeout(() => setNewlyAdded(new Set()), 1000);
      }
      setVersion(nextVersion);
      versionRef.current = nextVersion;
      storage.saveVersion(nextVersion);
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const result = await api.listTasks(0);
      apply(result.added, [], [], result.version);
      setLoading(false);
    } catch (err) {
      console.error('[cowork-tasks] refresh failed:', err);
    }
  }, [apply]);

  useEffect(() => {
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
          apply(result.added, result.updated, result.removed, result.version);
        }
        if (loading) setLoading(false);
      } catch (err) {
        if (loading) setLoading(false);
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
    // refresh/apply are stable refs; intervalMs rarely changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { tasks, version, newlyAdded, refresh, loading };
}
