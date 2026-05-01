import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TaskStore, nodeFs, type TaskDraft } from '@cowork-tasks/core';
import { ProcessedStore } from './processed-store.js';

export interface ServerConfig {
  /** Tasks home, e.g. ~/.cowork-tasks/. */
  home: string;
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

const TaskDraftArgs = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  column: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  owner: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
  due: z.string().optional(),
  labels: z.array(z.string()).optional(),
  source: z
    .object({
      type: z.string(),
      url: z.string().url().optional(),
      author: z.string().optional(),
      channel: z.string().optional(),
      meeting_title: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
});

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
  {
    name: 'list_tasks',
    description:
      'List tasks, returning a versioned diff. Pass `since` to receive only changes since that version.',
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
    description: 'Fetch a single task by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'get_tasks_bulk',
    description: 'Fetch multiple tasks by id.',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task.',
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
        source: { type: 'object' },
        folder: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_tasks',
    description: 'Create multiple tasks in one batch.',
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
    description: 'Apply a partial patch to an existing task.',
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
    description: 'Move a task to a column at a position.',
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
    name: 'archive_task',
    description: 'Archive a task (status -> archived).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'delete_task',
    description: 'Delete a task and move its file to the archived folder.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'list_config',
    description: 'Return the current config (columns, labels, defaults).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_config',
    description: 'Patch the config (columns, labels, working hours, triage interval).',
    inputSchema: {
      type: 'object',
      properties: { patch: { type: 'object' } },
      required: ['patch'],
    },
  },
  {
    name: 'is_processed',
    description: 'Check if (connector, sourceHash) is already in the processed log.',
    inputSchema: {
      type: 'object',
      properties: { connector: { type: 'string' }, sourceHash: { type: 'string' } },
      required: ['connector', 'sourceHash'],
    },
  },
  {
    name: 'mark_processed',
    description: 'Record that (connector, sourceHash) has been triaged.',
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
  close(): void {
    this.processed.close();
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
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }
}
