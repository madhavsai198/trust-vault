// src/components/AppNavbar.tsx
// ─────────────────────────────────────────────────────────────
// Unified, accessible, responsive navigation header.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import type { UserProfile } from '../types/document';
import ThemeToggle from './ThemeToggle';

interface AppNavbarProps {
  currentUser: UserProfile;
  currentView: 'vault' | 'audit';
  onNavigateView: (view: 'vault' | 'audit') => void;
  onNavigateHome: () => void;
  onLogout: () => void;
}

export default function AppNavbar({
  currentUser,
  currentView,
  onNavigateView,
  onNavigateHome,
  onLogout,
}: AppNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileMenuOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try { await onLogout(); } finally { setLoggingOut(false); }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      ADMIN:  'bg-cobalt-700/25 border-cobalt-600/40 text-cobalt-300',
      OWNER:  'bg-sun-500/15   border-sun-500/35    text-sun-400',
      VIEWER: 'bg-vault-600/50 border-sand-100/15   text-sand-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border ${styles[role] ?? styles.VIEWER}`}>
        {role}
      </span>
    );
  };

  const getInitials = (name: string) =>
    name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="border-b border-sand-100/8 bg-vault-900/85 backdrop-blur-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Brand + Desktop Nav */}
        <div className="flex items-center gap-7">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-cobalt-500 rounded-lg p-1"
            title="TrustVault Home"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-600 dark:bg-sun-500 flex items-center justify-center
                            font-black text-white text-xs shadow-sm
                            group-hover:bg-amber-500 transition-colors">
              TV
            </div>
            <span className="font-bold text-lg text-sand-100 hidden sm:block">
              Trust<span className="text-amber-600 dark:text-sun-400">Vault</span>
            </span>
          </button>

          {/* Desktop nav links */}
          <nav aria-label="App navigation" className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onNavigateView('vault')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                currentView === 'vault'
                  ? 'bg-vault-700 text-sand-100 border border-sand-100/10 shadow-sm'
                  : 'text-sand-400 hover:text-sand-200 hover:bg-vault-700/50 border border-transparent'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              Documents
            </button>

            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => onNavigateView('audit')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  currentView === 'audit'
                    ? 'bg-cobalt-700/30 text-cobalt-300 border border-cobalt-600/40'
                    : 'text-sand-400 hover:text-cobalt-300 hover:bg-cobalt-700/15 border border-transparent'
                }`}
                title="Security Audit Trail"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Audit Trail
              </button>
            )}
          </nav>
        </div>

        {/* Right: User + Theme + Actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />

          {/* User chip */}
          <div className="flex items-center gap-2.5 bg-vault-700/60 border border-sand-100/8 px-3 py-1.5 rounded-xl text-sm">
            <div className="w-6 h-6 rounded-full bg-cobalt-700/60 border border-cobalt-600/40
                            flex items-center justify-center text-[10px] font-bold text-cobalt-200">
              {getInitials(currentUser.name)}
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="text-sand-200 font-medium text-xs">{currentUser.name}</span>
              <span className="text-sand-600 text-[10px]">{currentUser.email}</span>
            </div>
            <div className="ml-1">{getRoleBadge(currentUser.role)}</div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogoutClick}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sand-100/10
                       hover:border-red-500/30 hover:bg-red-950/20
                       text-xs font-medium text-sand-500 hover:text-red-400 transition-all disabled:opacity-50"
            title="Sign out"
          >
            {loggingOut ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            Sign out
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg border border-sand-100/10 text-sand-400 hover:text-sand-100 hover:bg-vault-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-cobalt-500"
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-sand-100/8 bg-vault-850/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-fade-in">
          {/* User info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-vault-700/60 border border-sand-100/8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-cobalt-700/60 border border-cobalt-600/40
                              flex items-center justify-center text-xs font-bold text-cobalt-200">
                {getInitials(currentUser.name)}
              </div>
              <div>
                <div className="text-xs font-semibold text-sand-200">{currentUser.name}</div>
                <div className="text-[11px] text-sand-500">{currentUser.email}</div>
              </div>
            </div>
            {getRoleBadge(currentUser.role)}
          </div>

          {/* Nav links */}
          <div className="space-y-1">
            <button
              onClick={() => { onNavigateView('vault'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                currentView === 'vault' ? 'bg-vault-700 text-sand-100' : 'text-sand-400 hover:text-sand-100 hover:bg-vault-700/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              Documents
            </button>

            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => { onNavigateView('audit'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-all ${
                  currentView === 'audit' ? 'bg-cobalt-700/30 text-cobalt-300' : 'text-sand-400 hover:text-cobalt-300 hover:bg-cobalt-700/15'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Audit Trail
              </button>
            )}

            <button
              onClick={() => { onNavigateHome(); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left text-sand-500 hover:text-sand-200 hover:bg-vault-700/50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Home
            </button>
          </div>

          {/* Theme mode toggle */}
          <div className="pt-2 border-t border-sand-100/8 flex items-center justify-between">
            <span className="text-xs text-sand-400 font-medium">Appearance</span>
            <ThemeToggle showLabel />
          </div>

          {/* Sign out */}
          <div className="pt-2 border-t border-sand-100/8">
            <button
              onClick={() => { setMobileMenuOpen(false); handleLogoutClick(); }}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                         bg-red-950/30 border border-red-500/25 text-sm font-semibold text-red-400
                         hover:bg-red-900/40 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out of TrustVault
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
