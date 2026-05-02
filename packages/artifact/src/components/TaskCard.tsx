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

export function TaskCard({ task, isNew, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });
  // Each card is also a drop target so cards can be reordered within a
  // column. Drop ids are namespaced (`card:<id>`) to distinguish them from
  // column-level drops (the column id itself).
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `card:${task.id}`,
  });

  const setRefs = (el: HTMLElement | null) => {
    setNodeRef(el);
    setDropRef(el);
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${
          isDragging ? 1.02 : 1
        })`,
      }
    : undefined;

  return (
    <article
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      // dnd-kit's draggable attributes set role="button" + aria-roledescription="draggable".
      // The semantic role is still article; expose it via data-testid for queries.
      data-testid="task-card"
      data-task-id={task.id}
      data-column={task.column}
      aria-grabbed={isDragging}
      className={[
        'group relative cursor-grab rounded-md border bg-canvas p-3 text-left shadow-sm transition-shadow ease',
        isDragging ? 'cursor-grabbing shadow-md border-line' : 'hover:shadow-md border-line',
        isDropOver ? 'border-accent' : '',
        isNew ? 'new-card' : '',
      ].join(' ')}
      onClick={() => onClick(task)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(task);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[14px] font-medium leading-snug text-ink">
          {task.title}
        </h3>
        {task.source?.type && <SourceIcon type={task.source.type} size={14} />}
      </div>

      {task.description && (
        <p className="mt-1.5 line-clamp-2 font-body text-[13px] leading-relaxed text-soft">
          {task.description}
        </p>
      )}

      {(task.labels.length > 0 || task.priority !== 'none' || task.due) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {task.priority !== 'none' && (
            <Badge hue={PRIORITY_HUE[task.priority]}>{task.priority}</Badge>
          )}
          {task.due && (
            <Badge hue="warning">
              <Calendar size={10} strokeWidth={1.5} />
              {formatDue(task.due)}
            </Badge>
          )}
          {task.labels.slice(0, 3).map((l) => (
            <Badge key={l} hue="info">
              {l}
            </Badge>
          ))}
          {task.labels.length > 3 && (
            <span className="font-mono text-[11px] text-faint">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.owner && <Avatar name={task.owner} size={20} />}
          {task.source?.author && (
            <span className="font-mono text-[11px] text-faint">{task.source.author}</span>
          )}
        </div>
        {task.priority === 'critical' && (
          <AlertCircle size={14} strokeWidth={1.5} className="text-danger" aria-label="critical" />
        )}
      </div>
    </article>
  );
}
