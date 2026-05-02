import { X } from 'lucide-react';

interface HelpDialogProps {
  onClose: () => void;
}

interface Row {
  keys: string[];
  description: string;
}

const HOVER_SHORTCUTS: Row[] = [
  { keys: ['E', 'Enter'], description: 'Open card' },
  { keys: ['C'], description: 'Archive card' },
  { keys: ['L'], description: 'Open labels' },
  { keys: ['M'], description: 'Open owner' },
  { keys: ['D'], description: 'Set due date' },
  { keys: ['1', '–', '9', '0'], description: 'Toggle label by number' },
];
const BOARD_SHORTCUTS: Row[] = [
  { keys: ['/'], description: 'Focus search' },
  { keys: ['N'], description: 'New task in Inbox' },
  { keys: ['A'], description: 'Toggle show archived' },
  { keys: ['?'], description: 'This help' },
];
const MODAL_SHORTCUTS: Row[] = [
  { keys: ['T'], description: 'Edit title' },
  { keys: ['Space'], description: 'Assign to me' },
  { keys: ['L'], description: 'Toggle labels' },
  { keys: ['M'], description: 'Toggle owner' },
  { keys: ['C'], description: 'Archive' },
  { keys: ['D'], description: 'Edit due date' },
  { keys: ['Esc'], description: 'Close popup → close modal' },
];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <h3 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wider text-soft">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.description} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-display text-ink">{r.description}</span>
            <span className="flex gap-1 font-mono">
              {r.keys.map((k) => (
                <kbd
                  key={k}
                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-sm border border-line bg-canvas px-1.5 text-[11px] font-medium text-soft"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      data-testid="help-dialog"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-line bg-canvas p-6 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-medium text-ink">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-soft hover:bg-paper"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Section title="Hover a card" rows={HOVER_SHORTCUTS} />
          <Section title="Board" rows={BOARD_SHORTCUTS} />
          <Section title="In a card" rows={MODAL_SHORTCUTS} />
        </div>
        <footer className="mt-5 border-t border-line pt-3 text-[12px] text-soft">
          Press <kbd className="rounded-sm border border-line bg-paper px-1 font-mono">Esc</kbd>{' '}
          or click outside to close.
        </footer>
      </div>
    </div>
  );
}
