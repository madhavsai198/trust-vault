// src/components/LandingPage.tsx
// ─────────────────────────────────────────────────────────────
// TrustVault — SEO-Optimized, Fully Responsive Landing Page.
// Features impeccable responsive spacing, semantic HTML5,
// zero-knowledge architecture presentation, and interactive FAQ.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { UserProfile } from '../types/document';
import ThemeToggle from './ThemeToggle';

interface LandingPageProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenVault: () => void;
  onLogout: () => void;
}

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: FeatureItem[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Private Isolated Storage',
    description: 'Files are placed in a private server directory — never directly accessible by URL. Every document receives a cryptographically generated UUIDv4 key.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Magic-Byte File Signature Verification',
    description: 'Binary inspection validates every upload against its true MIME signature. Disguised malicious files and polyglots are rejected before reaching disk.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Granular Role-Based Access Control',
    description: 'Every API request is authorized server-side against an RBAC matrix. Owners grant read or edit permissions, and revoke them with immediate effect.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
      </svg>
    ),
    title: 'Secure Streaming Downloads',
    description: 'Documents stream directly through authenticated endpoints with no-cache and nosniff headers. Revoked access halts subsequent downloads instantaneously.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: 'Tamper-Evident Security Audit Log',
    description: 'Every authentication, access attempt, and permission delegation is logged with actor tracking, sanitized metadata, and request correlation IDs for ADMIN audit.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    title: 'HttpOnly Strict Cookie Authentication',
    description: 'JWT sessions are secured in HttpOnly SameSite=Strict cookies. Client-side JavaScript cannot read or exfiltrate your session, preventing XSS token theft.',
  },
];

const stats = [
  { value: 'Argon2id', label: 'Password Security' },
  { value: 'HttpOnly', label: 'XSS Prevention' },
  { value: 'UUIDv4', label: 'Storage Isolation' },
  { value: 'Strict RBAC', label: 'Access Control' },
];

const faqs = [
  {
    question: 'How does TrustVault isolate my private files?',
    answer:
      'Files are stored in private isolated storage on the server with cryptographically generated UUIDv4 keys. Client filenames are never used directly on disk, eliminating path traversal risks and direct URL access.',
  },
  {
    question: 'How does TrustVault prevent XSS token theft?',
    answer:
      'Authentication tokens are sealed in HttpOnly, SameSite=Strict cookies. JavaScript execution inside the browser cannot read or exfiltrate your session token, protecting against cross-site scripting.',
  },
  {
    question: 'What is magic-byte file signature verification?',
    answer:
      'TrustVault inspects the binary magic bytes of every uploaded file to verify its true MIME type before storage, preventing disguised executable files or polyglot payloads.',
  },
  {
    question: 'Who can access the security audit trail?',
    answer:
      'The audit trail is strictly restricted to authenticated users with the ADMIN role. Every document view, upload, download, permission delegation, and authentication event is logged with actor identification and request tracing.',
  },
  {
    question: 'What happens if a database write fails during document upload?',
    answer:
      'TrustVault implements atomic storage rollback: if database persistence encounters an error, the physical storage file is immediately purged from disk, guaranteeing zero orphaned storage objects.',
  },
];

