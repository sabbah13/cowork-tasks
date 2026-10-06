/**
 * Pure helpers for validate-skills.mjs, split out so they can be unit-tested.
 *
 * The `open-board` skill hands Cowork an `mcp_tools` allowlist when it creates
 * the board artifact. Cowork enforces that allowlist silently: a tool the
 * artifact calls but the list omits just fails at runtime. So the build checks
 * three things, not just the entry format:
 *
 *   artifact calls  is a subset of  allowlist  is a subset of  server tools
 */

export const SERVER = 'cowork-tasks';
export const MCP_TOOL_RE = /^mcp__[a-z0-9_-]+__[a-z0-9_-]+$/i;

/** Every `"mcp_tools": [ ... ]` block in a markdown file, as arrays of entries. */
export function extractAllowlists(text) {
  const re = /"mcp_tools"\s*:\s*\[([\s\S]*?)\]/g;
  const blocks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push([...m[1].matchAll(/"([^"]+)"/g)].map((e) => e[1]));
  }
  return blocks;
}

/** Tool names declared in the MCP server's `TOOLS` array (`    name: 'list_tasks'`). */
export function serverToolNames(serverSource) {
  return new Set([...serverSource.matchAll(/^ {4}name:\s*'([a-z_]+)'/gm)].map((m) => m[1]));
}

/** Tool names the artifact invokes through `callMcp('tool', ...)` / `callMcp<T>('tool', ...)`. */
export function artifactToolCalls(artifactSource) {
  return new Set([...artifactSource.matchAll(/callMcp\b[^(]*\(\s*'([a-z_]+)'/g)].map((m) => m[1]));
}

/**
 * Returns a list of human-readable problems (empty = ok).
 * `label` prefixes each message, e.g. the skill file path.
 */
export function checkAllowlists({ label, allowlists, serverTools, artifactCalls }) {
  const problems = [];
  const prefix = `mcp__${SERVER}__`;
  const normalized = [];

  allowlists.forEach((entries, i) => {
    const where = `${label} (mcp_tools block ${i + 1})`;
    if (entries.length === 0) {
      problems.push(`${where}: empty mcp_tools allowlist`);
      return;
    }
    const tools = new Set();
    for (const entry of entries) {
      if (!MCP_TOOL_RE.test(entry)) {
        problems.push(`${where}: entry "${entry}" must match mcp__<server>__<tool>`);
        continue;
      }
      if (!entry.startsWith(prefix)) continue; // another server's tool; not ours to verify
      const tool = entry.slice(prefix.length);
      if (!serverTools.has(tool)) {
        problems.push(`${where}: "${entry}" is not a tool the ${SERVER} MCP server exposes`);
      }
      tools.add(tool);
    }
    const missing = [...artifactCalls].filter((t) => !tools.has(t)).sort();
    if (missing.length > 0) {
      problems.push(
        `${where}: the artifact calls ${missing.join(', ')} but the allowlist omits ` +
          `${missing.length === 1 ? 'it' : 'them'}; Cowork would reject the call at runtime`,
      );
    }
    normalized.push([...tools].sort().join(','));
  });

  if (new Set(normalized).size > 1) {
    problems.push(
      `${label}: the mcp_tools blocks differ from each other; update and create must grant the same tools`,
    );
  }
  return problems;
}
