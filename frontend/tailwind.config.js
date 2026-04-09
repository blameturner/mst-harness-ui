/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial black-on-white. White dominant, near-black ink for text,
        // a hairline grey for borders, and a single warm off-white for panels.
        bg: '#ffffff',
        panel: '#fafaf9',       // subtle off-white for sidebars and cards
        panelHi: '#f4f4f2',     // hover/active state for list rows
        fg: '#0a0a0a',          // near-black ink
        muted: '#6b6b6b',       // secondary text / timestamps
        border: '#e6e6e4',      // hairline dividers
        accent: '#0a0a0a',      // monochrome accent — the ink itself is the pop
        // Legacy aliases so older components compile until migrated.
        text: '#0a0a0a',
        accentDim: '#3a3a3a',
      },
      fontFamily: {
        // Distinctive editorial pairing — no Inter, no system defaults.
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        // Real monospace only — used for code blocks, diff views, run output.
        // Intentionally the system stack so UI chrome never looks like a
        // generic "AI dev tool" caption.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(10, 10, 10, 0.04), 0 0 0 1px rgba(10, 10, 10, 0.06)',
        hover: '0 1px 0 0 rgba(10, 10, 10, 0.08), 0 4px 16px -4px rgba(10, 10, 10, 0.08)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 220ms ease-out',
        blink: 'blink 1.1s infinite',
      },
    },
  },
  plugins: [],
};
