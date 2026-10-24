// src/components/AuthModal.tsx
// ─────────────────────────────────────────────────────────────
// Authentication modal — email/password login and registration.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile } from '../types/document';
import { apiFetch } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  sessionNotice?: string | null;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, sessionNotice }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setName('');
      setEmail('');
      setPassword('');
      setError(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister ? { name, email, password } : { email, password };

    try {
      const data = await apiFetch<{ user: UserProfile; message?: string }>(endpoint, {
        method: 'POST',
        json: payload,
        silentAuth: true,
      });
      onAuthSuccess(data.user);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister((v) => !v);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-vault-950/80 backdrop-blur-md" />

      {/* Modal panel */}
      <div className="relative w-full max-w-md animate-fade-up">
        <div className="rounded-2xl border border-sand-100/10 bg-vault-800 shadow-2xl overflow-hidden">

          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-cobalt-700 via-cobalt-500 to-sun-500" />

          <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-7">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cobalt-700 flex items-center justify-center text-white font-black text-xs shadow-cobalt-sm">
                    TV
                  </div>
                  <span className="font-bold text-sand-100 text-lg">
                    Trust<span className="text-cobalt-400">Vault</span>
                  </span>
                </div>
                <h2
                  id="auth-modal-title"
                  className="text-xl font-serif font-bold text-sand-100"
                >
                  {isRegister ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-sm text-sand-500 mt-0.5">
                  {isRegister
                    ? 'Start securing your documents for free.'
                    : 'Sign in to access your private vault.'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-sand-500 hover:text-sand-200 hover:bg-vault-700/60 transition-all"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Session expiry notice */}
            {sessionNotice && !error && (
              <div
                role="status"
                className="mb-5 p-3.5 rounded-xl bg-sun-500/10 border border-sun-500/25 text-sun-400 text-sm flex items-start gap-3"
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{sessionNotice}</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm flex items-start gap-3"
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {isRegister && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-sand-400 mb-1.5 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    ref={isRegister ? firstInputRef : undefined}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className="input-vault"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-sand-400 mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  ref={!isRegister ? firstInputRef : undefined}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="input-vault"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-sand-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    className="input-vault pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-600 hover:text-sand-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {isRegister && (
                  <p className="text-xs text-sand-600 mt-1.5">Minimum 8 characters required.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-sm font-semibold mt-2 justify-center"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isRegister ? 'Creating account…' : 'Signing in…'}
                  </span>
                ) : (
                  isRegister ? 'Create Account' : 'Sign In to Vault'
                )}
              </button>
            </form>

            {/* Toggle */}
            <p className="mt-6 text-center text-sm text-sand-500">
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <button
                type="button"
                onClick={switchMode}
                className="text-cobalt-400 hover:text-cobalt-300 font-semibold hover:underline transition-colors"
              >
                {isRegister ? 'Sign in' : 'Create one free'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
