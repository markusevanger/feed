import { NextResponse } from 'next/server';
import { client } from '@/sanity/lib/client';

const MEDIA_SERVER_URL = process.env.MEDIA_SERVER_URL;
const MEDIA_API_KEY = process.env.MEDIA_API_KEY;

export async function GET() {
  if (!MEDIA_SERVER_URL) {
    return NextResponse.json({ error: 'Media server not configured' }, { status: 500 });
  }

  try {
    // Fetch all media files from the media server
    const headers: HeadersInit = {};
    if (MEDIA_API_KEY) {
      headers['Authorization'] = `Bearer ${MEDIA_API_KEY}`;
    }

    const mediaResponse = await fetch(`${MEDIA_SERVER_URL}/list`, { headers });
    if (!mediaResponse.ok) {
      throw new Error('Failed to fetch media list');
    }

    const mediaList = await mediaResponse.json();
    const allImages: { id: string; filename: string; url: string; size?: number }[] = mediaList.images || [];
    const allVideos: { id: string; filename: string; url: string; size?: number }[] = mediaList.videos || [];

    // Query Sanity for all referenced image and video URLs
    const referencedUrls = await client.fetch<string[]>(`
      array::unique([
        ...*[defined(images)].images[].url,
        ...*[defined(videos)].videos[].url
      ])
    `);

    const referencedSet = new Set(referencedUrls);

    // Find unused files
    const unusedImages = allImages.filter(img => !referencedSet.has(img.url));
    const unusedVideos = allVideos.filter(vid => !referencedSet.has(vid.url));

    // Calculate sizes
    const unusedImagesSize = unusedImages.reduce((sum, img) => sum + (img.size || 0), 0);
    const unusedVideosSize = unusedVideos.reduce((sum, vid) => sum + (vid.size || 0), 0);

    return NextResponse.json({
      unused: {
        images: unusedImages,
        videos: unusedVideos,
        totalCount: unusedImages.length + unusedVideos.length,
        totalSize: unusedImagesSize + unusedVideosSize,
      },
      all: {
        imagesCount: allImages.length,
        videosCount: allVideos.length,
        totalCount: allImages.length + allVideos.length,
      },
    });
  } catch (error) {
    console.error('Unused media check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check unused media' },
      { status: 500 }
    );
  }
}
