import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { TopBar } from './components/TopBar';
import { Column } from './components/Column';
import { TaskCard } from './components/TaskCard';
import { CardSkeleton } from './components/Skeleton';
import { SidePanel } from './components/SidePanel';
import { EmptyBoard } from './components/EmptyBoard';
import { useTasks } from './hooks/useTasks';
import { useConfig } from './hooks/useConfig';
import type { Task } from './types';
import { api, askClaude, fs } from './api';

export function App() {
  const config = useConfig();
  const { tasks, version, newlyAdded, refresh, loading } = useTasks(2000);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const board = useMemo(
    () => config.boards.find((b) => b.id === config.defaultBoard) ?? config.boards[0],
    [config],
  );

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.labels.some((l) => l.toLowerCase().includes(q)),
    );
  }, [tasks, search]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!board) return map;
    for (const c of board.columns) map.set(c.id, []);
    for (const t of filtered) {
      const list = map.get(t.column);
      if (list) list.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [filtered, board]);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const task = active.data.current as Task | undefined;
    if (!task) return;
    const overId = String(over.id);

    // `over.id` is either a column id (drop on empty column space) or a
    // `card:<task-id>` synthetic id from the per-card drop target. Resolve
    // both to a (targetColumn, targetPosition) pair.
    let targetColumn = overId;
    let targetPosition: number;
    if (overId.startsWith('card:')) {
      const overTaskId = overId.slice('card:'.length);
      const overTask = tasks.find((t) => t.id === overTaskId);
      if (!overTask) return;
      targetColumn = overTask.column;
      // Insert before the hovered card.
      targetPosition = overTask.position;
    } else {
      // Dropped on the column itself - append to the end.
      const peers = tasksByColumn.get(targetColumn) ?? [];
      targetPosition = peers.length;
    }

    if (task.column === targetColumn && task.position === targetPosition) return;

    // Optimistic local update so the move is visible immediately, before the
    // next poll lands. Reconciles cleanly because the server-authoritative
    // version cursor will overwrite on next list_tasks.
    await api.moveTask(task.id, targetColumn, targetPosition);
    refresh();
  };

  if (!board) return null;

  const empty = !loading && tasks.length === 0;

  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink">
      <TopBar
        boardName={board.name}
        taskCount={tasks.length}
        onRefresh={refresh}
        onSearch={setSearch}
        onTriageNow={() =>
          askClaude(
            'Run cowork-tasks triage now: drain the triage-queue and turn pending source items into tasks.',
          )
        }
        triageIntervalMinutes={config.triageIntervalMinutes}
      />

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {empty ? (
            <EmptyBoard
              onSetup={() => askClaude('Run /cowork-tasks:setup to connect my sources.')}
              onConnectFolder={async () => {
                const ok = await fs.connectFolder();
                if (ok) refresh();
              }}
            />
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              {board.columns.map((column) => {
                const cards = tasksByColumn.get(column.id) ?? [];
                return (
                  <Column
                    key={column.id}
                    column={column}
                    count={cards.length}
                    onAddTask={async (title) => {
                      await api.createTask({
                        title,
                        column: column.id,
                        position: cards.length,
                        source: { type: 'manual' },
                      } as Partial<Task>);
                      refresh();
                    }}
                  >
                    {loading && cards.length === 0 && (
                      <>
                        <CardSkeleton />
                        <CardSkeleton />
                      </>
                    )}
                    {cards.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isNew={newlyAdded.has(task.id)}
                        onClick={setSelected}
                      />
                    ))}
                  </Column>
                );
              })}
            </DndContext>
          )}
        </div>

        {selected && (
          <SidePanel
            task={tasks.find((t) => t.id === selected.id) ?? selected}
            onClose={() => setSelected(null)}
          />
        )}
      </main>

      <footer className="flex h-6 items-center justify-end border-t border-line bg-canvas px-3">
        <span className="font-mono text-[10px] text-faint">v{version}</span>
      </footer>
    </div>
  );
}
