import { useDroppable } from '@dnd-kit/core';
import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { Column as ColumnType } from '../types';

const COLUMN_HUE: Record<string, string> = {
  inbox: 'var(--fg-muted)',
  todo: 'var(--info)',
  'in-progress': 'var(--accent)',
  blocked: 'var(--warning)',
  done: 'var(--success)',
};

interface ColumnProps {
  column: ColumnType;
  count: number;
  children: ReactNode;
  /** Called when the user submits the inline "Add task" form. */
  onAddTask?: (title: string) => void;
}

export function Column({ column, count, children, onAddTask }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const hue = COLUMN_HUE[column.id] ?? 'var(--fg-muted)';
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const title = draft.trim();
    if (title && onAddTask) onAddTask(title);
    setDraft('');
    setAdding(false);
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      data-testid="column"
      data-column-id={column.id}
      className={[
        'flex h-full min-w-[280px] flex-1 flex-col rounded-lg border bg-paper transition-colors ease',
        isOver ? 'border-accent' : 'border-line',
      ].join(' ')}
    >
      <header
        className="flex items-center justify-between border-b border-line px-3 py-2"
        style={{ borderTopColor: hue, borderTopWidth: 4, borderRadius: '8px 8px 0 0' }}
      >
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[12px] font-medium uppercase tracking-wider text-ink">
            {column.name}
          </h2>
          <span className="font-mono text-[11px] text-soft">{count}</span>
        </div>
        <div className="flex items-center gap-2">
          {column.wip_limit && count >= column.wip_limit && (
            <span className="font-mono text-[10px] uppercase text-warning">WIP</span>
          )}
          {onAddTask && !adding && (
            <button
              type="button"
              data-testid="add-task-button"
              data-column-id={column.id}
              onClick={() => setAdding(true)}
              aria-label={`Add task to ${column.name}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-soft hover:bg-canvas hover:text-ink"
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {children}

        {adding && (
          <form
            data-testid="add-task-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2 rounded-md border border-accent bg-canvas p-2 shadow-sm"
          >
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                } else if (e.key === 'Escape') {
                  setDraft('');
                  setAdding(false);
                }
              }}
              rows={2}
              placeholder="Task title - Enter to add, Shift+Enter for newline, Esc to cancel"
              className="w-full resize-none border-0 bg-transparent font-display text-[14px] text-ink placeholder:text-faint focus:outline-none"
              data-testid="add-task-input"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft('');
                  setAdding(false);
                }}
                className="inline-flex h-7 items-center rounded-md px-2 font-display text-[12px] text-soft hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="add-task-submit"
                disabled={!draft.trim()}
                className="inline-flex h-7 items-center rounded-md bg-accent px-3 font-display text-[12px] font-medium text-accent-fg disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
