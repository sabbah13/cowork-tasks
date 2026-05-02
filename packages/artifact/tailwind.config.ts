import type { Config } from 'tailwindcss';

/**
 * Cowork-native theme. Tokens map straight to the CSS custom properties
 * in `src/styles.css`; component code uses semantic class names
 * (`bg-canvas`, `text-ink`, `border-line`) so the artifact tracks
 * Cowork's palette automatically when we tighten or relax it.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        subtle: 'var(--bg-subtle)',
        paper: 'var(--bg-paper)',
        muted: 'var(--bg-muted)',
        ink: 'var(--fg)',
        soft: 'var(--fg-muted)',
        faint: 'var(--fg-faint)',
        accent: {
          DEFAULT: 'var(--accent)',
          fg: 'var(--accent-fg)',
          soft: 'var(--accent-soft)',
        },
        info: 'var(--info)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        // Cowork uses a tight type scale - tweak default leadings.
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.04em' }],
        xs: ['11px', { lineHeight: '16px', letterSpacing: '0' }],
        sm: ['12px', { lineHeight: '17px', letterSpacing: '0' }],
        base: ['13px', { lineHeight: '20px', letterSpacing: '-0.005em' }],
        md: ['14px', { lineHeight: '21px', letterSpacing: '-0.005em' }],
        lg: ['16px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        xl: ['18px', { lineHeight: '26px', letterSpacing: '-0.015em' }],
        '2xl': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        none: '0',
        xs: '3px',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        pop: 'var(--shadow-pop)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        fast: '120ms',
        DEFAULT: '180ms',
        slow: '320ms',
      },
    },
  },
  plugins: [],
};

export default config;
