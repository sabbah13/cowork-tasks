import { Inbox } from 'lucide-react';

export function EmptyBoard({ onSetup }: { onSetup?: () => void }) {
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
  );
}
