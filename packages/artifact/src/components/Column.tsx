import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
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
}

export function Column({ column, count, children }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const hue = COLUMN_HUE[column.id] ?? 'var(--fg-muted)';

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
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
        {column.wip_limit && count >= column.wip_limit && (
          <span className="font-mono text-[10px] uppercase text-warning">WIP</span>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">{children}</div>
    </section>
  );
}
