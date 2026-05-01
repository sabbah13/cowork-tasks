import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import type {
  Connector,
  ConnectorRuntime,
  ConnectorStats,
  Cursor,
  SourceItem,
} from './types.js';

export interface RuntimeConfig {
  /** Tasks home, e.g. ~/.cowork-tasks/. */
  home: string;
  /** Connector being driven. */
  connector: Connector;
  /** Optional: custom processed-store predicate (e.g. SQLite-backed in MCP). */
  isProcessed?: (sourceHash: string) => Promise<boolean>;
  /** Optional: custom mark-processed (e.g. SQLite-backed in MCP). */
  markProcessed?: (sourceHash: string) => Promise<void>;
}

/**
 * Tiny default runtime. Persists cursors as JSON files under
 * `<home>/cursors/<connectorId>.json`, queues items under
 * `<home>/triage-queue/<connectorId>/<hash>.json`, and exposes a no-op
 * `isProcessed` unless one was passed (the MCP server provides a
 * SQLite-backed implementation).
 */
export class FileSystemRuntime implements ConnectorRuntime {
  private readonly cursorPath: string;
  private readonly queueDir: string;
  constructor(private readonly cfg: RuntimeConfig) {
    this.cursorPath = path.join(cfg.home, 'cursors', `${cfg.connector.id}.json`);
    this.queueDir = path.join(cfg.home, 'triage-queue', cfg.connector.id);
  }

  async loadCursor(): Promise<Cursor> {
    try {
      const raw = await fs.readFile(this.cursorPath, 'utf-8');
      const parsed = JSON.parse(raw) as { cursor: Cursor };
      return parsed.cursor;
    } catch {
      return null;
    }
  }

  async saveCursor(c: Cursor): Promise<void> {
    await fs.mkdir(path.dirname(this.cursorPath), { recursive: true });
    await fs.writeFile(this.cursorPath, JSON.stringify({ cursor: c }, null, 2));
  }

  async isProcessed(sourceHash: string): Promise<boolean> {
    if (this.cfg.isProcessed) return this.cfg.isProcessed(sourceHash);
    return false;
  }

  async enqueue(item: SourceItem): Promise<void> {
    await fs.mkdir(this.queueDir, { recursive: true });
    const file = path.join(this.queueDir, `${item.sourceHash}.json`);
    await fs.writeFile(file, JSON.stringify(item, null, 2));
    if (this.cfg.markProcessed) await this.cfg.markProcessed(item.sourceHash);
  }

  log(line: string): void {
    process.stdout.write(`${line}\n`);
  }
}

/** Compute a stable content hash from arbitrary fields. */
export function fingerprint(...parts: Array<string | number | undefined>): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(String(p ?? ''));
  return h.digest('hex').slice(0, 32);
}

/**
 * Drive a connector once: load cursor, call `watch`, enqueue new items
 * (deduped by `isProcessed`), persist cursor, return stats. Designed to be
 * called repeatedly by a long-running monitor or invoked once for a webhook
 * delivery.
 */
export async function runOnce(
  runtime: ConnectorRuntime,
  connector: Connector,
): Promise<ConnectorStats> {
  const startedAt = Date.now();
  const cursor = await runtime.loadCursor();
  let count = 0;
  let lastError: string | undefined;
  try {
    const next = await connector.watch(cursor, async (item) => {
      const dup = await runtime.isProcessed(item.sourceHash);
      if (dup) return;
      await runtime.enqueue(item);
      runtime.log(
        `QUEUED ${connector.id} ${item.sourceHash.slice(0, 12)} ${JSON.stringify(item.title.slice(0, 80))}`,
      );
      count += 1;
    });
    await runtime.saveCursor(next);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    runtime.log(`ERROR ${connector.id} ${lastError}`);
  }
  return {
    itemsLastTick: count,
    lastPollMs: Date.now() - startedAt,
    lastError,
    lastRunAt: new Date().toISOString(),
  };
}

/**
 * Long-running poll loop with exponential backoff on errors.
 */
export async function runForever(
  runtime: ConnectorRuntime,
  connector: Connector,
  opts: { intervalMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const baseInterval =
    opts.intervalMs ??
    (connector.schedule?.kind === 'poll' ? connector.schedule.intervalMs : 120_000);
  let backoff = 0;
  while (!opts.signal?.aborted) {
    const stats = await runOnce(runtime, connector);
    if (stats.lastError) {
      backoff = Math.min(60_000, backoff === 0 ? 1000 : backoff * 2);
    } else {
      backoff = 0;
    }
    const sleepMs = baseInterval + backoff + jitter(baseInterval * 0.2);
    await sleep(sleepMs, opts.signal);
  }
}

function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}
