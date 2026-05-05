#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoworkTasksServer } from './server.js';

/**
 * Expand `${HOME}`, `${USER}`, `${CLAUDE_PLUGIN_ROOT}` etc. in a config value.
 * Cowork only expands these tokens in `args[]`, not in `env{}` values, so we
 * defensively expand here too.
 */
function expandEnv(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  // If the value contains an unresolved ${VAR} token, fall back rather than
  // produce a literal-string path.
  const expanded = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/gi, (_m, name) => {
    return process.env[name] ?? '';
  });
  if (expanded.includes('${') || expanded.startsWith('/')) {
    // ok or fully relative
  }
  // If after expansion we end up with a path starting with "/.cowork-tasks"
  // (i.e. ${HOME} was not expanded), fall back.
  if (expanded === '' || expanded.includes('${') || /^\/?\.[a-z]/.test(expanded)) {
    return fallback;
  }
  return expanded;
}

/**
 * Derive the plugin root from the bundle location.
 *
 * The Cowork plugin layout puts our bundle at:
 *   <pluginRoot>/bundle/mcp-server.js
 *
 * So `path.dirname(path.dirname(scriptPath))` gives us the plugin root.
 * This is more reliable than env vars because Cowork doesn't expand
 * `${CLAUDE_PLUGIN_ROOT}` in `env` values - only in `args[]`.
 */
function derivePluginRoot(): string | undefined {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const bundleDir = path.dirname(scriptPath);
    const root = path.dirname(bundleDir);
    return root;
  } catch {
    return undefined;
  }
}

const home = expandEnv(process.env.TASKS_HOME, path.join(os.homedir(), '.cowork-tasks'));
const pluginRoot = derivePluginRoot();
// Optional override: lets the user point to a `tasks/` folder outside
// the home dir (e.g. inside a git repo so .task.json files live next to
// code). When unset the store defaults to <home>/tasks.
const tasksDir = process.env.TASKS_DIR
  ? expandEnv(process.env.TASKS_DIR, path.join(home, 'tasks'))
  : undefined;

async function main() {
  const server = new CoworkTasksServer({ home, pluginRoot, tasksDir });
  await server.start();
  const transport = new StdioServerTransport();
  await server.rawServer.connect(transport);
  process.stderr.write(
    `[cowork-tasks-mcp] running, home=${home}, pluginRoot=${pluginRoot ?? '(unknown)'}\n`,
  );
  const stop = () => {
    void server.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  process.stderr.write(`[cowork-tasks-mcp] fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
