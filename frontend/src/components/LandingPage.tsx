// src/components/LandingPage.tsx
// ─────────────────────────────────────────────────────────────
// TrustVault — Production landing page.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import type { UserProfile } from '../types/document';

interface LandingPageProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onOpenVault: () => void;
  onLogout: () => void;
}

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Private Isolated Storage',
    description: 'Your files are stored in a private server directory — never publicly accessible by URL. Each file gets a cryptographic UUID key.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'File Signature Verification',
    description: 'Magic-byte inspection validates every upload against its true MIME type. Malicious files disguised with fake extensions are rejected before storage.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Role-Based Access Control',
    description: 'Every request is authorized server-side against a strict RBAC model. Owners control sharing. Viewers get read-only access. Admins audit everything.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
      </svg>
    ),
    title: 'Secure Streaming Downloads',
    description: 'Downloads stream through the authenticated API with strict no-cache headers. Revoked access takes effect on the very next request.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: 'Tamper-Evident Audit Trail',
    description: 'Every authentication event, document access, and permission change is recorded in an admin-only audit log with full actor tracking and request correlation.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    title: 'HttpOnly Cookie Auth',
    description: 'Sessions are stored in HttpOnly, SameSite=Strict cookies. JavaScript cannot read your token — XSS cannot steal your session.',
  },
];

const stats = [
  { value: 'Argon2id', label: 'Password hashing' },
  { value: 'HttpOnly', label: 'Cookie security' },
  { value: 'AES-256', label: 'Storage isolation' },
  { value: 'RBAC', label: 'Access control' },
];

