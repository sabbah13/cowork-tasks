import * as path from 'node:path';
import {
  type Task,
  type TaskDraft,
  type Config,
  type ErrorTask,
  type Label,
  type Column,
  type BoardData,
  type Board,
  TaskSchema,
  ConfigSchema,
  DEFAULT_CONFIG,
  generateTaskId,
  slugify,
} from './schema.js';
import type { FsAdapter } from './fs-adapter.js';

const IGNORED_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.cursor',
  'dist',
  'build',
  '__pycache__',
  '.next',
  'venv',
  '.env',
  '.cowork-tasks-cache',
]);

interface StoredTask extends Task {
  _filePath: string;
}

export interface TaskStoreOptions {
  /** Root directory the store scans for *.task.json files. */
  rootPath: string;
  /** Filesystem adapter (node, vscode, browser-mock, ...). */
  fs: FsAdapter;
  /** Override the default tasks-folder (relative to rootPath). */
  tasksDir?: string;
  /** Override the default config path (relative to rootPath). */
  configPath?: string;
}

export class TaskStore {
  private readonly rootPath: string;
  private readonly tasksDir: string;
  private readonly configPath: string;
  private readonly fs: FsAdapter;
  private config: Config = { ...DEFAULT_CONFIG };
  private readonly tasks = new Map<string, StoredTask>();
  private errorTasks: ErrorTask[] = [];
  /**
   * Monotonic version counter. Bumped on every successful write
   * (create / update / move / archive / delete / config-change).
   * Used by MCP `list_tasks({since})` and the live artifact's polling cursor.
   */
  private versionCounter = 0;
  /** Per-task last-seen version, used to compute diffs cheaply. */
  private readonly taskVersions = new Map<string, number>();
  /** id -> version when task was removed; lets us emit `removed[]` since cursor. */
  private readonly tombstones = new Map<string, number>();
  /** Listeners notified on every write (MCP server uses this for change feed). */
  private readonly listeners = new Set<(version: number) => void>();

  constructor(opts: TaskStoreOptions) {
    this.rootPath = opts.rootPath;
    this.fs = opts.fs;
    this.tasksDir = opts.tasksDir ?? path.join(opts.rootPath, 'tasks');
    this.configPath = opts.configPath ?? path.join(opts.rootPath, 'config.json');
  }

  // --------------------------------------------------------------- lifecycle

  async initialize(): Promise<void> {
    await this.loadConfig();
    await this.scan();
  }

