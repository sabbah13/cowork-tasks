#!/usr/bin/env node
/**
 * Quick health summary across all connectors and the triage runner.
 * Reads `~/.cowork-tasks/stats/<connector>.json` files and the queue depth.
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';

const HOME = process.env.TASKS_HOME ?? path.join(os.homedir(), '.cowork-tasks');

const sections = await Promise.all([connectorStats(), queueDepth(), triageState()]);
process.stdout.write(JSON.stringify(Object.assign({}, ...sections), null, 2) + '\n');

async function connectorStats() {
  const dir = path.join(HOME, 'stats');
  const result = {};
  try {
    for (const f of await fs.readdir(dir)) {
      if (!f.endsWith('.json')) continue;
      const id = f.replace(/\.json$/, '');
      try {
        result[id] = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8'));
      } catch {
        result[id] = { status: 'unparseable' };
      }
    }
  } catch {
    // no stats dir yet
  }
  return { connectors: result };
}

async function queueDepth() {
  const queue = path.join(HOME, 'triage-queue');
  const result = {};
  try {
    for (const sub of await fs.readdir(queue)) {
      if (sub.startsWith('_')) continue;
      try {
        const entries = await fs.readdir(path.join(queue, sub));
        result[sub] = entries.filter((f) => f.endsWith('.json')).length;
      } catch {
        result[sub] = 0;
      }
    }
  } catch {
    // no queue dir
  }
  return { queueDepth: result };
}

async function triageState() {
  try {
    const raw = await fs.readFile(path.join(HOME, 'triage-state.json'), 'utf-8');
    return { triage: JSON.parse(raw) };
  } catch {
    return { triage: null };
  }
}
