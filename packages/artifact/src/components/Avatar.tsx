interface AvatarProps {
  name?: string;
  size?: number;
}

const ACCENT_HUES = ['var(--info)', 'var(--success)', 'var(--accent)', 'var(--warning)'];

function hashHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % ACCENT_HUES.length;
  return ACCENT_HUES[idx]!;
}

export function Avatar({ name, size = 24 }: AvatarProps) {
  const display = (name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hue = name ? hashHue(name) : 'var(--fg-faint)';
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        backgroundColor: `color-mix(in oklab, ${hue} 18%, var(--bg-subtle))`,
        color: `color-mix(in oklab, ${hue} 80%, var(--fg))`,
        fontSize: size * 0.42,
      }}
      className="inline-flex items-center justify-center rounded-full font-display font-medium leading-none"
    >
      {display}
    </span>
  );
}
