import {
  Search,
  Sparkles,
  Settings,
  FolderOpen,
  FolderCheck,
  Keyboard,
  Archive,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { fs } from '../api';

interface TopBarProps {
  boardName: string;
  taskCount: number;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  onTriageNow: () => void;
  onConnectFolder: () => void;
  onResetToSnapshot: () => void;
  onShowHelp: () => void;
  onToggleShowArchived: () => void;
  showArchived: boolean;
  triageIntervalMinutes: number;
  dataSource: 'mcp' | 'fs' | 'snapshot';
  /** Current group-by dimension. */
  groupBy: 'status' | 'source' | 'owner' | 'priority';
  onChangeGroupBy: (next: 'status' | 'source' | 'owner' | 'priority') => void;
}

/**
 * Cowork-native top bar.
 *
 * Layout: board title left, search center-right, action cluster right.
 * The action cluster is a single visual group with hairline dividers
 * between functional sections - matching Cowork's own header pattern.
 * Buttons are icon-first; labels appear on hover via tooltip. Triage Now
 * is the one primary CTA (terracotta fill).
 */
export function TopBar({
  boardName,
  taskCount,
  onRefresh: _onRefresh,
  onSearch,
  onTriageNow,
  onConnectFolder,
  onResetToSnapshot,
  onShowHelp,
  onToggleShowArchived,
  showArchived,
  triageIntervalMinutes,
  dataSource,
  groupBy,
  onChangeGroupBy,
}: TopBarProps) {
  const [q, setQ] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [fsConnected, setFsConnected] = useState(fs.isConnected());
  const fsAvailable = fs.isAvailable();

  useEffect(() => {
    setFsConnected(fs.isConnected());
  }, [dataSource]);

  return (
    <header
      role="banner"
      className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-line bg-canvas/95 px-5 backdrop-blur-sm"
    >
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="truncate font-display text-md font-medium tracking-tight text-ink">
          {boardName}
        </h1>
        <span className="font-display text-xs text-faint">
          {taskCount} <span className="text-faint/80">{taskCount === 1 ? 'task' : 'tasks'}</span>
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Search */}
        <label className="relative flex items-center">
          <Search
            size={13}
            strokeWidth={1.6}
            className="pointer-events-none absolute left-2.5 text-faint"
          />
          <input
            type="search"
            placeholder="Search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              onSearch(e.target.value);
            }}
            className={[
              'h-7 w-44 rounded-sm border border-transparent bg-paper pl-7 pr-7 font-display text-base text-ink',
              'placeholder:text-faint focus:border-line-strong focus:bg-canvas focus:outline-none',
              'transition-colors duration-fast',
            ].join(' ')}
          />
          {!q && (
            <kbd className="pointer-events-none absolute right-2 hidden text-2xs text-faint sm:inline">
              /
            </kbd>
          )}
        </label>

        {/* Group by dropdown */}
        <label className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 hover:bg-paper">
          <span className="font-display text-2xs uppercase tracking-wider text-faint">
            Group
          </span>
          <select
            value={groupBy}
            onChange={(e) => onChangeGroupBy(e.target.value as 'status' | 'source' | 'owner' | 'priority')}
            data-testid="group-by-select"
            className="bg-canvas font-display text-xs text-ink outline-none focus:ring-1 focus:ring-accent/35 rounded-sm"
          >
            <option value="status">Status</option>
            <option value="source">Source</option>
            <option value="owner">Owner</option>
            <option value="priority">Priority</option>
          </select>
        </label>

        {/* Folder badge: only renders when FSA is available */}
        {fsAvailable && (
          <IconButton
            onClick={async () => {
              await onConnectFolder();
              setFsConnected(fs.isConnected());
            }}
            label={
              fsConnected
                ? 'Connected to ~/.cowork-tasks/. Drag/edits write to JSON files.'
                : 'Connect ~/.cowork-tasks/ for JSON-file persistence.'
            }
            testId="connect-folder-button"
            data={{ connected: fsConnected }}
            tone={fsConnected ? 'success' : 'ghost'}
          >
            {fsConnected ? <FolderCheck size={14} strokeWidth={1.7} /> : <FolderOpen size={14} strokeWidth={1.6} />}
          </IconButton>
        )}

        {/* Show archived */}
        <IconButton
          onClick={onToggleShowArchived}
          label={`${showArchived ? 'Hiding' : 'Showing'} archived  ·  A`}
          testId="toggle-archived-button"
          data={{ active: showArchived }}
          tone={showArchived ? 'accent' : 'ghost'}
        >
          <Archive size={14} strokeWidth={1.6} />
        </IconButton>

        {/* Help */}
        <IconButton onClick={onShowHelp} label="Keyboard shortcuts  ·  ?" testId="help-button" tone="ghost">
          <Keyboard size={14} strokeWidth={1.6} />
        </IconButton>

        {/* Refresh button intentionally NOT rendered: Cowork's artifact
            chrome already provides one in its frame, per the Live
            Artifacts host spec. Avoid duplicating UI the host owns. */}

        {/* Vertical divider */}
        <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />

        {/* Settings */}
        <div className="relative">
          <IconButton
            onClick={() => setShowSettings((s) => !s)}
            label="Settings"
            testId="settings-button"
            tone="ghost"
            pressed={showSettings}
          >
            <Settings size={14} strokeWidth={1.6} />
          </IconButton>
          {showSettings && (
            <div
              role="menu"
              data-testid="settings-menu"
              className="panel-slide absolute right-0 top-9 z-20 w-72 rounded-md border border-line bg-canvas p-2 shadow-pop"
            >
              <div className="px-2 py-1.5">
                <p className="font-display text-2xs font-semibold uppercase tracking-wider text-faint">
                  Persistence
                </p>
                <p className="mt-1 font-display text-sm leading-snug text-soft">
                  {dataSource === 'fs' && (
                    <>
                      Writing to{' '}
                      <code className="rounded-xs bg-muted px-1 font-mono text-2xs text-ink">
                        ~/.cowork-tasks/
                      </code>{' '}
                      as JSON files.
                    </>
                  )}
                  {dataSource === 'mcp' && 'Writing through the Cowork Tasks MCP server.'}
                  {dataSource === 'snapshot' &&
                    'Local edits saved in browser storage. Click "Connect folder" for JSON-file persistence.'}
                </p>
              </div>
              <hr className="my-1.5 border-line" />
              <button
                type="button"
                onClick={() => {
                  onResetToSnapshot();
                  setShowSettings(false);
                }}
                data-testid="reset-snapshot-button"
                className="block w-full rounded-sm px-2 py-1.5 text-left font-display text-sm text-ink transition-colors duration-fast hover:bg-paper"
              >
                Reset to snapshot
                <span className="block font-display text-2xs text-faint">
                  Clears local edits; reloads the open-board snapshot.
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onTriageNow}
          title={`Auto-triage every ${triageIntervalMinutes}m. Click to run now.`}
          className={[
            'ml-1 inline-flex h-7 items-center gap-1.5 rounded-sm bg-accent px-3 font-display text-xs font-medium text-accent-fg',
            'shadow-sm transition-all duration-fast hover:shadow-md active:scale-[0.98]',
          ].join(' ')}
        >
          <Sparkles size={13} strokeWidth={1.8} />
          Triage now
        </button>
      </div>
    </header>
  );
}

// ----------------------------------------------------- icon button helper

interface IconButtonProps {
  onClick: () => void;
  label: string;
  children: ReactNode;
  testId?: string;
  data?: Record<string, string | boolean>;
  tone?: 'ghost' | 'accent' | 'success';
  pressed?: boolean;
}

function IconButton({
  onClick,
  label,
  children,
  testId,
  data,
  tone = 'ghost',
  pressed,
}: IconButtonProps) {
  const dataAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) dataAttrs[`data-${k}`] = String(v);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      {...dataAttrs}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-fast',
        tone === 'accent'
          ? 'bg-accent-soft text-accent'
          : tone === 'success'
            ? 'bg-success/10 text-success'
            : pressed
              ? 'bg-paper text-ink'
              : 'text-soft hover:bg-paper hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
