import { NextRequest, NextResponse } from 'next/server';

const MEDIA_SERVER_URL = process.env.MEDIA_SERVER_URL;

export async function POST(request: NextRequest) {
  if (!MEDIA_SERVER_URL) {
    return NextResponse.json(
      { error: 'Media server not configured' },
      { status: 500 }
    );
  }

  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'Missing urls array' },
        { status: 400 }
      );
    }

    // Check each URL with a HEAD request
    const results: Record<string, boolean> = {};

    await Promise.all(
      urls.map(async (url: string) => {
        try {
          // Only check URLs that belong to our media server
          if (!url.includes('/files/')) {
            results[url] = false;
            return;
          }

          const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store',
          });

          results[url] = response.ok;
        } catch {
          results[url] = false;
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Media check error:', error);
    return NextResponse.json(
      { error: 'Check failed' },
      { status: 500 }
    );
  }
}
