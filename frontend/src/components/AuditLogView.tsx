// src/components/AuditLogView.tsx
// ─────────────────────────────────────────────────────────────
// Production Security Audit Trail & Compliance Ledger.
// Access restricted to ADMIN role. Real-time correlation,
// actor identification, request tracking, and sanitized metadata.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UserProfile } from '../types/document';
import type { AuditLogEntry, AuditAction } from '../types/audit';
import AppNavbar from './AppNavbar';
import { apiFetch, ApiError } from '../lib/api';

interface AuditLogViewProps {
  currentUser: UserProfile;
  onNavigateVault: () => void;
  onNavigateHome: () => void;
  onLogout: () => void;
}

interface ActionBadgeConfig {
  label: string;
  category: 'auth' | 'document' | 'permission' | 'security';
  badgeClass: string;
}

const ACTION_CONFIG: Record<AuditAction, ActionBadgeConfig> = {
  LOGIN_SUCCESS: {
    label: 'Login Authorized',
    category: 'auth',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  LOGIN_FAILED: {
    label: 'Login Failed',
    category: 'security',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  LOGOUT_SUCCESS: {
    label: 'Session Terminated',
    category: 'auth',
    badgeClass: 'bg-vault-600/50 text-sand-400 border-sand-100/15',
  },
  REGISTER_SUCCESS: {
    label: 'Account Created',
    category: 'auth',
    badgeClass: 'bg-cobalt-700/25 text-cobalt-300 border-cobalt-600/35',
  },
  DOCUMENT_UPLOADED: {
    label: 'Document Stored',
    category: 'document',
    badgeClass: 'bg-cobalt-600/20 text-cobalt-300 border-cobalt-500/30',
  },
  DOCUMENT_VIEWED: {
    label: 'Document Accessed',
    category: 'document',
    badgeClass: 'bg-sun-500/15 text-sun-400 border-sun-500/30',
  },
  DOCUMENT_DOWNLOADED: {
    label: 'Document Streamed',
    category: 'document',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  DOCUMENT_UPDATED: {
    label: 'Metadata Updated',
    category: 'document',
    badgeClass: 'bg-sun-500/15 text-sun-400 border-sun-500/30',
  },
  DOCUMENT_DELETED: {
    label: 'Document Removed',
    category: 'document',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  DOCUMENT_ACCESS_DENIED: {
    label: 'Unauthorized Read',
    category: 'security',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/35',
  },
  DOCUMENT_UPDATE_DENIED: {
    label: 'Unauthorized Edit',
    category: 'security',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/35',
  },
  DOCUMENT_DELETE_DENIED: {
    label: 'Unauthorized Delete',
    category: 'security',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/35',
  },
  UPLOAD_REJECTED: {
    label: 'Upload Denied',
    category: 'security',
    badgeClass: 'bg-sun-500/20 text-sun-300 border-sun-500/35',
  },
  PERMISSION_GRANTED: {
    label: 'Access Delegated',
    category: 'permission',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  PERMISSION_REVOKED: {
    label: 'Access Revoked',
    category: 'permission',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  PERMISSION_CHANGE_DENIED: {
    label: 'Delegation Denied',
    category: 'security',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/35',
  },
};

export default function AuditLogView({
  currentUser,
  onNavigateVault,
  onNavigateHome,
  onLogout,
}: AuditLogViewProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters state
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected entry for metadata modal
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (currentUser.role !== 'ADMIN') return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (actionFilter !== 'ALL') {
        params.append('action', actionFilter);
      }
      if (outcomeFilter !== 'ALL') {
        params.append('outcome', outcomeFilter);
      }

      const data = await apiFetch<{
        logs: AuditLogEntry[];
        pagination: { total: number; totalPages: number; page: number; limit: number };
      }>(`/api/v1/audit-logs?${params.toString()}`);

      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403) {
        setError('Access denied: Administrator privileges required to inspect audit logs.');
      } else {
        setError((err as Error).message || 'Failed to fetch audit records');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser.role, page, limit, actionFilter, outcomeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      const actorName = log.actorId?.name?.toLowerCase() || '';
      const actorEmail = log.actorId?.email?.toLowerCase() || '';
      const docTitle = log.documentId?.title?.toLowerCase() || '';
      const reqId = log.requestId?.toLowerCase() || '';
      const targetName = log.targetUserId?.name?.toLowerCase() || '';
      const targetEmail = log.targetUserId?.email?.toLowerCase() || '';
      return (
        actorName.includes(q) ||
        actorEmail.includes(q) ||
        docTitle.includes(q) ||
        reqId.includes(q) ||
        targetName.includes(q) ||
        targetEmail.includes(q)
      );
    });
  }, [logs, searchQuery]);

  const copyRequestId = (reqId: string) => {
    navigator.clipboard.writeText(reqId);
    setCopiedId(reqId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    } catch {
      return { date: ts, time: '' };
    }
  };

  const renderActionIcon = (action: AuditAction) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
      case 'LOGOUT_SUCCESS':
      case 'REGISTER_SUCCESS':
        return (
          <svg className="w-4 h-4 text-cobalt-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        );
      case 'DOCUMENT_UPLOADED':
      case 'DOCUMENT_VIEWED':
      case 'DOCUMENT_DOWNLOADED':
      case 'DOCUMENT_UPDATED':
      case 'DOCUMENT_DELETED':
        return (
          <svg className="w-4 h-4 text-sun-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        );
      case 'PERMISSION_GRANTED':
      case 'PERMISSION_REVOKED':
        return (
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  // Explicit Non-Admin Access-Denied View
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-vault-900 text-sand-100 flex flex-col font-sans">
        <AppNavbar
          currentUser={currentUser}
          currentView="vault"
          onNavigateView={(v) => {
            if (v === 'vault') onNavigateVault();
          }}
          onNavigateHome={onNavigateHome}
          onLogout={onLogout}
        />
        <main className="flex-1 max-w-lg w-full mx-auto px-6 flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-500/10">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-bold text-sand-100 mb-2">Access Denied</h1>
          <p className="text-sm text-sand-400 mb-6 leading-relaxed">
            Administrator privileges are strictly required to view the security audit ledger.
            This access attempt has been logged.
          </p>
          <button
            onClick={onNavigateVault}
            className="btn-primary text-xs px-5 py-2.5"
          >
            Return to Documents Vault
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vault-900 text-sand-100 flex flex-col font-sans justify-between">
      {/* ── Top Nav ──────────────────────────────────────────── */}
      <AppNavbar
        currentUser={currentUser}
        currentView="audit"
        onNavigateView={(v) => {
          if (v === 'vault') onNavigateVault();
        }}
        onNavigateHome={onNavigateHome}
        onLogout={onLogout}
      />

      {/* ── Main Content Area ────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header Banner */}
        <div className="card rounded-2xl border-sand-100/10 bg-vault-700/70 p-6 md:p-8 backdrop-blur-sm relative overflow-hidden shadow-vault-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-cobalt-700/20 border border-cobalt-600/30 flex items-center justify-center text-cobalt-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-serif font-bold text-sand-100 tracking-tight">
                    Security Activity & Compliance Ledger
                  </h1>
                  <span className="badge-cobalt mt-1">Live Audit Stream</span>
                </div>
              </div>
              <p className="text-xs text-sand-500 max-w-2xl leading-relaxed mt-2">
                Immutable, application-level audit logging correlating authentication events, document access,
                sharing authorizations, and prevented security violations.
              </p>
            </div>

            {/* Total Stats Counters */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-vault-850/90 border border-sand-100/10 text-center min-w-[96px]">
                <div className="text-lg font-mono font-bold text-cobalt-400">{totalCount}</div>
                <div className="text-[10px] text-sand-500 uppercase tracking-widest font-semibold">Events</div>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-vault-850/90 border border-sand-100/10 text-center min-w-[96px]">
                <div className="text-lg font-mono font-bold text-emerald-400">
                  {logs.filter((l) => l.outcome === 'SUCCESS').length}
                </div>
                <div className="text-[10px] text-sand-500 uppercase tracking-widest font-semibold">Authorized</div>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-vault-850/90 border border-sand-100/10 text-center min-w-[96px]">
                <div className="text-lg font-mono font-bold text-rose-400">
                  {logs.filter((l) => l.outcome === 'DENIED').length}
                </div>
                <div className="text-[10px] text-sand-500 uppercase tracking-widest font-semibold">Prevented</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters & Search Control Bar ───────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl border border-sand-100/10 bg-vault-850/70 backdrop-blur-sm">
          {/* Action Filter */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
              Event Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="input-vault text-xs py-2 cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <optgroup label="Authentication">
                <option value="LOGIN_SUCCESS">LOGIN_SUCCESS (Login Authorized)</option>
                <option value="LOGIN_FAILED">LOGIN_FAILED (Login Failed)</option>
                <option value="LOGOUT_SUCCESS">LOGOUT_SUCCESS (Session Terminated)</option>
                <option value="REGISTER_SUCCESS">REGISTER_SUCCESS (Account Created)</option>
              </optgroup>
              <optgroup label="Documents">
                <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED (Document Stored)</option>
                <option value="DOCUMENT_VIEWED">DOCUMENT_VIEWED (Document Accessed)</option>
                <option value="DOCUMENT_DOWNLOADED">DOCUMENT_DOWNLOADED (Document Streamed)</option>
                <option value="DOCUMENT_UPDATED">DOCUMENT_UPDATED (Metadata Updated)</option>
                <option value="DOCUMENT_DELETED">DOCUMENT_DELETED (Document Removed)</option>
              </optgroup>
              <optgroup label="Security & Access Control">
                <option value="DOCUMENT_ACCESS_DENIED">DOCUMENT_ACCESS_DENIED (Unauthorized Read)</option>
                <option value="DOCUMENT_UPDATE_DENIED">DOCUMENT_UPDATE_DENIED (Unauthorized Edit)</option>
                <option value="DOCUMENT_DELETE_DENIED">DOCUMENT_DELETE_DENIED (Unauthorized Delete)</option>
                <option value="UPLOAD_REJECTED">UPLOAD_REJECTED (Upload Denied)</option>
              </optgroup>
              <optgroup label="Access Delegation">
                <option value="PERMISSION_GRANTED">PERMISSION_GRANTED (Access Delegated)</option>
                <option value="PERMISSION_REVOKED">PERMISSION_REVOKED (Access Revoked)</option>
                <option value="PERMISSION_CHANGE_DENIED">PERMISSION_CHANGE_DENIED (Delegation Denied)</option>
              </optgroup>
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
              Outcome
            </label>
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="input-vault text-xs py-2 cursor-pointer"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">SUCCESS (Authorized)</option>
              <option value="DENIED">DENIED (Prevented / Access Denied)</option>
              <option value="SYSTEM_FAILURE">SYSTEM_FAILURE</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
              Search Page
            </label>
            <input
              type="text"
              placeholder="Filter by actor, document title, or request ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-vault text-xs py-2"
            />
          </div>

          {/* Refresh Action */}
          <div className="md:col-span-1 flex items-end">
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh ledger"
              className="w-full h-[38px] flex items-center justify-center bg-vault-700 hover:bg-vault-600 border border-sand-100/10 rounded-xl text-sand-300 hover:text-white transition-all disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin text-cobalt-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchLogs}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Audit Logs Feed / Table ────────────────────────── */}
        <div className="rounded-2xl border border-sand-100/10 bg-vault-700/60 backdrop-blur-sm overflow-hidden shadow-vault-card">
          {loading && logs.length === 0 ? (
            <div className="p-16 text-center text-sand-400 text-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cobalt-700/20 border border-cobalt-600/30 flex items-center justify-center mx-auto mb-2 text-cobalt-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="font-medium text-sand-200">Querying security ledger…</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-14 text-center text-sand-400 text-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-vault-800 border border-sand-100/10 flex items-center justify-center mx-auto text-sand-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div className="font-semibold text-sand-200">No matching audit events</div>
              <p className="text-xs text-sand-500 max-w-sm mx-auto">
                No events match the selected criteria or search term. Try resetting your filters.
              </p>
              {(actionFilter !== 'ALL' || outcomeFilter !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setActionFilter('ALL');
                    setOutcomeFilter('ALL');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="btn-ghost text-xs px-4 py-2 mt-2"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sand-100/8 bg-vault-850/90 text-[11px] font-semibold uppercase tracking-wider text-sand-400">
                    <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                    <th className="py-3.5 px-4 font-semibold">Event Action</th>
                    <th className="py-3.5 px-4 font-semibold">Outcome</th>
                    <th className="py-3.5 px-4 font-semibold">Actor</th>
                    <th className="py-3.5 px-4 font-semibold">Target Resource</th>
                    <th className="py-3.5 px-4 font-semibold">Request ID</th>
                    <th className="py-3.5 px-4 text-right font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100/5">
                  {filteredLogs.map((log) => {
                    const cfg = ACTION_CONFIG[log.action] || {
                      label: log.action,
                      category: 'security',
                      badgeClass: 'bg-vault-600/50 text-sand-400 border-sand-100/15',
                    };
                    const { date, time } = formatTimestamp(log.timestamp);
                    const isSuccess = log.outcome === 'SUCCESS';

                    return (
                      <tr
                        key={log._id}
                        className="hover:bg-vault-600/30 transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-sand-100">{time}</div>
                          <div className="text-[10px] text-sand-500">{date}</div>
                        </td>

                        {/* Event Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-vault-800 border border-sand-100/10 flex items-center justify-center shrink-0">
                              {renderActionIcon(log.action)}
                            </div>
                            <div>
                              <div className="font-semibold text-sand-100">{cfg.label}</div>
                              <div className="text-[10px] text-sand-500 font-mono tracking-tight">
                                {log.action}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Outcome Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isSuccess
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuccess ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                              }`}
                            />
                            {log.outcome}
                          </span>
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {log.actorId ? (
                            <div>
                              <div className="font-medium text-sand-100 flex items-center gap-1.5">
                                <span>{log.actorId.name}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-vault-800 text-sand-400 border border-sand-100/10 uppercase">
                                  {log.actorId.role}
                                </span>
                              </div>
                              <div className="text-[10px] text-sand-500">{log.actorId.email}</div>
                            </div>
                          ) : (
                            <span className="text-sand-500 italic text-[11px]">
                              {log.metadata?.attemptedEmail ? (
                                <span>Anon ({String(log.metadata.attemptedEmail)})</span>
                              ) : (
                                'Unauthenticated'
                              )}
                            </span>
                          )}
                        </td>

                        {/* Target Resource */}
                        <td className="py-3.5 px-4 max-w-[200px] truncate">
                          {log.documentId ? (
                            <div>
                              <div className="font-medium text-sand-200 truncate" title={log.documentId.title}>
                                {log.documentId.title}
                              </div>
                              {log.documentId.category && (
                                <div className="text-[10px] text-sand-500">{log.documentId.category}</div>
                              )}
                            </div>
                          ) : log.targetUserId ? (
                            <div>
                              <div className="font-medium text-cobalt-300">
                                Recipient: {log.targetUserId.name}
                              </div>
                              <div className="text-[10px] text-sand-500">{log.targetUserId.email}</div>
                            </div>
                          ) : (
                            <span className="text-sand-600">—</span>
                          )}
                        </td>

                        {/* Request ID */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-sand-400">
                          <button
                            onClick={() => copyRequestId(log.requestId)}
                            className="inline-flex items-center gap-1.5 hover:text-cobalt-300 transition-colors p-1 rounded"
                            title="Click to copy correlation request ID"
                          >
                            <span>{log.requestId.substring(0, 8)}…</span>
                            {copiedId === log.requestId ? (
                              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 text-sand-500 hover:text-sand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </td>

                        {/* Inspect Details Button */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedEntry(log)}
                            className="px-2.5 py-1 rounded-lg bg-vault-800 hover:bg-vault-700 text-[11px] font-medium text-sand-300 hover:text-white border border-sand-100/10 transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination Controls ──────────────────────────── */}
          <div className="border-t border-sand-100/8 px-4 py-3 bg-vault-850/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sand-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-vault-800 border border-sand-100/10 rounded-lg px-2 py-1 text-xs text-sand-200 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sand-600">|</span>
              <span>
                Total <strong className="text-sand-200 font-mono">{totalCount}</strong> entries
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1 rounded-lg border border-sand-100/10 bg-vault-800 hover:bg-vault-700 disabled:opacity-30 transition-all text-sand-300"
              >
                « First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1 rounded-lg border border-sand-100/10 bg-vault-800 hover:bg-vault-700 disabled:opacity-30 transition-all text-sand-300"
              >
                ‹ Prev
              </button>

              <span className="px-3 font-medium text-sand-200">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-2.5 py-1 rounded-lg border border-sand-100/10 bg-vault-800 hover:bg-vault-700 disabled:opacity-30 transition-all text-sand-300"
              >
                Next ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="px-2.5 py-1 rounded-lg border border-sand-100/10 bg-vault-800 hover:bg-vault-700 disabled:opacity-30 transition-all text-sand-300"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Metadata Inspector Modal ─────────────────────────── */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEntry(null); }}
        >
          <div className="absolute inset-0 bg-vault-950/80 backdrop-blur-md" />
          <div className="relative bg-vault-800 border border-sand-100/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 animate-fade-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-sand-100/8 flex items-center justify-between bg-vault-850/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-vault-700 border border-sand-100/10 flex items-center justify-center">
                  {renderActionIcon(selectedEntry.action)}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sand-100 text-sm">
                    {ACTION_CONFIG[selectedEntry.action]?.label || selectedEntry.action}
                  </h3>
                  <div className="text-[10px] text-sand-500 font-mono">
                    ID: {selectedEntry._id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-lg text-sand-500 hover:text-sand-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-2 space-y-4 text-xs">
              {/* Event Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 bg-vault-850/60 p-4 rounded-xl border border-sand-100/8">
                <div>
                  <div className="text-[10px] font-semibold text-sand-500 uppercase tracking-wider">Outcome</div>
                  <span
                    className={`font-bold ${
                      selectedEntry.outcome === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {selectedEntry.outcome}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-sand-500 uppercase tracking-wider">Timestamp</div>
                  <div className="text-sand-300 font-mono text-[11px]">
                    {new Date(selectedEntry.timestamp).toISOString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-sand-500 uppercase tracking-wider">Actor</div>
                  <div className="text-sand-200">
                    {selectedEntry.actorId
                      ? `${selectedEntry.actorId.name} (${selectedEntry.actorId.email})`
                      : 'None / Unauthenticated'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-sand-500 uppercase tracking-wider">Correlation ID</div>
                  <div className="font-mono text-sand-400 truncate text-[11px]" title={selectedEntry.requestId}>
                    {selectedEntry.requestId}
                  </div>
                </div>
              </div>

              {/* Safe Metadata Payload */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-sand-400 mb-2 flex items-center justify-between">
                  <span>Sanitized Event Metadata</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Secrets & Passwords Excluded
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-vault-950 border border-sand-100/8 font-mono text-[11px] text-sand-300 overflow-x-auto max-h-48">
                  {Object.keys(selectedEntry.metadata || {}).length === 0 ? (
                    <span className="text-sand-600 italic">No additional metadata recorded</span>
                  ) : (
                    <pre>{JSON.stringify(selectedEntry.metadata, null, 2)}</pre>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-sand-100/8 bg-vault-850/60 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="btn-ghost text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="py-6 px-6 border-t border-sand-100/8 bg-vault-950 text-center text-xs text-sand-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} TrustVault Inc. All rights reserved.</span>
          <div className="flex items-center gap-4 text-sand-600">
            <span>SOC 2 Type II Audited</span>
            <span>·</span>
            <span>Tamper-Evident Security Log</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
