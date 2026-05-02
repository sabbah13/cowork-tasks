import { Inbox, FolderOpen, Sparkles } from 'lucide-react';
import { fs } from '../api';

interface EmptyBoardProps {
  onSetup?: () => void;
  onConnectFolder?: () => void;
}

/**
 * Empty state. Cowork-style: large negative space, calm typography,
 * monochrome icon, single primary CTA.
 */
export function EmptyBoard({ onSetup, onConnectFolder }: EmptyBoardProps) {
  const fsAvailable = fs.isAvailable();

  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-5 text-center">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-soft"
      >
        <Inbox size={20} strokeWidth={1.6} />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-display text-xl font-medium tracking-tight text-ink">
          Nothing on the board yet
        </h2>
        <p className="font-display text-md leading-relaxed text-soft">
          Connect a source - your inbox, Slack, or a meeting note-taker - and Cowork
          Tasks starts populating automatically.
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {fsAvailable && onConnectFolder && (
          <button
            type="button"
            onClick={onConnectFolder}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-canvas px-3 font-display text-sm font-medium text-ink transition-colors duration-fast hover:bg-paper"
          >
            <FolderOpen size={14} strokeWidth={1.6} />
            Connect folder
          </button>
        )}
        {onSetup && (
          <button
            type="button"
            onClick={onSetup}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-accent px-3 font-display text-sm font-medium text-accent-fg shadow-sm transition-all duration-fast hover:shadow-md active:scale-[0.98]"
          >
            <Sparkles size={13} strokeWidth={1.7} />
            Connect a source
          </button>
        )}
      </div>
    </div>
  );
}
