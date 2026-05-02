import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TaskStore, nodeFs, SourceInputSchema, type TaskDraft } from '@cowork-tasks/core';
import { ProcessedStore } from './processed-store.js';

export interface ServerConfig {
  /** Tasks home, e.g. ~/.cowork-tasks/. */
  home: string;
  /** Plugin root (the folder containing .claude-plugin/, artifact/, bundle/). */
  pluginRoot?: string;
  /** Server name advertised in the MCP handshake. */
  name?: string;
  /** Server version advertised in the MCP handshake. */
  version?: string;
}

const ListTasksArgs = z.object({
  since: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
});

const GetTaskArgs = z.object({ id: z.string() });
const GetTasksBulkArgs = z.object({ ids: z.array(z.string()) });

const TaskDraftArgs = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    column: z.string().optional(),
    position: z.number().int().nonnegative().optional(),
    owner: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
    due: z.string().optional(),
    labels: z.array(z.string()).optional(),
    /**
     * `source` accepts either:
     *   - a string URL ("https://fathom.video/...") - normalized to {type:'manual', url}
     *   - a full source object {type, url, ...}
     *
     * The lenient form is the right call here. Subagents that produce drafts
     * vary in how they format `source`, and a strict schema mismatch wastes a
     * full extra Claude turn re-doing the call.
     */
    source: SourceInputSchema.optional(),
  })
  .passthrough();

const CreateTaskArgs = TaskDraftArgs.extend({ folder: z.string().optional() });
const CreateTasksArgs = z.object({
  tasks: z.array(TaskDraftArgs),
  folder: z.string().optional(),
});
const UpdateTaskArgs = z.object({
  id: z.string(),
  patch: z.record(z.unknown()),
  ifVersion: z.number().int().nonnegative().optional(),
});
const MoveTaskArgs = z.object({
  id: z.string(),
  column: z.string(),
  position: z.number().int().nonnegative(),
  ifVersion: z.number().int().nonnegative().optional(),
});
const ArchiveTaskArgs = z.object({ id: z.string() });
const DeleteTaskArgs = z.object({ id: z.string() });
const UpdateConfigArgs = z.object({ patch: z.record(z.unknown()) });
const ProcessedArgs = z.object({ connector: z.string(), sourceHash: z.string() });
const MarkProcessedArgs = ProcessedArgs.extend({ taskId: z.string().optional() });

