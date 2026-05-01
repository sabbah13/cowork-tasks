import { useState } from 'react';
import { ExternalLink, Sparkles, MessageSquare, Wand2, Trash2, X } from 'lucide-react';
import type { Task } from '../types';
import { api, askClaude } from '../api';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { SourceIcon } from './SourceIcon';

interface SidePanelProps {
  task: Task;
  onClose: () => void;
}

/**
 * Detail panel slid in from the right. Edits persist via MCP. AI actions go
 * through `window.claude.complete()` (inline) or `sendToChat()` (chat) - the
 * artifact never runs an LLM itself; it routes intent into Cowork.
 */
export function SidePanel({ task, onClose }: SidePanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const save = async () => {
    if (title.trim() && (title !== task.title || description !== (task.description ?? ''))) {
      await api.updateTask(task.id, { title: title.trim(), description });
    }
  };

  const inlineAi = async (prompt: string) => {
    setAiBusy(true);
    setAiOutput(null);
    try {
      const out = await askClaude(prompt);
      if (typeof out === 'string') setAiOutput(out);
    } finally {
      setAiBusy(false);
    }
  };

  const handoff = (prompt: string) => askClaude(prompt);

  return (
    <aside
      role="dialog"
      aria-label={`Task: ${task.title}`}
      className="flex w-[420px] flex-col border-l border-line bg-canvas"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          {task.source && <SourceIcon type={task.source.type} size={14} />}
          <span className="font-mono text-[11px] uppercase tracking-wider text-soft">
            {task.source?.type ?? 'manual'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-soft hover:bg-paper"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          className="w-full bg-transparent font-display text-lg font-medium text-ink focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {task.owner && (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={task.owner} size={20} />
              <span className="font-display text-[12px] text-soft">{task.owner}</span>
            </span>
          )}
          {task.priority !== 'none' && <Badge hue="accent">{task.priority}</Badge>}
          {task.due && <Badge hue="warning">due {task.due.slice(0, 10)}</Badge>}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={save}
          rows={6}
          placeholder="Add context"
          className="mt-4 w-full resize-none rounded-md border border-line bg-canvas p-3 font-body text-[13px] leading-relaxed text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/35"
        />

        {task.source?.url && (
          <a
            href={task.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-display text-[13px] text-info hover:underline"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            Open in {task.source.type}
          </a>
        )}

        <hr className="my-5 border-line" />

        <h3 className="mb-2 font-display text-[12px] font-medium uppercase tracking-wider text-soft">
          Ask Claude
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <AiButton
            icon={<Sparkles size={14} strokeWidth={1.5} />}
            label="Summarize source"
            disabled={aiBusy}
            onClick={() =>
              inlineAi(
                `Briefly summarize this task and its source in 2-3 sentences:\n\n${task.title}\n\n${task.description ?? ''}\n\nSource: ${task.source?.url ?? '(none)'}`,
              )
            }
          />
          <AiButton
            icon={<Wand2 size={14} strokeWidth={1.5} />}
            label="Tighten title"
            disabled={aiBusy}
            onClick={() =>
              inlineAi(
                `Rewrite this task title in <=80 chars, action-verb form, no fluff:\n\n${task.title}`,
              )
            }
          />
          <AiButton
            icon={<MessageSquare size={14} strokeWidth={1.5} />}
            label="Draft reply"
            disabled={aiBusy}
            onClick={() =>
              handoff(
                `Draft a concise reply for this task in chat (so I can review and send it).\n\nTask: ${task.title}\n${task.description ?? ''}\nSource: ${task.source?.url ?? ''}`,
              )
            }
          />
          <AiButton
            icon={<Sparkles size={14} strokeWidth={1.5} />}
            label="Split into subtasks"
            disabled={aiBusy}
            onClick={() =>
              handoff(
                `Break this task into 2-5 subtasks. Discuss with me in chat before creating any tasks.\n\nTask: ${task.title}\n${task.description ?? ''}`,
              )
            }
          />
        </div>

        {aiBusy && (
          <p className="mt-3 font-display text-[13px] text-soft">Asking Claude...</p>
        )}
        {aiOutput && (
          <div className="mt-3 rounded-md border border-line bg-paper p-3 font-body text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
            {aiOutput}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => api.archiveTask(task.id).then(onClose)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-display text-[13px] text-soft hover:bg-paper"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={() => api.deleteTask(task.id).then(onClose)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-display text-[13px] text-danger hover:bg-paper"
        >
          <Trash2 size={14} strokeWidth={1.5} />
          Delete
        </button>
      </footer>
    </aside>
  );
}

function AiButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center justify-start gap-1.5 rounded-md border border-line bg-canvas px-3 font-display text-[13px] text-ink hover:bg-paper disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
