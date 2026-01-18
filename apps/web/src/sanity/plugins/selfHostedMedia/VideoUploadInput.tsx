'use client';

import React, { useCallback, useState, useId } from 'react';
import { Box, Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { PlayIcon, TrashIcon, UploadIcon } from '@sanity/icons';
import { set, unset } from 'sanity';
import type { ObjectInputProps } from 'sanity';
import { uploadFile, deleteFile } from './api';
import type { SelfHostedVideo } from './types';
import { nanoid } from 'nanoid';

type VideoValue = SelfHostedVideo | undefined;

export default function VideoUploadInput(props: ObjectInputProps) {
  const { onChange, readOnly } = props;
  const value = props.value as VideoValue;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputId = useId();

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadFile(file);

      if (result.type !== 'video') {
        throw new Error('Expected video upload response');
      }

      // Include _key for array items - preserve existing key or generate new one
      const existingKey = (value as SelfHostedVideo | undefined)?._key;
      onChange(set({
        _type: 'selfHostedVideo',
        _key: existingKey || nanoid(),
        url: result.url,
        mimeType: result.mimeType,
        orientation: 'horizontal', // Default, user can change
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
    onChange(unset());
  }, [value, onChange]);

  if (uploading) {
    return (
      <Card padding={4} border radius={2}>
        <Flex align="center" justify="center" gap={3}>
          <Spinner muted />
          <Text muted>Uploading video...</Text>
        </Flex>
      </Card>
    );
  }

  if (value?.url) {
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
              <PlayIcon />
            </Text>
            <Text size={1} muted align="center">
              {readOnly ? 'No video' : 'Drop a video here or click to upload'}
            </Text>
          </Flex>
        </label>
        {!readOnly && (
          <input
            id={inputId}
            type="file"
            accept="video/*"
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
