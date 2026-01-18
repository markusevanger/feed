'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Text,
  Badge,
} from '@sanity/ui';
import {
  CloseIcon,
  ImageIcon,
  PlayIcon,
  CheckmarkCircleIcon,
  AddIcon,
} from '@sanity/icons';

interface MediaFile {
  id: string;
  filename: string;
  url: string;
  type: 'image' | 'video';
  mtime: string;
  size?: number;
}

interface MediaListResponse {
  images: MediaFile[];
  videos: MediaFile[];
  total: number;
}

interface MediaPickerProps {
  onSelect: (items: SelectedMediaItem[]) => void;
  onClose: () => void;
  existingUrls?: string[];
  filterType?: 'image' | 'video' | 'all';
}

export interface SelectedMediaItem {
  url: string;
  type: 'image' | 'video';
  // Image metadata
  width?: number;
  height?: number;
  aspectRatio?: number;
  lqip?: string;
  exif?: {
    dateTime?: string;
    lensMake?: string;
    lensModel?: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
  // Video metadata
  mimeType?: string;
  orientation?: 'horizontal' | 'vertical';
  thumbnailUrl?: string;
}

export function MediaPicker({
  onSelect,
  onClose,
  existingUrls = [],
  filterType = 'all',
}: MediaPickerProps) {
  const [data, setData] = useState<MediaListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos'>(
    filterType === 'image' ? 'images' : filterType === 'video' ? 'videos' : 'all'
  );
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [adding, setAdding] = useState(false);
  const [addingProgress, setAddingProgress] = useState({ current: 0, total: 0 });

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/media');
      if (!response.ok) {
        throw new Error('Failed to fetch media');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const getFilteredMedia = () => {
    if (!data) return [];

    let media: MediaFile[];
    switch (activeTab) {
      case 'images':
        media = data.images;
        break;
      case 'videos':
        media = data.videos;
        break;
      default:
        media = [...data.images, ...data.videos].sort(
          (a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime()
        );
    }

    // Filter based on filterType prop
    if (filterType === 'image') {
      media = media.filter((m) => m.type === 'image');
    } else if (filterType === 'video') {
      media = media.filter((m) => m.type === 'video');
    }

    return media;
  };

  const toggleSelection = (file: MediaFile) => {
    setSelectedFiles((prev) => {
      const isSelected = prev.some((f) => f.id === file.id);
      if (isSelected) {
        return prev.filter((f) => f.id !== file.id);
      }
      return [...prev, file];
    });
  };

  const isAlreadyInDocument = (url: string) => existingUrls.includes(url);

  const handleAdd = async () => {
    if (selectedFiles.length === 0) return;

    setAdding(true);
    setAddingProgress({ current: 0, total: selectedFiles.length });

    const results: SelectedMediaItem[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setAddingProgress({ current: i + 1, total: selectedFiles.length });

      try {
        // Fetch metadata for each selected file
        const response = await fetch('/api/media/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: file.url, type: file.type }),
        });

        if (!response.ok) {
          console.error(`Failed to fetch metadata for ${file.url}`);
          continue;
        }

        const metadata = await response.json();

        if (file.type === 'image') {
          results.push({
            url: file.url,
            type: 'image',
            width: metadata.width,
            height: metadata.height,
            aspectRatio: metadata.aspectRatio,
            lqip: metadata.lqip,
            exif: metadata.exif,
            location: metadata.location,
          });
        } else {
          results.push({
            url: file.url,
            type: 'video',
            mimeType: metadata.mimeType,
            orientation: metadata.orientation || 'horizontal',
            thumbnailUrl: metadata.thumbnailUrl,
            lqip: metadata.lqip,
          });
        }
      } catch (err) {
        console.error(`Error fetching metadata for ${file.url}:`, err);
      }
    }

    setAdding(false);
    onSelect(results);
    onClose();
  };

  const filteredMedia = getFilteredMedia();

  const modalContent = (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200000,
      }}
      onClick={onClose}
    >
      <Card
        radius={3}
        shadow={3}
        style={{
          width: '90vw',
          maxWidth: 1000,
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Card borderBottom padding={4}>
          <Flex align="center" justify="space-between">
            <Stack space={2}>
              <Heading size={1}>Select Media</Heading>
              <Text muted size={1}>
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                  : 'Choose images or videos from your media library'}
              </Text>
            </Stack>
            <Flex gap={2}>
              <Button
                mode="ghost"
                icon={CloseIcon}
                onClick={onClose}
                disabled={adding}
              />
            </Flex>
          </Flex>
        </Card>

        {/* Tabs */}
        {filterType === 'all' && (
          <Card borderBottom>
            <TabList space={1} padding={2}>
              <Tab
                aria-controls="all-panel"
                id="all-tab"
                label="All"
                onClick={() => setActiveTab('all')}
                selected={activeTab === 'all'}
              />
              <Tab
                aria-controls="images-panel"
                icon={ImageIcon}
                id="images-tab"
                label="Images"
                onClick={() => setActiveTab('images')}
                selected={activeTab === 'images'}
              />
              <Tab
                aria-controls="videos-panel"
                icon={PlayIcon}
                id="videos-tab"
                label="Videos"
                onClick={() => setActiveTab('videos')}
                selected={activeTab === 'videos'}
              />
            </TabList>
          </Card>
        )}

        {/* Content */}
        <Box flex={1} overflow="auto" padding={4}>
          {loading && !data ? (
            <Flex align="center" justify="center" height="fill">
              <Spinner muted />
            </Flex>
          ) : error ? (
            <Flex align="center" justify="center" height="fill">
              <Card padding={4} radius={2} tone="critical">
                <Text>Error loading media: {error}</Text>
              </Card>
            </Flex>
          ) : filteredMedia.length === 0 ? (
            <Flex align="center" justify="center" padding={6}>
              <Text muted>No media files found</Text>
            </Flex>
          ) : (
            <Grid columns={[2, 3, 4, 5]} gap={3}>
              {filteredMedia.map((file) => {
                const isSelected = selectedFiles.some((f) => f.id === file.id);
                const isExisting = isAlreadyInDocument(file.url);

                return (
                  <Card
                    key={file.id}
                    radius={2}
                    shadow={isSelected ? 2 : 1}
                    tone={isSelected ? 'primary' : isExisting ? 'caution' : 'default'}
                    style={{
                      cursor: isExisting ? 'not-allowed' : 'pointer',
                      overflow: 'hidden',
                      opacity: isExisting ? 0.6 : 1,
                    }}
                    onClick={() => !isExisting && toggleSelection(file)}
                  >
                    <Box style={{ aspectRatio: '1', position: 'relative' }}>
                      {file.type === 'image' ? (
                        <img
                          src={file.url}
                          alt={file.filename}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                          }}
                        >
                          <PlayIcon style={{ fontSize: 48, opacity: 0.5 }} />
                        </Flex>
                      )}

                      {/* Type badge */}
                      <Box
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                        }}
                      >
                        <Badge
                          fontSize={0}
                          tone={file.type === 'image' ? 'positive' : 'primary'}
                        >
                          {file.type === 'image' ? 'IMG' : 'VID'}
                        </Badge>
                      </Box>

                      {/* Selection indicator */}
                      {isSelected && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            background: 'var(--card-bg-color)',
                            borderRadius: '50%',
                          }}
                        >
                          <Text
                            size={2}
                            style={{ color: 'var(--card-focus-ring-color)' }}
                          >
                            <CheckmarkCircleIcon />
                          </Text>
                        </Box>
                      )}

