import { z } from 'zod';
import type { TaskDraft } from '../schema.js';

/** A single raw item pulled from a source, before LLM triage. */
export const SourceItemSchema = z.object({
  /** Stable id within the source. */
  id: z.string(),
  /** Hash that uniquely identifies the *content version* of this item. */
  sourceHash: z.string(),
  /** Human title (subject, meeting name, ...). */
  title: z.string(),
  /** Body or transcript - kept compact for triage prompts. */
  body: z.string().optional(),
  /** Direct deep-link back to the source. */
  url: z.string().optional(),
  /** Sender / requester / host. */
  author: z.string().optional(),
  /** Source-native timestamp (ISO 8601). */
  timestamp: z.string().optional(),
  /** Any additional structured fields the connector wants to preserve. */
  meta: z.record(z.unknown()).optional(),
  /**
   * If true, bypasses the batched triage queue and triggers immediate
   * extraction. Used for urgent DMs, calendar invites starting soon, etc.
   */
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type SourceItem = z.infer<typeof SourceItemSchema>;

/** Opaque cursor handed back to a connector each tick. */
export type Cursor = string | null;

export type ConnectorCategory = 'email' | 'meeting' | 'chat' | 'issues';

/** Auth flow descriptor for the setup wizard. */
export type AuthSpec =
  | { kind: 'oauth'; provider: 'google' | 'microsoft' | 'slack' | 'zoom'; scopes: string[] }
  | { kind: 'apiKey'; envVar: string; label?: string }
  | { kind: 'token'; envVar: string; label?: string }
  | { kind: 'imap'; envVarPrefix: string }
  | { kind: 'localFile'; path: string }
  | { kind: 'mtproto'; envVarPrefix: string };

export type Schedule =
  | { kind: 'poll'; intervalMs: number }
  | { kind: 'stream' }
  | { kind: 'webhook'; port: number };

/**
 * The connector contract. A new source = one of these + a binary that runs it.
 */
export interface Connector {
  /** Stable id. Becomes the `source.type` stamped on tasks. */
  readonly id: string;
  /** Human label shown in setup wizard. */
  readonly label: string;
  readonly category: ConnectorCategory;
  readonly auth: AuthSpec;
  /** Optional schedule. Default = poll every 120s. */
  readonly schedule?: Schedule;

  /**
   * Pull new items since `cursor`. Each `push(item)` call queues one
   * `SourceItem`. Returns the cursor to persist for the next tick.
   */
  watch(cursor: Cursor, push: (item: SourceItem) => void): Promise<Cursor>;

  /**
   * Convert a queued source item into one or more task drafts. Most connectors
   * delegate to the central `task-extractor` subagent; this hook is for cases
   * where the source already provides structured action items (Read.ai,
   * Fireflies action-items endpoint, ...).
   */
  toTasks?(item: SourceItem): Promise<TaskDraft[]> | TaskDraft[];
}

export interface ConnectorRuntime {
  /** Persisted cursor for this connector; null on first run. */
  loadCursor(): Promise<Cursor>;
  saveCursor(c: Cursor): Promise<void>;
  /** Has this `(connector, sourceHash)` already been processed? */
  isProcessed(sourceHash: string): Promise<boolean>;
  /** Persist the queue entry for a new source item. */
  enqueue(item: SourceItem): Promise<void>;
  /** Loggable line emitted as a Cowork monitor notification. */
  log(line: string): void;
}

export interface ConnectorStats {
  itemsLastTick: number;
  lastPollMs: number;
  lastError?: string;
  lastRunAt?: string;
}
