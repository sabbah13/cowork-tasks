import { Inbox, FolderOpen } from 'lucide-react';
import { fs } from '../api';

interface EmptyBoardProps {
  /** Open the connector wizard via Claude. */
  onSetup?: () => void;
  /** Refetch from filesystem after the user grants directory access. */
  onConnectFolder?: () => void;
}

/**
 * Shown when the board is empty *and* not loading.
 *
 * Two distinct empty states:
 *  - File System Access API is available but not yet permitted -> offer
 *    "Connect ~/.cowork-tasks/ folder" so the user can grant directory
 *    permission (this matches Anthropic's productivity dashboard pattern
 *    and unlocks live polling without the MCP bridge).
 *  - No FS access path -> the only way to populate the board is via skills.
 *    Offer "Connect a source" which routes the user back to chat.
 */
export function EmptyBoard({ onSetup, onConnectFolder }: EmptyBoardProps) {
  const fsAvailable = fs.isAvailable();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div
        aria-hidden
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--accent) 14%, var(--bg-subtle))',
          color: 'var(--accent)',
        }}
      >
        <Inbox size={32} strokeWidth={1.25} />
      </div>
      <h2 className="font-display text-xl font-medium text-ink">Your board is empty</h2>
      <p className="max-w-md font-body text-[14px] leading-relaxed text-soft">
        Connect a source - your inbox, Slack, or a meeting note-taker - and Cowork Tasks will
        start populating your board automatically.
      </p>
      <div className="flex items-center gap-2">
        {fsAvailable && onConnectFolder && (
          <button
            type="button"
            onClick={onConnectFolder}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-canvas px-4 font-display text-[14px] font-medium text-ink hover:bg-paper"
          >
            <FolderOpen size={14} strokeWidth={1.5} />
            Connect ~/.cowork-tasks
          </button>
        )}
        {onSetup && (
          <button
            type="button"
            onClick={onSetup}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 font-display text-[14px] font-medium text-accent-fg hover:opacity-90"
          >
            Connect a source
          </button>
        )}
      </div>
    </div>
  );
}
