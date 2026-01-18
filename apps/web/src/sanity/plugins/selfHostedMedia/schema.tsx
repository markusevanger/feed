import React from 'react';
import { defineField, defineType } from 'sanity';
import ImageUploadInput from './ImageUploadInput';
import VideoUploadInput from './VideoUploadInput';
import MediaUploadInput from './MediaUploadInput';

// Cache for URL existence checks to avoid repeated requests
const urlExistsCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

async function checkUrlExists(url: string): Promise<boolean> {
  if (!url) return true; // Don't validate empty URLs (required rule handles that)

  // Check cache first
  const cached = urlExistsCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.exists;
  }

  try {
    const response = await fetch('/api/media/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
    });

    if (!response.ok) {
      // If check fails, assume it exists to avoid false negatives
      return true;
    }

    const { results } = await response.json();
    const exists = results[url] ?? true;

    // Cache the result
    urlExistsCache.set(url, { exists, timestamp: Date.now() });

    return exists;
  } catch {
    // Network error - assume exists to avoid blocking
    return true;
  }
}

export const selfHostedImageType = defineType({
  name: 'selfHostedImage',
  title: 'Image',
  type: 'object',
  components: {
    input: ImageUploadInput,
  },
  fields: [
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (Rule) =>
        Rule.required().custom(async (url) => {
          if (!url) return true;
          const exists = await checkUrlExists(url);
          return exists ? true : 'File not found on media server';
        }),
    }),
    defineField({
      name: 'width',
      title: 'Width',
      type: 'number',
      validation: (Rule) => Rule.required().positive(),
    }),
    defineField({
      name: 'height',
      title: 'Height',
      type: 'number',
      validation: (Rule) => Rule.required().positive(),
    }),
    defineField({
      name: 'aspectRatio',
      title: 'Aspect Ratio',
      type: 'number',
      validation: (Rule) => Rule.required().positive(),
    }),
    defineField({
      name: 'lqip',
      title: 'LQIP',
      type: 'string',
      description: 'Low Quality Image Placeholder (base64)',
    }),
    defineField({
      name: 'alt',
      title: 'Alt Text',
      type: 'string',
      description: 'Alternative text for accessibility',
    }),
    defineField({
      name: 'exif',
      title: 'EXIF Data',
      type: 'object',
      fields: [
        defineField({ name: 'dateTime', title: 'Date/Time', type: 'string' }),
        defineField({ name: 'lensMake', title: 'Lens Make', type: 'string' }),
        defineField({ name: 'lensModel', title: 'Lens Model', type: 'string' }),
      ],
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'object',
      fields: [
        defineField({ name: 'lat', title: 'Latitude', type: 'number' }),
        defineField({ name: 'lon', title: 'Longitude', type: 'number' }),
      ],
    }),
  ],
  preview: {
    select: {
      url: 'url',
      width: 'width',
      height: 'height',
    },
    prepare({ url, width, height }) {
      return {
        title: `Image (${width}x${height})`,
        media: url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : undefined,
      };
    },
  },
});

export const selfHostedVideoType = defineType({
  name: 'selfHostedVideo',
  title: 'Video',
  type: 'object',
  components: {
    input: VideoUploadInput,
  },
  fields: [
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (Rule) =>
        Rule.required().custom(async (url) => {
          if (!url) return true;
          const exists = await checkUrlExists(url);
          return exists ? true : 'File not found on media server';
        }),
    }),
    defineField({
      name: 'mimeType',
      title: 'MIME Type',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'orientation',
      title: 'Orientation',
      type: 'string',
      options: {
        list: [
          { title: 'Horizontal', value: 'horizontal' },
          { title: 'Vertical', value: 'vertical' },
        ],
        layout: 'radio',
      },
      initialValue: 'horizontal',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'thumbnailUrl',
      title: 'Thumbnail URL',
      type: 'url',
      description: 'Auto-generated thumbnail from video',
    }),
    defineField({
      name: 'lqip',
      title: 'LQIP',
      type: 'string',
      description: 'Low Quality Image Placeholder (base64)',
    }),
  ],
  preview: {
    select: {
      url: 'url',
      orientation: 'orientation',
      thumbnailUrl: 'thumbnailUrl',
    },
    prepare({ orientation, thumbnailUrl }) {
      return {
        title: `Video (${orientation || 'horizontal'})`,
        media: thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : undefined,
      };
    },
  },
});

