import type { UploadResponse } from './types';

// Get media server config from Sanity Studio env vars
// These are exposed to the client via SANITY_STUDIO_ prefix
const MEDIA_SERVER_URL = process.env.SANITY_STUDIO_MEDIA_SERVER_URL;
const MEDIA_API_KEY = process.env.SANITY_STUDIO_MEDIA_API_KEY;

// Upload directly to media server if configured, otherwise fall back to API route
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Direct upload to media server (bypasses Vercel's 4.5MB limit)
  if (MEDIA_SERVER_URL) {
    const headers: HeadersInit = {};
    if (MEDIA_API_KEY) {
      headers['Authorization'] = `Bearer ${MEDIA_API_KEY}`;
    }

    const response = await fetch(`${MEDIA_SERVER_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || error.message || 'Upload failed');
    }

    return response.json();
  }

  // Fallback: upload through Next.js API route
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || 'Upload failed');
  }

  return response.json();
}

export async function deleteFile(url: string): Promise<void> {
  // Extract type and filename from URL
  // URL format: https://domain/files/images/filename.ext or https://domain/files/videos/filename.ext
  const match = url.match(/\/files\/(images|videos)\/([^/]+)$/);
  if (!match) {
    throw new Error('Invalid file URL format');
  }

  const [, type, filename] = match;

  const response = await fetch('/api/media/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, filename }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Delete failed');
  }
}
