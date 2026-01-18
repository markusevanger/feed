'use client';

import React, { useCallback, useState, useId } from 'react';
import { Box, Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { ImageIcon, TrashIcon, UploadIcon } from '@sanity/icons';
import { set, unset } from 'sanity';
import type { ObjectInputProps } from 'sanity';
import { uploadFile, deleteFile } from './api';
import type { SelfHostedImage } from './types';
import { nanoid } from 'nanoid';

type ImageValue = SelfHostedImage | undefined;

export default function ImageUploadInput(props: ObjectInputProps) {
  const { onChange, readOnly } = props;
  const value = props.value as ImageValue;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputId = useId();

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadFile(file);

      if (result.type !== 'image') {
        throw new Error('Expected image upload response');
      }

      // Include _key for array items - preserve existing key or generate new one
      const existingKey = (value as SelfHostedImage | undefined)?._key;
      onChange(set({
        _type: 'selfHostedImage',
        _key: existingKey || nanoid(),
        url: result.url,
        width: result.width!,
        height: result.height!,
        aspectRatio: result.aspectRatio!,
        lqip: result.lqip,
        exif: result.exif,
        location: result.location,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onChange, value]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input so same file can be selected again
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
        // File might already be deleted, continue anyway
        console.warn('Failed to delete file:', err);
      }
    }
    onChange(unset());
  }, [value, onChange]);

  if (uploading) {
    return (
      <Card padding={4} border radius={2}>
        <Flex align="center" justify="center" gap={3}>
          <Spinner muted />
          <Text muted>Uploading...</Text>
        </Flex>
      </Card>
    );
  }

  if (value?.url) {
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

  return (
    <Stack space={3}>
      <Card
        padding={5}
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
        <label htmlFor={inputId} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
          <Flex direction="column" align="center" gap={3}>
            <Text size={4} muted>
              <ImageIcon />
            </Text>
            <Text size={1} muted align="center">
              {readOnly ? 'No image' : 'Drop an image here or click to upload'}
            </Text>
          </Flex>
        </label>
        {!readOnly && (
          <input
            id={inputId}
            type="file"
            accept="image/*"
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