const TOOLS: Tool[] = [
  // ---------------- Read-only ----------------
  {
    name: 'list_tasks',
    description:
      'Lists all tasks on the kanban board with their column, owner, priority, labels and source. Pass `since` to receive only changes since that version.',
    annotations: { title: 'List tasks', readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'integer', minimum: 0, description: 'Cursor returned by a prior call.' },
        limit: { type: 'integer', minimum: 1 },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Retrieves a single task with its full description, checklist, comments and source link.',
    annotations: { title: 'Get task', readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'get_tasks_bulk',
    description: 'Retrieves multiple tasks in one round-trip by their ids.',
    annotations: { title: 'Get tasks (bulk)', readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
  {
    name: 'list_config',
    description: 'Returns the board configuration: columns, labels, owners, working hours and triage cadence.',
    annotations: { title: 'List board configuration', readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'prepare_board_artifact',
    description:
      'Prepares the live kanban artifact HTML with the current board state pre-injected. Returns ready-to-render HTML so the live artifact opens instantly without extra round-trips.',
    annotations: { title: 'Prepare board artifact', readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        outPath: {
          type: 'string',
          description:
            'Optional. If provided, the prepared HTML is written there too. Otherwise the caller writes the returned `html` field.',
        },
      },
    },
  },
  {
    name: 'check_version',
    description:
      'Checks whether a newer Cowork Tasks release is available upstream. Cached for 6 hours so this is free to call on every open.',
    annotations: { title: 'Check for updates', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Bypass the 6-hour cache and re-fetch from upstream.',
        },
      },
    },
  },
  {
    name: 'is_processed',
    description: 'Checks whether a source item (e.g. an email or meeting) has already been triaged into a task.',
    annotations: { title: 'Check if source is processed', readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { connector: { type: 'string' }, sourceHash: { type: 'string' } },
      required: ['connector', 'sourceHash'],
    },
  },

  // ---------------- Write ----------------
  {
    name: 'create_task',
    description:
      'Creates a new task on the kanban board. `source` accepts either a URL string or a structured object {type, url, author, title, ...}.',
    annotations: { title: 'Create task', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        column: { type: 'string' },
        owner: { type: 'string' },
        priority: { enum: ['critical', 'high', 'medium', 'low', 'none'] },
        due: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        source: {
          oneOf: [
            { type: 'string', description: 'URL or path; auto-wrapped as {type: "manual", url}' },
            {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description:
                    'email | meeting | slack | jira | linear | asana | clickup | notion | monday | trello | github | gitlab | youtrack | manual',
                },
                url: { type: 'string' },
                author: { type: 'string' },
                channel: { type: 'string' },
                title: { type: 'string' },
                meeting_title: { type: 'string' },
                path: { type: 'string' },
              },
            },
          ],
        },
        folder: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_tasks',
    description:
      'Creates multiple tasks in one batch - used by the hourly triage runner so a meeting with N action items lands as a single board update.',
    annotations: { title: 'Create tasks (batch)', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        tasks: { type: 'array', items: { type: 'object' } },
        folder: { type: 'string' },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'update_task',
    description: 'Updates fields on an existing task: title, description, owner, priority, due date, labels.',
    annotations: { title: 'Update task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        patch: { type: 'object' },
        ifVersion: { type: 'integer' },
      },
      required: ['id', 'patch'],
    },
  },
  {
    name: 'move_task',
    description: 'Moves a task to a different column and position - the kanban drag/drop primitive.',
    annotations: { title: 'Move task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        column: { type: 'string' },
        position: { type: 'integer', minimum: 0 },
        ifVersion: { type: 'integer' },
      },
      required: ['id', 'column', 'position'],
    },
  },
  {
    name: 'update_config',
    description: 'Updates board configuration: rename columns, add labels, adjust triage interval and working hours.',
    annotations: { title: 'Update board configuration', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { patch: { type: 'object' } },
      required: ['patch'],
    },
  },
  {
    name: 'mark_processed',
    description: 'Records that a source item has been triaged so the connector skips it on the next poll.',
    annotations: { title: 'Mark source as processed', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        connector: { type: 'string' },
        sourceHash: { type: 'string' },
        taskId: { type: 'string' },
      },
      required: ['connector', 'sourceHash'],
    },
  },

  // ---------------- Destructive ----------------
  {
    name: 'archive_task',
    description: 'Archives a task and removes it from the active board (the JSON file is preserved).',
    annotations: { title: 'Archive task', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'delete_task',
    description: 'Permanently deletes a task and moves its JSON file to the archived folder.',
    annotations: { title: 'Delete task', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

export class CoworkTasksServer {
  private readonly server: Server;
  private readonly store: TaskStore;
  private readonly processed: ProcessedStore;

  constructor(private readonly cfg: ServerConfig) {
    this.store = new TaskStore({ rootPath: cfg.home, fs: nodeFs });
    this.processed = new ProcessedStore(cfg.home);
    this.server = new Server(
      { name: cfg.name ?? 'cowork-tasks', version: cfg.version ?? '0.1.0' },
      { capabilities: { tools: {} } },
    );
    this.bind();
  }

  async start(): Promise<void> {
    await this.processed.open();
    await this.store.initialize();
  }

  /** Expose the underlying transport-binding so cli.ts can attach stdio. */
  get rawServer(): Server {
    return this.server;
  }

  /** Stop async listeners; called from cli.ts on signal. */
  async close(): Promise<void> {
    await this.processed.close();
  }

  private bind(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

    this.server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      const result = await this.dispatch(name, args ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
  }

  private async dispatch(tool: string, raw: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case 'list_tasks': {
        const args = ListTasksArgs.parse(raw);
        const diff = this.store.diffSince(args.since ?? 0);
        if (args.limit && diff.added.length > args.limit) {
          diff.added = diff.added.slice(0, args.limit);
        }
        return diff;
      }
      case 'get_task': {
        const args = GetTaskArgs.parse(raw);
        return this.store.getTask(args.id) ?? null;
      }
      case 'get_tasks_bulk': {
        const args = GetTasksBulkArgs.parse(raw);
        return this.store.getTasksBulk(args.ids);
      }
      case 'create_task': {
        const args = CreateTaskArgs.parse(raw);
        const { folder, ...draft } = args;
        return this.store.createTask(draft as TaskDraft, folder);
      }
      case 'create_tasks': {
        const args = CreateTasksArgs.parse(raw);
        return this.store.createTasks(args.tasks as TaskDraft[], args.folder);
      }
      case 'update_task': {
        const args = UpdateTaskArgs.parse(raw);
        return this.store.updateTask(args.id, args.patch as Partial<TaskDraft>, args.ifVersion);
      }
      case 'move_task': {
        const args = MoveTaskArgs.parse(raw);
        await this.store.moveTask(args.id, args.column, args.position, args.ifVersion);
        return { ok: true, version: this.store.version };
      }
      case 'archive_task': {
        const args = ArchiveTaskArgs.parse(raw);
        await this.store.archiveTask(args.id);
        return { ok: true, version: this.store.version };
      }
      case 'delete_task': {
        const args = DeleteTaskArgs.parse(raw);
        await this.store.deleteTask(args.id);
        return { ok: true, version: this.store.version };
      }
      case 'list_config': {
        return this.store.getConfig();
      }
      case 'update_config': {
        const args = UpdateConfigArgs.parse(raw);
        return this.store.updateConfig(args.patch);
      }
      case 'is_processed': {
        const args = ProcessedArgs.parse(raw);
        return { processed: this.processed.isProcessed(args.connector, args.sourceHash) };
      }
      case 'mark_processed': {
        const args = MarkProcessedArgs.parse(raw);
        this.processed.markProcessed(args.connector, args.sourceHash, args.taskId);
        return { ok: true };
      }
      case 'prepare_board_artifact': {
        const outPath = (raw as { outPath?: string }).outPath;
        return this.prepareBoardArtifact(outPath);
      }
      case 'check_version': {
        const force = (raw as { force?: boolean }).force === true;
        return this.checkVersion(force);
      }
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  // -------------------------------------------------------- prepare artifact

  /**
   * Returns a fully-prepared HTML payload with `__INITIAL_STATE__` already
   * injected. The skill no longer needs to read the template, parse JSON,
   * find a path, run a Python script, etc. - one tool call replaces ~5
   * shell steps.
   */
  private async prepareBoardArtifact(outPath?: string): Promise<{
    html: string;
    path?: string;
    tasks: number;
    version: number;
    pluginVersion: string;
  }> {
    const pluginRoot = this.cfg.pluginRoot;
    if (!pluginRoot) {
      throw new Error(
        'pluginRoot not set. The CLI should derive it from the bundle location and pass it into ServerConfig.',
      );
    }
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const templatePath = path.join(pluginRoot, 'artifact', 'cowork-tasks.html');
    const template = await fs.readFile(templatePath, 'utf-8');

    const tasks = this.store.getAllTasks();
    const config = this.store.getConfig();
    const version = this.store.version;
    const pluginVersion = await this.readPluginVersion(pluginRoot);

    // Build the injected payload. The artifact's useTasks reads
    // `window.__INITIAL_STATE__`; we also stamp the plugin version so the
    // footer can render it.
    const state = JSON.stringify({ version, tasks, config });
    const inject = `<script>window.__INITIAL_STATE__=${state};window.__PLUGIN_VERSION__=${JSON.stringify(pluginVersion)};</script>`;

    if (template.indexOf('</head>') === -1) {
      throw new Error('artifact template missing </head> - cannot inject state');
    }
    const html = template.replace('</head>', `${inject}</head>`);

    let writtenPath: string | undefined;
    if (outPath) {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, html, 'utf-8');
      writtenPath = outPath;
    }

    return {
      html,
      path: writtenPath,
      tasks: tasks.length,
      version,
      pluginVersion,
    };
  }

  private async readPluginVersion(pluginRoot: string): Promise<string> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    try {
      const raw = await fs.readFile(
        path.join(pluginRoot, '.claude-plugin', 'plugin.json'),
        'utf-8',
      );
      return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ---------------------------------------------------------- version check

  /**
   * Cheap version check with a 6-hour disk cache.
   *
   * - Reads `~/.cowork-tasks/.update-check.json` for the last result.
   * - If older than 6h or `force=true`, fetches the upstream
   *   `.claude-plugin/plugin.json` from the public repo.
   * - Compares the `version` semver field.
   * - Always returns gracefully; network failure means
   *   `latest=null, fromCache=false`.
   *
   * Skills (and the open-board flow) call this on every run; the cache
   * keeps it free.
   */
  private async checkVersion(force: boolean): Promise<{
    current: string;
    latest: string | null;
    outdated: boolean;
    lastChecked: string | null;
    fromCache: boolean;
  }> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
    const cachePath = path.join(this.cfg.home, '.update-check.json');

    const pluginRoot = this.cfg.pluginRoot;
    const current = pluginRoot ? await this.readPluginVersion(pluginRoot) : 'unknown';

    if (!force) {
      try {
        const raw = await fs.readFile(cachePath, 'utf-8');
        const cached = JSON.parse(raw) as {
          checkedAt: number;
          latest: string | null;
        };
        if (Date.now() - cached.checkedAt < CACHE_TTL_MS) {
          return {
            current,
            latest: cached.latest,
            outdated: cached.latest != null && this.semverGreater(cached.latest, current),
            lastChecked: new Date(cached.checkedAt).toISOString(),
            fromCache: true,
          };
        }
      } catch {
        // no cache or unreadable - fall through to fetch
      }
    }

    // Fetch upstream. Override via COWORK_TASKS_UPSTREAM_URL when forking.
    const upstreamUrl =
      process.env.COWORK_TASKS_UPSTREAM_URL ??
      'https://raw.githubusercontent.com/cowork-tasks/cowork-tasks/main/packages/plugin/.claude-plugin/plugin.json';
    let latest: string | null = null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(upstreamUrl, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const j = (await res.json()) as { version?: string };
        latest = j.version ?? null;
      }
    } catch {
      latest = null;
    }

    const checkedAt = Date.now();
    try {
      await fs.mkdir(this.cfg.home, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify({ checkedAt, latest }), 'utf-8');
    } catch {
      // best-effort; don't fail the whole call on disk errors
    }

    return {
      current,
      latest,
      outdated: latest != null && this.semverGreater(latest, current),
      lastChecked: new Date(checkedAt).toISOString(),
      fromCache: false,
    };
  }

  private semverGreater(a: string, b: string): boolean {
    const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      const x = pa[i] ?? 0;
      const y = pb[i] ?? 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }
}
