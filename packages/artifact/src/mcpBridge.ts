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

// ------------------------------------------------------------- diagnostics

/**
 * What the board learned while trying to reach the task server. Shown in the
 * read-only banner so "can't reach the server" comes with a reason a person (or
 * a screenshot) can act on.
 */
export interface BridgeDiagnostics {
  /** The `host:<name>` the page was published for, if it was stamped. */
  hostServer: string | null;
  /** Whether `window.claude.use` exists, i.e. the page runs in the artifact runtime. */
  runtime: 'present' | 'missing';
  /** Outcome of `await claude.use("mcp")`. */
  mcp: 'not-tried' | 'ok' | 'null' | 'timeout' | 'threw';
  /** State of the `mcp:<server>` permission, if it could be read. */
  permission: string | null;
  /** Whether the host server showed up in `listTools()` (diagnostic only), if asked. */
  listed: boolean | null;
  /** The last error that retired the bridge. */
  failure: { code: string; message: string } | null;
}

export function freshDiagnostics(): BridgeDiagnostics {
  return {
    hostServer: null,
    runtime: 'missing',
    mcp: 'not-tried',
    permission: null,
    listed: null,
    failure: null,
  };
}

export interface DegradedExplanation {
  /** One sentence: what is wrong. */
  headline: string;
  /** One sentence: what to do about it. */
  hint: string;
  canRetry: boolean;
  canManagePermissions: boolean;
  /** A single copyable line of the raw facts. */
  details: string;
}

/** "Oct 6, 3:48 AM" style, in the viewer's locale. Empty string if unparseable. */
export function formatSnapshotTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Turns the diagnostics into words. The first matching case wins, most specific first. */
export function explainDegraded(d: BridgeDiagnostics): DegradedExplanation {
  const details = [
    `host=${d.hostServer ?? 'none'}`,
    `runtime=${d.runtime}`,
    `mcp=${d.mcp}`,
    `permission=${d.permission ?? 'unknown'}`,
    `listed=${d.listed === null ? 'unknown' : d.listed}`,
    d.failure ? `error=${d.failure.code}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  if (d.runtime === 'missing') {
    return {
      headline: "This page isn't running inside the Claude app's artifact runtime.",
      hint: 'Open the board from the Claude desktop app.',
      canRetry: false,
      canManagePermissions: false,
      details,
    };
  }
  if (d.permission === 'denied') {
    return {
      headline: 'Access to your Cowork Tasks server was declined for this artifact.',
      hint: "Allow it in the artifact's permissions to make the board live.",
      canRetry: true,
      canManagePermissions: true,
      details,
    };
  }
  if (d.mcp === 'null' || d.mcp === 'timeout' || d.mcp === 'threw') {
    return {
      headline: "The Claude app didn't give this page access to connectors.",
      hint: 'Open the board from the Claude desktop app, not a browser tab, then retry.',
      canRetry: true,
      canManagePermissions: true,
      details,
    };
  }
  if (d.failure?.code === 'not_in_manifest') {
    return {
      headline: "This page isn't allowed to use your Cowork Tasks server.",
      hint: 'It was likely published for a differently named server. Run /cowork-tasks:open-board again to republish it.',
      canRetry: true,
      canManagePermissions: true,
      details,
    };
  }
  if (d.failure?.code === 'server_not_connected' || d.listed === false) {
    return {
      headline: "Your Cowork Tasks server isn't reachable from this view.",
      hint: 'It runs on your computer while the Cowork Tasks plugin is active. Open the board from a session where the plugin is loaded, then retry.',
      canRetry: true,
      canManagePermissions: false,
      details,
    };
  }
  return {
    headline: `Couldn't reach your Cowork Tasks server${d.failure ? ` (${d.failure.code})` : ''}.`,
    hint: 'Retry; if it keeps failing, run /cowork-tasks:open-board to republish.',
    canRetry: true,
    canManagePermissions: true,
    details,
  };
}