  private async loadConfig(): Promise<void> {
    if (await this.fs.exists(this.configPath)) {
      try {
        const raw = await this.fs.readFile(this.configPath);
        const parsed = ConfigSchema.parse(JSON.parse(raw));
        this.config = parsed;
      } catch (err) {
        console.error('[cowork-tasks] config invalid, using defaults:', err);
        this.config = { ...DEFAULT_CONFIG };
      }
    } else {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private async saveConfig(): Promise<void> {
    const dir = path.dirname(this.configPath);
    if (!(await this.fs.exists(dir))) {
      await this.fs.mkdir(dir, true);
    }
    await this.fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /** Walk the rootPath and load every *.task.json file. */
  async scan(): Promise<void> {
    this.tasks.clear();
    this.errorTasks = [];
    this.taskVersions.clear();
    await this.walk(this.rootPath);
    this.bumpVersion();
  }

  private async walk(dir: string): Promise<void> {
    let items: string[];
    try {
      items = await this.fs.readdir(dir);
    } catch {
      return;
    }
    for (const item of items) {
      if (IGNORED_FOLDERS.has(item)) continue;
      const fullPath = path.join(dir, item);
      try {
        const stat = await this.fs.stat(fullPath);
        if (stat.isDirectory) {
          await this.walk(fullPath);
        } else if (item.endsWith('.task.json')) {
          await this.loadTaskFile(fullPath);
        }
      } catch {
        // permission errors etc. - skip
      }
    }
  }

  private async loadTaskFile(filePath: string): Promise<void> {
    let raw: string;
    try {
      raw = await this.fs.readFile(filePath);
    } catch (err) {
      this.errorTasks.push({
        filePath,
        relativePath: path.relative(this.rootPath, filePath),
        error: `cannot read: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const task = TaskSchema.parse(parsed);
      const stored: StoredTask = { ...task, _filePath: filePath };
      this.tasks.set(task.id, stored);
      this.taskVersions.set(task.id, this.versionCounter + 1);
    } catch (err) {
      this.errorTasks.push({
        filePath,
        relativePath: path.relative(this.rootPath, filePath),
        error: err instanceof Error ? err.message : String(err),
        rawContent: raw.slice(0, 200),
      });
    }
  }

  // --------------------------------------------------------------- versioning

  /** Subscribe to version bumps. Returns an unsubscribe fn. */
  onChange(fn: (version: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private bumpVersion(): number {
    this.versionCounter += 1;
    for (const fn of this.listeners) {
      try {
        fn(this.versionCounter);
      } catch (err) {
        console.error('[cowork-tasks] listener threw:', err);
      }
    }
    return this.versionCounter;
  }

  /** Current version. Artifacts pass this back as `since` in their next poll. */
  get version(): number {
    return this.versionCounter;
  }

  /**
   * Emit a versioned diff since `cursor`.
   *
   *   added[]   - tasks not present at cursor.
   *   updated[] - tasks present then but changed since.
   *   removed[] - ids deleted since.
   */
  diffSince(cursor: number): {
    version: number;
    added: Task[];
    updated: Task[];
    removed: string[];
  } {
    if (cursor === 0) {
      return {
        version: this.versionCounter,
        added: this.activeTasks(),
        updated: [],
        removed: [],
      };
    }
    if (cursor === this.versionCounter) {
      return { version: this.versionCounter, added: [], updated: [], removed: [] };
    }

    const added: Task[] = [];
    const updated: Task[] = [];
    for (const [id, task] of this.tasks) {
      const v = this.taskVersions.get(id) ?? 0;
      if (v > cursor) {
        const wasKnown = v <= cursor + 1 ? false : true;
        // We can't perfectly distinguish add-vs-update from versions alone, so
        // we treat any task whose first-seen-version > cursor as `added` and
        // the rest as `updated`. Artifacts handle either equivalently.
        const stripped = stripInternal(task);
        (wasKnown ? updated : added).push(stripped);
      }
    }
    const removed: string[] = [];
    for (const [id, v] of this.tombstones) {
      if (v > cursor) removed.push(id);
    }
    return { version: this.versionCounter, added, updated, removed };
  }

  // --------------------------------------------------------------- queries

  getAllTasks(): Task[] {
    return this.activeTasks();
  }

  getTask(id: string): Task | undefined {
    const t = this.tasks.get(id);
    return t ? stripInternal(t) : undefined;
  }

  getTasksBulk(ids: string[]): Task[] {
    const result: Task[] = [];
    for (const id of ids) {
      const t = this.tasks.get(id);
      if (t) result.push(stripInternal(t));
    }
    return result;
  }

  getErrorTasks(): ErrorTask[] {
    return this.errorTasks;
  }

  getConfig(): Config {
    return this.config;
  }

  getBoardData(boardId?: string): BoardData | null {
    const board = this.config.boards.find((b) => b.id === (boardId ?? this.config.defaultBoard));
    if (!board) return null;
    const active = this.activeTasks();
    const taskOrder: Record<string, string[]> = {};
    for (const col of board.columns) {
      taskOrder[col.id] = active
        .filter((t) => t.column === col.id)
        .sort((a, b) => a.position - b.position)
        .map((t) => t.id);
    }
    return {
      board: { ...board, task_order: taskOrder },
      tasks: active,
      errorTasks: this.errorTasks,
      config: {
        owner: this.config.owner ?? '',
        labels: this.config.labels,
        workingHours: this.config.workingHours ?? { start: 9, end: 18 },
      },
    };
  }

  // --------------------------------------------------------------- mutations

  async createTask(draft: TaskDraft, folder?: string): Promise<Task> {
    const id = draft.id ?? generateTaskId(draft.source?.type);
    const now = new Date().toISOString();
    const taskFolder = folder ?? this.tasksDir;
    const slug = slugify(draft.title ?? id);
    const fileName = `${slug || id}.task.json`;
    const filePath = path.join(taskFolder, fileName);

    const column = draft.column ?? 'inbox';
    const position = draft.position ?? this.activeTasks().filter((t) => t.column === column).length;

    const task: Task = TaskSchema.parse({
      id,
      title: draft.title ?? 'Untitled task',
      description: draft.description,
      status: draft.status ?? 'active',
      column,
      position,
      owner: draft.owner,
      requester: draft.requester,
      priority: draft.priority ?? 'none',
      due: draft.due,
      startTime: draft.startTime,
      labels: draft.labels ?? [],
      source: draft.source,
      links: draft.links ?? [],
      checklist: draft.checklist ?? [],
      comments: draft.comments ?? [],
      created: draft.created ?? now,
      updated: now,
    });

    const stored: StoredTask = { ...task, _filePath: filePath };
    this.tasks.set(id, stored);
    await this.saveTaskFile(stored);
    this.taskVersions.set(id, this.bumpVersion());
    return task;
  }

  async createTasks(drafts: TaskDraft[], folder?: string): Promise<Task[]> {
    const created: Task[] = [];
    for (const d of drafts) {
      created.push(await this.createTask(d, folder));
    }
    return created;
  }

  async updateTask(id: string, patch: Partial<Task>, ifVersion?: number): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    if (ifVersion !== undefined) {
      const current = this.taskVersions.get(id) ?? 0;
      if (current !== ifVersion) {
        throw new VersionMismatchError(id, ifVersion, current);
      }
    }
    Object.assign(task, patch, { updated: new Date().toISOString() });
    const validated = TaskSchema.parse({ ...task, _filePath: undefined });
    Object.assign(task, validated);
    await this.saveTaskFile(task);
    this.taskVersions.set(id, this.bumpVersion());
    return stripInternal(task);
  }

  async moveTask(
    id: string,
    toColumn: string,
    position: number,
    ifVersion?: number,
  ): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;
    if (ifVersion !== undefined) {
      const current = this.taskVersions.get(id) ?? 0;
      if (current !== ifVersion) {
        throw new VersionMismatchError(id, ifVersion, current);
      }
    }
    const oldColumn = task.column;
    const oldPosition = task.position;

    const writes: StoredTask[] = [];

    if (oldColumn === toColumn) {
      if (oldPosition === position) return;
      const peers = this.activeColumnTasks(toColumn).filter((t) => t.id !== id);
      if (oldPosition < position) {
        for (const t of peers) {
          if (t.position > oldPosition && t.position <= position) {
            t.position -= 1;
            writes.push(t);
          }
        }
      } else {
        for (const t of peers) {
          if (t.position >= position && t.position < oldPosition) {
            t.position += 1;
            writes.push(t);
          }
        }
      }
    } else {
      const oldPeers = this.activeColumnTasks(oldColumn);
      for (const t of oldPeers) {
        if (t.position > oldPosition) {
          t.position -= 1;
          writes.push(t);
        }
      }
      const newPeers = this.activeColumnTasks(toColumn);
      for (const t of newPeers) {
        if (t.position >= position) {
          t.position += 1;
          writes.push(t);
        }
      }
    }

    task.column = toColumn;
    task.position = position;
    task.updated = new Date().toISOString();
    writes.push(task);

    await Promise.all(writes.map((t) => this.saveTaskFile(t)));
    const v = this.bumpVersion();
    for (const t of writes) this.taskVersions.set(t.id, v);
  }

  async archiveTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = 'archived';
    task.updated = new Date().toISOString();
    await this.saveTaskFile(task);
    this.taskVersions.set(id, this.bumpVersion());
  }

  async deleteTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task || !task._filePath) return;
    const archiveDir = path.join(this.rootPath, 'archived');
    if (!(await this.fs.exists(archiveDir))) await this.fs.mkdir(archiveDir, true);
    const fileName = path.basename(task._filePath);
    const archivePath = path.join(archiveDir, `${Date.now()}-${fileName}`);
    try {
      await this.fs.rename(task._filePath, archivePath);
    } catch {
      try {
        await this.fs.unlink(task._filePath);
      } catch {
        /* swallow */
      }
    }
    this.tasks.delete(id);
    this.taskVersions.delete(id);
    this.tombstones.set(id, this.bumpVersion());
  }

  async updateConfig(patch: Partial<Config>): Promise<Config> {
    const merged = ConfigSchema.parse({ ...this.config, ...patch });
    this.config = merged;
    await this.saveConfig();
    this.bumpVersion();
    return merged;
  }

  // --------------------------------------------------------------- internals

  private async saveTaskFile(task: StoredTask): Promise<void> {
    if (!task._filePath) throw new Error('task has no file path');
    const dir = path.dirname(task._filePath);
    if (!(await this.fs.exists(dir))) await this.fs.mkdir(dir, true);
    const data: Record<string, unknown> = { ...task };
    delete data._filePath;
    await this.fs.writeFile(task._filePath, JSON.stringify(data, null, 2));
  }

  private activeTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter((t) => t.status === 'active')
      .map(stripInternal);
  }

  private activeColumnTasks(column: string): StoredTask[] {
    return Array.from(this.tasks.values())
      .filter((t) => t.column === column && t.status === 'active')
      .sort((a, b) => a.position - b.position);
  }

  // ------------------------------------------------------------- label / column

  async createLabel(name: string, color: string): Promise<Label> {
    const id = slugify(name);
    const existing = this.config.labels.find((l) => l.id === id);
    if (existing) return existing;
    const label: Label = { id, name, color };
    this.config.labels.push(label);
    await this.saveConfig();
    this.bumpVersion();
    return label;
  }

  async deleteLabel(id: string): Promise<boolean> {
    const before = this.config.labels.length;
    this.config.labels = this.config.labels.filter((l) => l.id !== id);
    if (this.config.labels.length === before) return false;
    await this.saveConfig();
    this.bumpVersion();
    return true;
  }

  async createColumn(name: string): Promise<Column | null> {
    const board = this.config.boards.find((b) => b.id === this.config.defaultBoard);
    if (!board) return null;
    const id = slugify(name);
    if (board.columns.find((c) => c.id === id)) return null;
    const column: Column = { id, name, color: '#6b6a64' };
    board.columns.push(column);
    await this.saveConfig();
    this.bumpVersion();
    return column;
  }

  getDefaultBoard(): Board | undefined {
    return this.config.boards.find((b) => b.id === this.config.defaultBoard);
  }
}

function stripInternal(task: StoredTask): Task {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _filePath, ...rest } = task;
  return rest;
}

export class VersionMismatchError extends Error {
  readonly id: string;
  readonly expected: number;
  readonly actual: number;
  constructor(id: string, expected: number, actual: number) {
    super(`task ${id} version mismatch (expected ${expected}, actual ${actual})`);
    this.name = 'VersionMismatchError';
    this.id = id;
    this.expected = expected;
    this.actual = actual;
  }
}
