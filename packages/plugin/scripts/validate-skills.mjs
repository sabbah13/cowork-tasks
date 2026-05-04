#!/usr/bin/env node
/**
 * Build-time validator for plugin assets that have wire-format
 * requirements Cowork enforces silently.
 *
 * Currently checks:
 *   - mcp_tools allowlist entries in skills/open-board/SKILL.md must
 *     all match `mcp__<server>__<tool>`. Any other shape gets dropped
 *     by Cowork at create_artifact time, leaving the artifact unable
 *     to call any MCP tool. v0.4.8 shipped with `<server>:<tool>` and
 *     was effectively dead on arrival; this guard prevents a repeat.
 *
 * Exit code 0 = ok. Anything else = fatal (build fails).
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.resolve(here, '..');
const skillsDir = path.join(pluginDir, 'skills');

const MCP_TOOL_RE = /^mcp__[a-z0-9_-]+__[a-z0-9_-]+$/i;

let problems = 0;
function fail(msg) {
  problems += 1;
  process.stderr.write(`[validate-skills] ${msg}\n`);
}

async function* walkSkillFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkSkillFiles(full);
    else if (entry.name === 'SKILL.md') yield full;
  }
}

/**
 * Find any code-block JSON containing an `mcp_tools` array and validate
 * each entry's wire-format. We parse loosely (no full markdown parser):
 * locate `"mcp_tools": [`, capture lines until the matching `]`, then
 * extract quoted strings. Good enough for the prescribed format the
 * skill uses; if the skill ever uses YAML or another shape, this needs
 * updating.
 */
async function checkMcpToolsAllowlist(file) {
  const text = await fs.readFile(file, 'utf-8');
  const re = /"mcp_tools"\s*:\s*\[([\s\S]*?)\]/g;
  let m;
  let blocks = 0;
  while ((m = re.exec(text)) !== null) {
    blocks += 1;
    const block = m[1];
    const entries = [...block.matchAll(/"([^"]+)"/g)].map((e) => e[1]);
    if (entries.length === 0) {
      fail(`${path.relative(pluginDir, file)}: empty mcp_tools allowlist`);
      continue;
    }
    for (const entry of entries) {
      if (!MCP_TOOL_RE.test(entry)) {
        fail(
          `${path.relative(
            pluginDir,
            file,
          )}: mcp_tools entry "${entry}" must match mcp__<server>__<tool>`,
        );
      }
    }
  }
  return blocks;
}

const targets = [];
for await (const f of walkSkillFiles(skillsDir)) targets.push(f);
let totalBlocks = 0;
for (const f of targets) totalBlocks += await checkMcpToolsAllowlist(f);

if (problems > 0) {
  process.stderr.write(
    `[validate-skills] ${problems} problem(s) in ${targets.length} skill file(s). Failing.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[validate-skills] ${targets.length} skills checked, ${totalBlocks} mcp_tools block(s) ok.\n`,
);
