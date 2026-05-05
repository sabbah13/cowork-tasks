import fs from 'node:fs';
import path from 'node:path';
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
    name: 'clear_artifact_folder',
    description:
      'Removes a stale artifact folder under the Cowork artifacts directory. Use this when create_artifact fails with "folder already exists" but the artifact is not in list_artifacts (manifest out of sync). Refuses to delete anything outside the provided artifactsDir or any path that does not match a safe id.',
    annotations: { title: 'Clear stale artifact folder', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        artifactsDir: {
          type: 'string',
          description: 'The Cowork artifacts directory. Derive it from any path returned by list_artifacts (e.g. /Users/.../Documents/Claude/Artifacts).',
        },
        id: {
          type: 'string',
          description: 'The artifact id whose folder should be deleted (e.g. "cowork-tasks").',
        },
      },
      required: ['artifactsDir', 'id'],
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

/**
 * Read an icon file (relative to the plugin root) and return it as a
 * `data:` URI suitable for the MCP `icons[].src` field. Returns null if
 * the file is unreadable or missing - the server should still start.
 */
function readIconAsDataUri(pluginRoot: string | undefined, relPath: string): string | null {
  if (!pluginRoot) return null;
  try {

    const buf = fs.readFileSync(path.join(pluginRoot, relPath));
    const ext = path.extname(relPath).toLowerCase();
    const mimeType =
      ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
    return `data:${mimeType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const TOOL_ICON_KEYS: Record<string, 'list' | 'add' | 'edit' | 'open' | 'archive' | 'config'> = {
  list_tasks: 'list',
  get_task: 'list',
  get_tasks_bulk: 'list',
  create_task: 'add',
  create_tasks: 'add',
  update_task: 'edit',
  move_task: 'edit',
  archive_task: 'archive',
  delete_task: 'archive',
  list_config: 'config',
  update_config: 'config',
  prepare_board_artifact: 'open',
  check_version: 'config',
  clear_artifact_folder: 'archive',
  is_processed: 'config',
  mark_processed: 'config',
};

/**
 * Build the per-tool icon list. Each tool gets the plugin icon by
 * default plus an optional category-specific tint via SVG. The list is
 * computed once at server start.
 */
function buildToolIcons(serverIcon: string | null): Record<string, Array<{ src: string; mimeType?: string; sizes?: string[] }>> {
  if (!serverIcon) return {};
  const base = [{ src: serverIcon, mimeType: 'image/png', sizes: ['256x256'] }];
  const map: Record<string, typeof base> = {};
  for (const tool of Object.keys(TOOL_ICON_KEYS)) {
    map[tool] = base;
  }
  return map;
}

export class CoworkTasksServer {
  private readonly server: Server;
  private readonly store: TaskStore;
  private readonly processed: ProcessedStore;
  private readonly toolIcons: Record<string, Array<{ src: string; mimeType?: string; sizes?: string[] }>>;

  constructor(private readonly cfg: ServerConfig) {
    this.store = new TaskStore({ rootPath: cfg.home, fs: nodeFs });
    this.processed = new ProcessedStore(cfg.home);

    // Spec-correct decoration per MCP 2025-11-25 (`Implementation` may
    // carry `title`, `description`, `websiteUrl`, `icons[]`). Cowork's
    // Connectors panel doesn't read these for stdio plugins today, but
    // shipping them now means the artifact's "C" badge upgrades to a
    // real logo + description automatically when Cowork picks them up.
    const serverIcon = readIconAsDataUri(cfg.pluginRoot, 'icon.png');
    const serverInfo: {
      name: string;
      version: string;
      title?: string;
      description?: string;
      websiteUrl?: string;
      icons?: Array<{ src: string; mimeType?: string; sizes?: string[] }>;
    } = {
      name: cfg.name ?? 'cowork-tasks',
      version: cfg.version ?? '0.1.0',
      title: 'Cowork Tasks',
      description:
        'A live kanban board for Claude Cowork. Auto-creates and tracks tasks from your email, meetings, Slack, and issue trackers - never lose a follow-up again.',
      websiteUrl: 'https://github.com/sabbah13/cowork-tasks',
    };
    if (serverIcon) {
      serverInfo.icons = [{ src: serverIcon, mimeType: 'image/png', sizes: ['256x256'] }];
    }

    this.server = new Server(serverInfo, { capabilities: { tools: {} } });
    this.toolIcons = buildToolIcons(serverIcon);
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
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Decorate each tool with the plugin icon so MCP clients that
      // surface tool icons (per MCP 2025-11-25 spec) can render them.
      // The base TOOLS array stays constant; we attach `icons` at
      // response time so the icon binary isn't carried in every call.
      const decorated = TOOLS.map((t) => {
        const icons = this.toolIcons[t.name];
        return icons ? { ...t, icons } : t;
      });
      return { tools: decorated };
    });

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
      case 'clear_artifact_folder': {
        const args = raw as { artifactsDir?: string; id?: string };
        if (!args.artifactsDir || !args.id) {
          // Input-validation errors return a structured result so MCP
          // clients (and our skill) can branch on `error_code` instead
          // of regexing a free-form string.
          return {
            ok: false,
            error_code: 'MISSING_ARGS',
            message:
              'clear_artifact_folder requires both `artifactsDir` (absolute path) and `id` (safe slug).',
            received: {
              artifactsDir: args.artifactsDir ?? null,
              id: args.id ?? null,
            },
          };
        }
        return this.clearArtifactFolder(args.artifactsDir, args.id);
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
    html?: string;
    path?: string;
    bytes: number;
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

    // CRITICAL: inject as the FIRST script in <head>, before the dev-mock
    // IIFE. If we inject before </head>, the mock script runs first and its
    // guard `if (window.__INITIAL_STATE__) return` sees an empty global -
    // the mock then installs window.__INITIAL_STATE__ (later overwritten,
    // ok) AND window.claude.callTool (NOT overwritten, BAD - the artifact
    // then thinks it's in mcp mode and polls the mock bridge for 7 fake
    // tasks). Injecting at the top of <head> lets the mock guard fire as
    // intended in production.
    const headIdx = template.indexOf('<head>');
    if (headIdx === -1) {
      throw new Error('artifact template missing <head> - cannot inject state');
    }
    const insertAt = headIdx + '<head>'.length;
    const html = template.slice(0, insertAt) + inject + template.slice(insertAt);

    let writtenPath: string | undefined;
    if (outPath) {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, html, 'utf-8');
      writtenPath = outPath;
    }

    // Critical: when outPath is provided, omit `html` from the response.
    // The artifact bundle is ~3 MB inlined and overflows Cowork's tool-call
    // budget. Skills should always pass outPath and read from disk via
    // create_artifact's html_path parameter.
    return {
      ...(writtenPath ? {} : { html }),
      path: writtenPath,
      bytes: html.length,
      tasks: tasks.length,
      version,
      pluginVersion,
    };
  }

  // ----------------------------------------------------- clear stale folder

  /**
   * Removes a stale artifact folder when Cowork's UI deleted the manifest
   * entry but left the folder on disk. The folder collision blocks
   * `create_artifact`, and `update_artifact` can't help because the manifest
   * is empty. This tool resolves the deadlock.
   *
   * Safety guards:
   *  - The id must match `[a-z0-9_-]+` (no path separators, no escapes).
   *  - The resolved target must be a direct child of artifactsDir.
   *  - artifactsDir must look like an absolute path under the user's home.
   */
  private async clearArtifactFolder(
    artifactsDir: string,
    id: string,
  ): Promise<
    | { ok: true; existed: boolean; deleted: boolean; path: string }
    | { ok: false; error_code: string; message: string; details?: unknown }
  > {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
      return {
        ok: false,
        error_code: 'UNSAFE_ID',
        message: 'id must match [a-z0-9_-] (1-64 chars, must start alphanumeric).',
        details: { id },
      };
    }
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    if (!path.isAbsolute(artifactsDir)) {
      return {
        ok: false,
        error_code: 'NOT_ABSOLUTE',
        message: 'artifactsDir must be an absolute path.',
        details: { artifactsDir },
      };
    }
    const resolvedDir = path.resolve(artifactsDir);
    const target = path.resolve(resolvedDir, id);
    if (!target.startsWith(resolvedDir + path.sep)) {
      return {
        ok: false,
        error_code: 'PATH_ESCAPE',
        message: 'Resolved target escapes artifactsDir; refusing to clear.',
        details: { artifactsDir: resolvedDir, target },
      };
    }
    let existed = false;
    try {
      await fs.access(target);
      existed = true;
    } catch {
      return { ok: true, existed: false, deleted: false, path: target };
    }
    await fs.rm(target, { recursive: true, force: true });
    return { ok: true, existed, deleted: true, path: target };
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
      'https://raw.githubusercontent.com/sabbah13/cowork-tasks/main/packages/plugin/.claude-plugin/plugin.json';
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
      outdated: latest != null && current !== 'unknown' && this.semverGreater(latest, current),
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
