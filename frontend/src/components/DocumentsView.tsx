// src/components/DocumentsView.tsx
// ─────────────────────────────────────────────────────────────
// Secure Document Management View (Phase 3).
//
// Features:
// 1. Authenticated document upload with client pre-validation & server enforcement.
// 2. Real-time listing with search and category filtering.
// 3. Authenticated streaming downloads (rechecking permissions on every request).
// 4. In-place metadata editing (PATCH) and secure deletion with confirmation.
// 5. Accessible landmarks, ARIA labels, responsive table/card layout.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useId } from 'react';
import type {
  VaultDocument,
  DocumentCategory,
  UserProfile,
  DocumentPermission,
  RecipientUser,
} from '../types/document';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const CATEGORIES: DocumentCategory[] = [
  'FINANCIAL',
  'LEGAL',
  'MEDICAL',
  'PERSONAL',
  'TAX',
  'OTHER',
];

interface DocumentsViewProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export default function DocumentsView({
  currentUser,
  onLogout,
  onNavigateHome,
}: DocumentsViewProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Upload Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('OTHER');
  const [uploading, setUploading] = useState(false);

  // Edit Modal states
  const [editingDoc, setEditingDoc] = useState<VaultDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('OTHER');
  const [savingEdit, setSavingEdit] = useState(false);

  // Sharing Modal states (Phase 4)
  const [sharingDoc, setSharingDoc] = useState<VaultDocument | null>(null);
  const [recipients, setRecipients] = useState<RecipientUser[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [selectedPerm, setSelectedPerm] = useState<'READ' | 'EDIT'>('READ');
  const [docPermissions, setDocPermissions] = useState<DocumentPermission[]>([]);
  const [loadingShareData, setLoadingShareData] = useState(false);
  const [grantingPerm, setGrantingPerm] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  // Action loading states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputId = useId();
  const titleInputId = useId();
  const categoryInputId = useId();
  const searchInputId = useId();

  // Helper to format file size
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Helper to get category badge color
  const getCategoryBadgeColor = (cat: DocumentCategory): string => {
    switch (cat) {
      case 'FINANCIAL':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'LEGAL':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'MEDICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'PERSONAL':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'TAX':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  // Helper to get file icon
  const getFileIcon = (mime: string): string => {
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('sheet') || mime.includes('excel')) return '📊';
    return '📁';
  };

  // Helper to get access level badge
  const getAccessLevelBadge = (level?: string) => {
    switch (level) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            🛡️ Admin
          </span>
        );
      case 'EDIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            ✏️ Shared (EDIT)
          </span>
        );
      case 'READ':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            👁️ Shared (READ)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            👑 Owner
          </span>
        );
    }
  };

  // ── Fetch Documents ──────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`${API_URL}/api/v1/documents?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch documents');
      }

      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, onLogout]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  // ── Upload Handler ───────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    if (!uploadTitle.trim()) {
      setError('Document title is required');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadTitle.trim());
      formData.append('category', uploadCategory);

      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccessMsg(`Document "${uploadTitle}" securely vaulted`);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadCategory('OTHER');
      // Reset input element
      const fileInput = document.getElementById(fileInputId) as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      fetchDocuments();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // ── Download Handler ─────────────────────────────────────────
  const handleDownload = async (doc: VaultDocument) => {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/documents/${doc.id}/download`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed or permission denied');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.originalFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Delete Handler ───────────────────────────────────────────
  const handleDelete = async (doc: VaultDocument) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${doc.title}"?\nThis removes the file from private storage immediately.`
    );
    if (!confirmDelete) return;

    setDeletingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed or unauthorized');
      }

      setSuccessMsg(`"${doc.title}" deleted from vault`);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Save Metadata Edit ───────────────────────────────────────
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (!editTitle.trim()) {
      setError('Title cannot be empty');
      return;
    }

    setSavingEdit(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/documents/${editingDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update metadata');
      }

      setSuccessMsg(`Metadata updated for "${editTitle}"`);
      setEditingDoc(null);
      fetchDocuments();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Sharing Handlers (Phase 4) ──────────────────────────────
  const fetchSharingDetails = async (docId: string) => {
    setLoadingShareData(true);
    setShareError(null);
    try {
      const [recipientsRes, permsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/documents/recipients/list`, { credentials: 'include' }),
        fetch(`${API_URL}/api/v1/documents/${docId}/permissions`, { credentials: 'include' }),
      ]);

      if (recipientsRes.ok) {
        const rData = await recipientsRes.json();
        const userList: RecipientUser[] = rData.users || [];
        setRecipients(userList);
        if (userList.length > 0) {
          setSelectedRecipientId((prev) => prev || userList[0].id);
        }
      }

      if (permsRes.ok) {
        const pData = await permsRes.json();
        setDocPermissions(pData.permissions || []);
      }
    } catch (err: unknown) {
      setShareError((err as Error).message);
    } finally {
      setLoadingShareData(false);
    }
  };

  const openShareModal = (doc: VaultDocument) => {
    setSharingDoc(doc);
    setShareError(null);
    setShareSuccess(null);
    fetchSharingDetails(doc.id);
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingDoc || !selectedRecipientId) return;

    setGrantingPerm(true);
    setShareError(null);
    setShareSuccess(null);

    try {
      const res = await fetch(
        `${API_URL}/api/v1/documents/${sharingDoc.id}/permissions/${selectedRecipientId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ permission: selectedPerm }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant permission');
      }

      setShareSuccess(data.message || `Granted ${selectedPerm} access`);
      await fetchSharingDetails(sharingDoc.id);
    } catch (err: unknown) {
      setShareError((err as Error).message);
    } finally {
      setGrantingPerm(false);
    }
  };

  const handleRevokePermission = async (userId: string) => {
    if (!sharingDoc) return;
    setRevokingUserId(userId);
    setShareError(null);
    setShareSuccess(null);

    try {
      const res = await fetch(
        `${API_URL}/api/v1/documents/${sharingDoc.id}/permissions/${userId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke permission');
      }

      setShareSuccess('Permission revoked successfully');
      await fetchSharingDetails(sharingDoc.id);
    } catch (err: unknown) {
      setShareError((err as Error).message);
    } finally {
      setRevokingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col justify-between">
      {/* ── Top Navigation Bar ───────────────────────────────── */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
              title="Return to home page"
            >
              <span className="text-2xl" aria-hidden="true">🔐</span>
              <span className="bg-gradient-to-r from-brand-500 to-violet-400 bg-clip-text text-transparent">
                TrustVault
              </span>
            </button>
            <span className="text-gray-600">/</span>
            <span className="text-sm font-medium text-gray-300">Private Vault</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-gray-300 font-medium">{currentUser.name}</span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                {currentUser.role}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ───────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Banner notifications */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
          >
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="hover:text-white"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center justify-between p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm"
          >
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="hover:text-white"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Document Upload Card ─────────────────────────────── */}
        <section aria-labelledby="upload-heading" className="card border-white/15 bg-gray-900/40">
          <h2 id="upload-heading" className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📤</span> Upload Secure Document
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Title input */}
              <div>
                <label htmlFor={titleInputId} className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Document Title *
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  placeholder="e.g. Q4 Tax Audit Report"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  maxLength={150}
                  className="w-full px-3 py-2 bg-gray-950 border border-white/10 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Category selector */}
              <div>
                <label htmlFor={categoryInputId} className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Category
                </label>
                <select
                  id={categoryInputId}
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 bg-gray-950 border border-white/10 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* File input */}
              <div>
                <label htmlFor={fileInputId} className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  File (.pdf, .png, .jpg, .docx, .xlsx, .txt) *
                </label>
                <input
                  id={fileInputId}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    if (file && !uploadTitle) {
                      // Pre-fill title without extension
                      const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                      setUploadTitle(name);
                    }
                  }}
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt"
                  required
                  className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-500/20 file:text-brand-300 hover:file:bg-brand-500/30 file:cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                🔒 Files are validated via magic-byte signatures and stored in isolated private storage outside the web root. Max size: 10MB.
              </p>
              <button
                type="submit"
                disabled={uploading}
                className="btn-primary text-sm px-6 py-2"
              >
                {uploading ? 'Encrypting & Storing…' : 'Vault Document'}
              </button>
            </div>
          </form>
        </section>

        {/* ── Document Explorer & Filter Bar ───────────────────── */}
        <section aria-labelledby="documents-heading" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 id="documents-heading" className="text-2xl font-bold tracking-tight">
              Vault Documents ({documents.length})
            </h2>

            {/* Filter and search controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category pills */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-brand-600 text-white font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      selectedCategory === cat
                        ? 'bg-brand-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <label htmlFor={searchInputId} className="sr-only">Search documents by title</label>
                <input
                  id={searchInputId}
                  type="search"
                  placeholder="Search title…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 pl-8 bg-gray-950 border border-white/10 rounded-lg text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 w-44"
                />
                <span className="absolute left-2.5 top-2 text-gray-500 text-xs" aria-hidden="true">
                  🔍
                </span>
              </div>

              <button
                onClick={fetchDocuments}
                className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-xs"
                title="Refresh list"
              >
                🔄
              </button>
            </div>
          </div>

          {/* ── Document List Table ───────────────────────────── */}
          {loading ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              <span className="inline-block animate-spin mr-2">⏳</span> Loading vault documents…
            </div>
          ) : documents.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-white/15">
              <span className="text-4xl mb-3 inline-block" aria-hidden="true">📭</span>
              <h3 className="text-lg font-semibold text-gray-200">No documents found</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                {searchQuery || selectedCategory !== 'ALL'
                  ? 'No documents matched your search or category filter.'
                  : 'Your vault is empty. Upload your first document using the form above.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-gray-900/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs text-gray-400 uppercase tracking-wider border-b border-white/10">
                  <tr>
                    <th scope="col" className="px-6 py-3">Document</th>
                    <th scope="col" className="px-6 py-3">Category</th>
                    <th scope="col" className="px-6 py-3">Access Level</th>
                    <th scope="col" className="px-6 py-3">Size</th>
                    <th scope="col" className="px-6 py-3">Uploaded</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" aria-hidden="true">
                            {getFileIcon(doc.detectedMimeType)}
                          </span>
                          <div>
                            <div className="font-medium text-white">{doc.title}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {doc.originalFilename}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getCategoryBadgeColor(
                            doc.category
                          )}`}
                        >
                          {doc.category}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {getAccessLevelBadge(doc.accessLevel)}
                      </td>

                      <td className="px-6 py-4 text-gray-400 text-xs font-mono">
                        {formatBytes(doc.sizeBytes)}
                      </td>

                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {new Date(doc.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-brand-500/50 hover:bg-brand-500/10 text-xs text-brand-300 font-medium transition-colors"
                            title="Download document"
                          >
                            {downloadingId === doc.id ? 'Streaming…' : '⬇️ Download'}
                          </button>

                          {(doc.accessLevel === 'OWNER' ||
                            doc.accessLevel === 'ADMIN' ||
                            !doc.accessLevel) && (
                            <button
                              onClick={() => openShareModal(doc)}
                              className="px-2.5 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-xs text-brand-300 font-medium transition-colors"
                              title="Manage permissions & share"
                            >
                              🔗 Share
                            </button>
                          )}

                          {doc.accessLevel !== 'READ' && (
                            <button
                              onClick={() => {
                                setEditingDoc(doc);
                                setEditTitle(doc.title);
                                setEditCategory(doc.category);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-xs text-gray-400 hover:text-white transition-colors"
                              title="Edit metadata"
                            >
                              ✏️
                            </button>
                          )}

                          {(doc.accessLevel === 'OWNER' ||
                            doc.accessLevel === 'ADMIN' ||
                            !doc.accessLevel) && (
                            <button
                              onClick={() => handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/50 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete document"
                            >
                              {deletingId === doc.id ? '…' : '🗑️'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── Metadata Edit Modal ──────────────────────────────── */}
      {editingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="card max-w-md w-full bg-gray-900 border-white/20 shadow-2xl p-6 space-y-4">
            <h3 id="edit-dialog-title" className="text-lg font-bold">
              Edit Document Metadata
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={150}
                  className="w-full px-3 py-2 bg-gray-950 border border-white/15 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 bg-gray-950 border border-white/15 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 rounded-lg border border-white/15 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-sm px-4 py-2"
                >
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Document Sharing & Permissions Modal (Phase 4) ─── */}
      {sharingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="card max-w-2xl w-full bg-gray-900 border-white/20 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden="true">🔗</span>
                  <h3 id="share-dialog-title" className="text-lg font-bold text-white">
                    Share Document
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Manage access permissions for <span className="font-semibold text-gray-200">"{sharingDoc.title}"</span>
                </p>
              </div>
              <button
                onClick={() => setSharingDoc(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Alerts */}
            {shareError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
                <span>⚠️ {shareError}</span>
                <button onClick={() => setShareError(null)}>✕</button>
              </div>
            )}
            {shareSuccess && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center justify-between">
                <span>✅ {shareSuccess}</span>
                <button onClick={() => setShareSuccess(null)}>✕</button>
              </div>
            )}

            {/* Grant Access Form */}
            <form onSubmit={handleGrantPermission} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
              <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <span>➕</span> Grant Access to Registered Recipient
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Select Recipient
                  </label>
                  {recipients.length === 0 ? (
                    <div className="text-xs text-gray-500 italic p-2 border border-white/10 rounded-lg">
                      No other registered users available
                    </div>
                  ) : (
                    <select
                      value={selectedRecipientId}
                      onChange={(e) => setSelectedRecipientId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-950 border border-white/15 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                      required
                    >
                      {recipients.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email}) [{user.role}]
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Permission Level
                  </label>
                  <select
                    value={selectedPerm}
                    onChange={(e) => setSelectedPerm(e.target.value as 'READ' | 'EDIT')}
                    className="w-full px-3 py-2 bg-gray-950 border border-white/15 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="READ">READ (View metadata & Download)</option>
                    <option value="EDIT">EDIT (View, Download & Edit Metadata)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={grantingPerm || recipients.length === 0}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {grantingPerm ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      <span>Granting…</span>
                    </>
                  ) : (
                    <>
                      <span>🔒</span>
                      <span>Grant Permission</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Active Permissions List */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>👥</span> Active & Past Access Grants ({docPermissions.length})
                </span>
                {loadingShareData && (
                  <span className="text-xs text-gray-500 animate-pulse">Loading…</span>
                )}
              </h4>

              {docPermissions.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
                  This document has not been shared with any users yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
                  {docPermissions.map((perm) => {
                    const isRevoked = Boolean(perm.revokedAt);
                    const recipientUser = perm.user;
                    const granter = perm.grantedBy;

                    return (
                      <div
                        key={perm.id}
                        className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">
                              {recipientUser?.name || 'Unknown User'}
                            </span>
                            <span className="text-gray-500">({recipientUser?.email})</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                perm.permission === 'EDIT'
                                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {perm.permission}
                            </span>
                            {isRevoked ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                                Revoked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Granted by {granter?.name || 'Owner'} on{' '}
                            {new Date(perm.createdAt).toLocaleDateString()}
                            {isRevoked && ` · Revoked on ${new Date(perm.revokedAt!).toLocaleDateString()}`}
                          </div>
                        </div>

                        <div>
                          {!isRevoked ? (
                            <button
                              onClick={() => handleRevokePermission(recipientUser._id)}
                              disabled={revokingUserId === recipientUser._id}
                              className="px-3 py-1 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium transition-colors"
                            >
                              {revokingUserId === recipientUser._id ? 'Revoking…' : 'Revoke Access'}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                setSelectedRecipientId(recipientUser._id);
                                setSelectedPerm(perm.permission);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-colors text-[11px]"
                            >
                              Re-grant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSharingDoc(null)}
                className="px-4 py-2 rounded-lg border border-white/15 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="py-6 px-6 border-t border-white/10 text-center text-xs text-gray-600">
        TrustVault — Snovasys Fresher Hiring Challenge 2026 &nbsp;·&nbsp; Phase 4: Document Sharing and Permissions
      </footer>
    </div>
  );
}
