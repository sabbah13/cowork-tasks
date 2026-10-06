/**
 * Pure helpers for the artifact runtime's `mcp` capability
 * (`const mcp = await window.claude.use("mcp")`).
 *
 * Kept free of `window` access so they can be unit-tested in plain node. The
 * wiring (which server to call, caching the namespace, falling back to a
 * snapshot) lives in api.ts.
 */

/** `host:` + the local MCP server's name with anything outside [A-Za-z0-9_-] replaced by `_`. */
export const HOST_SERVER_RE = /^host:[A-Za-z0-9_-]+$/;

export function isValidHostServer(value: unknown): value is string {
  return typeof value === 'string' && HOST_SERVER_RE.test(value);
}

/**
 * What a failed `mcp.callTool` means for the board.
 *
 * - `bridge-down`: this view cannot reach the Cowork Tasks server at all
 *   (not in the Claude app, server not running, consent refused, policy).
 *   Stop calling it and show the read-only snapshot.
 * - `declined`: the viewer said no to the app's confirmation for a write.
 *   The write never ran; the bridge itself is fine.
 * - `tool`: the server answered and reported a failure for this one call.
 * - `transient`: unreachable right now, rate limited, or an unknown code.
 *   Keep the bridge and let the next poll try again.
 */
export type McpFailureKind = 'bridge-down' | 'declined' | 'tool' | 'transient';

const BRIDGE_DOWN_CODES = new Set([
  'server_not_connected',
  'server_not_found',
  'not_in_manifest',
  'not_granted',
  'capability_disabled',
  'capability_removed',
  'blocked_by_policy',
  'approval_required',
  'needs_reauth',
  'selection_required',
  'consent_required',
  'user_changed',
]);

const TOOL_CODES = new Set(['tool_error', 'bad_request', 'transform_error']);

export function classifyMcpError(err: unknown): { kind: McpFailureKind; code: string } {
  const code =
    typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : 'unknown';
  if (BRIDGE_DOWN_CODES.has(code)) return { kind: 'bridge-down', code };
  if (code === 'cancelled') return { kind: 'declined', code };
  if (TOOL_CODES.has(code)) return { kind: 'tool', code };
  // server_unavailable, upstream_error, rate_limited, and any code newer than
  // this contract: the runtime says to treat unknown codes as upstream_error.
  return { kind: 'transient', code };
}

/**
 * The JSON answer of a `callTool` result. The runtime provides `payload`
 * (structured content, else the first text block parsed as JSON, else the
 * text); older shells may only give `content`, so fall back the same way.
 */
export function unwrapPayload<T>(result: unknown): T {
  if (typeof result !== 'object' || result === null) return result as T;
  const r = result as {
    payload?: unknown;
    structuredContent?: unknown;
    content?: { type?: string; text?: unknown }[];
  };
  if (r.payload !== undefined) return r.payload as T;
  if (r.structuredContent !== undefined) return r.structuredContent as T;
  const block = r.content?.find((b) => b && typeof b.text === 'string');
  if (block && typeof block.text === 'string') {
    try {
      return JSON.parse(block.text) as T;
    } catch {
      return block.text as unknown as T;
    }
  }
  return result as T;
}

/** Tools that only read. A failure of one of these is not worth telling the user about. */
export const READ_ONLY_TOOLS = new Set(['list_tasks', 'get_task', 'get_tasks_bulk', 'list_config']);

/** Human wording for the "change not saved" toast. */
export function writeFailureMessage(kind: McpFailureKind): string {
  switch (kind) {
    case 'declined':
      return 'Change not saved: the request was declined in the Claude app.';
    case 'bridge-down':
      return "Change not saved: this view can't reach your Cowork Tasks server, so the board is read-only.";
    case 'tool':
      return 'Change not saved: the Cowork Tasks server rejected it.';
    default:
      return "Couldn't save that change right now. Try it again in a moment.";
  }
}

/**
 * The board polls through the capability every few seconds. The runtime's own
 * guidance is never to tighten a polling loop, so the new bridge is slower
 * than the 2 s used for the legacy in-iframe bridge.
 */
export const USE_BRIDGE_MIN_POLL_MS = 5000;
