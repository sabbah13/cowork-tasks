/**
 * Type aliases mirroring `@cowork-tasks/core` schema. Kept in this file
 * (instead of importing from core) so the artifact's bundle stays tight -
 * we only need the shapes, not Zod runtime validators.
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type Status = 'active' | 'archived' | 'deleted';
export type SourceType =
  | 'email'
  | 'meeting'
  | 'slack'
  | 'teams'
  | 'discord'
  | 'telegram'
  | 'jira'
  | 'linear'
  | 'asana'
  | 'clickup'
  | 'notion'
  | 'monday'
  | 'trello'
  | 'github'
  | 'gitlab'
  | 'youtrack'
  | 'manual';

export interface Source {
  type: SourceType;
  url?: string;
  channel?: string;
  author?: string;
  meeting_title?: string;
  path?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  column: string;
  position: number;
  owner?: string;
  requester?: string;
  priority: Priority;
  due?: string;
  startTime?: string;
  labels: string[];
  source?: Source;
  links: { url: string; title: string; favicon?: string }[];
  checklist: { id: string; text: string; done: boolean }[];
  comments: { id: string; author: string; text: string; timestamp: string }[];
  created: string;
  updated: string;
}

export interface Column {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  wip_limit?: number;
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Diff {
  version: number;
  added: Task[];
  updated: Task[];
  removed: string[];
}

export interface Config {
  owner?: string;
  labels: Label[];
  boards: Board[];
  defaultBoard: string;
  triageIntervalMinutes: number;
}