export const selfHostedMediaType = defineType({
  name: 'selfHostedMedia',
  title: 'Media',
  type: 'object',
  components: {
    input: MediaUploadInput,
  },
  fields: [
    defineField({
      name: 'mediaType',
      title: 'Media Type',
      type: 'string',
      options: {
        list: [
          { title: 'Image', value: 'image' },
          { title: 'Video', value: 'video' },
        ],
        layout: 'radio',
      },
      initialValue: 'image',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (Rule) =>
        Rule.custom(async (url, context) => {
          const parent = context.parent as { mediaType?: string; url?: string };
          // Only require URL if we have a media type set
          if (!url && parent?.mediaType) {
            return 'Please upload a file';
          }
          if (!url) return true;
          const exists = await checkUrlExists(url);
          return exists ? true : 'File not found on media server';
        }),
    }),
    // Image-specific fields
    defineField({
      name: 'width',
      title: 'Width',
      type: 'number',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string; url?: string };
          if (parent?.mediaType === 'image' && parent?.url && !value) {
            return 'Width is required for images';
          }
          if (value && value <= 0) return 'Must be positive';
          return true;
        }),
    }),
    defineField({
      name: 'height',
      title: 'Height',
      type: 'number',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string; url?: string };
          if (parent?.mediaType === 'image' && parent?.url && !value) {
            return 'Height is required for images';
          }
          if (value && value <= 0) return 'Must be positive';
          return true;
        }),
    }),
    defineField({
      name: 'aspectRatio',
      title: 'Aspect Ratio',
      type: 'number',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string; url?: string };
          if (parent?.mediaType === 'image' && parent?.url && !value) {
            return 'Aspect ratio is required for images';
          }
          if (value && value <= 0) return 'Must be positive';
          return true;
        }),
    }),
    defineField({
      name: 'lqip',
      title: 'LQIP',
      type: 'string',
      description: 'Low Quality Image Placeholder (base64)',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
    }),
    defineField({
      name: 'alt',
      title: 'Alt Text',
      type: 'string',
      description: 'Alternative text for accessibility',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
    }),
    defineField({
      name: 'exif',
      title: 'EXIF Data',
      type: 'object',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
      fields: [
        defineField({ name: 'dateTime', title: 'Date/Time', type: 'string' }),
        defineField({ name: 'lensMake', title: 'Lens Make', type: 'string' }),
        defineField({ name: 'lensModel', title: 'Lens Model', type: 'string' }),
      ],
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'object',
      hidden: ({ parent }) => parent?.mediaType !== 'image',
      fields: [
        defineField({ name: 'lat', title: 'Latitude', type: 'number' }),
        defineField({ name: 'lon', title: 'Longitude', type: 'number' }),
      ],
    }),
    // Video-specific fields
    defineField({
      name: 'mimeType',
      title: 'MIME Type',
      type: 'string',
      hidden: ({ parent }) => parent?.mediaType !== 'video',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string; url?: string };
          if (parent?.mediaType === 'video' && parent?.url && !value) {
            return 'MIME type is required for videos';
          }
          return true;
        }),
    }),
    defineField({
      name: 'orientation',
      title: 'Orientation',
      type: 'string',
      options: {
        list: [
          { title: 'Horizontal', value: 'horizontal' },
          { title: 'Vertical', value: 'vertical' },
        ],
        layout: 'radio',
      },
      initialValue: 'horizontal',
      hidden: ({ parent }) => parent?.mediaType !== 'video',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string; url?: string };
          if (parent?.mediaType === 'video' && parent?.url && !value) {
            return 'Orientation is required for videos';
          }
          return true;
        }),
    }),
    defineField({
      name: 'thumbnailUrl',
      title: 'Thumbnail URL',
      type: 'url',
      description: 'Auto-generated thumbnail from video',
      hidden: ({ parent }) => parent?.mediaType !== 'video',
    }),
  ],
  preview: {
    select: {
      mediaType: 'mediaType',
      url: 'url',
      width: 'width',
      height: 'height',
      orientation: 'orientation',
      thumbnailUrl: 'thumbnailUrl',
    },
    prepare({ mediaType, url, width, height, orientation, thumbnailUrl }) {
      if (mediaType === 'video') {
        return {
          title: `Video (${orientation || 'horizontal'})`,
          media: thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : undefined,
        };
      }
      return {
        title: width && height ? `Image (${width}x${height})` : 'Image',
        media: url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : undefined,
      };
    },
  },
});
