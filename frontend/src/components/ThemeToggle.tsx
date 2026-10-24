// src/components/ThemeToggle.tsx
// ─────────────────────────────────────────────────────────────
// Interactive, accessible Theme Toggle button (Light / Dark mode).
// ─────────────────────────────────────────────────────────────

import { useTheme } from '../lib/theme';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium
                 border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cobalt-500
                 ${
                   isDark
                     ? 'bg-vault-800 text-sand-300 border-sand-100/10 hover:text-sun-400 hover:border-sun-500/30 hover:bg-vault-750'
                     : 'bg-white text-sand-300 border-slate-200 shadow-sm hover:text-cobalt-600 hover:border-cobalt-500/40 hover:bg-slate-50'
                 } ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={`Current theme is ${theme}. Click to switch to ${isDark ? 'light' : 'dark'} mode.`}
    >
      <span className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          /* Moon icon in dark mode */
          <svg
            className="w-4 h-4 text-sun-400 transition-transform duration-300 transform rotate-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        ) : (
          /* Sun icon in light mode */
          <svg
            className="w-4 h-4 text-amber-500 transition-transform duration-300 transform rotate-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
      </span>

      {showLabel && (
        <span className="text-xs font-semibold tracking-wide">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
}
