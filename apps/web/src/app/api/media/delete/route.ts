import { NextRequest, NextResponse } from 'next/server';

const MEDIA_SERVER_URL = process.env.MEDIA_SERVER_URL;
const MEDIA_API_KEY = process.env.MEDIA_API_KEY;

export async function DELETE(request: NextRequest) {
  if (!MEDIA_SERVER_URL) {
    return NextResponse.json(
      { error: 'Media server not configured' },
      { status: 500 }
    );
  }

  try {
    const { type, filename } = await request.json();

    if (!type || !filename) {
      return NextResponse.json(
        { error: 'Missing type or filename' },
        { status: 400 }
      );
    }

    if (type !== 'images' && type !== 'videos') {
      return NextResponse.json(
        { error: 'Invalid type, must be "images" or "videos"' },
        { status: 400 }
      );
    }

    const headers: HeadersInit = {};
    if (MEDIA_API_KEY) {
      headers['Authorization'] = `Bearer ${MEDIA_API_KEY}`;
    }

    const response = await fetch(`${MEDIA_SERVER_URL}/files/${type}/${filename}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Delete proxy error:', error);
    return NextResponse.json(
      { error: 'Delete failed' },
      { status: 500 }
    );
  }
}
