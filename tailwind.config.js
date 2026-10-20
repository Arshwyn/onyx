/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Onyx redesign design tokens -- see Onyx_app_redesign_concepts.zip's README.md
        bg: '#000000',
        surface: '#111114',
        'surface-alt': '#0d0d0f',
        border: {
          DEFAULT: '#1f1f23',
          input: '#232327',
          pill: '#27272a',
          subtle: '#3f3f46',
        },
        text: {
          primary: '#ffffff',
          secondary: '#e4e4e7',
          tertiary: '#a1a1aa',
          muted: '#71717a',
          faint: '#52525b',
        },
        accent: {
          DEFAULT: '#3b82f6',
          light: '#60a5fa',
          lighter: '#93c5fd',
        },
        success: {
          DEFAULT: '#4ade80',
          bg: '#0e1f14',
          border: '#14532d',
        },
        warning: '#fb923c',
        danger: {
          DEFAULT: '#f87171',
          bg: 'rgba(239,68,68,0.12)',
          border: 'rgba(239,68,68,0.35)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        pill: '999px',
      },
      boxShadow: {
        menu: '0 12px 30px rgba(0,0,0,0.5)',
        fab: '0 8px 20px rgba(0,0,0,0.4)',
        timer: '0 12px 30px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}