export default function LandingPage({ currentUser, onOpenAuth, onOpenVault, onLogout }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-vault-900 text-sand-100 flex flex-col overflow-x-hidden">
      {/* ── Skip link ─────────────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]
                   focus:px-4 focus:py-2 focus:bg-cobalt-700 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* ── Navbar ────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <nav
          aria-label="Main navigation"
          className="border-b border-sand-100/8 bg-vault-900/85 backdrop-blur-lg"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); }}
              className="flex items-center gap-3 group"
              aria-label="TrustVault Home"
            >
              <div className="w-8 h-8 rounded-lg bg-cobalt-700 flex items-center justify-center
                              text-white font-black text-sm shadow-cobalt-sm
                              group-hover:bg-cobalt-600 transition-colors">
                TV
              </div>
              <span className="font-bold text-lg tracking-tight text-sand-100">
                Trust<span className="text-cobalt-400">Vault</span>
              </span>
            </a>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <a href="#features" className="px-4 py-2 text-sm text-sand-400 hover:text-sand-100 rounded-lg hover:bg-vault-700/50 transition-all">
                Features
              </a>
              <a href="#security" className="px-4 py-2 text-sm text-sand-400 hover:text-sand-100 rounded-lg hover:bg-vault-700/50 transition-all">
                Security
              </a>
              <a href="#how-it-works" className="px-4 py-2 text-sm text-sand-400 hover:text-sand-100 rounded-lg hover:bg-vault-700/50 transition-all">
                How It Works
              </a>
            </div>

            {/* Auth actions */}
            <div className="hidden md:flex items-center gap-3">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-sand-300">
                    <div className="w-7 h-7 rounded-full bg-cobalt-700/50 border border-cobalt-600/40
                                    flex items-center justify-center text-xs font-bold text-cobalt-300">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{currentUser.name}</span>
                  </div>
                  <button
                    onClick={onOpenVault}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Open Vault
                  </button>
                  <button
                    onClick={onLogout}
                    className="text-sm text-sand-500 hover:text-sand-300 px-3 py-2 rounded-lg hover:bg-vault-700/50 transition-all"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onOpenAuth}
                    className="text-sm text-sand-300 hover:text-sand-100 px-4 py-2 rounded-lg hover:bg-vault-700/50 transition-all font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={onOpenAuth}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Get Started Free
                  </button>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg border border-sand-100/10 text-sand-400 hover:text-sand-100 hover:bg-vault-700/50 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-sand-100/8 bg-vault-850/95 backdrop-blur-xl px-6 py-4 space-y-3 animate-fade-in">
              <a href="#features" className="block py-2 text-sm text-sand-400 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#security" className="block py-2 text-sm text-sand-400 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>Security</a>
              <a href="#how-it-works" className="block py-2 text-sm text-sand-400 hover:text-sand-100" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <div className="pt-3 border-t border-sand-100/8 flex flex-col gap-2">
                {currentUser ? (
                  <>
                    <button onClick={onOpenVault} className="btn-primary text-sm py-2.5 w-full justify-center">Open Vault</button>
                    <button onClick={onLogout} className="text-sm text-sand-500 hover:text-sand-300 py-2 text-center">Sign Out</button>
                  </>
                ) : (
                  <>
                    <button onClick={onOpenAuth} className="btn-primary text-sm py-2.5 w-full justify-center">Get Started Free</button>
                    <button onClick={onOpenAuth} className="text-sm text-sand-400 hover:text-sand-200 py-2 text-center">Sign In</button>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* ── Main ──────────────────────────────────────────── */}
      <main id="main-content" className="flex-1">

        {/* ── Hero ─────────────────────────────────────────── */}
        <section aria-labelledby="hero-title" className="relative pt-32 pb-28 px-6 overflow-hidden">
          {/* Background glows */}
          <div className="absolute inset-0 bg-vault-radial pointer-events-none" />
          <div className="absolute inset-0 bg-sun-glow pointer-events-none" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(245,239,224,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,239,224,1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Pre-title badge */}
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full
                            border border-cobalt-600/30 bg-cobalt-700/10 text-cobalt-300 text-xs font-semibold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-cobalt-400 animate-pulse-slow" />
              End-to-End Secure Document Management
            </div>

            <h1
              id="hero-title"
              className="text-5xl md:text-7xl font-serif font-bold leading-[1.1] mb-6 tracking-tight"
            >
              Your documents.{' '}
              <br className="hidden md:block" />
              <span
                className="bg-gradient-to-r from-cobalt-400 via-cobalt-300 to-sun-400 bg-clip-text text-transparent"
              >
                Truly private.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-sand-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              TrustVault is a zero-trust document vault with military-grade access control,
              cryptographic file verification, and a complete security audit trail — so you always
              know who touched what, and when.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                id="cta-get-started"
                onClick={currentUser ? onOpenVault : onOpenAuth}
                className="btn-primary text-base px-8 py-3.5 gap-2.5 shadow-cobalt-md"
                aria-label="Access secure vault"
              >
                {currentUser ? 'Go to My Vault' : 'Start Securing Documents'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <a
                id="cta-learn-more"
                href="#features"
                className="btn-ghost text-base px-8 py-3.5"
                aria-label="Learn about TrustVault security"
              >
                See How It Works
              </a>
            </div>

            {/* Trust indicators */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-sand-500">
              {['No credit card required', 'End-to-end encrypted storage', 'Audit log on every action'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-cobalt-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats bar ─────────────────────────────────────── */}
        <section aria-label="Security specifications" className="border-y border-sand-100/8 bg-vault-800/40">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-mono font-semibold text-sun-400 mb-1">{s.value}</div>
                  <div className="text-xs text-sand-500 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section id="features" aria-labelledby="features-title" className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="badge-cobalt mb-4">Security-First Architecture</div>
              <h2 id="features-title" className="text-4xl font-serif font-bold text-sand-100 mb-4">
                Built for the paranoid. <br />
                <span className="text-sand-400 font-normal text-3xl">Perfect for everyone else.</span>
              </h2>
              <p className="text-sand-500 max-w-xl mx-auto leading-relaxed">
                Every component was designed with a threat model in mind. Here's what protects your data.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className="group card hover:border-cobalt-600/25 hover:bg-vault-700/80 transition-all duration-300"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-cobalt-700/20 border border-cobalt-600/25
                                  flex items-center justify-center text-cobalt-400 mb-5
                                  group-hover:bg-cobalt-700/30 group-hover:border-cobalt-500/40 transition-all">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-sand-100 mb-2.5 text-[15px]">{f.title}</h3>
                  <p className="text-sm text-sand-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section id="how-it-works" aria-labelledby="how-it-works-title" className="py-24 px-6 bg-vault-800/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="badge-sun mb-4">Simple & Secure</div>
              <h2 id="how-it-works-title" className="text-4xl font-serif font-bold text-sand-100 mb-4">
                Vault your files in seconds
              </h2>
              <p className="text-sand-500 max-w-xl mx-auto">
                No complicated setup. No keys to manage. Just upload, share, and sleep soundly.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Create Your Account',
                  desc: 'Register with your email. Your password is hashed with Argon2id — even we cannot read it.',
                  color: 'cobalt',
                },
                {
                  step: '02',
                  title: 'Upload & Organize',
                  desc: 'Drag and drop PDFs, images, or documents. Magic-byte validation ensures no disguised malware gets through.',
                  color: 'sun',
                },
                {
                  step: '03',
                  title: 'Share with Confidence',
                  desc: 'Grant granular access to specific people. Revoke it instantly. Every action is logged in the audit trail.',
                  color: 'cobalt',
                },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className={`text-5xl font-serif font-bold mb-4 ${
                    item.color === 'sun' ? 'text-sun-500/30' : 'text-cobalt-700/40'
                  }`}>
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-sand-100 mb-3">{item.title}</h3>
                  <p className="text-sm text-sand-500 leading-relaxed">{item.desc}</p>
                  {/* Connector arrow — desktop */}
                  {item.step !== '03' && (
                    <div className="hidden md:block absolute top-10 -right-4 text-sand-700">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security section ──────────────────────────────── */}
        <section id="security" aria-labelledby="security-title" className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              <div>
                <div className="badge-cobalt mb-6">Enterprise-Grade Security</div>
                <h2 id="security-title" className="text-4xl font-serif font-bold text-sand-100 mb-6 leading-tight">
                  Security isn't a feature. <br />
                  <span className="text-cobalt-400">It's the foundation.</span>
                </h2>
                <p className="text-sand-500 leading-relaxed mb-8">
                  TrustVault was designed with a comprehensive threat model, protecting against OWASP
                  Top 10 risks including IDOR, XSS session theft, CSRF, brute-force, path traversal, and
                  unauthorised privilege escalation.
                </p>
                <button
                  onClick={currentUser ? onOpenVault : onOpenAuth}
                  className="btn-primary"
                >
                  {currentUser ? 'Go to Vault' : 'Start for Free'}
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { title: 'Zero Client-Side Token Storage', desc: 'JWT stored in HttpOnly cookies — inaccessible to JavaScript and XSS.' },
                  { title: 'Server-Side Authorization on Every Request', desc: 'No trust in client claims. Every endpoint re-verifies identity and permissions.' },
                  { title: 'Rate-Limited Login', desc: 'Maximum 10 attempts per 15 minutes per IP prevents credential stuffing.' },
                  { title: 'Sanitized Audit Metadata', desc: 'Passwords, tokens, and raw file content are explicitly excluded from audit logs.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-vault-700/40 border border-sand-100/7 hover:border-cobalt-600/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-cobalt-700/30 border border-cobalt-600/30 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-cobalt-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-sand-200 mb-1">{item.title}</div>
                      <div className="text-sm text-sand-500 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ────────────────────────────────────── */}
        <section aria-labelledby="cta-title" className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-cobalt-700 px-10 py-16 text-center shadow-cobalt-lg">
              {/* Decorative blobs */}
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-cobalt-600/40 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-sun-500/20 blur-3xl" />
              <div className="relative">
                <h2 id="cta-title" className="text-4xl font-serif font-bold text-white mb-4">
                  Ready to secure your documents?
                </h2>
                <p className="text-cobalt-200 mb-8 text-lg max-w-xl mx-auto">
                  Join TrustVault today. Your files deserve better than a shared drive.
                </p>
                <button
                  onClick={currentUser ? onOpenVault : onOpenAuth}
                  className="btn-sun text-base px-8 py-3.5"
                >
                  {currentUser ? 'Open My Vault' : 'Create Free Account'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-sand-100/8 bg-vault-950 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-cobalt-700 flex items-center justify-center text-white font-black text-xs">TV</div>
                <span className="font-bold text-sand-100">Trust<span className="text-cobalt-400">Vault</span></span>
              </div>
              <p className="text-sm text-sand-600 leading-relaxed max-w-xs">
                Zero-trust document storage with cryptographic verification and a complete audit trail.
              </p>
            </div>
            {/* Product links */}
            <div>
              <h3 className="text-xs font-semibold text-sand-400 uppercase tracking-widest mb-4">Product</h3>
              <ul className="space-y-2.5">
                {['Features', 'Security', 'How It Works', 'Sign In'].map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (link === 'Sign In') { onOpenAuth(); } }}
                      className="text-sm text-sand-600 hover:text-sand-300 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Security links */}
            <div>
              <h3 className="text-xs font-semibold text-sand-400 uppercase tracking-widest mb-4">Security</h3>
              <ul className="space-y-2.5">
                {['Argon2id Hashing', 'HttpOnly Cookies', 'RBAC Authorization', 'Audit Logging'].map((item) => (
                  <li key={item}>
                    <span className="text-sm text-sand-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-sand-100/6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sand-700">
            <span>© {new Date().getFullYear()} TrustVault. All rights reserved.</span>
            <div className="flex items-center gap-1 text-sand-700">
              <svg className="w-3.5 h-3.5 text-cobalt-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Secured with end-to-end encryption</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
