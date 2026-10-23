/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Backgrounds ─────────────────────────────────────────
        vault: {
          950: '#0A0805',
          900: '#0F0C08',
          850: '#141008',
          800: '#1A1610',
          750: '#1E1A12',
          700: '#211D14',
          600: '#2A2518',
          500: '#35301F',
          400: '#4A4430',
        },
        // ── Primary: Cobalt Blue ────────────────────────────────
        cobalt: {
          950: '#0C1A4A',
          900: '#112260',
          800: '#163080',
          700: '#1B4FD8',
          600: '#2563EB',
          500: '#3B7CF8',
          400: '#5B93FF',
          300: '#93B8FF',
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
          400: '#F5C842',
          300: '#FAD96A',
          200: '#FDE89A',
          100: '#FEF6D0',
        },
        // ── Warm text tones ─────────────────────────────────────
        sand: {
          100: '#F5EFE0',
          200: '#E8DFC7',
          300: '#D4C9A8',
          400: '#C4B89A',
          500: '#A89E82',
          600: '#8A8066',
          700: '#6E654E',
          800: '#524C39',
          900: '#3A3428',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'ui-sans-serif', 'system-ui'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'vault-radial': 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(27,79,216,0.15), transparent)',
        'cobalt-glow':  'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(27,79,216,0.10), transparent)',
        'sun-glow':     'radial-gradient(ellipse 40% 30% at 80% 20%, rgba(245,200,66,0.08), transparent)',
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
        'vault-card':'0 1px 0 rgba(245,239,224,0.06), inset 0 1px 0 rgba(245,239,224,0.04)',
      },
    },
  },
  plugins: [],
};
