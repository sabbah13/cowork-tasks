import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { TopBar } from './components/TopBar';
import { Column } from './components/Column';
import { TaskCard } from './components/TaskCard';
import { CardSkeleton } from './components/Skeleton';
import { SidePanel } from './components/SidePanel';
import { EmptyBoard } from './components/EmptyBoard';
import { HelpDialog } from './components/HelpDialog';
import { useTasks } from './hooks/useTasks';
import { useConfig } from './hooks/useConfig';
import { useHotkeys } from './hooks/useHotkeys';
import type { Task } from './types';
import { api, askClaude, fs, getDataSource, resetDataSource } from './api';

function genId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function App() {
  const config = useConfig();
  const { tasks, version, newlyAdded, refresh, loading, setTasksLocal, resetToSnapshot } =
    useTasks(2000);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Task | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingNewTask, setPendingNewTask] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  /**
   * Monotonically-increasing signals consumed by SidePanel useEffects.
   * Stored as state (not refs) so updating them re-renders the panel and
   * the effect actually fires; refs alone don't trigger React updates.
   */
  const [focusTitleSignal, setFocusTitleSignal] = useState(0);
  const [focusDueSignal, setFocusDueSignal] = useState(0);
  /** Drives label/owner picker visibility from inside the side panel. */
  const [openPicker, setOpenPicker] = useState<'labels' | 'owner' | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const board = useMemo(
    () => config.boards.find((b) => b.id === config.defaultBoard) ?? config.boards[0],
    [config],
  );

  const visibleTasks = useMemo(
    () => (showArchived ? tasks : tasks.filter((t) => t.status === 'active')),
    [tasks, showArchived],
  );

  const filtered = useMemo(() => {
    if (!search) return visibleTasks;
    const q = search.toLowerCase();
    return visibleTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.labels.some((l) => l.toLowerCase().includes(q)),
    );
  }, [visibleTasks, search]);

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

  // ---------------------------------------------------------------- mutations

  const onDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current as Task | undefined;
    if (task) setDragging(task);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;
    const task = active.data.current as Task | undefined;
    if (!task) return;
    const overId = String(over.id);

    let targetColumn = overId;
    let targetPosition: number;
    if (overId.startsWith('card:')) {
      const overTaskId = overId.slice('card:'.length);
      const overTask = tasks.find((t) => t.id === overTaskId);
      if (!overTask) return;
      targetColumn = overTask.column;
      targetPosition = overTask.position;
    } else {
      targetPosition = 0;
    }

    if (task.column === targetColumn && task.position === targetPosition) return;

    setTasksLocal((prev) => {
      const next: Task[] = [];
      const newColumnTasks = prev
        .filter((t) => t.column === targetColumn && t.id !== task.id)
        .sort((a, b) => a.position - b.position);
      newColumnTasks.splice(targetPosition, 0, {
        ...task,
        column: targetColumn,
        position: targetPosition,
        updated: new Date().toISOString(),
      });
      newColumnTasks.forEach((t, i) => (t.position = i));
      const sourceTasks = prev
        .filter(
          (t) => t.column === task.column && t.id !== task.id && t.column !== targetColumn,
        )
        .sort((a, b) => a.position - b.position);
      sourceTasks.forEach((t, i) => (t.position = i));
      const touchedIds = new Set([
        ...newColumnTasks.map((t) => t.id),
        ...sourceTasks.map((t) => t.id),
      ]);
      for (const t of prev) if (!touchedIds.has(t.id)) next.push(t);
      next.push(...newColumnTasks, ...sourceTasks);
      return next;
    });

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

  // ---------------------------------------------------------------- hotkeys

  const toggleLabelByIndex = (cardId: string | null, index: number) => {
    if (!cardId) return;
    const labels = config.labels;
    const label = labels[index];
    if (!label) return;
    const t = tasks.find((x) => x.id === cardId);
    if (!t) return;
    const next = t.labels.includes(label.name)
      ? t.labels.filter((l) => l !== label.name)
      : [...t.labels, label.name];
    handleUpdate(cardId, { labels: next });
  };

  useHotkeys(
    {
      hoveredId: hovered,
      selectedId: selected?.id ?? null,
      popupOpen: showHelp || openPicker !== null,
      inputFocused: false,
    },
    {
      onOpenHovered: () => {
        if (hovered) {
          const t = tasks.find((x) => x.id === hovered);
          if (t) setSelected(t);
        }
      },
      onArchiveHovered: () => {
        if (hovered) handleArchive(hovered);
      },
      onOpenLabelsForHovered: () => {
        if (!hovered) return;
        const t = tasks.find((x) => x.id === hovered);
        if (t) {
          setSelected(t);
          setOpenPicker('labels');
        }
      },
      onOpenOwnerForHovered: () => {
        if (!hovered) return;
        const t = tasks.find((x) => x.id === hovered);
        if (t) {
          setSelected(t);
          setOpenPicker('owner');
        }
      },
      onSetDueForHovered: () => {
        if (!hovered) return;
        const t = tasks.find((x) => x.id === hovered);
        if (!t) return;
        setSelected(t);
        setFocusDueSignal((n) => n + 1);
      },
      onToggleLabelByIndex: toggleLabelByIndex,
      onFocusSearch: () => {
        const el = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (el) el.focus();
      },
      onNewTaskInInbox: () => {
        setPendingNewTask('inbox');
      },
      onToggleShowArchived: () => setShowArchived((s) => !s),
      onShowHelp: () => setShowHelp(true),
      onCloseTopPopup: () => {
        if (showHelp) {
          setShowHelp(false);
          return true;
        }
        if (openPicker !== null) {
          setOpenPicker(null);
          return true;
        }
        if (selected) {
          setSelected(null);
          return true;
        }
        if (search) {
          setSearch('');
          return true;
        }
        return false;
      },
      onArchiveSelected: () => {
        if (selected) {
          handleArchive(selected.id);
          setSelected(null);
        }
      },
      onSetDueSelected: () => {
        if (selected) setFocusDueSignal((n) => n + 1);
      },
      onToggleLabelsSelected: () =>
        setOpenPicker((p) => (p === 'labels' ? null : 'labels')),
      onToggleOwnerSelected: () =>
        setOpenPicker((p) => (p === 'owner' ? null : 'owner')),
      onEditTitleSelected: () => {
        setFocusTitleSignal((n) => n + 1);
      },
      onAssignSelfSelected: () => {
        if (!selected) return;
        const me = config.owner ?? 'me';
        handleUpdate(selected.id, { owner: me });
      },
    },
  );

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
        onConnectFolder={async () => {
          const ok = await fs.connectFolder();
          if (ok) {
            resetDataSource();
            refresh();
          }
        }}
        onResetToSnapshot={resetToSnapshot}
        onShowHelp={() => setShowHelp(true)}
        onToggleShowArchived={() => setShowArchived((s) => !s)}
        showArchived={showArchived}
        dataSource={dataSource}
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
            <DndContext
              sensors={sensors}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragging(null)}
            >
              {board.columns.map((column) => {
                const cards = tasksByColumn.get(column.id) ?? [];
                return (
                  <Column
                    key={column.id}
                    column={column}
                    count={cards.length}
                    onAddTask={(title) => handleAddTask(column.id, title)}
                    autoOpen={pendingNewTask === column.id}
                    onAutoOpenConsumed={() => setPendingNewTask(null)}
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
                        onHover={setHovered}
                        onUpdate={handleUpdate}
                        isHidden={dragging?.id === task.id}
                      />
                    ))}
                  </Column>
                );
              })}
              <DragOverlay dropAnimation={null} zIndex={9999}>
                {dragging ? (
                  <div className="rotate-1 opacity-95">
                    <TaskCard task={dragging} onClick={() => undefined} previewMode />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {selected && (
          <SidePanel
            task={tasks.find((t) => t.id === selected.id) ?? selected}
            onClose={() => {
              setSelected(null);
              setOpenPicker(null);
            }}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            availableLabels={config.labels}
            openPicker={openPicker}
            setOpenPicker={setOpenPicker}
            focusTitleSignal={focusTitleSignal}
            focusDueSignal={focusDueSignal}
          />
        )}
      </main>

      <footer className="flex h-6 items-center justify-between border-t border-line bg-canvas px-3">
        <span className="font-mono text-2xs text-faint" data-testid="data-source">
          {dataSource}
        </span>
        <span className="flex items-center gap-2 font-mono text-2xs text-faint">
          {window.__PLUGIN_VERSION__ && (
            <span data-testid="plugin-version">cowork-tasks {window.__PLUGIN_VERSION__}</span>
          )}
          <span data-testid="board-version">v{version}</span>
        </span>
      </footer>

      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
    </div>
  );
}
