import {
  Mail,
  MessageSquare,
  Mic,
  Hash,
  ListTodo,
  Github,
  GitMerge,
  ExternalLink,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import type { SourceType } from '../types';

const ICONS: Partial<Record<SourceType, LucideIcon>> = {
  email: Mail,
  meeting: Mic,
  slack: Hash,
  teams: MessageSquare,
  discord: MessageSquare,
  telegram: MessageSquare,
  jira: ListTodo,
  linear: ListTodo,
  asana: ListTodo,
  clickup: ListTodo,
  notion: ListTodo,
  monday: ListTodo,
  trello: ListTodo,
  youtrack: ListTodo,
  github: Github,
  gitlab: GitMerge,
  manual: Pencil,
};

export function SourceIcon({ type, size = 14 }: { type?: SourceType; size?: number }) {
  if (!type) return null;
  const Icon = ICONS[type] ?? ExternalLink;
  return <Icon size={size} strokeWidth={1.5} className="text-soft" aria-label={type} />;
}
