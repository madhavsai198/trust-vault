// src/lib/theme.ts
// ─────────────────────────────────────────────────────────────
// Client-side theme provider & controller supporting Light & Dark modes.
// Defaults to 'light' mode as requested.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'trustvault-theme';

/**
 * Reads initial theme from localStorage or defaults to 'light'.
 */
export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // LocalStorage might be restricted
  }
  // Default to light mode
  return 'light';
}

/**
 * Applies the theme classes and color-scheme attributes to <html>
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }

  // Update meta tags for browser chrome & mobile header bars
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0F0C08' : '#F8FAFC');
  }

  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) {
    colorSchemeMeta.setAttribute('content', theme);
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage write errors
  }

  // Dispatch custom event so all listeners re-render
  window.dispatchEvent(new CustomEvent('trustvault-theme-change', { detail: { theme } }));
}

/**
 * React hook to read and toggle current theme.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Ensure the initial theme is applied to DOM on mount
    applyTheme(theme);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener('trustvault-theme-change', handleThemeChange);
    return () => window.removeEventListener('trustvault-theme-change', handleThemeChange);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
