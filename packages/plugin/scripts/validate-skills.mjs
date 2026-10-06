#!/usr/bin/env node
/**
 * Build-time validator for plugin assets that have wire-format
 * requirements Cowork enforces silently.
 *
 * Currently checks, for every tool grant in a SKILL.md: the artifact-runtime
 * `capabilities.mcp.servers[].tools` (bare names) and the legacy
 * `mcp_tools` allowlist (`mcp__<server>__<tool>`):
 *   - each `mcp_tools` entry matches `mcp__<server>__<tool>`. Any other shape gets
 *     dropped by Cowork at create_artifact time, leaving the artifact unable
 *     to call any MCP tool. v0.4.8 shipped with `<server>:<tool>` and was
 *     effectively dead on arrival.
 *   - every tool the artifact calls (packages/artifact/src) is in the
 *     allowlist. 0.4.14 shipped `restore_task` (Undo delete) without
 *     allowlisting it, so Undo failed silently.
 *   - every allowlisted `cowork-tasks` tool still exists in the MCP server
 *     (packages/mcp-server/src/server.ts).
 *   - all grant blocks in a skill grant the same tools (capabilities, update, create).
 *
 * Exit code 0 = ok. Anything else = fatal (build fails).
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactToolCalls,
  checkAllowlists,
  extractAllowlists,
  extractCapabilityTools,
  serverToolNames,
} from './validate-skills-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.resolve(here, '..');
const repoDir = path.resolve(pluginDir, '..', '..');
const skillsDir = path.join(pluginDir, 'skills');
const serverFile = path.join(repoDir, 'packages', 'mcp-server', 'src', 'server.ts');
const artifactSrcDir = path.join(repoDir, 'packages', 'artifact', 'src');

let problems = 0;
function fail(msg) {
  problems += 1;
  process.stderr.write(`[validate-skills] ${msg}\n`);
}

async function* walk(dir, match) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, match);
    else if (match(entry.name)) yield full;
  }
}

const serverTools = serverToolNames(await fs.readFile(serverFile, 'utf-8'));
if (serverTools.size === 0) fail(`no tools found in ${path.relative(repoDir, serverFile)}; the TOOLS parser needs updating`);

const artifactCalls = new Set();
for await (const f of walk(artifactSrcDir, (n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n))) {
  for (const t of artifactToolCalls(await fs.readFile(f, 'utf-8'))) artifactCalls.add(t);
}
if (artifactCalls.size === 0) fail('no callMcp(...) calls found in packages/artifact/src; the call parser needs updating');

const targets = [];
for await (const f of walk(skillsDir, (n) => n === 'SKILL.md')) targets.push(f);

let totalBlocks = 0;
let totalCapabilityBlocks = 0;
for (const file of targets) {
  const text = await fs.readFile(file, 'utf-8');
  const allowlists = extractAllowlists(text);
  const capabilityTools = extractCapabilityTools(text);
  totalBlocks += allowlists.length + capabilityTools.length;
  totalCapabilityBlocks += capabilityTools.length;
  if (allowlists.length + capabilityTools.length === 0) continue;
  for (const p of checkAllowlists({
    label: path.relative(pluginDir, file),
    allowlists,
    capabilityTools,
    serverTools,
    artifactCalls,
  })) {
    fail(p);
  }
}
if (totalCapabilityBlocks === 0) {
  fail('no capabilities.mcp.servers tools grant found in any skill; the open-board skill must declare one');
}

if (problems > 0) {
  process.stderr.write(
    `[validate-skills] ${problems} problem(s) in ${targets.length} skill file(s). Failing.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[validate-skills] ${targets.length} skills checked, ${totalBlocks} mcp_tools block(s) ok ` +
    `(${totalCapabilityBlocks} capabilities, ${artifactCalls.size} artifact tool calls, ${serverTools.size} server tools).\n`,
);
