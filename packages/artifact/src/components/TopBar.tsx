import { RefreshCw, Search, Filter, Settings } from 'lucide-react';
import { useState } from 'react';

interface TopBarProps {
  boardName: string;
  taskCount: number;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  onTriageNow: () => void;
  triageIntervalMinutes: number;
}

export function TopBar({
  boardName,
  taskCount,
  onRefresh,
  onSearch,
  onTriageNow,
  triageIntervalMinutes,
}: TopBarProps) {
  const [q, setQ] = useState('');

  return (
    <header
      role="banner"
      className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4"
    >
      <div className="flex items-center gap-2">
        <h1 className="font-display text-base font-medium tracking-tight text-ink">
          {boardName}
        </h1>
        <span className="font-mono text-xs text-soft">{taskCount} tasks</span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <label className="relative flex items-center">
          <Search size={14} strokeWidth={1.5} className="absolute left-2 text-faint" />
          <input
            type="search"
            placeholder="Search tasks"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              onSearch(e.target.value);
            }}
            className="h-8 w-48 rounded-md border border-line bg-canvas pl-7 pr-2 font-display text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/35"
          />
        </label>

        <button
          type="button"
          onClick={onTriageNow}
          title={`Auto-triage runs every ${triageIntervalMinutes}m. Click to run now.`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-canvas px-3 font-display text-[13px] font-medium text-ink hover:bg-paper"
        >
          <Filter size={14} strokeWidth={1.5} />
          Triage now
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-canvas text-soft hover:bg-paper"
          aria-label="Refresh"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-soft hover:bg-paper"
          aria-label="Settings"
        >
          <Settings size={14} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
