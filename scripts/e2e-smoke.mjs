#!/usr/bin/env node
/**
 * Smoke-test: spawn the built MCP server, do a list_tasks -> create_task ->
 * list_tasks(since=v1) round trip, assert the diff contains our task.
 *
 * Run after a full repo build to confirm the plumbing works end-to-end.
 */
import { spawn } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';

const home = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-tasks-e2e-'));
// Prefer the bundled server (what Cowork actually runs) when present;
// fall back to the workspace `dist/cli.js` if the plugin hasn't been built.
const bundled = path.resolve('packages/plugin/bundle/mcp-server.js');
const dev = path.resolve('packages/mcp-server/dist/cli.js');
const mcpPath = (await fs.access(bundled).then(() => true).catch(() => false)) ? bundled : dev;
const child = spawn('node', [mcpPath], { env: { ...process.env, TASKS_HOME: home } });

let buffer = '';
let id = 0;
const inflight = new Map();

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
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
    const resolver = inflight.get(msg.id);
    if (!resolver) continue;
    inflight.delete(msg.id);
    if (msg.error) resolver.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
    else resolver.resolve(msg.result);
  }
});

child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const myId = ++id;
    inflight.set(myId, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
  });
}

async function call(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  const text = result?.content?.[0]?.text;
  return text ? JSON.parse(text) : result;
}

try {
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    clientInfo: { name: 'e2e-smoke', version: '0.1.0' },
    capabilities: {},
  });

  const initial = await call('list_tasks', {});
  if (initial.added.length !== 0) throw new Error('expected empty initial list');

  const created = await call('create_task', {
    title: 'Smoke-test task',
    description: 'Created by scripts/e2e-smoke.mjs',
    source: { type: 'manual' },
  });
  if (!created.id) throw new Error('create_task returned no id');

  const diff = await call('list_tasks', { since: initial.version });
  const found = diff.added.find((t) => t.id === created.id);
  if (!found) throw new Error('created task not in diff');

  await call('move_task', { id: created.id, column: 'todo', position: 0 });
  const fresh = await call('get_task', { id: created.id });
  if (fresh.column !== 'todo') throw new Error('move_task did not persist column');

  console.log(JSON.stringify({ ok: true, version: diff.version, taskId: created.id }, null, 2));
} catch (err) {
  console.error('SMOKE FAIL:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await fs.rm(home, { recursive: true, force: true });
}
