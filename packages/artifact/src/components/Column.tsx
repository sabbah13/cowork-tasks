import { useDroppable } from '@dnd-kit/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { Column as ColumnType } from '../types';

interface ColumnProps {
  column: ColumnType;
  count: number;
  children: ReactNode;
  onAddTask?: (title: string) => void;
  /** Rename the column. Triggered by double-click on the header label. */
  onRename?: (id: string, name: string) => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
}

export function Column({
  column,
  count,
  children,
  onAddTask,
  onRename,
  autoOpen,
  onAutoOpenConsumed,
}: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) setNameDraft(column.name);
  }, [column.name, renaming]);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const commitRename = () => {
    const next = nameDraft.trim();
    if (next && next !== column.name && onRename) {
      onRename(column.id, next);
    } else {
      setNameDraft(column.name);
    }
    setRenaming(false);
  };
  const cancelRename = () => {
    setNameDraft(column.name);
    setRenaming(false);
  };

  useEffect(() => {
    if (autoOpen) {
      setAdding(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen, onAutoOpenConsumed]);

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
        'flex h-full min-w-[286px] flex-1 flex-col rounded-lg bg-subtle/60 transition-all duration-fast ease-out',
        // Cowork chrome avoids visible borders unless an action is in
        // progress. Drop-target highlight is the one exception.
        isOver
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
          : 'ring-1 ring-line',
      ].join(' ')}
    >
      {/*
        Column header: uppercase track-wide name, count, optional + button.
        Cowork's own headers are flat - no colored top stripe, just an
        understated label.
      */}
      <header className="flex items-center justify-between border-b border-line/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {renaming ? (
            <input
              ref={renameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              data-testid="column-rename-input"
              className="bg-canvas font-display text-2xs font-semibold uppercase tracking-wider text-ink outline-none ring-1 ring-accent/35 rounded-sm px-1 -mx-1"
            />
          ) : (
            <h2
              className="font-display text-2xs font-semibold uppercase tracking-wider text-soft"
              onDoubleClick={() => onRename && setRenaming(true)}
              title={onRename ? 'Double-click to rename' : undefined}
            >
              {column.name}
            </h2>
          )}
          <span
            className={[
              'inline-flex h-4 min-w-[16px] items-center justify-center rounded-xs px-1 font-mono text-2xs',
              count > 0 ? 'bg-muted text-soft' : 'text-faint',
            ].join(' ')}
          >
            {count}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {column.wip_limit && count >= column.wip_limit && (
            <span className="font-mono text-2xs uppercase tracking-wide text-warning">
              WIP
            </span>
          )}
          {onAddTask && !adding && (
            <button
              type="button"
              data-testid="add-task-button"
              data-column-id={column.id}
              onClick={() => setAdding(true)}
              aria-label={`Add task to ${column.name}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-faint transition-colors duration-fast hover:bg-canvas hover:text-ink"
            >
              <Plus size={14} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </header>

      <div className="cowork-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {isOver && (
          <div
            aria-hidden
            data-testid="drop-placeholder-column"
            className="drop-placeholder"
          />
        )}
        {children}

        {adding && (
          <form
            data-testid="add-task-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="rounded-md border border-accent/50 bg-canvas p-2 shadow-sm"
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
              placeholder="Task title  ·  Enter to save"
              className="w-full resize-none border-0 bg-transparent font-display text-md text-ink placeholder:text-faint focus:outline-none"
              data-testid="add-task-input"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-2xs text-faint">⏎ save · Esc cancel</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraft('');
                    setAdding(false);
                  }}
                  className="inline-flex h-6 items-center rounded-sm px-2 font-display text-xs text-soft hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="add-task-submit"
                  disabled={!draft.trim()}
                  className="inline-flex h-6 items-center rounded-sm bg-ink px-2 font-display text-xs font-medium text-canvas transition-opacity duration-fast disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
