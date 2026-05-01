import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  hue?: 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
}

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
  return (
    <span
      style={{
        backgroundColor: `color-mix(in oklab, ${v} 14%, var(--bg-subtle))`,
        color: `color-mix(in oklab, ${v} 80%, var(--fg))`,
      }}
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-display font-medium leading-tight"
    >
      {children}
    </span>
  );
}
