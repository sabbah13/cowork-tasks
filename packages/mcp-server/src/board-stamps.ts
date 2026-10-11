/**
 * Reads back what `prepare_board_artifact` stamps into the board page, so a
 * skill can check that what is published is what it prepared.
 *
 * The stamps are one inline script of JSON assignments:
 *
 *   <script>window.__INITIAL_STATE__={...};window.__PLUGIN_VERSION__="...";
 *     window.__COWORK_MCP_SERVER__="host:...";window.__SNAPSHOT_AT__="...";</script>
 *
 * The file may be a copy of a page that was published and fetched back, and
 * task titles come from email, so this never evaluates anything: it walks the
 * JSON values with a string-aware scanner. A title that happens to contain the
 * text `;window.__PLUGIN_VERSION__=` cannot confuse it, because the scanner
 * only looks for the next assignment after a complete JSON value.
 */

export interface BoardStamps {
  /** Number of tasks baked into the page (what a read-only snapshot shows). */
  tasks: number;
  /** The task store's version when the page was prepared. */
  version: number;
  pluginVersion: string | null;
  hostServer: string | null;
  snapshotAt: string | null;
}

const ASSIGNMENT = /\s*window\.(__[A-Z_]+__)\s*=/y;

/** Index just past the JSON string that starts at `start`, or -1 if unterminated. */
function endOfString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') {
      i += 1;
    } else if (c === '"') {
      return i + 1;
    }
  }
  return -1;
}

/** Index just past the JSON value that starts at `start`, or -1 if it is not one. */
function endOfJsonValue(text: string, start: number): number {
  const first = text[start];
  if (first === '"') return endOfString(text, start);
  if (first === '{' || first === '[') {
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
      const c = text[i];
      if (c === '"') {
        const end = endOfString(text, i);
        if (end < 0) return -1;
        i = end - 1;
      } else if (c === '{' || c === '[') {
        depth += 1;
      } else if (c === '}' || c === ']') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return -1;
  }
  const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(
    text.slice(start, start + 40),
  );
  return literal ? start + literal[0].length : -1;
}

/** Returns the stamps, or null if the text is not a prepared board page. */
export function readBoardStamps(html: string): BoardStamps | null {
  const open = html.indexOf('<script>window.__INITIAL_STATE__=');
  if (open === -1) return null;

  const values: Record<string, unknown> = {};
  let position = open + '<script>'.length;
  for (;;) {
    ASSIGNMENT.lastIndex = position;
    const match = ASSIGNMENT.exec(html);
    if (!match) break;
    const valueStart = ASSIGNMENT.lastIndex;
    const valueEnd = endOfJsonValue(html, valueStart);
    if (valueEnd < 0) return null;
    try {
      values[match[1] as string] = JSON.parse(html.slice(valueStart, valueEnd));
    } catch {
      return null;
    }
    position = valueEnd;
    while (html[position] === ';' || html[position] === ' ' || html[position] === '\n') {
      position += 1;
    }
  }

  const state = values.__INITIAL_STATE__ as { version?: unknown; tasks?: unknown } | undefined;
  if (!state || !Array.isArray(state.tasks) || typeof state.version !== 'number') return null;
  const text = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    tasks: state.tasks.length,
    version: state.version,
    pluginVersion: text(values.__PLUGIN_VERSION__),
    hostServer: text(values.__COWORK_MCP_SERVER__),
    snapshotAt: text(values.__SNAPSHOT_AT__),
  };
}
