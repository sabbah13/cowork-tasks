/**
 * Bridge between the live artifact and the Cowork Tasks MCP server.
 *
 * In production, Cowork exposes `window.claude.callTool(server, tool, args)`
 * to live artifacts. We wrap that here, with a dev-mode fallback that hits a
 * local stub server so the dashboard can be developed in plain `vite dev`.
 */

declare global {
  interface Window {
    claude?: {
      callTool?: (server: string, tool: string, args: unknown) => Promise<unknown>;
      complete?: (prompt: string) => Promise<string>;
      sendToChat?: (prompt: string) => Promise<void>;
    };
  }
}

const SERVER = 'cowork-tasks';

async function callTool<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const bridge = window.claude?.callTool;
  if (bridge) {
    const out = (await bridge(SERVER, tool, args)) as { content?: { text?: string }[] } | T;
    // Cowork returns MCP `content` blocks; unwrap the JSON-text payload.
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
  // Dev fallback: hit a local HTTP shim that bridges to the MCP server.
  const res = await fetch(`/__dev_mcp/${tool}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${tool}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface ListTasksResult {
  version: number;
  added: import('./types').Task[];
  updated: import('./types').Task[];
  removed: string[];
}

export const api = {
  listTasks: (since?: number) => callTool<ListTasksResult>('list_tasks', since ? { since } : {}),
  getTask: (id: string) => callTool<import('./types').Task | null>('get_task', { id }),
  createTask: (draft: Partial<import('./types').Task>) =>
    callTool<import('./types').Task>('create_task', draft as Record<string, unknown>),
  updateTask: (id: string, patch: Partial<import('./types').Task>, ifVersion?: number) =>
    callTool<import('./types').Task>('update_task', { id, patch, ifVersion }),
  moveTask: (id: string, column: string, position: number, ifVersion?: number) =>
    callTool<{ ok: boolean; version: number }>('move_task', { id, column, position, ifVersion }),
  archiveTask: (id: string) => callTool<{ ok: boolean }>('archive_task', { id }),
  deleteTask: (id: string) => callTool<{ ok: boolean }>('delete_task', { id }),
  listConfig: () => callTool<import('./types').Config>('list_config'),
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
