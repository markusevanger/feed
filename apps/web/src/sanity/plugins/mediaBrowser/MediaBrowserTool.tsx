'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
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
  Button,
} from '@sanity/ui';
import { ResetIcon, ImageIcon, PlayIcon, DatabaseIcon, TrashIcon, ControlsIcon } from '@sanity/icons';

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

interface UnusedMediaResponse {
  unused: {
    images: MediaFile[];
    videos: MediaFile[];
    totalCount: number;
    totalSize: number;
  };
  all: {
    imagesCount: number;
    videosCount: number;
    totalCount: number;
  };
}

interface MediaStats {
  disk: {
    total: number;
    totalFormatted: string;
    free: number;
    freeFormatted: string;
    used: number;
    usedFormatted: string;
    usedPercent: number;
  };
  storage: {
    images: {
      count: number;
      size: number;
      sizeFormatted: string;
    };
    videos: {
      count: number;
      size: number;
      sizeFormatted: string;
    };
    total: {
      count: number;
      size: number;
      sizeFormatted: string;
    };
  };
  config: {
    minFreeSpaceMB: number;
    maxFileSizeMB: number;
    publicUrl?: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function StorageBar({
  used,
  total,
  label,
  tone,
}: {
  used: number;
  total: number;
  label: string;
  tone?: 'positive' | 'caution' | 'critical';
}) {
  const percent = total > 0 ? (used / total) * 100 : 0;
  return (
    <Stack space={2}>
      <Flex justify="space-between">
        <Text size={1} muted>
          {label}
        </Text>
        <Text size={1} muted>
          {percent.toFixed(1)}%
        </Text>
      </Flex>
      <Box
        style={{
          height: 8,
          background: 'var(--card-border-color)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            height: '100%',
            width: `${Math.min(percent, 100)}%`,
            background:
              tone === 'critical'
                ? 'var(--card-badge-critical-bg-color)'
                : tone === 'caution'
                  ? 'var(--card-badge-caution-bg-color)'
                  : 'var(--card-badge-positive-bg-color)',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
    </Stack>
  );
}

function StatsPanel({ stats, cdnUrl }: { stats: MediaStats; cdnUrl: string | null }) {
  const diskPercent = stats.disk.usedPercent;
  const diskTone =
    diskPercent > 90 ? 'critical' : diskPercent > 75 ? 'caution' : 'positive';

  const isLocalhost = cdnUrl?.includes('localhost');

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Box>
          <Stack space={2}>
            <Text size={0} muted>
              CDN
            </Text>
            <Flex align="center" gap={2}>
              <Badge tone={isLocalhost ? 'caution' : 'positive'} fontSize={0}>
                {isLocalhost ? 'DEV' : 'PROD'}
              </Badge>
              <Text size={1} style={{ wordBreak: 'break-all' }}>
                {cdnUrl || 'Not configured'}
              </Text>
            </Flex>
          </Stack>
        </Box>

        <Box
          style={{
            borderTop: '1px solid var(--card-border-color)',
            paddingTop: 16,
          }}
        >
          <Flex align="center" gap={2}>
            <DatabaseIcon />
            <Heading size={0}>Storage</Heading>
          </Flex>
        </Box>

        <StorageBar
          used={stats.disk.used}
          total={stats.disk.total}
          label="Disk Usage"
          tone={diskTone}
        />

        <Grid columns={2} gap={3}>
          <Card padding={3} radius={2} tone="transparent">
            <Stack space={2}>
              <Text size={0} muted>
                Total
              </Text>
              <Text size={2} weight="semibold">
                {stats.disk.totalFormatted}
              </Text>
            </Stack>
          </Card>
          <Card padding={3} radius={2} tone="transparent">
            <Stack space={2}>
              <Text size={0} muted>
                Free
              </Text>
              <Text size={2} weight="semibold">
                {stats.disk.freeFormatted}
              </Text>
            </Stack>
          </Card>
        </Grid>

        <Box
          style={{
            borderTop: '1px solid var(--card-border-color)',
            paddingTop: 16,
          }}
        >
          <Stack space={3}>
            <Text size={1} weight="semibold">
              Media Storage
            </Text>

            <Flex justify="space-between" align="center">
              <Flex align="center" gap={2}>
                <ImageIcon />
                <Text size={1}>Images</Text>
              </Flex>
              <Text size={1} muted>
                {stats.storage.images.count} files ({stats.storage.images.sizeFormatted})
              </Text>
            </Flex>

            <Flex justify="space-between" align="center">
              <Flex align="center" gap={2}>
                <PlayIcon />
                <Text size={1}>Videos</Text>
              </Flex>
              <Text size={1} muted>
                {stats.storage.videos.count} files ({stats.storage.videos.sizeFormatted})
              </Text>
            </Flex>

            <Box
              style={{
                borderTop: '1px solid var(--card-border-color)',
                paddingTop: 12,
              }}
            >
              <Flex justify="space-between" align="center">
                <Text size={1} weight="semibold">
                  Total
                </Text>
                <Text size={1} weight="semibold">
                  {stats.storage.total.count} files ({stats.storage.total.sizeFormatted})
                </Text>
              </Flex>
            </Box>
          </Stack>
        </Box>

        <Box
          style={{
            borderTop: '1px solid var(--card-border-color)',
            paddingTop: 16,
          }}
        >
          <Stack space={2}>
            <Text size={0} muted>
              Server Config
            </Text>
            <Text size={1}>
              Max file size: {stats.config.maxFileSizeMB} MB
            </Text>
            <Text size={1}>
              Min free space: {stats.config.minFreeSpaceMB} MB
            </Text>
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}

export function MediaBrowserTool() {
  const [data, setData] = useState<MediaListResponse | null>(null);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos'>('all');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaFile | null>(null);
  const [showCleanupMenu, setShowCleanupMenu] = useState(false);
  const [cleanupDialog, setCleanupDialog] = useState<'unused' | 'all' | null>(null);
  const [unusedMedia, setUnusedMedia] = useState<UnusedMediaResponse | null>(null);
  const [loadingUnused, setLoadingUnused] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mediaResponse, statsResponse] = await Promise.all([
        fetch('/api/media'),
        fetch('/api/media/stats'),
      ]);

      if (!mediaResponse.ok) {
        throw new Error('Failed to fetch media');
      }

      const mediaResult = await mediaResponse.json();
      setData(mediaResult);

      if (statsResponse.ok) {
        const statsResult = await statsResponse.json();
        setStats(statsResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (file: MediaFile) => {
    setDeleting(true);
    try {
      const response = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: file.type === 'image' ? 'images' : 'videos',
          filename: file.filename,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      // Clear selection and refresh
      setSelectedMedia(null);
      setDeleteConfirm(null);
      await fetchMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [fetchMedia]);

  const fetchUnusedMedia = useCallback(async () => {
    setLoadingUnused(true);
    try {
      const response = await fetch('/api/media/unused');
      if (!response.ok) {
        throw new Error('Failed to fetch unused media');
      }
      const result = await response.json();
      setUnusedMedia(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch unused media');
    } finally {
      setLoadingUnused(false);
    }
  }, []);

  const handleBulkDelete = useCallback(async (files: MediaFile[]) => {
    setBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: files.length });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const response = await fetch('/api/media/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: file.type === 'image' ? 'images' : 'videos',
            filename: file.filename,
          }),
        });

        if (!response.ok) {
          console.warn(`Failed to delete ${file.filename}`);
        }

        setBulkDeleteProgress({ current: i + 1, total: files.length });
      }

      // Refresh data
      setCleanupDialog(null);
      setUnusedMedia(null);
      await fetchMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
      setBulkDeleteProgress({ current: 0, total: 0 });
    }
  }, [fetchMedia]);