                      {/* Already added indicator */}
                      {isExisting && (
                        <Flex
                          align="center"
                          justify="center"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.4)',
                          }}
                        >
                          <Text size={1} style={{ color: 'white' }}>
                            Already added
                          </Text>
                        </Flex>
                      )}
                    </Box>
                  </Card>
                );
              })}
            </Grid>
          )}
        </Box>

        {/* Footer */}
        <Card borderTop padding={4}>
          <Flex align="center" justify="space-between">
            <Text size={1} muted>
              {adding
                ? `Adding ${addingProgress.current} of ${addingProgress.total}...`
                : `${filteredMedia.length} files available`}
            </Text>
            <Flex gap={2}>
              <Button
                mode="ghost"
                text="Cancel"
                onClick={onClose}
                disabled={adding}
              />
              <Button
                icon={adding ? undefined : AddIcon}
                tone="primary"
                text={adding ? 'Adding...' : `Add ${selectedFiles.length > 0 ? selectedFiles.length : ''} Selected`}
                onClick={handleAdd}
                disabled={selectedFiles.length === 0 || adding}
              />
            </Flex>
          </Flex>
        </Card>
      </Card>
    </Box>
  );

  // Use portal to render at document body level, escaping any parent overflow:hidden containers
  return createPortal(modalContent, document.body);
}
