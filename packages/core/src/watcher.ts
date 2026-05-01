import chokidar, { type FSWatcher } from 'chokidar';

export interface WatcherOptions {
  /** Root path to watch recursively. */
  root: string;
  /**
   * File-extension(s) to react to. Default: `.task.json` and `config.json`.
   */
  match?: (filename: string) => boolean;
  /** Debounce milliseconds. Default: 300. */
  debounceMs?: number;
  /** Glob patterns to ignore. */
  ignored?: string[];
}

const DEFAULT_IGNORE = [
  /(^|[/\\])\../, // dotfiles like .git, .DS_Store
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/__pycache__/**',
  '**/venv/**',
];

const DEFAULT_MATCH = (filename: string) =>
  filename.endsWith('.task.json') || filename.endsWith('config.json');

/**
 * Watches a directory for task file mutations. Emits coalesced "changed"
 * events with a 300ms debounce so that bulk edits (e.g. `git checkout`,
 * batched MCP writes) don't fan out into N store re-scans.
 */
export class TaskWatcher {
  private watcher?: FSWatcher;
  private timer?: NodeJS.Timeout;
  private readonly opts: Required<WatcherOptions>;
  private listeners: Array<(reason: string) => void> = [];

  constructor(opts: WatcherOptions) {
    this.opts = {
      root: opts.root,
      match: opts.match ?? DEFAULT_MATCH,
      debounceMs: opts.debounceMs ?? 300,
      ignored: opts.ignored ?? (DEFAULT_IGNORE as unknown as string[]),
    };
  }

  start(): void {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.opts.root, {
      ignored: this.opts.ignored as never,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    const onEvent = (kind: string) => (path: string) => {
      const file = path.split(/[/\\]/).at(-1) ?? '';
      if (!this.opts.match(file)) return;
      this.schedule(`${kind}:${file}`);
    };

    this.watcher.on('add', onEvent('add'));
    this.watcher.on('change', onEvent('change'));
    this.watcher.on('unlink', onEvent('unlink'));
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  onChange(fn: (reason: string) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  private schedule(reason: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      for (const fn of this.listeners) {
        try {
          fn(reason);
        } catch (err) {
          console.error('[cowork-tasks] watcher listener threw:', err);
        }
      }
    }, this.opts.debounceMs);
  }
}
