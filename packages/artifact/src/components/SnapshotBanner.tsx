import { explainDegraded, formatSnapshotTime, type BridgeDiagnostics } from '../mcpBridge';

interface SnapshotBannerProps {
  diagnostics: BridgeDiagnostics;
  /** ISO time the page was prepared (stamped by prepare_board_artifact). */
  snapshotAt: string | null;
  onRetry: () => void;
  onOpenPermissions: () => void;
}

/**
 * Shown when the board was published to be live but cannot reach the task
 * server. It says when the snapshot was taken (so a stale page is obvious),
 * why the connection failed, what to do about it, and offers the two actions
 * that can actually help: retry, and open the permissions panel.
 */
export function SnapshotBanner({
  diagnostics,
  snapshotAt,
  onRetry,
  onOpenPermissions,
}: SnapshotBannerProps) {
  const why = explainDegraded(diagnostics);
  const when = formatSnapshotTime(snapshotAt);
  const button =
    'rounded-md border border-line bg-canvas px-2 py-0.5 text-[12px] text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35';

  return (
    <div
      role="status"
      data-testid="snapshot-banner"
      className="border-b border-line bg-paper px-4 py-2 text-[12.5px] text-muted"
    >
      <div>
        <strong className="font-semibold text-ink">
          Read-only snapshot{when ? ` from ${when}` : ''}.
        </strong>{' '}
        {why.headline} {why.hint} Changes made here won&apos;t be saved. Run{' '}
        <code className="font-mono">/cowork-tasks:open-board</code> to refresh the snapshot.
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {why.canRetry && (
          <button type="button" data-testid="banner-retry" className={button} onClick={onRetry}>
            Retry
          </button>
        )}
        {why.canManagePermissions && (
          <button
            type="button"
            data-testid="banner-permissions"
            className={button}
            onClick={onOpenPermissions}
          >
            Open permissions
          </button>
        )}
        <span data-testid="banner-details" className="select-all font-mono text-[11px] text-faint">
          {why.details}
        </span>
      </div>
    </div>
  );
}
