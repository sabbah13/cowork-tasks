#!/usr/bin/env node
/**
 * Triage runner.
 *
 * Drains `~/.cowork-tasks/triage-queue/<connector>/<hash>.json` files into
 * the MCP server as well-formed tasks. Runs once per `--once` invocation, or
 * stays alive on a `triageIntervalMinutes` schedule.
 *
 * The actual extraction is delegated to the `task-extractor` subagent (the
 * agent definition lives in `agents/task-extractor.md`). This binary's job
 * is the boring part:
 *  - assemble the prompt input,
 *  - invoke the agent,
 *  - apply the result via MCP create_tasks + mark_processed,
 *  - clean up the queue.
 *
 * In v0.1 the agent invocation is "stubbed" by emitting a structured prompt
 * to stdout that Cowork picks up via the `triage-now` skill. When the user
 * runs Cowork directly (no Claude wrapping), we fall back to a heuristic
 * extraction so the board is still useful out-of-the-box.
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';

const HOME = process.env.TASKS_HOME ?? path.join(os.homedir(), '.cowork-tasks');
const QUEUE = path.join(HOME, 'triage-queue');
const FAILED = path.join(QUEUE, '_failed');
const STATE = path.join(HOME, 'triage-state.json');

const MCP_BIN = process.env.COWORK_TASKS_MCP_BIN ?? 'cowork-tasks-mcp';

const argv = process.argv.slice(2);
const once = argv.includes('--once') || argv.includes('-1');
const verbose = argv.includes('--verbose') || argv.includes('-v');

main().catch((err) => {
  process.stderr.write(`[triage-runner] fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});

async function main() {
  await fs.mkdir(QUEUE, { recursive: true });
  if (once) {
    const stats = await runOnce();
    process.stdout.write(`${JSON.stringify(stats)}\n`);
    return;
  }
  // Daemon mode: poll on the configured interval.
  let intervalMs = 60 * 60 * 1000; // 1 hour default
  try {
    const state = JSON.parse(await fs.readFile(STATE, 'utf-8'));
    if (typeof state.intervalMs === 'number') intervalMs = state.intervalMs;
  } catch {
    // first run
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stats = await runOnce();
    if (verbose) process.stdout.write(`[triage-runner] ${JSON.stringify(stats)}\n`);
    await sleep(intervalMs);
  }
}

async function runOnce() {
  const items = await loadQueueItems();
  if (items.length === 0) {
    return { drained: 0, created: 0, skipped: 0, failed: 0 };
  }

  // Heuristic fallback (no Claude wrapping). Keeps the system useful out of
  // the box; the real extractor (task-extractor agent) runs when Cowork is
  // available - the `triage-now` skill invokes it explicitly.
  const drafts = items.map(heuristicDraft).filter((d) => d !== null);

  const created = await mcpCall('create_tasks', { tasks: drafts.map((d) => d.task) });
  for (const item of items) {
    await mcpCall('mark_processed', {
      connector: item.envelope.connector,
      sourceHash: item.envelope.sourceHash,
    });
    await fs.unlink(item.path).catch(() => undefined);
  }

  return {
    drained: items.length,
    created: Array.isArray(created) ? created.length : drafts.length,
    skipped: items.length - drafts.length,
    failed: 0,
  };
}

async function loadQueueItems() {
  const result = [];
  let dirs;
  try {
    dirs = await fs.readdir(QUEUE);
  } catch {
    return result;
  }
  for (const connector of dirs) {
    if (connector.startsWith('_')) continue; // skip _failed/
    const dir = path.join(QUEUE, connector);
    let files;
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const fp = path.join(dir, f);
      try {
        const raw = await fs.readFile(fp, 'utf-8');
        const envelope = JSON.parse(raw);
        result.push({ path: fp, envelope: { ...envelope, connector } });
      } catch {
        // ignore malformed
      }
    }
  }
  return result;
}

function heuristicDraft({ envelope }) {
  // Skip newsletters / automated emails on naive signals.
  const title = String(envelope.title ?? '').trim();
  if (!title) return null;
  if (/^(re:|fwd:)/i.test(title) && !/\?/.test(title)) return null;
  if (/unsubscribe|newsletter|notifications? from/i.test(title)) return null;

  const sourceType = String(envelope.connector ?? '').split('-').slice(1).join('-') || 'manual';
  const draft = {
    title: actionVerbForm(title),
    description: (envelope.body ?? '').slice(0, 300),
    column: 'inbox',
    priority: envelope.priority === 'high' ? 'high' : 'none',
    labels: [sourceType],
    source: {
      type: mapConnectorToSourceType(envelope.connector),
      url: envelope.url,
      author: envelope.author,
    },
  };
  return { task: draft, queueId: envelope.sourceHash };
}

function mapConnectorToSourceType(connector) {
  const family = String(connector ?? '').split('-')[0];
  switch (family) {
    case 'email':
      return 'email';
    case 'meet':
      return 'meeting';
    case 'chat':
      return 'slack'; // best-effort default
    case 'issues':
      return 'jira';
    default:
      return 'manual';
  }
}

function actionVerbForm(s) {
  // Trim "Re:", "Fwd:" prefixes and ensure the title is action-y.
  const cleaned = s.replace(/^(re:|fwd:|fw:)\s*/i, '').trim();
  // If it ends with "?" we keep the question form. Otherwise prepend "Reply
  // to" or "Review" depending on shape.
  if (/\?$/.test(cleaned)) return `Reply to "${cleaned}"`;
  if (/^(can|could|please|kindly|need)/i.test(cleaned)) return `Action: ${cleaned}`;
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

async function mcpCall(tool, args) {
  // Spawns the MCP server in stdio mode and sends a single tools/call.
  // We use a hand-rolled JSON-RPC client to avoid pulling in MCP SDK from a
  // .js file. Two messages: initialize, then call.
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(MCP_BIN, [], { env: { ...process.env, TASKS_HOME: HOME } });
    let id = 0;
    const send = (obj) =>
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, ...obj }) + '\n');
    let buffer = '';
    let initialized = false;
    let result;
    let stderr = '';
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.stdout.on('data', (b) => {
      buffer += b.toString();
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1 && !initialized) {
          initialized = true;
          send({
            method: 'tools/call',
            params: { name: tool, arguments: args },
          });
        } else if (msg.id === 2) {
          const text = msg.result?.content?.[0]?.text;
          try {
            result = text ? JSON.parse(text) : msg.result;
          } catch {
            result = text;
          }
          child.kill('SIGTERM');
          resolve(result);
        } else if (msg.error) {
          child.kill('SIGTERM');
          reject(new Error(`mcp error: ${msg.error.message ?? JSON.stringify(msg.error)}`));
        }
      }
    });
    child.on('exit', () => {
      if (!initialized) reject(new Error(`mcp exited before initialize: ${stderr}`));
    });
    send({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'triage-runner', version: '0.1.0' },
        capabilities: {},
      },
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
