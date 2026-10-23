// src/components/DocumentsView.tsx
// ─────────────────────────────────────────────────────────────
// Production Document Management View.
// Zero-trust document storage, streaming downloads, RBAC sharing,
// and cryptographic verification with full accessibility.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useId } from 'react';
import type {
  VaultDocument,
  DocumentCategory,
  UserProfile,
  DocumentPermission,
  RecipientUser,
} from '../types/document';
import AppNavbar from './AppNavbar';
import { apiFetch, apiDownload } from '../lib/api';

const CATEGORIES: DocumentCategory[] = [
  'FINANCIAL',
  'LEGAL',
  'MEDICAL',
  'PERSONAL',
  'TAX',
  'OTHER',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

interface DocumentsViewProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onNavigateHome: () => void;
  onNavigateAudit?: () => void;
}

export default function DocumentsView({
  currentUser,
  onLogout,
  onNavigateHome,
  onNavigateAudit,
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
  const [isDragging, setIsDragging] = useState(false);

  // Edit Modal states
  const [editingDoc, setEditingDoc] = useState<VaultDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('OTHER');
  const [savingEdit, setSavingEdit] = useState(false);

  // Sharing Modal states
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

  // Escape key listener for dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingDoc(null);
        setSharingDoc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryBadgeClass = (cat: DocumentCategory): string => {
    switch (cat) {
      case 'FINANCIAL':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'LEGAL':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'MEDICAL':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'PERSONAL':
        return 'bg-cobalt-700/25 text-cobalt-300 border-cobalt-600/30';
      case 'TAX':
        return 'bg-sun-500/15 text-sun-400 border-sun-500/30';
      default:
        return 'bg-vault-600/50 text-sand-400 border-sand-100/15';
    }
  };

  const renderFileIcon = (mime: string) => {
    if (mime.includes('pdf')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      );
    }
    if (mime.includes('image')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-cobalt-700/25 border border-cobalt-600/30 flex items-center justify-center text-cobalt-300 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
      );
    }
    if (mime.includes('word') || mime.includes('document')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-cobalt-600/20 border border-cobalt-500/30 flex items-center justify-center text-cobalt-400 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      );
    }
    if (mime.includes('sheet') || mime.includes('excel')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M12 10.875v7.5" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-vault-600/60 border border-sand-100/15 flex items-center justify-center text-sand-300 shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
    );
  };

  const renderAccessBadge = (level?: string) => {
    switch (level) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cobalt-700/20 text-cobalt-300 border border-cobalt-600/35">
            <svg className="w-3 h-3 text-cobalt-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Admin
          </span>
        );
      case 'EDIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Shared (Edit)
          </span>
        );
      case 'READ':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sun-500/15 text-sun-400 border border-sun-500/30">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Shared (Read)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sun-500/15 text-sun-400 border border-sun-500/30">
            <svg className="w-3 h-3 text-sun-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 011.094.216l1.414 1.414a1 1 0 01.216 1.094l-.8 1.599L20 12.377V13a1 1 0 01-1 1h-1.323l-1.582 3.954.8 1.599a1 1 0 01-.216 1.094l-1.414 1.414a1 1 0 01-1.094-.216l-1.599-.8L11 21.677V22a1 1 0 01-2 0v-.323l-3.954-1.582-1.599.8a1 1 0 01-1.094-.216l-1.414-1.414a1 1 0 01-.216-1.094l.8-1.599L0 13.623V13a1 1 0 011-1h1.323l1.582-3.954-.8-1.599a1 1 0 01.216-1.094l1.414-1.414a1 1 0 011.094.216l1.599.8L9 4.323V3a1 1 0 011-1zm0 6a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
            </svg>
            Owner
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

      const data = await apiFetch<{ documents: VaultDocument[] }>(
        `/api/v1/documents?${params.toString()}`
      );
      setDocuments(data.documents || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of 10MB.`);
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (!uploadTitle) {
      const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setUploadTitle(name);
    }
  };

  // ── Upload Handler ───────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size exceeds the 10MB limit.');
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

      await apiFetch('/api/v1/documents', {
        method: 'POST',
        body: formData,
      });

      setSuccessMsg(`Document "${uploadTitle}" safely vaulted`);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadCategory('OTHER');
      const fileInput = document.getElementById(fileInputId) as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      fetchDocuments();
    } catch (err: unknown) {
      setError((err as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Download Handler ─────────────────────────────────────────
  const handleDownload = async (doc: VaultDocument) => {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const { blob, filename } = await apiDownload(`/api/v1/documents/${doc.id}/download`);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || doc.originalFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      setError((err as Error).message || 'Download failed or permission denied');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Delete Handler ───────────────────────────────────────────
  const handleDelete = async (doc: VaultDocument) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${doc.title}"?\nThis removes the file from private vault storage immediately.`
    );
    if (!confirmDelete) return;

    setDeletingId(doc.id);
    setError(null);
    try {
      await apiFetch(`/api/v1/documents/${doc.id}`, {
        method: 'DELETE',
      });

      setSuccessMsg(`"${doc.title}" deleted from vault`);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: unknown) {
      setError((err as Error).message || 'Delete failed or unauthorized');
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
      await apiFetch(`/api/v1/documents/${editingDoc.id}`, {
        method: 'PATCH',
        json: {
          title: editTitle.trim(),
          category: editCategory,
        },
      });

      setSuccessMsg(`Document details updated for "${editTitle}"`);
      setEditingDoc(null);
      fetchDocuments();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update metadata');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Sharing Handlers ─────────────────────────────────────────
  const fetchSharingDetails = async (docId: string) => {
    setLoadingShareData(true);
    setShareError(null);
    try {
      const [recipientsData, permsData] = await Promise.all([
        apiFetch<{ users: RecipientUser[] }>('/api/v1/documents/recipients/list'),
        apiFetch<{ permissions: DocumentPermission[] }>(`/api/v1/documents/${docId}/permissions`),
      ]);

      const userList = recipientsData.users || [];
      setRecipients(userList);
      if (userList.length > 0) {
        setSelectedRecipientId((prev) => prev || userList[0].id);
      }
      setDocPermissions(permsData.permissions || []);
    } catch (err: unknown) {
      setShareError((err as Error).message || 'Failed to load sharing details');
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
      const data = await apiFetch<{ message: string }>(
        `/api/v1/documents/${sharingDoc.id}/permissions/${selectedRecipientId}`,
        {
          method: 'PUT',
          json: { permission: selectedPerm },
        }
      );

      setShareSuccess(data.message || `Granted ${selectedPerm} access`);
      await fetchSharingDetails(sharingDoc.id);
    } catch (err: unknown) {
      setShareError((err as Error).message || 'Failed to grant permission');
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
      await apiFetch(`/api/v1/documents/${sharingDoc.id}/permissions/${userId}`, {
        method: 'DELETE',
      });

      setShareSuccess('Permission revoked successfully');
      await fetchSharingDetails(sharingDoc.id);
    } catch (err: unknown) {
      setShareError((err as Error).message || 'Failed to revoke permission');
    } finally {
      setRevokingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-vault-900 text-sand-100 flex flex-col justify-between font-sans">
      {/* ── Unified Top Navigation Bar ───────────────────────── */}
      <AppNavbar
        currentUser={currentUser}
        currentView="vault"
        onNavigateView={(v) => {
          if (v === 'audit' && onNavigateAudit) onNavigateAudit();
        }}
        onNavigateHome={onNavigateHome}
        onLogout={onLogout}
      />

      {/* ── Main Container ───────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">

        {/* Notifications */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm animate-fade-in"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-vault-700/50"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm animate-fade-in"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-vault-700/50"
              aria-label="Dismiss message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* ── Document Upload Card ─────────────────────────────── */}
        <section aria-labelledby="upload-heading" className="card border-sand-100/10 bg-vault-700/70 p-6 md:p-8 backdrop-blur-sm shadow-vault-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cobalt-700/20 border border-cobalt-600/30 flex items-center justify-center text-cobalt-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h2 id="upload-heading" className="text-lg font-serif font-bold text-sand-100">
                  Upload to Vault
                </h2>
                <p className="text-xs text-sand-500">
                  Private storage with automatic MIME verification and cryptographic UUID isolation.
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-sand-500">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Encrypted at rest
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            {/* Drag & Drop File Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0] || null;
                handleFileChange(file);
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-cobalt-500 bg-cobalt-700/10'
                  : selectedFile
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-sand-100/15 hover:border-cobalt-600/40 bg-vault-850/60'
              }`}
              onClick={() => {
                const el = document.getElementById(fileInputId) as HTMLInputElement | null;
                if (el) el.click();
              }}
            >
              <input
                id={fileInputId}
                type="file"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt"
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-between gap-4 max-w-lg mx-auto p-3.5 rounded-xl bg-vault-800 border border-sand-100/10 text-left">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {renderFileIcon(selectedFile.type)}
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-sand-100 truncate">{selectedFile.name}</div>
                      <div className="text-[11px] text-sand-500 font-mono">{formatBytes(selectedFile.size)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileChange(null);
                      const el = document.getElementById(fileInputId) as HTMLInputElement | null;
                      if (el) el.value = '';
                    }}
                    className="p-1.5 rounded-lg text-sand-500 hover:text-red-400 hover:bg-vault-700/60"
                    title="Remove selected file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-vault-800 border border-sand-100/10 flex items-center justify-center text-cobalt-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-sand-200">
                    <span className="text-cobalt-400 underline font-semibold">Choose a document</span> or drag & drop here
                  </div>
                  <p className="text-xs text-sand-500">
                    PDF, DOCX, XLSX, PNG, JPG, or TXT (up to 10 MB)
                  </p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Title input */}
              <div>
                <label htmlFor={titleInputId} className="block text-xs font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
                  Document Title *
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  placeholder="e.g. Master Services Agreement 2026"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  maxLength={150}
                  className="input-vault"
                />
              </div>

              {/* Category selector */}
              <div>
                <label htmlFor={categoryInputId} className="block text-xs font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
                  Category
                </label>
                <select
                  id={categoryInputId}
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  className="input-vault cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-vault-850 text-sand-100">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-sand-100/8">
              <p className="text-xs text-sand-500 flex items-center gap-2">
                <svg className="w-4 h-4 text-cobalt-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span>Inspected by magic-byte signatures · Stored off public web roots</span>
              </p>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="btn-primary text-sm px-6 py-2.5 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Securing File…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Store Document</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── Document Explorer & Filter Bar ───────────────────── */}
        <section aria-labelledby="documents-heading" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 id="documents-heading" className="text-xl font-serif font-bold tracking-tight text-sand-100">
                Vault Documents
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cobalt-700/20 text-cobalt-300 border border-cobalt-600/30">
                {documents.length}
              </span>
            </div>

            {/* Filter and search controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category pills */}
              <div className="flex items-center gap-1 bg-vault-850 border border-sand-100/10 p-1 rounded-xl text-xs overflow-x-auto max-w-full">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedCategory === 'ALL'
                      ? 'bg-cobalt-700 text-white font-semibold shadow-cobalt-sm'
                      : 'text-sand-400 hover:text-sand-100 hover:bg-vault-700/50'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedCategory === cat
                        ? 'bg-cobalt-700 text-white font-semibold shadow-cobalt-sm'
                        : 'text-sand-400 hover:text-sand-100 hover:bg-vault-700/50'
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
                  placeholder="Filter by title…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3.5 py-1.5 pl-9 bg-vault-850 border border-sand-100/10 rounded-xl text-xs text-sand-100 placeholder-sand-600 focus:outline-none focus:border-cobalt-600 w-48 sm:w-56"
                />
                <svg className="w-4 h-4 absolute left-3 top-2 text-sand-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <button
                onClick={fetchDocuments}
                className="p-2 rounded-xl border border-sand-100/10 text-sand-400 hover:text-sand-100 hover:bg-vault-700/50 transition-all"
                title="Refresh list"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin text-cobalt-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Document List Table ───────────────────────────── */}
          {loading ? (
            <div className="p-16 text-center text-sand-400 text-sm card bg-vault-700/40">
              <div className="w-10 h-10 rounded-xl bg-cobalt-700/20 border border-cobalt-600/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-cobalt-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="font-medium text-sand-200">Loading secure documents…</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="card p-14 text-center border-dashed border-sand-100/15 bg-vault-800/40">
              <div className="w-12 h-12 rounded-2xl bg-vault-700/80 border border-sand-100/10 flex items-center justify-center mx-auto mb-4 text-sand-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.375v4.5a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-4.5m-19.5 0a9 9 0 0118 0" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-sand-200">No documents found</h3>
              <p className="text-xs text-sand-500 max-w-sm mx-auto mt-1 leading-relaxed">
                {searchQuery || selectedCategory !== 'ALL'
                  ? 'No documents matched your search or category filter.'
                  : 'Your vault is currently empty. Use the upload panel above to safely archive documents.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-sand-100/10 bg-vault-700/60 shadow-vault-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-vault-850/90 text-xs text-sand-400 uppercase tracking-wider border-b border-sand-100/8">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Document</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Category</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Access</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Size</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Date</th>
                    <th scope="col" className="px-6 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100/5">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-vault-600/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          {renderFileIcon(doc.detectedMimeType)}
                          <div className="min-w-0 max-w-xs sm:max-w-md">
                            <div className="font-semibold text-sand-100 truncate group-hover:text-cobalt-300 transition-colors">
                              {doc.title}
                            </div>
                            <div className="text-xs text-sand-500 font-mono truncate">
                              {doc.originalFilename}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getCategoryBadgeClass(
                            doc.category
                          )}`}
                        >
                          {doc.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderAccessBadge(doc.accessLevel)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sand-400 text-xs font-mono">
                        {formatBytes(doc.sizeBytes)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sand-500 text-xs">
                        {new Date(doc.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-100/10 hover:border-cobalt-600/40 hover:bg-cobalt-700/20 text-xs text-cobalt-300 font-medium transition-all"
                            title="Download document safely"
                          >
                            <svg className="w-3.5 h-3.5 text-cobalt-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            {downloadingId === doc.id ? 'Streaming…' : 'Download'}
                          </button>

                          {(currentUser.role === 'ADMIN' ||
                            doc.accessLevel === 'OWNER' ||
                            (!doc.accessLevel && currentUser.role !== 'VIEWER')) && (
                            <button
                              onClick={() => openShareModal(doc)}
                              className="p-1.5 rounded-lg border border-sand-100/10 hover:border-cobalt-600/40 hover:bg-cobalt-700/20 text-sand-400 hover:text-cobalt-300 transition-all"
                              title="Manage access & permissions"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                              </svg>
                            </button>
                          )}

                          {(currentUser.role === 'ADMIN' ||
                            doc.accessLevel === 'OWNER' ||
                            doc.accessLevel === 'EDIT' ||
                            (!doc.accessLevel && currentUser.role !== 'VIEWER')) && (
                            <button
                              onClick={() => {
                                setEditingDoc(doc);
                                setEditTitle(doc.title);
                                setEditCategory(doc.category);
                              }}
                              className="p-1.5 rounded-lg border border-sand-100/10 hover:border-sand-100/20 hover:bg-vault-600/50 text-sand-400 hover:text-sand-100 transition-all"
                              title="Edit metadata"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                          )}

                          {(currentUser.role === 'ADMIN' ||
                            doc.accessLevel === 'OWNER' ||
                            (!doc.accessLevel && currentUser.role !== 'VIEWER')) && (
                            <button
                              onClick={() => handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="p-1.5 rounded-lg border border-sand-100/10 hover:border-red-500/40 hover:bg-red-500/10 text-sand-400 hover:text-red-400 transition-all"
                              title="Delete document"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingDoc(null); }}
        >
          <div className="absolute inset-0 bg-vault-950/80 backdrop-blur-md" />
          <div className="relative card max-w-md w-full bg-vault-800 border-sand-100/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-fade-up">
            <div className="flex items-center justify-between pb-3 border-b border-sand-100/8">
              <h3 id="edit-dialog-title" className="text-lg font-serif font-bold text-sand-100">
                Edit Document
              </h3>
              <button
                onClick={() => setEditingDoc(null)}
                className="p-1 rounded-lg text-sand-500 hover:text-sand-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
                  Document Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={150}
                  className="input-vault"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-sand-400 mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="input-vault cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-vault-850 text-sand-100">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand-100/8">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {savingEdit ? 'Updating…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Document Sharing & Permissions Modal ─────────────── */}
      {sharingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSharingDoc(null); }}
        >
          <div className="absolute inset-0 bg-vault-950/80 backdrop-blur-md" />
          <div className="relative card max-w-2xl w-full bg-vault-800 border-sand-100/10 shadow-2xl p-6 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto animate-fade-up">

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-sand-100/8 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cobalt-700/20 border border-cobalt-600/30 flex items-center justify-center text-cobalt-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </div>
                <div>
                  <h3 id="share-dialog-title" className="text-lg font-serif font-bold text-sand-100">
                    Document Access & Delegation
                  </h3>
                  <p className="text-xs text-sand-500 mt-0.5">
                    Managing permissions for <span className="font-semibold text-sand-200">"{sharingDoc.title}"</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSharingDoc(null)}
                className="p-1 rounded-lg text-sand-500 hover:text-sand-200"
                aria-label="Close dialog"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Alerts */}
            {shareError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center justify-between">
                <span>{shareError}</span>
                <button onClick={() => setShareError(null)}>✕</button>
              </div>
            )}
            {shareSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center justify-between">
                <span>{shareSuccess}</span>
                <button onClick={() => setShareSuccess(null)}>✕</button>
              </div>
            )}

            {/* Grant Access Form */}
            <form onSubmit={handleGrantPermission} className="p-5 rounded-2xl bg-vault-850/80 border border-sand-100/8 space-y-4">
              <h4 className="text-xs font-semibold text-sand-200 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-cobalt-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Grant Access to User
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-sand-400 mb-1.5 uppercase tracking-wider">
                    Select User
                  </label>
                  {recipients.length === 0 ? (
                    <div className="text-xs text-sand-500 italic p-2.5 border border-sand-100/10 rounded-xl bg-vault-900">
                      No other registered users available
                    </div>
                  ) : (
                    <select
                      value={selectedRecipientId}
                      onChange={(e) => setSelectedRecipientId(e.target.value)}
                      className="input-vault cursor-pointer"
                      required
                    >
                      {recipients.map((user) => (
                        <option key={user.id} value={user.id} className="bg-vault-850 text-sand-100">
                          {user.name} ({user.email}) · {user.role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sand-400 mb-1.5 uppercase tracking-wider">
                    Access Level
                  </label>
                  <select
                    value={selectedPerm}
                    onChange={(e) => setSelectedPerm(e.target.value as 'READ' | 'EDIT')}
                    className="input-vault cursor-pointer"
                  >
                    <option value="READ" className="bg-vault-850 text-sand-100">READ (Download & View)</option>
                    <option value="EDIT" className="bg-vault-850 text-sand-100">EDIT (Download, View & Edit Details)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={grantingPerm || recipients.length === 0}
                  className="btn-primary text-xs px-5 py-2"
                >
                  {grantingPerm ? 'Granting…' : 'Delegate Access'}
                </button>
              </div>
            </form>

            {/* Active Permissions List */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-sand-300 uppercase tracking-wider flex items-center justify-between">
                <span>Active Delegations ({docPermissions.length})</span>
                {loadingShareData && (
                  <span className="text-xs text-cobalt-400 animate-pulse">Refreshing…</span>
                )}
              </h4>

              {docPermissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-sand-500 border border-dashed border-sand-100/10 rounded-2xl bg-vault-850/30">
                  This document has not been shared with any users yet.
                </div>
              ) : (
                <div className="divide-y divide-sand-100/8 border border-sand-100/10 rounded-2xl overflow-hidden bg-vault-850/40">
                  {docPermissions.map((perm) => {
                    const isRevoked = Boolean(perm.revokedAt);
                    const recipientUser = perm.user;
                    const granter = perm.grantedBy;

                    return (
                      <div
                        key={perm.id}
                        className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-vault-700/30 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sand-100">
                              {recipientUser?.name || 'Unknown User'}
                            </span>
                            <span className="text-sand-500">({recipientUser?.email})</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                perm.permission === 'EDIT'
                                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                                  : 'bg-sun-500/20 text-sun-400 border-sun-500/30'
                              }`}
                            >
                              {perm.permission}
                            </span>
                            {isRevoked ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                Revoked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-sand-500">
                            Authorized by {granter?.name || 'Owner'} on{' '}
                            {new Date(perm.createdAt).toLocaleDateString()}
                            {isRevoked && ` · Revoked on ${new Date(perm.revokedAt!).toLocaleDateString()}`}
                          </div>
                        </div>

                        <div>
                          {!isRevoked ? (
                            <button
                              onClick={() => handleRevokePermission(recipientUser._id)}
                              disabled={revokingUserId === recipientUser._id}
                              className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium transition-colors"
                            >
                              {revokingUserId === recipientUser._id ? 'Revoking…' : 'Revoke'}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                setSelectedRecipientId(recipientUser._id);
                                setSelectedPerm(perm.permission);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-sand-100/15 hover:border-sand-100/30 text-sand-300 hover:text-white transition-colors"
                            >
                              Re-authorize
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
            <div className="flex justify-end pt-4 border-t border-sand-100/8">
              <button
                type="button"
                onClick={() => setSharingDoc(null)}
                className="btn-ghost text-xs px-5 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Production Footer ─────────────────────────────────── */}
      <footer className="py-6 px-6 border-t border-sand-100/8 bg-vault-950 text-center text-xs text-sand-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} TrustVault Inc. All rights reserved.</span>
          <div className="flex items-center gap-4 text-sand-600">
            <span>Zero-Knowledge Architecture</span>
            <span>·</span>
            <span>End-to-End Encrypted Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
