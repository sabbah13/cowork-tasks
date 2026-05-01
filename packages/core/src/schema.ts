import { z } from 'zod';

export const PrioritySchema = z.enum(['critical', 'high', 'medium', 'low', 'none']);
export type Priority = z.infer<typeof PrioritySchema>;

export const StatusSchema = z.enum(['active', 'archived', 'deleted']);
export type Status = z.infer<typeof StatusSchema>;

export const SourceTypeSchema = z.enum([
  'email',
  'meeting',
  'slack',
  'teams',
  'discord',
  'telegram',
  'jira',
  'linear',
  'asana',
  'clickup',
  'notion',
  'monday',
  'trello',
  'github',
  'gitlab',
  'youtrack',
  'manual',
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  type: SourceTypeSchema,
  url: z.string().url().optional(),
  channel: z.string().optional(),
  author: z.string().optional(),
  meeting_title: z.string().optional(),
  path: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const LinkSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  favicon: z.string().optional(),
});

export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
});

export const CommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  text: z.string(),
  timestamp: z.string(),
});

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: StatusSchema.default('active'),
  column: z.string().min(1).default('inbox'),
  position: z.number().int().nonnegative().default(0),
  owner: z.string().optional(),
  requester: z.string().optional(),
  priority: PrioritySchema.default('none'),
  due: z.string().optional(),
  startTime: z.string().optional(),
  labels: z.array(z.string()).default([]),
  source: SourceSchema.optional(),
  links: z.array(LinkSchema).default([]),
  checklist: z.array(ChecklistItemSchema).default([]),
  comments: z.array(CommentSchema).default([]),
  created: z.string(),
  updated: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * Drafts allow callers to omit defaultable fields. We use a hand-rolled type
 * (instead of `TaskSchema.partial()`) so that fields with Zod `.default(...)`
 * are correctly optional on the *input* side.
 */
export interface TaskDraft {
  id?: string;
  title?: string;
  description?: string;
  status?: Status;
  column?: string;
  position?: number;
  owner?: string;
  requester?: string;
  priority?: Priority;
  due?: string;
  startTime?: string;
  labels?: string[];
  source?: Source;
  links?: z.infer<typeof LinkSchema>[];
  checklist?: z.infer<typeof ChecklistItemSchema>[];
  comments?: z.infer<typeof CommentSchema>[];
  created?: string;
  updated?: string;
}

export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export type Label = z.infer<typeof LabelSchema>;

export const ColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  color: z.string(),
  wip_limit: z.number().int().positive().optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

export const BoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  columns: z.array(ColumnSchema),
});
export type Board = z.infer<typeof BoardSchema>;

export const WorkingHoursSchema = z.object({
  start: z.number().int().min(0).max(23),
  end: z.number().int().min(0).max(23),
});
export type WorkingHours = z.infer<typeof WorkingHoursSchema>;

export const ConfigSchema = z.object({
  owner: z.string().optional(),
  labels: z.array(LabelSchema),
  boards: z.array(BoardSchema),
  defaultBoard: z.string(),
  workingHours: WorkingHoursSchema.optional(),
  triageIntervalMinutes: z.number().int().min(5).max(1440).default(60),
  priorityContacts: z.array(z.string()).default([]),
  urgentInviteWindow: z.number().int().min(0).max(720).default(30),
});
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
  workingHours: { start: 9, end: 18 },
  triageIntervalMinutes: 60,
  priorityContacts: [],
  urgentInviteWindow: 30,
  labels: [
    { id: 'urgent', name: 'Urgent', color: '#b8503a' },
    { id: 'high-priority', name: 'High Priority', color: '#d97757' },
    { id: 'meeting', name: 'Meeting', color: '#788c5d' },
    { id: 'slack', name: 'Slack', color: '#6a9bcc' },
    { id: 'email', name: 'Email', color: '#c89a3f' },
    { id: 'review', name: 'Review', color: '#8a6ec7' },
    { id: 'hiring', name: 'Hiring', color: '#5599cc' },
    { id: 'partner', name: 'Partner', color: '#4ab3c2' },
    { id: 'escalation', name: 'Escalation', color: '#b8503a' },
    { id: 'demo', name: 'Demo', color: '#3d4663' },
  ],
  boards: [
    {
      id: 'main',
      name: 'Main Board',
      columns: [
        { id: 'inbox', name: 'Inbox', icon: 'inbox', color: '#6b6a64' },
        { id: 'todo', name: 'To Do', icon: 'list', color: '#6a9bcc' },
        { id: 'in-progress', name: 'In Progress', icon: 'loader', color: '#d97757' },
        { id: 'blocked', name: 'Blocked', icon: 'octagon-x', color: '#c89a3f' },
        { id: 'done', name: 'Done', icon: 'check', color: '#788c5d' },
      ],
    },
  ],
  defaultBoard: 'main',
};

export interface ErrorTask {
  filePath: string;
  relativePath: string;
  error: string;
  rawContent?: string;
}

export interface BoardData {
  board: Board & { task_order: Record<string, string[]> };
  tasks: Task[];
  errorTasks: ErrorTask[];
  config: { owner: string; labels: Label[]; workingHours: WorkingHours };
}

export function generateTaskId(prefix?: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return prefix ? `${prefix}_${ts}_${rand}` : `task_${ts}_${rand}`;
}

export function slugify(text: string, max = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}
