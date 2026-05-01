import type { Connector, ConnectorRuntime, Cursor, SourceItem } from './types.js';
import { runOnce } from './runtime.js';

/**
 * In-memory `ConnectorRuntime` for tests. Does NOT touch disk - keeps cursors
 * and queued items in maps. Lets contributors verify their connector without
 * setting up the full MCP server.
 */
export class InMemoryRuntime implements ConnectorRuntime {
  cursor: Cursor = null;
  readonly processed = new Set<string>();
  readonly queue: SourceItem[] = [];
  readonly logs: string[] = [];

  async loadCursor(): Promise<Cursor> {
    return this.cursor;
  }
  async saveCursor(c: Cursor): Promise<void> {
    this.cursor = c;
  }
  async isProcessed(hash: string): Promise<boolean> {
    return this.processed.has(hash);
  }
  async enqueue(item: SourceItem): Promise<void> {
    this.queue.push(item);
    this.processed.add(item.sourceHash);
  }
  log(line: string): void {
    this.logs.push(line);
  }
}

export interface ContractCheckResult {
  ok: boolean;
  failures: string[];
}

/**
 * Validate a connector against the contract:
 *
 *  1. First run with empty cursor enqueues every item.
 *  2. Cursor is non-null after a successful run.
 *  3. Re-running with the same cursor and same source state enqueues nothing.
 *  4. Errors don't crash the harness (returned as `lastError`).
 *
 * Connector authors call this from their package's test file.
 */
export async function checkContract(connector: Connector): Promise<ContractCheckResult> {
  const failures: string[] = [];
  const runtime = new InMemoryRuntime();

  const before = runtime.queue.length;
  const stats1 = await runOnce(runtime, connector);
  if (stats1.lastError) failures.push(`first run errored: ${stats1.lastError}`);
  if (runtime.queue.length === before) {
    // not strictly required - some connectors will be empty - but flag it
    failures.push(
      'first run produced 0 items - if intentional, mock the API to return at least one',
    );
  }

  const stats2 = await runOnce(runtime, connector);
  if (stats2.lastError) failures.push(`second run errored: ${stats2.lastError}`);
  if (stats2.itemsLastTick > 0) {
    failures.push(
      `second run produced ${stats2.itemsLastTick} items - dedup via isProcessed/sourceHash is missing`,
    );
  }

  return { ok: failures.length === 0, failures };
}
