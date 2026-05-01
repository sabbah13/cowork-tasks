import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import Database from 'better-sqlite3';

/**
 * Tracks which `(connector, sourceHash)` pairs have already been processed.
 *
 * Persisted as a SQLite file at `<home>/processed.db`. Lookups are
 * synchronous and trivially fast - this is on the polling hot path.
 */
export class ProcessedStore {
  private db?: Database.Database;
  private readonly file: string;

  constructor(home: string) {
    this.file = path.join(home, 'processed.db');
  }

  async open(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    this.db = new Database(this.file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed (
        connector TEXT NOT NULL,
        sourceHash TEXT NOT NULL,
        taskId TEXT,
        processedAt TEXT NOT NULL,
        PRIMARY KEY (connector, sourceHash)
      );
      CREATE INDEX IF NOT EXISTS idx_processed_connector ON processed(connector);
    `);
  }

  isProcessed(connector: string, sourceHash: string): boolean {
    if (!this.db) throw new Error('ProcessedStore not opened');
    const row = this.db
      .prepare('SELECT 1 FROM processed WHERE connector = ? AND sourceHash = ?')
      .get(connector, sourceHash);
    return row !== undefined;
  }

  markProcessed(connector: string, sourceHash: string, taskId?: string): void {
    if (!this.db) throw new Error('ProcessedStore not opened');
    this.db
      .prepare(
        'INSERT OR REPLACE INTO processed (connector, sourceHash, taskId, processedAt) VALUES (?, ?, ?, ?)',
      )
      .run(connector, sourceHash, taskId ?? null, new Date().toISOString());
  }

  countByConnector(connector: string): number {
    if (!this.db) throw new Error('ProcessedStore not opened');
    const row = this.db
      .prepare<[string], { c: number }>('SELECT COUNT(*) as c FROM processed WHERE connector = ?')
      .get(connector);
    return row?.c ?? 0;
  }

  close(): void {
    this.db?.close();
    this.db = undefined;
  }
}
