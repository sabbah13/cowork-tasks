import * as path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * Tracks which `(connector, sourceHash)` pairs have already been processed.
 *
 * Persisted as JSON at `<home>/processed.json`. Volumes are small (a few
 * thousand entries even for heavy users) and lookups happen on connector
 * polls, not on every artifact frame, so a JSON-in-memory store is fine.
 *
 * Why not SQLite? Cowork plugins are copied into a content-addressed cache
 * before they run, and native modules (better-sqlite3 ships a
 * platform-specific .node binary) don't survive that journey reliably across
 * machines or platform updates. A plain JSON file is portable and good
 * enough for the read/write patterns here.
 */
export class ProcessedStore {
  private readonly file: string;
  private map: Record<string, Record<string, { taskId?: string; processedAt: string }>> = {};
  private dirty = false;
  private flushTimer?: NodeJS.Timeout;

  constructor(home: string) {
    this.file = path.join(home, 'processed.json');
  }

  async open(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      this.map = JSON.parse(raw);
    } catch {
      this.map = {};
    }
  }

  isProcessed(connector: string, sourceHash: string): boolean {
    return this.map[connector]?.[sourceHash] !== undefined;
  }

  markProcessed(connector: string, sourceHash: string, taskId?: string): void {
    if (!this.map[connector]) this.map[connector] = {};
    this.map[connector]![sourceHash] = { taskId, processedAt: new Date().toISOString() };
    this.scheduleFlush();
  }

  countByConnector(connector: string): number {
    return Object.keys(this.map[connector] ?? {}).length;
  }

  /** Coalesce writes to disk; the WAL-style fsync per call is unnecessary. */
  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, 200);
  }

  private async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.map));
    await fs.rename(tmp, this.file);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
  }
}
