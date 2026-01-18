import { NextRequest, NextResponse } from 'next/server';

const MEDIA_SERVER_URL = process.env.MEDIA_SERVER_URL;
const MEDIA_API_KEY = process.env.MEDIA_API_KEY;

export async function POST(request: NextRequest) {
  if (!MEDIA_SERVER_URL) {
    return NextResponse.json(
      { error: 'Media server not configured' },
      { status: 500 }
    );
  }

  try {
    const { url, type } = await request.json();

    if (!url || !type) {
      return NextResponse.json(
        { error: 'Missing url or type parameter' },
        { status: 400 }
      );
    }

    const headers: HeadersInit = {};
    if (MEDIA_API_KEY) {
      headers['Authorization'] = `Bearer ${MEDIA_API_KEY}`;
    }

    // Fetch metadata from media server
    const response = await fetch(`${MEDIA_SERVER_URL}/metadata`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Media metadata error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media metadata' },
      { status: 500 }
    );
  }
}
