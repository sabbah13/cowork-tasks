import { useCallback, useEffect, useState } from 'react';
import type { Board, Column, Config } from '../types';
import { api } from '../api';

const FALLBACK_CONFIG: Config = {
  labels: [],
  triageIntervalMinutes: 60,
  defaultBoard: 'main',
  boards: [
    {
      id: 'main',
      name: 'Main Board',
      columns: [
        { id: 'inbox', name: 'Inbox', icon: 'inbox', color: '#6b6a64' },
        { id: 'todo', name: 'To Do', icon: 'list', color: '#6a9bcc' },
        { id: 'in-progress', name: 'In Progress', icon: 'loader', color: '#d97757' },
        { id: 'blocked', name: 'Blocked', icon: 'octagon-x', color: '#c89a3f' },
        { id: 'done', name: 'Done', icon: 'check', color: '#788c5d' },
      ],
    },
  ],
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `col-${Date.now().toString(36)}`
  );
}

export interface ConfigApi {
  config: Config;
  /** Rename a column on the active board. Persists best-effort. */
  renameColumn: (columnId: string, name: string) => void;
  /** Append a new column to the active board. Persists best-effort. */
  addColumn: (name: string) => void;
}

/**
 * Loads the board configuration once at mount and exposes mutators that
 * update the local copy optimistically and call MCP `update_config`.
 * Cowork's iframe does not expose `callTool` today, so the optimistic
 * local state is the user-visible source of truth between opens.
 */
export function useConfig(): ConfigApi {
  const [config, setConfig] = useState<Config>(FALLBACK_CONFIG);

  useEffect(() => {
    api
      .listConfig()
      .then((c) => setConfig(c ?? FALLBACK_CONFIG))
      .catch(() => setConfig(FALLBACK_CONFIG));
  }, []);

  const persist = useCallback((next: Config) => {
    setConfig(next);
    void api.updateConfig({ boards: next.boards });
  }, []);

  const renameColumn = useCallback(
    (columnId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const next: Config = {
        ...config,
        boards: config.boards.map((b: Board) => ({
          ...b,
          columns: b.columns.map((c: Column) =>
            c.id === columnId ? { ...c, name: trimmed } : c,
          ),
        })),
      };
      persist(next);
    },
    [config, persist],
  );

  const addColumn = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const board = config.boards.find((b) => b.id === config.defaultBoard) ?? config.boards[0];
      if (!board) return;
      let id = slugify(trimmed);
      const taken = new Set(board.columns.map((c) => c.id));
      let suffix = 2;
      while (taken.has(id)) {
        id = `${slugify(trimmed)}-${suffix++}`;
      }
      const newCol: Column = { id, name: trimmed, color: '#6b6a64' };
      const next: Config = {
        ...config,
        boards: config.boards.map((b: Board) =>
          b.id === board.id ? { ...b, columns: [...b.columns, newCol] } : b,
        ),
      };
      persist(next);
    },
    [config, persist],
  );

  return { config, renameColumn, addColumn };
}
