// src/components/LandingPage.tsx
// ─────────────────────────────────────────────────────────────
// The TrustVault landing / dashboard placeholder.
// Phase 1: No real data — this is a UI skeleton only.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// Feature cards shown on the landing page
const features = [
  {
    icon: '🔒',
    title: 'End-to-End Encrypted',
    description: 'Documents are encrypted before they leave your device. Only you and your trusted contacts can read them.',
  },
  {
    icon: '🤝',
    title: 'Trusted Sharing',
    description: 'Grant fine-grained access to individuals. Revoke access at any time with a single click.',
  },
  {
    icon: '📋',
    title: 'Full Audit Trail',
    description: 'Every view, download, and share is logged with a timestamp so nothing goes unnoticed.',
  },
  {
    icon: '🛡️',
    title: 'Zero-Knowledge Design',
    description: 'The server never sees your unencrypted data. Your secrets stay yours.',
  },
];

// ── Types ─────────────────────────────────────────────────────
type HealthStatus = 'checking' | 'ok' | 'error';

export default function LandingPage() {
  const [apiStatus, setApiStatus] = useState<HealthStatus>('checking');

  // Ping the backend health endpoint when the page loads.
  // This demonstrates the frontend ↔ backend connection.
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => (res.ok ? setApiStatus('ok') : setApiStatus('error')))
      .catch(() => setApiStatus('error'));
  }, []);

  const statusConfig: Record<HealthStatus, { label: string; colour: string; dot: string }> = {
    checking: { label: 'Checking API…', colour: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
    ok:       { label: 'API Online',    colour: 'text-green-400',  dot: 'bg-green-400' },
    error:    { label: 'API Offline',   colour: 'text-red-400',    dot: 'bg-red-400' },
  };

  const { label, colour, dot } = statusConfig[apiStatus];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col justify-between">
      {/* Skip to Content for screen reader & keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* ── Header & Navigation ──────────────────────────────── */}
      <header>
        <nav
          aria-label="Main navigation"
          className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-md"
        >
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <span className="text-2xl" aria-hidden="true">🔐</span>
              <span className="bg-gradient-to-r from-brand-500 to-violet-400 bg-clip-text text-transparent">
                TrustVault
              </span>
            </div>

            {/* API health indicator */}
            <div
              className="flex items-center gap-2 text-sm"
              role="status"
              aria-live="polite"
              aria-label={`Backend service status: ${label}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
              <span className={colour}>{label}</span>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Main Content Landmark ────────────────────────────── */}
      <main id="main-content" className="flex-1">

        {/* ── Hero Section ────────────────────────────────────── */}
        <section aria-labelledby="hero-title" className="pt-32 pb-24 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            {/* Status Badge */}
            <span className="inline-block mb-6 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase
                             border border-green-500/40 bg-green-500/10 text-green-400">
              Phase 2 — Auth &amp; Database Active
            </span>

            <h1 id="hero-title" className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
              Store &amp; share{' '}
              <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                secrets safely
              </span>
            </h1>

            <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
              TrustVault lets you store sensitive documents and share them with trusted contacts —
              with end-to-end encryption, fine-grained access control, and a full audit trail.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <a
                id="cta-get-started"
                href="#features"
                className="btn-primary text-base inline-flex items-center gap-2"
                aria-label="Explore TrustVault security architecture"
              >
                Explore Platform
                <span aria-hidden="true">→</span>
              </a>
              <a
                id="cta-learn-more"
                href="#features"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15
                           hover:border-brand-500/50 text-gray-300 hover:text-white font-semibold
                           transition-all duration-200"
                aria-label="Learn more about TrustVault features"
              >
                Security Specs ↓
              </a>
            </div>
          </div>
        </section>

        {/* ── Features Section ────────────────────────────────── */}
        <section id="features" aria-labelledby="features-title" className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 id="features-title" className="text-3xl font-bold text-center mb-4">Why TrustVault?</h2>
            <p className="text-center text-gray-400 mb-14">
              Built with security-first principles at every layer.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => (
                <div key={f.title} className="card hover:border-brand-500/30 transition-colors duration-300">
                  <div className="text-4xl mb-4" aria-hidden="true">{f.icon}</div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Roadmap Section ─────────────────────────────────── */}
        <section aria-labelledby="roadmap-title" className="py-20 px-6 border-t border-white/10">
          <div className="max-w-3xl mx-auto">
            <h2 id="roadmap-title" className="text-3xl font-bold text-center mb-12">Project Roadmap</h2>

            <ol className="space-y-4">
              {[
                { phase: 'Phase 1', label: 'Project Foundation & Tooling',            done: true  },
                { phase: 'Phase 2', label: 'MongoDB Atlas & Argon2id Auth (RBAC)',    done: true  },
                { phase: 'Phase 3', label: 'Document Storage & Client Encryption',    done: false },
                { phase: 'Phase 4', label: 'Granular Sharing & Access Delegation',    done: false },
                { phase: 'Phase 5', label: 'Security Hardening & Comprehensive Audit',done: false },
              ].map((item) => (
                <li
                  key={item.phase}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors
                    ${item.done
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-white/10 bg-white/5'}`}
                >
                  <span className={`text-xl ${item.done ? 'text-green-400' : 'text-gray-600'}`} aria-hidden="true">
                    {item.done ? '✅' : '⬜'}
                  </span>
                  <span className="font-mono text-sm text-gray-500 w-20 shrink-0">{item.phase}</span>
                  <span className={`font-medium ${item.done ? 'text-white' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-white/10 text-center text-sm text-gray-600">
        <p>TrustVault — Snovasys Fresher Hiring Challenge 2026 &nbsp;·&nbsp; Phase 2</p>
      </footer>
    </div>
  );
}
