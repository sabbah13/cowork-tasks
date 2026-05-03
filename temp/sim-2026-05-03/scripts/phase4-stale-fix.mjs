#!/usr/bin/env node
/**
 * Re-run Phase 4 step 4 with correct args. The MCP tool clear_artifact_folder
 * requires { artifactsDir, id }. We create a stale dir and ask the server to
 * clear it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = '/Users/sabbah/Documents/Projects/cowork-tasks';
const TEMP = path.join(REPO, 'temp/sim-2026-05-03');
const fakeRoot = path.join(TEMP, 'fake-artifacts');
const stale = path.join(fakeRoot, 'cowork-tasks');
fs.mkdirSync(stale, { recursive: true });
fs.writeFileSync(path.join(stale, 'leftover.html'), '<!-- stale -->');

const cliPath = path.join(REPO, 'packages/mcp-server/dist/cli.js');

const requests = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 't', version: '0' }, capabilities: {} } },
  { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'clear_artifact_folder', arguments: { artifactsDir: fakeRoot, id: 'cowork-tasks' } } },
];

const child = spawnSync('node', [cliPath], {
  encoding: 'utf8',
  timeout: 15_000,
  input: requests.map(r => JSON.stringify(r)).join('\n') + '\n',
});

const after = fs.existsSync(stale);
const result = {
  beforeExists: true,
  afterExists: after,
  success: !after,
  stdout: (child.stdout || '').slice(0, 1500),
  stderr: (child.stderr || '').slice(0, 1500),
};
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(TEMP, 'phase4-stale-fix.json'), JSON.stringify(result, null, 2));
