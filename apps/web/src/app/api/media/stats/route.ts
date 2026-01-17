import { NextResponse } from 'next/server';

const MEDIA_SERVER_URL = process.env.MEDIA_SERVER_URL;
const MEDIA_API_KEY = process.env.MEDIA_API_KEY;

export async function GET() {
  if (!MEDIA_SERVER_URL) {
    return NextResponse.json(
      { error: 'Media server not configured' },
      { status: 500 }
    );
  }

  try {
    const headers: HeadersInit = {};
    if (MEDIA_API_KEY) {
      headers['Authorization'] = `Bearer ${MEDIA_API_KEY}`;
    }

    const response = await fetch(`${MEDIA_SERVER_URL}/stats`, {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Media stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get media stats' },
      { status: 500 }
    );
  }
}
