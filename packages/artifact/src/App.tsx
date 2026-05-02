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
import { api, askClaude, fs, getDataSource, resetDataSource } from './api';

function genId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function App() {
  const config = useConfig();
  const { tasks, version, newlyAdded, refresh, loading, setTasksLocal } = useTasks(2000);
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
      targetPosition = overTask.position;
    } else {
      const peers = tasksByColumn.get(targetColumn) ?? [];
      targetPosition = peers.length;
    }

    if (task.column === targetColumn && task.position === targetPosition) return;

    // Optimistic local update first - this is what the user sees and what
    // makes drag-and-drop feel native even when the persistence layer is
    // unavailable (Cowork iframe with no callTool bridge).
    setTasksLocal((prev) => {
      const next: Task[] = [];
      // Tasks in the target column, excluding the moved one, then insert.
      const newColumnTasks = prev
        .filter((t) => t.column === targetColumn && t.id !== task.id)
        .sort((a, b) => a.position - b.position);
      newColumnTasks.splice(targetPosition, 0, {
        ...task,
        column: targetColumn,
        position: targetPosition,
        updated: new Date().toISOString(),
      });
      // Renumber the new column.
      newColumnTasks.forEach((t, i) => (t.position = i));
      // Renumber the source column.
      const sourceTasks = prev
        .filter((t) => t.column === task.column && t.id !== task.id && t.column !== targetColumn)
        .sort((a, b) => a.position - b.position);
      sourceTasks.forEach((t, i) => (t.position = i));
      // Build the next array preserving every task that wasn't touched.
      const touchedIds = new Set([
        ...newColumnTasks.map((t) => t.id),
        ...sourceTasks.map((t) => t.id),
      ]);
      for (const t of prev) {
        if (!touchedIds.has(t.id)) next.push(t);
      }
      next.push(...newColumnTasks, ...sourceTasks);
      return next;
    });

    // Best-effort persistence - never blocks the UI; failures are logged
    // and swallowed by the api layer.
    void api.moveTask(task.id, targetColumn, targetPosition);
  };

  const handleAddTask = async (columnId: string, title: string) => {
    const peers = tasksByColumn.get(columnId) ?? [];
    const draft: Task = {
      id: genId(),
      title,
      description: '',
      status: 'active',
      column: columnId,
      position: peers.length,
      labels: [],
      links: [],
      checklist: [],
      comments: [],
      priority: 'none',
      source: { type: 'manual' },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    setTasksLocal((prev) => [...prev, draft]);
    void api.createTask(draft);
  };

  const handleArchive = (id: string) => {
    setTasksLocal((prev) => prev.filter((t) => t.id !== id));
    void api.archiveTask(id);
  };

  const handleDelete = (id: string) => {
    setTasksLocal((prev) => prev.filter((t) => t.id !== id));
    void api.deleteTask(id);
  };

  const handleUpdate = (id: string, patch: Partial<Task>) => {
    setTasksLocal((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...patch, updated: new Date().toISOString() } : t,
      ),
    );
    void api.updateTask(id, patch);
  };

  if (!board) return null;

  const empty = !loading && tasks.length === 0;
  const dataSource = getDataSource();

  return (
    <div
      className="flex h-screen w-full flex-col bg-canvas text-ink"
      data-testid="board-root"
      data-source={dataSource}
    >
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
                if (ok) {
                  resetDataSource();
                  refresh();
                }
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
                    onAddTask={(title) => handleAddTask(column.id, title)}
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
            onArchive={handleArchive}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        )}
      </main>

      <footer className="flex h-6 items-center justify-between border-t border-line bg-canvas px-3">
        <span className="font-mono text-[10px] text-faint" data-testid="data-source">
          {dataSource}
        </span>
        <span className="font-mono text-[10px] text-faint" data-testid="board-version">
          v{version}
        </span>
      </footer>
    </div>
  );
}
