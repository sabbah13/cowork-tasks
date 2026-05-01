#!/usr/bin/env node
/**
 * Shared bootstrapper for all connector binaries. Each `connectors/<id>.js`
 * imports this with its own `(opts) => Connector` factory and the env var(s)
 * it needs.
 *
 * Behavior:
 *  - If the connector's required credential env var is missing, log
 *    `disabled: not configured` and exit 0 - so Cowork's monitor mechanism
 *    quietly accepts a no-op until the user configures it.
 *  - Otherwise: wire up a FileSystemRuntime that bridges to the MCP server
 *    for `is_processed` / `mark_processed`, then `runForever`.
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { FileSystemRuntime, runForever } from '@cowork-tasks/core';

export async function startConnector({ make, requiredEnvVars }) {
  const home = process.env.TASKS_HOME ?? path.join(os.homedir(), '.cowork-tasks');
  await fs.mkdir(home, { recursive: true });

  for (const v of requiredEnvVars ?? []) {
    if (!process.env[v]) {
      const credsFile = path.join(home, 'credentials', `${(make.name || 'connector').toLowerCase()}.json`);
      try {
        const raw = await fs.readFile(credsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        for (const [k, val] of Object.entries(parsed)) {
          if (process.env[k] == null && typeof val === 'string') {
            process.env[k] = val;
          }
        }
      } catch {
        // fall through to "disabled"
      }
    }
  }

  for (const v of requiredEnvVars ?? []) {
    if (!process.env[v]) {
      process.stdout.write(`disabled: ${v} not set\n`);
      return;
    }
  }

  const connector = make();
  const runtime = new FileSystemRuntime({ home, connector });
  process.stdout.write(`READY ${connector.id}\n`);

  const ac = new AbortController();
  process.on('SIGINT', () => ac.abort());
  process.on('SIGTERM', () => ac.abort());
  await runForever(runtime, connector, { signal: ac.signal });
}
