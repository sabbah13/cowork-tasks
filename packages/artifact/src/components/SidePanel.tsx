import { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Sparkles,
  MessageSquare,
  Wand2,
  Trash2,
  X,
  Tag,
  User,
  Calendar,
  Plus as PlusIcon,
  X as XIcon,
  Send as SendIcon,
  Check as CheckIcon,
} from 'lucide-react';
import type { Label, Task } from '../types';
import { api, askClaude } from '../api';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { SourceIcon } from './SourceIcon';
import { Markdown } from './Markdown';

interface SidePanelProps {
  task: Task;
  onClose: () => void;
  onUpdate?: (id: string, patch: Partial<Task>) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Available labels for the picker (from board config). */
  availableLabels: Label[];
  /** Which picker is currently open, if any. Driven by App for hotkeys. */
  openPicker?: 'labels' | 'owner' | null;
  setOpenPicker?: (p: 'labels' | 'owner' | null) => void;
  /** Increment to focus + select the title input. Hotkey: T. */
  focusTitleSignal?: number;
  /** Increment to focus the due-date picker. Hotkey: D. */
  focusDueSignal?: number;
}

const PRIORITIES: Array<Task['priority']> = ['critical', 'high', 'medium', 'low', 'none'];

export function SidePanel({
  task,
  onClose,
  onUpdate,
  onArchive,
  onDelete,
  availableLabels,
  openPicker,
  setOpenPicker,
  focusTitleSignal,
  focusDueSignal,
}: SidePanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [editingDescription, setEditingDescription] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Re-sync local title/description if the underlying task changes (live-update).
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
  }, [task.id]);

  // Hotkey: T → focus + select title.
  useEffect(() => {
    if (focusTitleSignal && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [focusTitleSignal]);

  // Hotkey: D → focus due-date picker (and open it if supported).
  useEffect(() => {
    if (focusDueSignal && dueRef.current) {
      dueRef.current.focus();
      dueRef.current.showPicker?.();
    }
  }, [focusDueSignal]);

  const save = async () => {
    const patch: Partial<Task> = {};
    if (title.trim() && title !== task.title) patch.title = title.trim();
    if (description !== (task.description ?? '')) patch.description = description;
    if (Object.keys(patch).length === 0) return;
    if (onUpdate) onUpdate(task.id, patch);
    else await api.updateTask(task.id, patch);
  };

  const setLabels = (labels: string[]) => {
    if (onUpdate) onUpdate(task.id, { labels });
    else void api.updateTask(task.id, { labels });
  };
  const setOwner = (owner: string) => {
    if (onUpdate) onUpdate(task.id, { owner });
    else void api.updateTask(task.id, { owner });
  };
  const setPriority = (priority: Task['priority']) => {
    if (onUpdate) onUpdate(task.id, { priority });
    else void api.updateTask(task.id, { priority });
  };
  const setDue = (due: string | undefined) => {
    if (onUpdate) onUpdate(task.id, { due });
    else void api.updateTask(task.id, { due });
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
      data-testid="side-panel"
      className="flex w-[440px] flex-col border-l border-line bg-canvas"
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
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          data-testid="side-panel-title"
          className="w-full bg-transparent font-display text-lg font-medium text-ink focus:outline-none"
        />

        {/* Meta row: owner, priority, due. Each click-able to open its picker. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenPicker?.(openPicker === 'owner' ? null : 'owner')}
            data-testid="open-owner-picker"
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-paper"
          >
            {task.owner ? (
              <>
                <Avatar name={task.owner} size={20} />
                <span className="font-display text-[12px] text-soft">{task.owner}</span>
              </>
            ) : (
              <>
                <User size={14} strokeWidth={1.5} className="text-faint" />
                <span className="font-display text-[12px] text-faint">No owner</span>
              </>
            )}
          </button>

          <PriorityChip value={task.priority} onChange={setPriority} />

          <label className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-paper">
            <Calendar size={14} strokeWidth={1.5} className="text-faint" />
            <input
              ref={dueRef}
              type="date"
              data-testid="due-date-input"
              value={task.due ? task.due.slice(0, 10) : ''}
              onChange={(e) => setDue(e.target.value || undefined)}
              className="bg-transparent font-display text-[12px] text-ink focus:outline-none"
            />
          </label>
        </div>

        {/* Labels row + picker */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {task.labels.map((l) => (
            <Badge key={l} hue="info">
              {l}
            </Badge>
          ))}
          <button
            type="button"
            onClick={() => setOpenPicker?.(openPicker === 'labels' ? null : 'labels')}
            data-testid="open-label-picker"
            className="inline-flex items-center gap-1 rounded-sm border border-dashed border-line px-1.5 py-0.5 font-display text-[11px] text-soft hover:border-line hover:bg-paper"
          >
            <Tag size={11} strokeWidth={1.5} />
            {task.labels.length === 0 ? 'Add label' : 'Edit'}
          </button>
        </div>

        {openPicker === 'labels' && (
          <LabelPicker
            available={availableLabels}
            selected={task.labels}
            onChange={setLabels}
            onClose={() => setOpenPicker?.(null)}
          />
        )}
        {openPicker === 'owner' && (
          <OwnerPicker
            current={task.owner ?? ''}
            onChange={(o) => {
              setOwner(o);
              setOpenPicker?.(null);
            }}
            onClose={() => setOpenPicker?.(null)}
          />
        )}

        {editingDescription || !description.trim() ? (
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              save();
              if (description.trim()) setEditingDescription(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.currentTarget.blur();
                if (description.trim()) setEditingDescription(false);
              }
            }}
            autoFocus={editingDescription}
            rows={6}
            placeholder="Add context. Markdown supported - **bold**, ```code```, tables, [links](url), ![images](url), and even ```mermaid diagrams."
            data-testid="side-panel-description"
            className="mt-4 w-full resize-none rounded-md border border-line bg-canvas p-3 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            data-testid="side-panel-description-preview"
            onClick={() => {
              setEditingDescription(true);
              setTimeout(() => descRef.current?.focus(), 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setEditingDescription(true);
                setTimeout(() => descRef.current?.focus(), 0);
              }
            }}
            title="Click to edit"
            className="mt-4 cursor-text rounded-md border border-transparent p-3 transition-colors hover:border-line hover:bg-paper"
          >
            <Markdown source={description} />
          </div>
        )}

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

        <ChecklistSection
          items={task.checklist}
          onChange={(next) => onUpdate?.(task.id, { checklist: next })}
        />

        <hr className="my-5 border-line" />

        <CommentsSection
          comments={task.comments}
          ownerName={task.owner}
          onChange={(next) => onUpdate?.(task.id, { comments: next })}
        />

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
          <div className="mt-3 rounded-md border border-line bg-paper p-3 font-display text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
            {aiOutput}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (onArchive) onArchive(task.id);
            else void api.archiveTask(task.id);
            onClose();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-display text-[13px] text-soft hover:bg-paper"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={() => {
            if (onDelete) onDelete(task.id);
            else void api.deleteTask(task.id);
            onClose();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-display text-[13px] text-danger hover:bg-paper"
        >
          <Trash2 size={14} strokeWidth={1.5} />
          Delete
        </button>
      </footer>
    </aside>
  );
}

