import { useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Calendar, AlertCircle } from 'lucide-react';
import type { Task } from '../types';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { SourceIcon } from './SourceIcon';

interface TaskCardProps {
  task: Task;
  isNew?: boolean;
  onClick: (task: Task) => void;
  onHover?: (id: string | null) => void;
  /** Persist a quick title edit done on the card itself. */
  onUpdate?: (id: string, patch: Partial<Task>) => void;
  isHidden?: boolean;
  previewMode?: boolean;
}

const PRIORITY_HUE: Record<Task['priority'], 'danger' | 'accent' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'accent',
  medium: 'info',
  low: 'neutral',
  none: 'neutral',
};

function formatDue(due: string): string {
  const d = new Date(due);
  const today = new Date();
  const diff = Math.floor((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TaskCard({
  task,
  isNew,
  onClick,
  onHover,
  onUpdate,
  isHidden,
  previewMode,
}: TaskCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(task.title);
  }, [task.title, editingTitle]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== task.title && onUpdate) {
      onUpdate(task.id, { title: next });
    } else {
      setTitleDraft(task.title);
    }
    setEditingTitle(false);
  };

  const cancelTitle = () => {
    setTitleDraft(task.title);
    setEditingTitle(false);
  };

  const draggable = useDraggable({
    id: task.id,
    data: task,
    disabled: previewMode || editingTitle,
  });
  const droppable = useDroppable({
    id: `card:${task.id}`,
    disabled: previewMode,
  });

  const setRefs = (el: HTMLElement | null) => {
    if (!previewMode) {
      draggable.setNodeRef(el);
      droppable.setNodeRef(el);
    }
  };

  const isDragging = draggable.isDragging;
  const isDropOver = droppable.isOver;
  const isOverdue = task.due ? Date.parse(task.due) < Date.now() - 86_400_000 : false;

  const style: React.CSSProperties = {};
  if (isHidden) {
    style.opacity = 0;
    style.pointerEvents = 'none';
  }

  // Drop drag listeners while editing the title - dnd-kit's pointer
  // listeners would otherwise eat clicks on the inline input.
  const dragProps =
    previewMode || editingTitle
      ? {}
      : { ...draggable.attributes, ...draggable.listeners };

  return (
    <>
      {isDropOver && !previewMode && !isDragging && (
        <div
          aria-hidden
          data-testid="drop-placeholder"
          className="drop-placeholder"
        />
      )}
    <article
      ref={setRefs}
      style={style}
      {...dragProps}
      data-testid="task-card"
      data-task-id={task.id}
      data-column={task.column}
      aria-grabbed={isDragging}
      className={[
        // Base card surface - soft paper on cream, hairline border, gentle hover lift.
        'group relative rounded-md bg-canvas p-3 text-left transition-all duration-fast ease-out',
        'border border-line',
        previewMode
          ? 'cursor-grabbing shadow-pop ring-1 ring-accent/30'
          : 'cursor-grab',
        !previewMode &&
          !isDragging &&
          'hover:border-line-strong hover:bg-paper hover:shadow-sm',
        isDropOver && !previewMode ? 'border-accent shadow-sm' : '',
        isNew ? 'new-card' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // Click vs dblclick: defer opening the panel by 220ms so a real
      // double-click (which fires click+click+dblclick) can cancel the
      // pending open and enter edit mode instead.
      onClick={(e) => {
        if (previewMode || editingTitle) return;
        if ((e.target as HTMLElement | null)?.closest('input,textarea')) return;
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
          return;
        }
        clickTimerRef.current = window.setTimeout(() => {
          clickTimerRef.current = null;
          onClick(task);
        }, 220);
      }}
      onDoubleClick={(e) => {
        if (previewMode || !onUpdate) return;
        e.stopPropagation();
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        setEditingTitle(true);
      }}
      onMouseEnter={() => !previewMode && onHover?.(task.id)}
      onMouseLeave={() => !previewMode && onHover?.(null)}
      tabIndex={previewMode ? -1 : 0}
      onKeyDown={(e) => {
        if (!previewMode && !editingTitle && e.key === 'Enter') onClick(task);
      }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelTitle();
              }
            }}
            data-testid="task-card-title-input"
            className="w-full bg-canvas font-display text-md font-medium leading-snug text-ink outline-none ring-2 ring-accent/35 rounded-sm px-1 -mx-1"
          />
        ) : (
          <h3
            className="font-display text-md font-medium leading-snug text-ink"
            title="Double-click to rename"
          >
            {task.title}
          </h3>
        )}
        {task.source?.type && (
          <span className="mt-0.5 shrink-0 text-soft transition-colors duration-fast group-hover:text-ink">
            <SourceIcon type={task.source.type} size={14} />
          </span>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="mt-1.5 line-clamp-2 font-display text-sm text-soft">
          {task.description}
        </p>
      )}

      {/* Meta chips: priority + due + labels */}
      {(task.labels.length > 0 || task.priority !== 'none' || task.due) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {task.priority !== 'none' && (
            <Badge hue={PRIORITY_HUE[task.priority]}>{task.priority}</Badge>
          )}
          {task.due && (
            <Badge hue={isOverdue ? 'danger' : 'warning'}>
              <Calendar size={10} strokeWidth={1.6} />
              {formatDue(task.due)}
            </Badge>
          )}
          {task.labels.slice(0, 3).map((l) => (
            <Badge key={l} hue="neutral">
              {l}
            </Badge>
          ))}
          {task.labels.length > 3 && (
            <span className="font-mono text-2xs text-faint">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: owner + critical indicator */}
      {(task.owner || task.source?.author || task.priority === 'critical') && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {task.owner && <Avatar name={task.owner} size={18} />}
            {(task.owner || task.source?.author) && (
              <span className="truncate font-display text-xs text-faint">
                {task.owner ?? task.source?.author}
              </span>
            )}
          </div>
          {task.priority === 'critical' && (
            <AlertCircle
              size={13}
              strokeWidth={1.8}
              className="shrink-0 text-danger"
              aria-label="critical"
            />
          )}
        </div>
      )}
    </article>
    </>
  );
}