  const handleDeleteUnused = useCallback(async () => {
    if (!unusedMedia) return;
    const files = [...unusedMedia.unused.images, ...unusedMedia.unused.videos];
    await handleBulkDelete(files);
  }, [unusedMedia, handleBulkDelete]);

  const handleDeleteAll = useCallback(async () => {
    if (!data) return;
    const files = [...data.images, ...data.videos];
    await handleBulkDelete(files);
  }, [data, handleBulkDelete]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const getFilteredMedia = () => {
    if (!data) return [];
    switch (activeTab) {
      case 'images':
        return data.images;
      case 'videos':
        return data.videos;
      default:
        return [...data.images, ...data.videos].sort(
          (a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime()
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !data) {
    return (
      <Flex align="center" justify="center" height="fill" padding={4}>
        <Spinner muted />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex align="center" justify="center" height="fill" padding={4}>
        <Card padding={4} radius={2} tone="critical">
          <Stack space={3}>
            <Text>Error loading media: {error}</Text>
            <Button
              icon={ResetIcon}
              text="Retry"
              tone="primary"
              onClick={fetchMedia}
            />
          </Stack>
        </Card>
      </Flex>
    );
  }

  const filteredMedia = getFilteredMedia();

  return (
    <Flex direction="column" height="fill">
      <Card borderBottom padding={4}>
        <Flex align="center" justify="space-between">
          <Stack space={2}>
            <Heading size={1}>Media Browser</Heading>
            <Text muted size={1}>
              {data?.total ?? 0} files ({data?.images.length ?? 0} images, {data?.videos.length ?? 0} videos)
            </Text>
          </Stack>
          <Flex gap={2}>
            <Box style={{ position: 'relative' }}>
              <Button
                icon={ControlsIcon}
                mode="ghost"
                text="Cleanup"
                onClick={() => setShowCleanupMenu(!showCleanupMenu)}
              />
              {showCleanupMenu && (
                <Card
                  shadow={2}
                  radius={2}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    zIndex: 100,
                    minWidth: 220,
                  }}
                >
                  <Stack padding={1}>
                    <Button
                      mode="bleed"
                      justify="flex-start"
                      text="Delete unused media"
                      onClick={() => {
                        setShowCleanupMenu(false);
                        setCleanupDialog('unused');
                        fetchUnusedMedia();
                      }}
                      style={{ width: '100%' }}
                    />
                    <Box paddingY={2} paddingX={3}>
                      <Box style={{ borderTop: '1px solid var(--card-border-color)' }} />
                    </Box>
                    <Card tone="critical" radius={2}>
                      <Button
                        mode="bleed"
                        tone="critical"
                        justify="flex-start"
                        text="Delete ALL media"
                        onClick={() => {
                          setShowCleanupMenu(false);
                          setCleanupDialog('all');
                        }}
                        style={{ width: '100%' }}
                      />
                    </Card>
                  </Stack>
                </Card>
              )}
            </Box>
            <Button
              icon={DatabaseIcon}
              mode={showStats ? 'default' : 'ghost'}
              text="Stats"
              onClick={() => setShowStats(!showStats)}
              tone={showStats ? 'primary' : 'default'}
            />
            <Button
              icon={ResetIcon}
              mode="ghost"
              text="Refresh"
              onClick={fetchMedia}
              disabled={loading}
            />
          </Flex>
        </Flex>
      </Card>

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

      <Flex flex={1} overflow="hidden">
        {showStats && stats && (
          <Box style={{ width: 300 }} padding={4} overflow="auto">
            <StatsPanel stats={stats} cdnUrl={stats.config.publicUrl || null} />
          </Box>
        )}

        <Box flex={1} overflow="auto" padding={4}>
          <TabPanel
            aria-labelledby="all-tab"
            id="all-panel"
            hidden={activeTab !== 'all'}
          >
            <MediaGrid
              media={activeTab === 'all' ? filteredMedia : []}
              onSelect={setSelectedMedia}
              selectedId={selectedMedia?.id}
            />
          </TabPanel>
          <TabPanel
            aria-labelledby="images-tab"
            id="images-panel"
            hidden={activeTab !== 'images'}
          >
            <MediaGrid
              media={activeTab === 'images' ? filteredMedia : []}
              onSelect={setSelectedMedia}
              selectedId={selectedMedia?.id}
            />
          </TabPanel>
          <TabPanel
            aria-labelledby="videos-tab"
            id="videos-panel"
            hidden={activeTab !== 'videos'}
          >
            <MediaGrid
              media={activeTab === 'videos' ? filteredMedia : []}
              onSelect={setSelectedMedia}
              selectedId={selectedMedia?.id}
            />
          </TabPanel>
        </Box>

        {selectedMedia && (
          <Card borderLeft style={{ width: 360 }} overflow="auto">
            <Stack padding={4} space={4}>
              <Heading size={0}>Details</Heading>

              <Box style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: 4 }}>
                {selectedMedia.type === 'image' ? (
                  <img
                    src={selectedMedia.url}
                    alt={selectedMedia.filename}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      background: '#1a1a1a',
                    }}
                  />
                ) : (
                  <video
                    src={selectedMedia.url}
                    controls
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      background: '#1a1a1a',
                    }}
                  />
                )}
              </Box>

              <Stack space={3}>
                <Flex align="center" gap={2}>
                  <Badge tone={selectedMedia.type === 'image' ? 'positive' : 'primary'}>
                    {selectedMedia.type}
                  </Badge>
                  {selectedMedia.size && (
                    <Badge tone="default">{formatBytes(selectedMedia.size)}</Badge>
                  )}
                </Flex>

                <Stack space={2}>
                  <Text size={1} weight="semibold">Filename</Text>
                  <Text size={1} muted style={{ wordBreak: 'break-all' }}>
                    {selectedMedia.filename}
                  </Text>
                </Stack>

                <Stack space={2}>
                  <Text size={1} weight="semibold">ID</Text>
                  <Text size={1} muted style={{ fontFamily: 'monospace' }}>
                    {selectedMedia.id}
                  </Text>
                </Stack>

                <Stack space={2}>
                  <Text size={1} weight="semibold">Uploaded</Text>
                  <Text size={1} muted>
                    {formatDate(selectedMedia.mtime)}
                  </Text>
                </Stack>

                <Stack space={2}>
                  <Text size={1} weight="semibold">URL</Text>
                  <Text size={1} muted style={{ wordBreak: 'break-all' }}>
                    <a href={selectedMedia.url} target="_blank" rel="noopener noreferrer">
                      {selectedMedia.url}
                    </a>
                  </Text>
                </Stack>
              </Stack>

              <Flex gap={2}>
                <Button
                  mode="ghost"
                  text="Close"
                  onClick={() => setSelectedMedia(null)}
                />
                <Button
                  icon={TrashIcon}
                  mode="ghost"
                  tone="critical"
                  text="Delete"
                  onClick={() => setDeleteConfirm(selectedMedia)}
                />
              </Flex>
            </Stack>
          </Card>
        )}
      </Flex>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200000,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <Card
            padding={4}
            radius={2}
            shadow={2}
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack space={4}>
              <Heading size={1}>Delete file?</Heading>
              <Text>
                Are you sure you want to delete <strong>{deleteConfirm.filename}</strong>?
                This action cannot be undone.
              </Text>
              <Text size={1} muted>
                Note: If this file is referenced by any Sanity documents, those references
                will become broken.
              </Text>
              <Flex gap={2} justify="flex-end">
                <Button
                  mode="ghost"
                  text="Cancel"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                />
                <Button
                  icon={TrashIcon}
                  tone="critical"
                  text={deleting ? 'Deleting...' : 'Delete'}
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                />
              </Flex>
            </Stack>
          </Card>
        </Box>
      )}

      {/* Cleanup dialog - Delete unused media */}
      {cleanupDialog === 'unused' && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200000,
          }}
          onClick={() => !bulkDeleting && setCleanupDialog(null)}
        >
          <Card
            padding={4}
            radius={2}
            shadow={2}
            style={{ maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack space={4}>
              <Heading size={1}>Delete unused media</Heading>

              {loadingUnused ? (
                <Flex align="center" justify="center" padding={4}>
                  <Spinner muted />
                  <Box marginLeft={3}>
                    <Text muted>Scanning for unused files...</Text>
                  </Box>
                </Flex>
              ) : unusedMedia ? (
                <>
                  {unusedMedia.unused.totalCount === 0 ? (
                    <Card padding={4} tone="positive" radius={2}>
                      <Text>All media files are in use. Nothing to clean up.</Text>
                    </Card>
                  ) : (
                    <>
                      <Text>
                        Found <strong>{unusedMedia.unused.totalCount}</strong> unused files
                        ({unusedMedia.unused.images.length} images, {unusedMedia.unused.videos.length} videos)
                        totaling <strong>{formatBytes(unusedMedia.unused.totalSize)}</strong>.
                      </Text>
                      <Text size={1} muted>
                        These files are not referenced by any Sanity documents and can be safely deleted.
                      </Text>

                      {bulkDeleting && (
                        <Card padding={3} tone="caution" radius={2}>
                          <Stack space={2}>
                            <Text size={1}>
                              Deleting... {bulkDeleteProgress.current} / {bulkDeleteProgress.total}
                            </Text>
                            <Box
                              style={{
                                height: 4,
                                background: 'var(--card-border-color)',
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                style={{
                                  height: '100%',
                                  width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%`,
                                  background: 'var(--card-badge-caution-bg-color)',
                                  transition: 'width 0.2s ease',
                                }}
                              />
                            </Box>
                          </Stack>
                        </Card>
                      )}
                    </>
                  )}
                </>
              ) : (
                <Text muted>Failed to load unused media information.</Text>
              )}

              <Flex gap={2} justify="flex-end">
                <Button
                  mode="ghost"
                  text="Cancel"
                  onClick={() => setCleanupDialog(null)}
                  disabled={bulkDeleting}
                />
                {unusedMedia && unusedMedia.unused.totalCount > 0 && (
                  <Button
                    icon={TrashIcon}
                    tone="critical"
                    text={bulkDeleting ? 'Deleting...' : `Delete ${unusedMedia.unused.totalCount} files`}
                    onClick={handleDeleteUnused}
                    disabled={bulkDeleting}
                  />
                )}
              </Flex>
            </Stack>
          </Card>
        </Box>
      )}

      {/* Cleanup dialog - Delete ALL media (danger zone) */}
      {cleanupDialog === 'all' && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200000,
          }}
          onClick={() => !bulkDeleting && setCleanupDialog(null)}
        >
          <Card
            padding={4}
            radius={2}
            shadow={2}
            style={{ maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack space={4}>
              <Card padding={3} tone="critical" radius={2}>
                <Flex align="center" gap={2}>
                  <TrashIcon />
                  <Heading size={1}>Danger Zone</Heading>
                </Flex>
              </Card>

              <Heading size={1}>Delete ALL media?</Heading>

              <Card padding={3} tone="critical" radius={2}>
                <Stack space={2}>
                  <Text weight="semibold">
                    This will permanently delete ALL {data?.total ?? 0} media files:
                  </Text>
                  <Text size={1}>
                    • {data?.images.length ?? 0} images
                  </Text>
                  <Text size={1}>
                    • {data?.videos.length ?? 0} videos
                  </Text>
                </Stack>
              </Card>

              <Text size={1} muted>
                This action cannot be undone. All references in Sanity documents will become broken.
              </Text>

              {bulkDeleting && (
                <Card padding={3} tone="caution" radius={2}>
                  <Stack space={2}>
                    <Text size={1}>
                      Deleting... {bulkDeleteProgress.current} / {bulkDeleteProgress.total}
                    </Text>
                    <Box
                      style={{
                        height: 4,
                        background: 'var(--card-border-color)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        style={{
                          height: '100%',
                          width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%`,
                          background: 'var(--card-badge-critical-bg-color)',
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </Box>
                  </Stack>
                </Card>
              )}

              <Flex gap={2} justify="flex-end">
                <Button
                  mode="ghost"
                  text="Cancel"
                  onClick={() => setCleanupDialog(null)}
                  disabled={bulkDeleting}
                />
                <Button
                  icon={TrashIcon}
                  tone="critical"
                  text={bulkDeleting ? 'Deleting...' : 'Yes, delete everything'}
                  onClick={handleDeleteAll}
                  disabled={bulkDeleting || !data || data.total === 0}
                />
              </Flex>
            </Stack>
          </Card>
        </Box>
      )}
    </Flex>
  );
}

function MediaGrid({
  media,
  onSelect,
  selectedId,
}: {
  media: MediaFile[];
  onSelect: (file: MediaFile) => void;
  selectedId?: string;
}) {
  if (media.length === 0) {
    return (
      <Flex align="center" justify="center" padding={6}>
        <Text muted>No media files found</Text>
      </Flex>
    );
  }

  return (
    <Grid columns={[2, 3, 4, 5]} gap={3}>
      {media.map((file) => (
        <Card
          key={file.id}
          radius={2}
          shadow={selectedId === file.id ? 2 : 1}
          tone={selectedId === file.id ? 'primary' : 'default'}
          style={{ cursor: 'pointer', overflow: 'hidden' }}
          onClick={() => onSelect(file)}
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
          </Box>
        </Card>
      ))}
    </Grid>
  );
}
