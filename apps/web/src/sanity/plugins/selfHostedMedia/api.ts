import type { UploadResponse } from './types';

// Get media server config from Sanity Studio env vars
// These are exposed to the client via SANITY_STUDIO_ prefix
const MEDIA_SERVER_URL = process.env.SANITY_STUDIO_MEDIA_SERVER_URL;
const MEDIA_API_KEY = process.env.SANITY_STUDIO_MEDIA_API_KEY;

export type UploadProgressCallback = (progress: number) => void;

// Upload directly to media server if configured, otherwise fall back to API route
export async function uploadFile(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const url = MEDIA_SERVER_URL ? `${MEDIA_SERVER_URL}/upload` : '/api/upload';

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || error.message || 'Upload failed'));
        } catch {
          reject(new Error(xhr.statusText || 'Upload failed'));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', url);

    // Add auth header for direct media server uploads
    if (MEDIA_SERVER_URL && MEDIA_API_KEY) {
      xhr.setRequestHeader('Authorization', `Bearer ${MEDIA_API_KEY}`);
    }

    xhr.send(formData);
  });
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
