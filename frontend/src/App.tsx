// src/App.tsx
// ─────────────────────────────────────────────────────────────
// Root application component managing auth state and view routing.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import DocumentsView from './components/DocumentsView';
import AuditLogView from './components/AuditLogView';
import AuthModal from './components/AuthModal';
import { apiFetch, onSessionExpired } from './lib/api';
import type { UserProfile } from './types/document';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'landing' | 'vault' | 'audit'>('landing');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Subscribe to automatic session expiry events from apiFetch
  useEffect(() => {
    const unsubscribe = onSessionExpired((reason) => {
      setSessionNotice(reason || 'Your session has expired. Please sign in again.');
      setCurrentUser(null);
      setView('landing');
      setIsAuthModalOpen(true);
    });
    return unsubscribe;
  }, []);

  // Check existing session on application load
  const checkSession = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserProfile }>('/auth/me');
      setCurrentUser(data.user);
      setView('vault'); // If already authenticated, jump to Vault
    } catch {
      setCurrentUser(null);
      setView('landing');
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error on logout
    } finally {
      setCurrentUser(null);
      setView('landing');
      setSessionNotice(null);
    }
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setSessionNotice(null);
    setView('vault');
  };

  const openAuth = () => {
    setSessionNotice(null);
    setIsAuthModalOpen(true);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-vault-900 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-600 dark:bg-sun-500 flex items-center justify-center
                        text-white font-black text-base shadow-md animate-pulse-slow">
          TV
        </div>
        <div className="flex items-center gap-2.5 text-sm text-sand-400">
          <svg className="w-4 h-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-medium text-sand-300">Verifying secure session…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === 'audit' && currentUser && currentUser.role === 'ADMIN' ? (
        <AuditLogView
          currentUser={currentUser}
          onNavigateVault={() => setView('vault')}
          onNavigateHome={() => setView('landing')}
          onLogout={handleLogout}
        />
      ) : view === 'vault' && currentUser ? (
        <DocumentsView
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigateHome={() => setView('landing')}
          onNavigateAudit={() => setView('audit')}
        />
      ) : (
        <LandingPage
          currentUser={currentUser}
          onOpenAuth={openAuth}
          onOpenVault={() => setView('vault')}
          onLogout={handleLogout}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setSessionNotice(null);
        }}
        onAuthSuccess={handleAuthSuccess}
        sessionNotice={sessionNotice}
      />
    </>
  );
}

