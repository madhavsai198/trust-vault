// src/lib/api.ts
// ─────────────────────────────────────────────────────────────
// Centralized API client for TrustVault.
//
// 1. Enforces credentials: 'include' on all requests for HttpOnly cookies.
// 2. Automatically handles JSON request/response encoding.
// 3. Detects 401 Unauthorized / expired sessions and notifies listeners.
// 4. Provides typed error handling with detailed server messages.
// 5. Never stores session tokens or credentials in localStorage.
// ─────────────────────────────────────────────────────────────

const envApiUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && envApiUrl) {
    try {
      const parsed = new URL(envApiUrl, window.location.origin);
      // Align 127.0.0.1 <-> localhost so cookies are treated as same-host by the browser
      if (
        (window.location.hostname === '127.0.0.1' && parsed.hostname === 'localhost') ||
        (window.location.hostname === 'localhost' && parsed.hostname === '127.0.0.1')
      ) {
        parsed.hostname = window.location.hostname;
        return parsed.origin;
      }
    } catch {}
  }
  return envApiUrl ?? 'http://localhost:4000';
})();

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

type SessionExpiredCallback = (reason?: string) => void;
const sessionExpiredListeners: Set<SessionExpiredCallback> = new Set();

/**
 * Register a listener to be notified when any API request receives 401 Unauthorized.
 */
export function onSessionExpired(cb: SessionExpiredCallback): () => void {
  sessionExpiredListeners.add(cb);
  return () => sessionExpiredListeners.delete(cb);
}

function notifySessionExpired(reason?: string): void {
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener(reason);
    } catch {
      // Ignore listener error
    }
  });
}

export interface RequestOptions extends RequestInit {
  json?: unknown;
  silentAuth?: boolean;
}

/**
 * Robust fetch wrapper for TrustVault REST API.
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});

  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensure HttpOnly JWT cookies are transmitted
  };

  const response = await fetch(url, fetchOptions);

  // Handle unauthenticated / session expired response (suppressed when silentAuth is requested)
  if (response.status === 401 && !options.silentAuth) {
    notifySessionExpired('Session expired or unauthorized. Please sign in again.');
  }

  // Handle empty response bodies (e.g. 204 No Content or file streams)
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let data: any = null;
  if (isJson) {
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    const errorMessage =
      data?.error ||
      data?.message ||
      `Request failed with status code ${response.status}`;
    throw new ApiError(errorMessage, response.status, data?.details);
  }

  return data as T;
}

export interface DownloadOptions {
  silentAuth?: boolean;
}

/**
 * Streaming download helper that preserves credentials and dispatches session expiry on 401.
 */
export async function apiDownload(
  endpoint: string,
  options: DownloadOptions = {}
): Promise<{ blob: Blob; filename?: string }> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (response.status === 401 && !options.silentAuth) {
    notifySessionExpired('Session expired or unauthorized. Please sign in again.');
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const message = errorJson?.error || `Download failed with HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);

  return {
    blob,
    filename: filenameMatch ? filenameMatch[1] : undefined,
  };
}

