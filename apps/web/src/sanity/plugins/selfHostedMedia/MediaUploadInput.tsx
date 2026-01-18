'use client';

import React, { useCallback, useState, useId } from 'react';
import { Box, Button, Card, Flex, Spinner, Stack, Text, Inline, Radio, Label } from '@sanity/ui';
import { ImageIcon, PlayIcon, TrashIcon, UploadIcon, SearchIcon } from '@sanity/icons';
import { set } from 'sanity';
import type { ObjectInputProps } from 'sanity';
import { uploadFile, deleteFile } from './api';
import { nanoid } from 'nanoid';
import { MediaPicker, type SelectedMediaItem } from './MediaPicker';

interface MediaValue {
  _type: 'selfHostedMedia';
  _key?: string;
  mediaType: 'image' | 'video';
  url?: string;
  // Image fields
  width?: number;
  height?: number;
  aspectRatio?: number;
  lqip?: string;
  alt?: string;
  exif?: {
    dateTime?: string;
    lensMake?: string;
    lensModel?: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
  // Video fields
  mimeType?: string;
  orientation?: 'horizontal' | 'vertical';
}

export default function MediaUploadInput(props: ObjectInputProps) {
  const { onChange, readOnly } = props;
  const value = props.value as MediaValue | undefined;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const inputId = useId();

  const mediaType = value?.mediaType || 'image';

  const handleMediaTypeChange = useCallback((newType: 'image' | 'video') => {
    onChange(set({
      _type: 'selfHostedMedia',
      _key: value?._key || nanoid(),
      mediaType: newType,
    }));
  }, [onChange, value]);

  const handleUpload = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (mediaType === 'image' && !isImage) {
      setError('Please select an image file');
      return;
    }

    if (mediaType === 'video' && !isVideo) {
      setError('Please select a video file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const result = await uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });
      const existingKey = value?._key;

      if (isImage && result.type === 'image') {
        onChange(set({
          _type: 'selfHostedMedia',
          _key: existingKey || nanoid(),
          mediaType: 'image',
          url: result.url,
          width: result.width!,
          height: result.height!,
          aspectRatio: result.aspectRatio!,
          lqip: result.lqip,
          exif: result.exif,
          location: result.location,
        }));
      } else if (isVideo && result.type === 'video') {
        onChange(set({
          _type: 'selfHostedMedia',
          _key: existingKey || nanoid(),
          mediaType: 'video',
          url: result.url,
          mimeType: result.mimeType,
          orientation: result.orientation || 'horizontal',
          thumbnailUrl: result.thumbnailUrl,
          lqip: result.lqip,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onChange, value, mediaType]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    e.target.value = '';
  }, [handleUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleRemove = useCallback(async () => {
    if (value?.url) {
      try {
        await deleteFile(value.url);
      } catch (err) {
        console.warn('Failed to delete file:', err);
      }
    }
    // Keep the mediaType but remove the file
    onChange(set({
      _type: 'selfHostedMedia',
      _key: value?._key || nanoid(),
      mediaType: value?.mediaType || 'image',
    }));
  }, [value, onChange]);

  const handleMediaPickerSelect = useCallback(
    (items: SelectedMediaItem[]) => {
      // Only take the first item since this is a single media input
      const item = items[0];
      if (!item) return;

      const existingKey = value?._key;

      if (item.type === 'image') {
        onChange(set({
          _type: 'selfHostedMedia',
          _key: existingKey || nanoid(),
          mediaType: 'image',
          url: item.url,
          width: item.width!,
          height: item.height!,
          aspectRatio: item.aspectRatio!,
          lqip: item.lqip,
          exif: item.exif,
          location: item.location,
        }));
      } else {
        onChange(set({
          _type: 'selfHostedMedia',
          _key: existingKey || nanoid(),
          mediaType: 'video',
          url: item.url,
          mimeType: item.mimeType,
          orientation: item.orientation || 'horizontal',
          thumbnailUrl: item.thumbnailUrl,
          lqip: item.lqip,
        }));
      }
    },
    [onChange, value]
  );

  if (uploading) {
    return (
      <Card padding={4} border radius={2}>
        <Stack space={3}>
          <Flex align="center" justify="center" gap={3}>
            <Spinner muted />
            <Text muted>
              Uploading {mediaType}... {uploadProgress}%
            </Text>
          </Flex>
          <Box
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'var(--card-border-color)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <Box
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: 'var(--card-fg-color)',
                borderRadius: '2px',
                transition: 'width 0.2s ease-out',
              }}
            />
          </Box>
        </Stack>
      </Card>
    );
  }

  // Render image preview
  if (value?.url && mediaType === 'image') {
    return (
      <Stack space={3}>
        <Card border radius={2} overflow="hidden">
          <Box
            style={{
              position: 'relative',
              paddingBottom: `${(1 / (value.aspectRatio || 1)) * 100}%`,
              background: '#1a1a1a',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt={value.alt || ''}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>
        </Card>
        <Flex gap={2}>
          <Text size={1} muted>
            {value.width} x {value.height}
          </Text>
          {value.exif?.dateTime && (
            <Text size={1} muted>
              {new Date(value.exif.dateTime).toLocaleDateString()}
            </Text>
          )}
        </Flex>
        {!readOnly && (
          <Flex gap={2}>
            <Box flex={1}>
              <label htmlFor={inputId} style={{ cursor: 'pointer' }}>
                <Button
                  as="span"
                  icon={UploadIcon}
                  text="Replace"
                  mode="ghost"
                  style={{ width: '100%' }}
                />
              </label>
              <input
                id={inputId}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Box>
            <Button
              icon={TrashIcon}
              text="Remove"
              mode="ghost"
              tone="critical"
              onClick={handleRemove}
            />
          </Flex>
        )}
      </Stack>
    );
  }

  // Render video preview
  if (value?.url && mediaType === 'video') {
    return (
      <Stack space={3}>
        <Card border radius={2} overflow="hidden">
          <Box style={{ position: 'relative', paddingBottom: '56.25%', background: '#1a1a1a' }}>
            <video
              src={value.url}
              controls
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </Box>
        </Card>
        <Flex gap={2}>
          <Text size={1} muted>
            {value.mimeType}
          </Text>
          <Text size={1} muted>
            {value.orientation}
          </Text>
        </Flex>
        {!readOnly && (
          <Flex gap={2}>
            <Box flex={1}>
              <label htmlFor={inputId} style={{ cursor: 'pointer' }}>
                <Button
                  as="span"
                  icon={UploadIcon}
                  text="Replace"
                  mode="ghost"
                  style={{ width: '100%' }}
                />
              </label>
              <input
                id={inputId}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Box>
            <Button
              icon={TrashIcon}
              text="Remove"
              mode="ghost"
              tone="critical"
              onClick={handleRemove}
            />
          </Flex>
        )}
      </Stack>
    );
  }

  // Empty state - show upload UI with media type toggle
  const accept = mediaType === 'image' ? 'image/*' : 'video/*';
  const Icon = mediaType === 'image' ? ImageIcon : PlayIcon;
  const label = mediaType === 'image' ? 'image' : 'video';
  const filterType = mediaType === 'image' ? 'image' : 'video';

  return (
    <Stack space={3}>
      {/* Media Picker Modal */}
      {showMediaPicker && (
        <MediaPicker
          onSelect={handleMediaPickerSelect}
          onClose={() => setShowMediaPicker(false)}
          filterType={filterType}
        />
      )}

      {/* Media type toggle */}
      {!readOnly && (
        <Card padding={3} border radius={2}>
          <Inline space={4}>
            <Flex align="center" gap={2}>
              <Radio
                id={`${inputId}-image`}
                checked={mediaType === 'image'}
                onChange={() => handleMediaTypeChange('image')}
              />
              <Label htmlFor={`${inputId}-image`} style={{ cursor: 'pointer' }}>
                <Flex align="center" gap={2}>
                  <ImageIcon />
                  <Text size={1}>Image</Text>
                </Flex>
              </Label>
            </Flex>
            <Flex align="center" gap={2}>
              <Radio
                id={`${inputId}-video`}
                checked={mediaType === 'video'}
                onChange={() => handleMediaTypeChange('video')}
              />
              <Label htmlFor={`${inputId}-video`} style={{ cursor: 'pointer' }}>
                <Flex align="center" gap={2}>
                  <PlayIcon />
                  <Text size={1}>Video</Text>
                </Flex>
              </Label>
            </Flex>
          </Inline>
        </Card>
      )}

      {/* Action buttons - Browse Library or Upload */}
      {!readOnly && (
        <Flex gap={2}>
          <Button
            icon={SearchIcon}
            text="Browse Library"
            mode="ghost"
            tone="primary"
            onClick={() => setShowMediaPicker(true)}
            style={{ flex: 1 }}
          />
          <label htmlFor={inputId} style={{ flex: 1 }}>
            <Button
              icon={UploadIcon}
              text="Upload File"
              mode="ghost"
              as="span"
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </label>
          <input
            id={inputId}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </Flex>
      )}

      {/* Drop zone */}
      <Card
        padding={4}
        border
        radius={2}
        tone={dragOver ? 'primary' : 'default'}
        style={{
          borderStyle: 'dashed',
          cursor: readOnly ? 'default' : 'pointer',
        }}
        onDrop={readOnly ? undefined : handleDrop}
        onDragOver={readOnly ? undefined : handleDragOver}
        onDragLeave={readOnly ? undefined : handleDragLeave}
      >
        <label htmlFor={`${inputId}-drop`} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
          <Flex direction="column" align="center" gap={2}>
            <Text size={3} muted>
              <Icon />
            </Text>
            <Text size={1} muted align="center">
              {readOnly ? `No ${label}` : `or drop ${label === 'image' ? 'an' : 'a'} ${label} here`}
            </Text>
          </Flex>
        </label>
        {!readOnly && (
          <input
            id={`${inputId}-drop`}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        )}
      </Card>
      {error && (
        <Card padding={3} tone="critical" border radius={2}>
          <Text size={1}>{error}</Text>
        </Card>
      )}
    </Stack>
  );
}
