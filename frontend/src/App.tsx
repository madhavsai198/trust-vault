// src/App.tsx
// ─────────────────────────────────────────────────────────────
// Root application component managing auth state and view routing.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import DocumentsView from './components/DocumentsView';
import AuthModal from './components/AuthModal';
import type { UserProfile } from './types/document';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'landing' | 'vault'>('landing');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check existing session on application load
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setView('vault'); // If already authenticated, jump to Vault
      } else {
        setCurrentUser(null);
        setView('landing');
      }
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
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network error on logout
    } finally {
      setCurrentUser(null);
      setView('landing');
    }
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setView('vault');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center text-sm">
        <span className="inline-block animate-spin mr-2">⏳</span> Loading TrustVault…
      </div>
    );
  }

  return (
    <>
      {view === 'vault' && currentUser ? (
        <DocumentsView
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigateHome={() => setView('landing')}
        />
      ) : (
        <LandingPage
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenVault={() => setView('vault')}
          onLogout={handleLogout}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}
