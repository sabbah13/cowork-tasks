import type { Config } from 'tailwindcss';

/**
 * Anthropic-flavored theme. Bake the official palette and Styrene/Tiempos
 * type stack as semantic tokens; component code uses these names, never raw
 * hex, so a future "Cowork dark" mode is a one-CSS-var diff.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        paper: 'var(--bg-subtle)',
        muted: 'var(--bg-muted)',
        ink: 'var(--fg)',
        soft: 'var(--fg-muted)',
        faint: 'var(--fg-faint)',
        accent: {
          DEFAULT: 'var(--accent)',
          fg: 'var(--accent-fg)',
        },
        info: 'var(--info)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        line: 'var(--border)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
