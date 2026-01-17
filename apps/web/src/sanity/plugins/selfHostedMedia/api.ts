import type { UploadResponse } from './types';

// Upload goes through Next.js API route which keeps the API key server-side
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

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
