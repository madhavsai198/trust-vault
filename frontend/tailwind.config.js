/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Adaptive Backgrounds ────────────────────────────────
        vault: {
          950: 'rgb(var(--vault-950) / <alpha-value>)',
          900: 'rgb(var(--vault-900) / <alpha-value>)',
          850: 'rgb(var(--vault-850) / <alpha-value>)',
          800: 'rgb(var(--vault-800) / <alpha-value>)',
          750: 'rgb(var(--vault-750) / <alpha-value>)',
          700: 'rgb(var(--vault-700) / <alpha-value>)',
          600: 'rgb(var(--vault-600) / <alpha-value>)',
          500: 'rgb(var(--vault-500) / <alpha-value>)',
          400: 'rgb(var(--vault-400) / <alpha-value>)',
        },
        // ── Primary: Cobalt Blue ────────────────────────────────
        cobalt: {
          950: '#0C1A4A',
          900: '#112260',
          800: '#163080',
          700: '#1B4FD8',
          600: '#2563EB',
          500: '#3B7CF8',
          400: 'rgb(var(--cobalt-400) / <alpha-value>)',
          300: 'rgb(var(--cobalt-300) / <alpha-value>)',
          200: '#C7DAFF',
          100: '#EBF1FF',
        },
        // ── Secondary: Sun Yellow / Amber ───────────────────────
        sun: {
          950: '#3D2800',
          900: '#5C3C00',
          800: '#7A5000',
          700: '#A06A00',
          600: '#C88800',
          500: '#EAB308',
          400: 'rgb(var(--sun-400) / <alpha-value>)',
          300: 'rgb(var(--sun-300) / <alpha-value>)',
          200: '#FDE89A',
          100: '#FEF6D0',
        },
        // ── Adaptive Text Tones ─────────────────────────────────
        sand: {
          100: 'rgb(var(--sand-100) / <alpha-value>)',
          200: 'rgb(var(--sand-200) / <alpha-value>)',
          300: 'rgb(var(--sand-300) / <alpha-value>)',
          400: 'rgb(var(--sand-400) / <alpha-value>)',
          500: 'rgb(var(--sand-500) / <alpha-value>)',
          600: 'rgb(var(--sand-600) / <alpha-value>)',
          700: 'rgb(var(--sand-700) / <alpha-value>)',
          800: 'rgb(var(--sand-800) / <alpha-value>)',
          900: 'rgb(var(--sand-900) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'ui-sans-serif', 'system-ui'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'vault-radial': 'radial-gradient(ellipse 80% 60% at 50% -20%, var(--glow-cobalt), transparent)',
        'cobalt-glow':  'radial-gradient(ellipse 60% 40% at 50% 100%, var(--glow-cobalt-subtle), transparent)',
        'sun-glow':     'radial-gradient(ellipse 40% 30% at 80% 20%, var(--glow-sun), transparent)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up':    'fade-up 0.5s ease-out forwards',
        'fade-in':    'fade-in 0.4s ease-out forwards',
        shimmer:      'shimmer 2.5s linear infinite',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        float:        'float 4s ease-in-out infinite',
      },
      boxShadow: {
        'cobalt-sm': '0 2px 8px rgba(27,79,216,0.25)',
        'cobalt-md': '0 4px 20px rgba(27,79,216,0.35)',
        'cobalt-lg': '0 8px 40px rgba(27,79,216,0.40)',
        'sun-sm':    '0 2px 8px rgba(245,200,66,0.20)',
        'sun-md':    '0 4px 20px rgba(245,200,66,0.30)',
        'vault-card':'var(--shadow-vault-card)',
      },
    },
  },
  plugins: [],
};