export default function LandingPage({ currentUser, onOpenAuth, onOpenVault, onLogout }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="min-h-screen bg-vault-900 text-sand-100 flex flex-col overflow-x-hidden">
      {/* ── Accessible Skip Link ────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]
                   focus:px-4 focus:py-2.5 focus:bg-cobalt-700 focus:text-white focus:rounded-xl focus:shadow-cobalt-md"
      >
        Skip to main content
      </a>

      {/* ── Sticky Navigation Header ────────────────────────── */}
      <header className="sticky top-0 inset-x-0 z-50 border-b border-sand-100/10 bg-vault-900/90 backdrop-blur-xl transition-colors">
        <nav
          aria-label="Main navigation"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between"
        >
          {/* Brand Logo */}
          <a
            id="brand-logo"
            href="/"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus:ring-2 focus:ring-cobalt-500 rounded-xl p-1"
            aria-label="TrustVault Home"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-600 dark:bg-sun-500 flex items-center justify-center
                            text-white font-black text-xs sm:text-sm shadow-sm
                            group-hover:bg-amber-500 transition-colors">
              TV
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight text-sand-100">
              Trust<span className="text-amber-600 dark:text-sun-400">Vault</span>
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
            <a
              id="nav-link-features"
              href="#features"
              className="px-3.5 py-2 text-sm font-medium text-sand-400 hover:text-sand-100 rounded-xl hover:bg-vault-700/50 transition-all"
            >
              Features
            </a>
            <a
              id="nav-link-how"
              href="#how-it-works"
              className="px-3.5 py-2 text-sm font-medium text-sand-400 hover:text-sand-100 rounded-xl hover:bg-vault-700/50 transition-all"
            >
              How It Works
            </a>
            <a
              id="nav-link-security"
              href="#security"
              className="px-3.5 py-2 text-sm font-medium text-sand-400 hover:text-sand-100 rounded-xl hover:bg-vault-700/50 transition-all"
            >
              Security
            </a>
            <a
              id="nav-link-faq"
              href="#faq"
              className="px-3.5 py-2 text-sm font-medium text-sand-400 hover:text-sand-100 rounded-xl hover:bg-vault-700/50 transition-all"
            >
              FAQ
            </a>
          </div>

          {/* Desktop Auth & Theme Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {currentUser ? (
              <>
                <div className="flex items-center gap-2 text-sm text-sand-300">
                  <div className="w-7 h-7 rounded-full bg-cobalt-700/40 border border-cobalt-600/30
                                  flex items-center justify-center text-xs font-bold text-cobalt-300">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-sand-200">{currentUser.name}</span>
                </div>
                <button
                  id="nav-btn-open-vault"
                  onClick={onOpenVault}
                  className="btn-primary text-sm px-4 py-2"
                >
                  Open Vault
                </button>
                <button
                  id="nav-btn-signout"
                  onClick={onLogout}
                  className="text-sm text-sand-500 hover:text-sand-200 px-3 py-2 rounded-xl hover:bg-vault-700/50 transition-all"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  id="nav-btn-signin"
                  onClick={onOpenAuth}
                  className="text-sm font-medium text-sand-300 hover:text-sand-100 px-4 py-2 rounded-xl hover:bg-vault-700/50 transition-all"
                >
                  Sign In
                </button>
                <button
                  id="nav-btn-get-started"
                  onClick={onOpenAuth}
                  className="btn-primary text-sm px-5 py-2"
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>

          {/* Mobile Actions: Theme + Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              id="mobile-menu-toggle"
              className="p-2 rounded-xl border border-sand-100/10 text-sand-400 hover:text-sand-100 hover:bg-vault-700/50 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-sand-100/10 bg-vault-900/98 backdrop-blur-2xl px-6 py-5 space-y-3 animate-fade-in shadow-xl">
            <a href="#features" className="block py-2 text-sm font-medium text-sand-300 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block py-2 text-sm font-medium text-sand-300 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#security" className="block py-2 text-sm font-medium text-sand-300 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>Security</a>
            <a href="#faq" className="block py-2 text-sm font-medium text-sand-300 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>FAQ</a>

            <div className="pt-3 border-t border-sand-100/10 flex flex-col gap-2.5">
              {currentUser ? (
                <>
                  <button onClick={() => { setMobileMenuOpen(false); onOpenVault(); }} className="btn-primary text-sm py-2.5 w-full justify-center">Open Vault</button>
                  <button onClick={() => { setMobileMenuOpen(false); onLogout(); }} className="text-sm text-sand-500 hover:text-sand-300 py-2 text-center">Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setMobileMenuOpen(false); onOpenAuth(); }} className="btn-primary text-sm py-2.5 w-full justify-center">Get Started Free</button>
                  <button onClick={() => { setMobileMenuOpen(false); onOpenAuth(); }} className="text-sm font-medium text-sand-400 hover:text-sand-100 py-2 text-center">Sign In</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Main Content Landmark ───────────────────────────── */}
      <main id="main-content" className="flex-1">

        {/* ── Hero Section ──────────────────────────────────── */}
        <section
          id="hero-section"
          aria-labelledby="hero-title"
          className="relative pt-20 pb-14 sm:pt-24 sm:pb-18 lg:pt-28 lg:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
        >
          {/* Ambient Glows */}
          <div className="absolute inset-0 bg-vault-radial pointer-events-none" />
          <div className="absolute inset-0 bg-sun-glow pointer-events-none" />

          {/* Subtle Precision Grid Overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035] dark:opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Pre-title Badge — Primary Amber */}
            <div className="inline-flex items-center gap-2 mb-4 sm:mb-5 px-3.5 py-1.5 rounded-full
                            border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-sun-300
                            text-xs font-semibold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-slow" />
              Zero-Knowledge Document Security
            </div>

            {/* Main H1 Heading with Primary Amber Gradient */}
            <h1
              id="hero-title"
              className="text-4xl sm:text-6xl lg:text-7xl font-serif font-bold text-sand-100 tracking-tight leading-[1.12] mb-5 sm:mb-6"
            >
              Your documents.{' '}
              <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 dark:from-sun-400 dark:via-sun-300 dark:to-cobalt-400 bg-clip-text text-transparent">
                Truly private.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-sand-400 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              TrustVault is a zero-trust document vault with military-grade access control,
              magic-byte signature verification, and an immutable security audit trail — so you always
              know who touched what, and when.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-10 sm:mb-12">
              <button
                id="hero-cta-vault"
                onClick={currentUser ? onOpenVault : onOpenAuth}
                className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base gap-2.5 shadow-md"
                aria-label="Access TrustVault secure storage"
              >
                <span>{currentUser ? 'Go to My Vault' : 'Start Securing Documents'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <a
                id="hero-cta-how"
                href="#features"
                className="btn-ghost w-full sm:w-auto px-8 py-3.5 text-base"
                aria-label="Learn how TrustVault security works"
              >
                See How It Works
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-sand-500 font-medium">
              {[
                'No credit card required',
                'Isolated storage encryption',
                'Tamper-evident audit trail',
              ].map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{badge}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Key Security Stats Bar ─────────────────────────── */}
        <section
          id="stats-section"
          aria-label="Key security specifications"
          className="border-y border-sand-100/10 bg-vault-850/60 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-sand-100/10">
              {stats.map((s, idx) => (
                <div key={s.label} className={`text-center ${idx > 0 ? 'pt-4 sm:pt-0' : ''}`}>
                  <div className="text-xl sm:text-2xl font-mono font-bold text-amber-600 dark:text-sun-400 mb-1">
                    {s.value}
                  </div>
                  <div className="text-xs font-semibold text-sand-400 uppercase tracking-wider">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Section ──────────────────────────────── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
              <div className="badge-cobalt mb-3.5">Security-First Architecture</div>
              <h2
                id="features-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-sand-100 tracking-tight mb-4"
              >
                Built for the paranoid.{' '}
                <span className="text-sand-400 font-normal block sm:inline">
                  Perfect for everyone else.
                </span>
              </h2>
              <p className="text-base sm:text-lg text-sand-400 leading-relaxed">
                Every component was designed around a strict zero-trust threat model to guarantee total file integrity and confidentiality.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
              {features.map((f, i) => (
                <article
                  key={f.title}
                  className="card p-6 sm:p-7 flex flex-col justify-between hover:border-cobalt-500/35 hover:-translate-y-1 transition-all duration-300 group"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-cobalt-700/15 border border-cobalt-600/25
                                    flex items-center justify-center text-cobalt-600 dark:text-cobalt-400 mb-5
                                    group-hover:bg-cobalt-700/25 group-hover:border-cobalt-500/40 transition-all">
                      {f.icon}
                    </div>
                    <h3 className="font-bold text-sand-100 text-lg mb-2.5">
                      {f.title}
                    </h3>
                    <p className="text-sm text-sand-400 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-vault-800/30 border-y border-sand-100/8"
        >
          <div className="max-w-5xl mx-auto">
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
              <div className="badge-sun mb-3.5">Simple & Resilient</div>
              <h2
                id="how-it-works-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-sand-100 tracking-tight mb-4"
              >
                Vault your files in three steps
              </h2>
              <p className="text-base sm:text-lg text-sand-400">
                No complex key exchanges. No unverified attachments. Just upload, share, and track with certainty.
              </p>
            </div>

            {/* 3 Step Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: '01',
                  title: 'Create Your Account',
                  desc: 'Register with email. Your password is irreversibly hashed with Argon2id and sessions sealed in HttpOnly cookies.',
                  color: 'cobalt',
                },
                {
                  step: '02',
                  title: 'Upload & Verify',
                  desc: 'Drop files into your private vault. Deep magic-byte inspection verifies genuine MIME signatures before disk persistence.',
                  color: 'sun',
                },
                {
                  step: '03',
                  title: 'Share & Audit',
                  desc: 'Grant granular READ or EDIT permissions to specific teammates. Revoke instantly. Every action is written to the audit log.',
                  color: 'cobalt',
                },
              ].map((item) => (
                <div key={item.step} className="card p-6 sm:p-8 flex flex-col justify-between relative group hover:border-sand-100/20">
                  <div>
                    <div className={`text-4xl sm:text-5xl font-serif font-black mb-4 ${
                      item.color === 'sun' ? 'text-amber-500/40 dark:text-sun-500/40' : 'text-cobalt-600/40 dark:text-cobalt-400/40'
                    }`}>
                      {item.step}
                    </div>
                    <h3 className="text-lg font-bold text-sand-100 mb-2.5">
                      {item.title}
                    </h3>
                    <p className="text-sm text-sand-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Enterprise Security Architecture ──────────────── */}
        <section
          id="security"
          aria-labelledby="security-heading"
          className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Left Column Narrative */}
              <div className="lg:col-span-6 space-y-6">
                <div className="badge-cobalt">Enterprise-Grade Architecture</div>
                <h2
                  id="security-heading"
                  className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-sand-100 leading-[1.15]"
                >
                  Security isn't an afterthought.{' '}
                  <span className="text-cobalt-400 block mt-1">It's the foundation.</span>
                </h2>
                <p className="text-base text-sand-400 leading-relaxed">
                  TrustVault was engineered against the OWASP Top 10 threat matrix, eliminating risks such as
                  Insecure Direct Object References (IDOR), cross-site scripting (XSS) session hijacking, brute-force attacks,
                  and path traversal file overwrites.
                </p>
                <div className="pt-2">
                  <button
                    id="security-cta-action"
                    onClick={currentUser ? onOpenVault : onOpenAuth}
                    className="btn-primary"
                  >
                    {currentUser ? 'Open Secure Vault' : 'Create Free Account'}
                  </button>
                </div>
              </div>

              {/* Right Column Guarantee Cards */}
              <div className="lg:col-span-6 space-y-4">
                {[
                  {
                    title: 'Zero Client-Side Token Storage',
                    desc: 'JWT tokens reside solely in HttpOnly, SameSite=Strict cookies — completely immune to JavaScript XSS scraping.',
                  },
                  {
                    title: 'Server-Side Authorization on Every Request',
                    desc: 'No implicit trust in client payloads. Every single API route re-evaluates identity and active permissions in real-time.',
                  },
                  {
                    title: 'Rate-Limited Protection',
                    desc: 'Express-rate-limit buffers authentication endpoints, blocking credential stuffing and distributed brute-force attacks.',
                  },
                  {
                    title: 'Sanitized Audit Metadata',
                    desc: 'Passwords, raw secrets, and binary file streams are strictly scrubbed prior to ledger persistence.',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex gap-4 p-4 sm:p-5 rounded-2xl bg-vault-800/80 border border-sand-100/10 hover:border-cobalt-600/30 transition-all shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cobalt-700/20 border border-cobalt-600/30 flex items-center justify-center shrink-0 mt-0.5 text-cobalt-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-sand-100 mb-1">{item.title}</h3>
                      <p className="text-xs sm:text-sm text-sand-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Interactive FAQ Section ────────────────────────── */}
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-vault-800/20 border-t border-sand-100/8"
        >
          <div className="max-w-4xl mx-auto">
            {/* FAQ Header */}
            <div className="text-center mb-12 sm:mb-16">
              <div className="badge-cobalt mb-3.5">Answers & Clarity</div>
              <h2
                id="faq-heading"
                className="text-3xl sm:text-4xl font-serif font-bold text-sand-100 mb-4"
              >
                Frequently Asked Questions
              </h2>
              <p className="text-base text-sand-400 max-w-xl mx-auto">
                Everything you need to know about TrustVault's zero-knowledge architecture and operational guarantees.
              </p>
            </div>

            {/* Accordion List */}
            <div className="space-y-3.5">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={faq.question}
                    className="card border border-sand-100/10 overflow-hidden transition-all duration-200"
                  >
                    <button
                      id={`faq-btn-${index}`}
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-cobalt-500 rounded-xl"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                    >
                      <span className="font-bold text-sm sm:text-base text-sand-100">
                        {faq.question}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-vault-700/60 border border-sand-100/10 flex items-center justify-center shrink-0 text-sand-400">
                        <svg
                          className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        id={`faq-answer-${index}`}
                        className="px-5 pb-5 sm:px-6 sm:pb-6 text-sm text-sand-400 leading-relaxed border-t border-sand-100/8 pt-4 animate-fade-in"
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── High-Impact Call to Action Banner ──────────────── */}
        <section
          id="cta-section"
          aria-labelledby="cta-heading"
          className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-cobalt-700 p-8 sm:p-12 lg:p-16 text-center shadow-cobalt-lg">
              {/* Decorative radial glows */}
              <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cobalt-500/40 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-sun-500/20 blur-3xl pointer-events-none" />

              <div className="relative">
                <h2
                  id="cta-heading"
                  className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white mb-4 tracking-tight"
                >
                  Ready to secure your private documents?
                </h2>
                <p className="text-cobalt-100 mb-8 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                  Join TrustVault today. Enjoy zero-knowledge storage with cryptographic proof on every file.
                </p>
                <button
                  id="cta-banner-btn"
                  onClick={currentUser ? onOpenVault : onOpenAuth}
                  className="btn-sun text-base px-8 py-3.5 gap-2"
                  aria-label="Create account or open vault"
                >
                  <span>{currentUser ? 'Open My Vault' : 'Create Free Account'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Semantic Site Footer ────────────────────────────── */}
      <footer id="site-footer" className="border-t border-sand-100/10 bg-vault-950 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Col 1: Brand & Identity */}
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-600 dark:bg-sun-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
                  TV
                </div>
                <span className="font-bold text-sand-100 text-lg">
                  Trust<span className="text-amber-600 dark:text-sun-400">Vault</span>
                </span>
              </div>
              <p className="text-sm text-sand-500 leading-relaxed max-w-xs">
                Zero-knowledge private document storage featuring cryptographic UUID isolation and immutable security audit logs.
              </p>
            </div>

            {/* Col 2: Navigation Links */}
            <div>
              <h3 className="text-xs font-bold text-sand-300 uppercase tracking-widest mb-4">Navigation</h3>
              <ul className="space-y-2.5">
                {[
                  { name: 'Features', href: '#features' },
                  { name: 'How It Works', href: '#how-it-works' },
                  { name: 'Security Architecture', href: '#security' },
                  { name: 'FAQ', href: '#faq' },
                ].map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="text-sm text-sand-400 hover:text-cobalt-400 transition-colors"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Security Specifications */}
            <div>
              <h3 className="text-xs font-bold text-sand-300 uppercase tracking-widest mb-4">Specifications</h3>
              <ul className="space-y-2.5 text-sm text-sand-400">
                <li>Argon2id Hashing</li>
                <li>HttpOnly Strict Cookies</li>
                <li>MIME Magic Inspection</li>
                <li>Tamper-Evident Audit Trail</li>
              </ul>
            </div>

            {/* Col 4: Trust & Compliance */}
            <div>
              <h3 className="text-xs font-bold text-sand-300 uppercase tracking-widest mb-4">Compliance</h3>
              <p className="text-xs text-sand-500 leading-relaxed mb-3">
                All records stored in isolated non-public volumes. Tokens never persist in browser localStorage.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Zero-Knowledge Compliant
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-sand-100/8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sand-500">
            <span>© {new Date().getFullYear()} TrustVault. All rights reserved.</span>
            <div className="flex items-center gap-1.5 text-sand-400">
              <svg className="w-4 h-4 text-cobalt-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Secured with cryptographic UUID isolation & end-to-end verification</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
