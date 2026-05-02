interface AvatarProps {
  name?: string;
  size?: number;
}

/**
 * Cowork-style avatar. The Cowork chrome itself uses a flat circular
 * monogram (e.g. "SR" for Sam Rivera) - no rainbow per-user hues.
 * We mirror that: every avatar is the same muted token, only the initials
 * change. Reserves color for actual semantic signals.
 */
export function Avatar({ name, size = 22 }: AvatarProps) {
  const display = (name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.4)),
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-display font-semibold leading-none text-soft"
    >
      {display}
    </span>
  );
}
