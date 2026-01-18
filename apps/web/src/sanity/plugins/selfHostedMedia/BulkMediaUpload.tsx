'use client';

import React, { useCallback, useState, useId, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
} from '@sanity/ui';
import {
  AddIcon,
  CheckmarkCircleIcon,
  CloseIcon,
  ErrorOutlineIcon,
  ImageIcon,
  PlayIcon,
  UploadIcon,
  SearchIcon,
} from '@sanity/icons';
import { insert, set, type ArrayOfObjectsInputProps } from 'sanity';
import { uploadFile } from './api';
import { nanoid } from 'nanoid';
import type { UploadResponse } from './types';
import { MediaPicker, type SelectedMediaItem } from './MediaPicker';
import { MediaGridPreview, type MediaGridItem } from './MediaGridPreview';

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error' | 'duplicate';
  progress: number;
  error?: string;
  result?: UploadResponse;
}

const MAX_CONCURRENT_UPLOADS = 3;

interface MediaValue {
  _type: 'selfHostedMedia';
  _key?: string;
  url?: string;
}

export default function BulkMediaUpload(props: ArrayOfObjectsInputProps) {
  const { onChange, renderDefault, readOnly, value } = props;
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const inputId = useId();

  // Track URLs added during this session to prevent duplicates in concurrent uploads
  const addedUrlsRef = useRef<Set<string>>(new Set());

  // Get existing URLs in the document
  const existingUrls = ((value || []) as MediaValue[])
    .map((m) => m.url)
    .filter((url): url is string => !!url);

  // Warn user if they try to navigate away during uploads
  const activeUploadsCount = uploads.filter(
    (u) => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing'
  ).length;

  useEffect(() => {
    if (activeUploadsCount === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a generic prompt
      e.returnValue = 'You have uploads in progress. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeUploadsCount]);

  // Track which upload IDs have been started to prevent duplicates
  const startedUploadsRef = useRef<Set<string>>(new Set());

  const startUpload = useCallback((item: UploadItem) => {
    // Prevent starting the same upload twice
    if (startedUploadsRef.current.has(item.id)) {
      return;
    }
    startedUploadsRef.current.add(item.id);

    // Mark as uploading
    setUploads((prev) =>
      prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading' as const } : u))
    );

    uploadFile(item.file, (progress) => {
      setUploads((prev) =>
        prev.map((u) => {
          if (u.id !== item.id) return u;
          // When upload reaches 100%, switch to processing state
          if (progress === 100 && u.status === 'uploading') {
            return { ...u, progress, status: 'processing' as const };
          }
          return { ...u, progress };
        })
      );
    })
      .then((result) => {
        // Check if server detected a duplicate
        const isDuplicate = (result as UploadResponse & { duplicate?: boolean }).duplicate;

        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? {
                  ...u,
                  status: isDuplicate ? ('duplicate' as const) : ('complete' as const),
                  progress: 100,
                  result,
                }
              : u
          )
        );

        // Check if URL was already added during this session (synchronous check)
        const urlAddedThisSession = addedUrlsRef.current.has(result.url);

        // Only add to Sanity array if URL hasn't been added this session
        if (!urlAddedThisSession) {
          // Track this URL IMMEDIATELY to prevent duplicate additions from concurrent uploads
          addedUrlsRef.current.add(result.url);

          const isImage = result.type === 'image';
          const mediaItem = isImage
            ? {
                _type: 'selfHostedMedia' as const,
                _key: nanoid(),
                mediaType: 'image' as const,
                url: result.url,
                width: result.width!,
                height: result.height!,
                aspectRatio: result.aspectRatio!,
                lqip: result.lqip,
                exif: result.exif,
                location: result.location,
              }
            : {
                _type: 'selfHostedMedia' as const,
                _key: nanoid(),
                mediaType: 'video' as const,
                url: result.url,
                mimeType: result.mimeType,
                orientation: result.orientation || ('horizontal' as const),
                thumbnailUrl: result.thumbnailUrl,
                lqip: result.lqip,
              };

          onChange(insert([mediaItem], 'after', [-1]));
        }

        // Process next in queue
        setTimeout(() => processQueue(), 0);
      })
      .catch((err) => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: 'error' as const, error: err.message || 'Upload failed' }
              : u
          )
        );

        // Continue processing queue even on error
        setTimeout(() => processQueue(), 0);
      });
  }, [onChange]);

  const processQueue = useCallback(() => {
    setUploads((currentUploads) => {
      const pending = currentUploads.filter((i) => i.status === 'pending');
      const uploading = currentUploads.filter((i) => i.status === 'uploading');

      // Start more uploads if we have capacity
      const toStart = pending.slice(0, MAX_CONCURRENT_UPLOADS - uploading.length);

      // Schedule uploads outside of state update
      for (const item of toStart) {
        setTimeout(() => startUpload(item), 0);
      }

      return currentUploads;
    });
  }, [startUpload]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Filter for images and videos only
      const validFiles = fileArray.filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );

      if (validFiles.length === 0) return;

      const newItems: UploadItem[] = validFiles.map((file) => ({
        id: nanoid(),
        file,
        status: 'pending' as const,
        progress: 0,
      }));

      setUploads((prev) => [...prev, ...newItems]);
      // Start processing after state update
      setTimeout(() => processQueue(), 0);

      // Auto-expand if we have uploads
      setIsExpanded(true);
    },
    [processQueue]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'complete' && u.status !== 'duplicate'));
  }, []);

  const handleMediaPickerSelect = useCallback(
    (items: SelectedMediaItem[]) => {
      for (const item of items) {
        // Skip if URL already exists
        if (existingUrls.includes(item.url) || addedUrlsRef.current.has(item.url)) {
          continue;
        }

        // Track this URL
        addedUrlsRef.current.add(item.url);

        const mediaItem =
          item.type === 'image'
            ? {
                _type: 'selfHostedMedia' as const,
                _key: nanoid(),
                mediaType: 'image' as const,
                url: item.url,
                width: item.width!,
                height: item.height!,
                aspectRatio: item.aspectRatio!,
                lqip: item.lqip,
                exif: item.exif,
                location: item.location,
              }
            : {
                _type: 'selfHostedMedia' as const,
                _key: nanoid(),
                mediaType: 'video' as const,
                url: item.url,
                mimeType: item.mimeType,
                orientation: item.orientation || ('horizontal' as const),
                thumbnailUrl: item.thumbnailUrl,
                lqip: item.lqip,
              };

        onChange(insert([mediaItem], 'after', [-1]));
      }
    },
    [onChange, existingUrls]
  );

  // Handler for reordering items via drag-and-drop
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const items = (value || []) as MediaGridItem[];
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= items.length || toIndex >= items.length) return;

      const newItems = [...items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);

      onChange(set(newItems));
    },
    [onChange, value]
  );

  // Handler for removing items from the grid
  const handleRemoveFromGrid = useCallback(
    (key: string) => {
      const items = (value || []) as MediaGridItem[];
      const newItems = items.filter((item) => item._key !== key);
      onChange(set(newItems));
    },
    [onChange, value]
  );

  // Auto-arrange items using the packing algorithm
  const handleAutoArrange = useCallback(() => {
    const items = (value || []) as MediaGridItem[];
    if (items.length === 0) return;

    // Calculate natural spans
    const getNaturalSpan = (item: MediaGridItem): 1 | 2 => {
      if (item.mediaType === 'image') {
        const aspectRatio = item.aspectRatio || 1;
        return aspectRatio > 1 ? 2 : 1;
      }
      return item.orientation === 'horizontal' ? 2 : 1;
    };

    // Separate by span type
    const span1Items = items.filter((i) => getNaturalSpan(i) === 1);
    const span2Items = items.filter((i) => getNaturalSpan(i) === 2);

    // Build optimized order
    const arranged: MediaGridItem[] = [];
    let s1Idx = 0;
    let s2Idx = 0;

    while (s1Idx < span1Items.length || s2Idx < span2Items.length) {
      // Priority 1: [2, 1] - one horizontal + one vertical
      if (s2Idx < span2Items.length && s1Idx < span1Items.length) {
        arranged.push(span2Items[s2Idx++]);
        arranged.push(span1Items[s1Idx++]);
        continue;
      }

      // Priority 2: [1, 1, 1] - three verticals
      if (s1Idx + 3 <= span1Items.length) {
        arranged.push(span1Items[s1Idx++]);
        arranged.push(span1Items[s1Idx++]);
        arranged.push(span1Items[s1Idx++]);
        continue;
      }

      // Priority 3: Remaining horizontal
      if (s2Idx < span2Items.length) {
        arranged.push(span2Items[s2Idx++]);
        continue;
      }

      // Priority 4: Remaining verticals
      if (s1Idx < span1Items.length) {
        arranged.push(span1Items[s1Idx++]);
        continue;
      }
    }

    onChange(set(arranged));
  }, [onChange, value]);

  const activeUploads = uploads.filter(
    (u) => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing'
  );
  const processingUploads = uploads.filter((u) => u.status === 'processing');
  const completedUploads = uploads.filter((u) => u.status === 'complete');
  const duplicateUploads = uploads.filter((u) => u.status === 'duplicate');
  const errorUploads = uploads.filter((u) => u.status === 'error');

  return (
    <Stack space={4}>
      {/* Media Picker Modal */}
      {showMediaPicker && (
        <MediaPicker
          onSelect={handleMediaPickerSelect}
          onClose={() => setShowMediaPicker(false)}
          existingUrls={existingUrls}
        />
      )}

      {/* Visual grid preview for arranging media */}
      <MediaGridPreview
        items={(value || []) as MediaGridItem[]}
        onReorder={handleReorder}
        onRemove={handleRemoveFromGrid}
        onAutoArrange={handleAutoArrange}
        readOnly={readOnly}
      />

      {/* Add Media Section - positioned after the array items */}
      {!readOnly && (
        <Card padding={4} border radius={2} tone={dragOver ? 'primary' : 'default'}>
          <Stack space={4}>
            {/* Two-column add options */}
            <Flex gap={3}>
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
                  text="Upload Files"
                  mode="ghost"
                  as="span"
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </label>
              <input
                id={inputId}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Flex>

            {/* Drop zone - more compact */}
            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: dragOver
                  ? 'var(--card-focus-ring-color)'
                  : 'var(--card-border-color)',
                borderRadius: '4px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <label htmlFor={inputId} style={{ cursor: 'pointer', display: 'block' }}>
                <Flex direction="column" align="center" gap={2}>
                  <Flex gap={2}>
                    <Text size={2} muted>
                      <ImageIcon />
                    </Text>
                    <Text size={2} muted>
                      <PlayIcon />
                    </Text>
                  </Flex>
                  <Text size={1} muted align="center">
                    or drop files here
                  </Text>
                </Flex>
              </label>
            </Box>

            {/* Upload Progress Panel */}
            {uploads.length > 0 && (
              <Card padding={3} border radius={2} tone="transparent">
                <Stack space={3}>
                  <Flex justify="space-between" align="center">
                    <Flex gap={3} align="center">
                      <Text size={1} weight="semibold">
                        Uploads
                      </Text>
                      {activeUploads.length > 0 && (
                        <Text size={1} muted>
                          {activeUploads.length} in progress
                          {processingUploads.length > 0 && ` (${processingUploads.length} processing)`}
                        </Text>
                      )}
                      {completedUploads.length > 0 && (
                        <Text size={1} style={{ color: 'var(--card-positive-color)' }}>
                          {completedUploads.length} complete
                        </Text>
                      )}
                      {duplicateUploads.length > 0 && (
                        <Text size={1} style={{ color: 'var(--card-caution-fg-color)' }}>
                          {duplicateUploads.length} duplicate
                        </Text>
                      )}
                      {errorUploads.length > 0 && (
                        <Text size={1} style={{ color: 'var(--card-critical-color)' }}>
                          {errorUploads.length} failed
                        </Text>
                      )}
                    </Flex>
                    <Flex gap={2}>
                      {(completedUploads.length > 0 || duplicateUploads.length > 0) && (
                        <Button
                          text="Clear completed"
                          mode="ghost"
                          tone="default"
                          fontSize={1}
                          padding={2}
                          onClick={clearCompleted}
                        />
                      )}
                      <Button
                        text={isExpanded ? 'Collapse' : 'Expand'}
                        mode="ghost"
                        fontSize={1}
                        padding={2}
                        onClick={() => setIsExpanded(!isExpanded)}
                      />
                    </Flex>
                  </Flex>

                  {isExpanded && (
                    <Stack space={2}>
                      {uploads.map((item) => (
                        <UploadProgressItem
                          key={item.id}
                          item={item}
                          onRemove={() => removeUpload(item.id)}
                        />
                      ))}
                    </Stack>
                  )}

                  {!isExpanded && activeUploads.length > 0 && (
                    <Box>
                      <OverallProgressBar uploads={uploads} />
                    </Box>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function UploadProgressItem({
  item,
  onRemove,
}: {
  item: UploadItem;
  onRemove: () => void;
}) {
  const isImage = item.file.type.startsWith('image/');
  const Icon = isImage ? ImageIcon : PlayIcon;

  return (
    <Card padding={2} border radius={2} tone={item.status === 'error' ? 'critical' : 'default'}>
      <Flex gap={3} align="center">
        {/* File type icon */}
        <Box style={{ flexShrink: 0 }}>
          <Text size={2} muted>
            <Icon />
          </Text>
        </Box>

        {/* File info and progress */}
        <Box flex={1} style={{ minWidth: 0 }}>
          <Stack space={2}>
            <Text size={1} textOverflow="ellipsis">
              {item.file.name}
            </Text>
            {(item.status === 'uploading' || item.status === 'processing') && (
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
                    width: item.status === 'processing' ? '100%' : `${item.progress}%`,
                    height: '100%',
                    backgroundColor: item.status === 'processing'
                      ? 'var(--card-caution-fg-color)'
                      : 'var(--card-focus-ring-color)',
                    borderRadius: '2px',
                    transition: 'width 0.2s ease-out',
                  }}
                />
              </Box>
            )}
            {item.status === 'error' && (
              <Text size={1} style={{ color: 'var(--card-critical-color)' }}>
                {item.error}
              </Text>
            )}
          </Stack>
        </Box>

        {/* Status indicator */}
        <Box style={{ flexShrink: 0 }}>
          {item.status === 'pending' && (
            <Text size={1} muted>
              Waiting...
            </Text>
          )}
          {item.status === 'uploading' && (
            <Text size={1} muted>
              {item.progress}%
            </Text>
          )}
          {item.status === 'processing' && (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>
                Processing...
              </Text>
            </Flex>
          )}
          {item.status === 'complete' && (
            <Text size={2} style={{ color: 'var(--card-positive-color)' }}>
              <CheckmarkCircleIcon />
            </Text>
          )}
          {item.status === 'duplicate' && (
            <Text size={1} style={{ color: 'var(--card-caution-fg-color)' }}>
              Duplicate
            </Text>
          )}
          {item.status === 'error' && (
            <Button
              icon={CloseIcon}
              mode="bleed"
              tone="critical"
              padding={2}
              onClick={onRemove}
            />
          )}
        </Box>
      </Flex>
    </Card>
  );
}

function OverallProgressBar({ uploads }: { uploads: UploadItem[] }) {
  const totalFiles = uploads.length;
  const completedFiles = uploads.filter((u) => u.status === 'complete').length;
  const duplicateFiles = uploads.filter((u) => u.status === 'duplicate').length;
  const processingFiles = uploads.filter((u) => u.status === 'processing').length;
  const errorFiles = uploads.filter((u) => u.status === 'error').length;

  // Calculate weighted progress (processing counts as 100% uploaded, waiting for server)
  const totalProgress = uploads.reduce((acc, u) => {
    if (u.status === 'complete') return acc + 100;
    if (u.status === 'duplicate') return acc + 100;
    if (u.status === 'processing') return acc + 100;
    if (u.status === 'error') return acc + 100; // Count errors as "done"
    return acc + u.progress;
  }, 0);

  const overallProgress = totalFiles > 0 ? Math.round(totalProgress / totalFiles) : 0;

  return (
    <Stack space={2}>
      <Flex justify="space-between">
        <Text size={1} muted>
          {completedFiles + duplicateFiles} of {totalFiles} files
          {processingFiles > 0 && ` (${processingFiles} processing)`}
          {duplicateFiles > 0 && ` (${duplicateFiles} duplicate)`}
          {errorFiles > 0 && ` (${errorFiles} failed)`}
        </Text>
        <Text size={1} muted>
          {overallProgress}%
        </Text>
      </Flex>
      <Box
        style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'var(--card-border-color)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            width: `${overallProgress}%`,
            height: '100%',
            backgroundColor: 'var(--card-focus-ring-color)',
            borderRadius: '3px',
            transition: 'width 0.3s ease-out',
          }}
        />
      </Box>
    </Stack>
  );
}
