// src/components/AuthModal.tsx
// ─────────────────────────────────────────────────────────────
// Authentication modal supporting email/password login,
// account registration, and 1-click test user sign-in for interviewers.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { UserProfile } from '../types/document';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister ? { name, email, password } : { email, password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data.user);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click login helper for evaluation
  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Quick login failed');
      }

      onAuthSuccess(data.user);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="card max-w-md w-full bg-gray-900 border-white/20 shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 id="auth-modal-title" className="text-xl font-bold text-white flex items-center gap-2">
            <span>🔐</span> {isRegister ? 'Create TrustVault Account' : 'Sign in to TrustVault'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* 1-Click Demo Accounts for Easy Interview Testing */}
        {!isRegister && (
          <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 space-y-2">
            <span className="text-xs font-semibold text-brand-300 block uppercase tracking-wider">
              ⚡ 1-Click Evaluation Accounts
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('owner@trustvault.dev', 'OwnerDev@123!')}
                className="py-1.5 px-2 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-medium"
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@trustvault.dev', 'AdminDev@123!')}
                className="py-1.5 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-medium"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('viewer@trustvault.dev', 'ViewerDev@123!')}
                className="py-1.5 px-2 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-medium"
              >
                Viewer
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Doe"
                className="w-full px-3 py-2 bg-gray-950 border border-white/10 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
              className="w-full px-3 py-2 bg-gray-950 border border-white/10 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-gray-950 border border-white/10 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5 text-sm font-semibold mt-2"
          >
            {loading ? 'Authenticating…' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400 pt-2 border-t border-white/10">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className="text-brand-400 hover:underline font-semibold"
              >
                Sign in
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className="text-brand-400 hover:underline font-semibold"
              >
                Create one
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
