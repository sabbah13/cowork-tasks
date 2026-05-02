import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  hue?: 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
}

/**
 * Cowork-flat badge. We deliberately avoid loud per-label colors here -
 * Cowork's own UI uses muted neutral chips with a single accent for
 * priority. Only `danger`, `accent`, and `warning` hues carry color so
 * they read as semantic signals rather than decoration.
 */
const HUE_VAR: Record<NonNullable<BadgeProps['hue']>, string> = {
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  accent: 'var(--accent)',
  neutral: 'var(--fg-muted)',
};

export function Badge({ children, hue = 'neutral' }: BadgeProps) {
  const v = HUE_VAR[hue];
  // Neutral / informational labels render in a soft greyscale chip; only
  // semantic hues (priority + due) earn a tinted background.
  const isSemantic = hue === 'danger' || hue === 'accent' || hue === 'warning';
  const bg = isSemantic
    ? `color-mix(in oklab, ${v} 12%, var(--bg))`
    : 'var(--bg-muted)';
  const fg = isSemantic
    ? `color-mix(in oklab, ${v} 75%, var(--fg))`
    : 'var(--fg-muted)';
  return (
    <span
      style={{ backgroundColor: bg, color: fg }}
      className="inline-flex items-center gap-1 rounded-xs px-1.5 py-px font-display text-2xs font-medium leading-tight"
    >
      {children}
    </span>
  );
}