// --------------------------------------------------------- subcomponents

function PriorityChip({
  value,
  onChange,
}: {
  value: Task['priority'];
  onChange: (p: Task['priority']) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="open-priority-picker"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-display text-[12px] text-soft hover:bg-paper"
      >
        priority: <span className="text-ink">{value}</span>
      </button>
      {open && (
        <ul
          role="menu"
          data-testid="priority-menu"
          className="absolute left-0 top-7 z-30 w-32 rounded-md border border-line bg-canvas p-1 shadow-md"
        >
          {PRIORITIES.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className={`block w-full rounded-sm px-2 py-1 text-left font-display text-[12px] hover:bg-paper ${
                  p === value ? 'text-accent' : 'text-ink'
                }`}
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LabelPicker({
  available,
  selected,
  onChange,
  onClose,
}: {
  available: Label[];
  selected: string[];
  onChange: (l: string[]) => void;
  onClose: () => void;
}) {
  const toggle = (name: string) =>
    selected.includes(name)
      ? onChange(selected.filter((s) => s !== name))
      : onChange([...selected, name]);
  return (
    <div
      role="menu"
      data-testid="label-picker"
      className="mt-2 rounded-md border border-line bg-paper p-2"
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="font-display text-[11px] uppercase tracking-wider text-soft">Labels</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close labels"
          className="text-soft hover:text-ink"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {available.map((l, i) => (
          <li key={l.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-canvas">
              <input
                type="checkbox"
                checked={selected.includes(l.name)}
                onChange={() => toggle(l.name)}
                data-testid={`label-checkbox-${l.name}`}
                className="h-3 w-3 accent-accent"
              />
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: l.color }}
                aria-hidden
              />
              <span className="font-display text-[12px] text-ink">{l.name}</span>
              {i < 9 && (
                <kbd className="ml-auto rounded-sm border border-line bg-canvas px-1 font-mono text-[10px] text-faint">
                  {i === 9 ? 0 : i + 1}
                </kbd>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OwnerPicker({
  current,
  onChange,
  onClose,
}: {
  current: string;
  onChange: (o: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(current);
  return (
    <div
      role="menu"
      data-testid="owner-picker"
      className="mt-2 rounded-md border border-line bg-paper p-2"
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="font-display text-[11px] uppercase tracking-wider text-soft">Owner</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close owner"
          className="text-soft hover:text-ink"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onChange(draft);
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder="Owner name"
        data-testid="owner-input"
        className="w-full rounded-sm border border-line bg-canvas px-2 py-1 font-display text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/35"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => onChange(draft)}
          data-testid="owner-save"
          className="rounded-md bg-accent px-2 py-1 font-display text-[12px] font-medium text-accent-fg"
        >
          Save
        </button>
      </div>
    </div>
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

// ─────────────────────────── Checklist ───────────────────────────────────────

type ChecklistItem = Task['checklist'][number];
type Comment = Task['comments'][number];

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function ChecklistSection({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const total = items.length;
  const done = items.filter((i) => i.done).length;

  const toggle = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const editText = (id: string, text: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));
  const commitDraft = () => {
    const text = draft.trim();
    if (!text) {
      setAdding(false);
      setDraft('');
      return;
    }
    onChange([...items, { id: genId('chk'), text, done: false }]);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <section data-testid="side-panel-checklist">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[12px] font-medium uppercase tracking-wider text-soft">
          Checklist
          {total > 0 && (
            <span className="ml-2 font-mono text-[11px] normal-case text-faint">
              {done}/{total}
            </span>
          )}
        </h3>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            data-testid="checklist-add-button"
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-display text-[12px] text-soft hover:bg-paper hover:text-ink"
          >
            <PlusIcon size={12} strokeWidth={1.8} /> Add
          </button>
        )}
      </div>

      {total > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid="checklist-item"
              className="group flex items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-paper"
            >
              <button
                type="button"
                aria-label={item.done ? 'Mark not done' : 'Mark done'}
                onClick={() => toggle(item.id)}
                data-testid="checklist-toggle"
                className={[
                  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                  item.done
                    ? 'border-success bg-success text-canvas'
                    : 'border-line hover:border-line-strong',
                ].join(' ')}
              >
                {item.done && <CheckIcon size={10} strokeWidth={2.4} />}
              </button>
              <input
                value={item.text}
                onChange={(e) => editText(item.id, e.target.value)}
                className={[
                  'min-w-0 flex-1 bg-transparent font-display text-[13px] outline-none',
                  item.done ? 'text-faint line-through' : 'text-ink',
                ].join(' ')}
              />
              <button
                type="button"
                aria-label="Remove item"
                onClick={() => remove(item.id)}
                data-testid="checklist-remove"
                className="invisible inline-flex h-5 w-5 items-center justify-center rounded-sm text-faint hover:bg-muted hover:text-danger group-hover:visible"
              >
                <XIcon size={12} strokeWidth={1.6} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-line" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New item, Enter to add"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              } else if (e.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
            onBlur={() => {
              if (!draft.trim()) {
                setAdding(false);
                setDraft('');
              } else {
                commitDraft();
                setAdding(false);
              }
            }}
            data-testid="checklist-add-input"
            className="min-w-0 flex-1 bg-canvas font-display text-[13px] text-ink outline-none ring-1 ring-line-strong rounded-sm px-1.5 py-0.5 focus:ring-accent/40"
          />
        </div>
      )}

      {total === 0 && !adding && (
        <p className="mt-2 font-display text-[12.5px] text-faint">
          No items yet. Add one to break this task into smaller steps.
        </p>
      )}
    </section>
  );
}

// ─────────────────────────── Comments ────────────────────────────────────────

function CommentsSection({
  comments,
  ownerName,
  onChange,
}: {
  comments: Comment[];
  ownerName?: string;
  onChange: (next: Comment[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([
      ...comments,
      {
        id: genId('cmt'),
        author: ownerName || 'You',
        text,
        timestamp: new Date().toISOString(),
      },
    ]);
    setDraft('');
  };

  const remove = (id: string) => onChange(comments.filter((c) => c.id !== id));

  return (
    <section data-testid="side-panel-comments">
      <h3 className="font-display text-[12px] font-medium uppercase tracking-wider text-soft">
        Comments
        {comments.length > 0 && (
          <span className="ml-2 font-mono text-[11px] normal-case text-faint">
            {comments.length}
          </span>
        )}
      </h3>

      {comments.length > 0 && (
        <ul className="mt-2 space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              data-testid="comment-item"
              className="group rounded-md border border-line bg-paper px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[12.5px] font-medium text-ink">{c.author}</span>
                <span className="font-mono text-[10.5px] text-faint">
                  {new Date(c.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap font-display text-[13px] leading-snug text-ink">
                {c.text}
              </p>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label="Remove comment"
                data-testid="comment-remove"
                className="invisible mt-1 font-display text-[11px] text-faint hover:text-danger group-hover:visible"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Add a comment, Cmd/Ctrl+Enter to send"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          data-testid="comment-input"
          className="min-w-0 flex-1 resize-none rounded-md border border-line bg-canvas px-2.5 py-2 font-display text-[13px] leading-snug text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/35"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          aria-label="Add comment"
          data-testid="comment-submit"
          className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-3 font-display text-[12px] font-medium text-accent-fg shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <SendIcon size={12} strokeWidth={1.8} /> Send
        </button>
      </div>
    </section>
  );
}
