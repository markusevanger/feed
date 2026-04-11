'use client';

import React, { useCallback, useState, useId } from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Label,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import {
  CloseIcon,
  ImageIcon,
  PlayIcon,
  UploadIcon,
  SyncIcon,
} from '@sanity/icons';
import { uploadFile } from './api';
import type { UploadResponse } from './types';
import type { MediaGridItem } from './MediaGridPreview';

interface MediaEditDialogProps {
  item: MediaGridItem;
  onSave: (updates: Partial<MediaGridItem>) => void;
  onClose: () => void;
}

type RotationDegrees = 0 | 90 | 180 | 270;

export function MediaEditDialog({ item, onSave, onClose }: MediaEditDialogProps) {
  const isImage = item.mediaType === 'image';
  const inputId = useId();

  // Local state for editable fields
  const [alt, setAlt] = useState(item.alt || '');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>(
    item.orientation || 'horizontal'
  );
  const [rotation, setRotation] = useState<RotationDegrees>(0);

  // Upload state for image replacement
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<UploadResponse | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type matches current media type
      const fileIsImage = file.type.startsWith('image/');
      if (isImage && !fileIsImage) {
        setUploadError('Please select an image file');
        return;
      }
      if (!isImage && fileIsImage) {
        setUploadError('Please select a video file');
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      // Create preview URL
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      try {
        const result = await uploadFile(file, (progress) => {
          setUploadProgress(progress);
        });

        setPendingUpload(result);
        setIsUploading(false);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
        setIsUploading(false);
        setPreviewUrl(null);
      }

      e.target.value = '';
    },
    [isImage]
  );

  const handleRotate = useCallback(() => {
    setRotation((prev) => ((prev + 90) % 360) as RotationDegrees);
  }, []);

  const handleSave = useCallback(() => {
    const updates: Partial<MediaGridItem> = {};

    if (isImage) {
      // Image updates
      if (alt !== (item.alt || '')) {
        updates.alt = alt;
      }

      // Apply rotation to dimensions if rotated 90 or 270 degrees
      if (rotation === 90 || rotation === 270) {
        // Swap width and height
        updates.width = item.height;
        updates.height = item.width;
        updates.aspectRatio = item.height && item.width ? item.height / item.width : undefined;
      }

      // If new image uploaded, apply those values
      if (pendingUpload) {
        updates.url = pendingUpload.url;
        updates.width = pendingUpload.width;
        updates.height = pendingUpload.height;
        updates.aspectRatio = pendingUpload.aspectRatio;
        updates.lqip = pendingUpload.lqip;
        updates.exif = pendingUpload.exif;
        updates.location = pendingUpload.location;

        // Apply rotation to new image dimensions too
        if (rotation === 90 || rotation === 270) {
          updates.width = pendingUpload.height;
          updates.height = pendingUpload.width;
          updates.aspectRatio =
            pendingUpload.height && pendingUpload.width
              ? pendingUpload.height / pendingUpload.width
              : undefined;
        }
      }
    } else {
      // Video updates
      if (orientation !== item.orientation) {
        updates.orientation = orientation;
      }

      // If new video uploaded
      if (pendingUpload) {
        updates.url = pendingUpload.url;
        updates.mimeType = pendingUpload.mimeType;
        updates.thumbnailUrl = pendingUpload.thumbnailUrl;
        updates.lqip = pendingUpload.lqip;
      }
    }

    onSave(updates);
    onClose();
  }, [isImage, alt, item, rotation, orientation, pendingUpload, onSave, onClose]);

  // Determine which URL to display
  const displayUrl = previewUrl || item.url;

  // Calculate display dimensions with rotation
  const getRotatedStyle = () => {
    if (rotation === 0) return {};
    return {
      transform: `rotate(${rotation}deg)`,
      transformOrigin: 'center center',
    };
  };

  return (
    <Dialog
      id="media-edit-dialog"
      header={`Edit ${isImage ? 'Image' : 'Video'}`}
      onClose={onClose}
      width={1}
    >
      <Box padding={4}>
        <Stack space={5}>
          {/* Media Preview */}
          <Card padding={3} border radius={2} tone="transparent">
            <Stack space={3}>
              <Flex justify="space-between" align="center">
                <Text size={1} weight="semibold">
                  Preview
                </Text>
                {isImage && (
                  <Button
                    icon={SyncIcon}
                    text="Rotate 90°"
                    mode="ghost"
                    fontSize={1}
                    padding={2}
                    onClick={handleRotate}
                    disabled={isUploading}
                  />
                )}
              </Flex>

              <Flex justify="center" align="center" style={{ minHeight: 200 }}>
                {displayUrl ? (
                  isImage ? (
                    <Box
                      style={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayUrl}
                        alt={alt || ''}
                        style={{
                          maxWidth: rotation === 90 || rotation === 270 ? 200 : 300,
                          maxHeight: rotation === 90 || rotation === 270 ? 300 : 200,
                          objectFit: 'contain',
                          transition: 'transform 0.3s ease',
                          ...getRotatedStyle(),
                        }}
                      />
                    </Box>
                  ) : (
                    <video
                      src={displayUrl}
                      controls
                      style={{
                        maxWidth: '100%',
                        maxHeight: 300,
                      }}
                    />
                  )
                ) : (
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 200,
                      height: 150,
                      backgroundColor: 'var(--card-bg2-color)',
                      borderRadius: 4,
                    }}
                  >
                    {isImage ? (
                      <ImageIcon style={{ fontSize: 32, opacity: 0.3 }} />
                    ) : (
                      <PlayIcon style={{ fontSize: 32, opacity: 0.3 }} />
                    )}
                  </Flex>
                )}
              </Flex>

              {/* Upload/Replace Section */}
              <Stack space={2}>
                <label htmlFor={inputId}>
                  <Button
                    icon={UploadIcon}
                    text={displayUrl ? `Replace ${isImage ? 'Image' : 'Video'}` : 'Upload'}
                    mode="ghost"
                    as="span"
                    style={{ width: '100%', cursor: 'pointer' }}
                    disabled={isUploading}
                  />
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept={isImage ? 'image/*' : 'video/*'}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {isUploading && (
                  <Flex gap={2} align="center">
                    <Spinner muted />
                    <Text size={1} muted>
                      Uploading... {uploadProgress}%
                    </Text>
                  </Flex>
                )}

                {uploadError && (
                  <Text size={1} style={{ color: 'var(--card-critical-color)' }}>
                    {uploadError}
                  </Text>
                )}

                {pendingUpload && !isUploading && (
                  <Text size={1} style={{ color: 'var(--card-positive-color)' }}>
                    New file ready to save
                  </Text>
                )}
              </Stack>
            </Stack>
          </Card>

          {/* Metadata Section */}
          <Card padding={3} border radius={2} tone="transparent">
            <Stack space={4}>
              <Text size={1} weight="semibold">
                Details
              </Text>

              {isImage ? (
                <>
                  {/* Alt Text */}
                  <Stack space={2}>
                    <Label size={1}>Alt Text</Label>
                    <TextInput
                      value={alt}
                      onChange={(e) => setAlt(e.currentTarget.value)}
                      placeholder="Describe the image for accessibility"
                    />
                  </Stack>

                  {/* Current Dimensions (read-only info) */}
                  <Grid columns={2} gap={3}>
                    <Stack space={2}>
                      <Label size={1}>Width</Label>
                      <Text size={1} muted>
                        {rotation === 90 || rotation === 270
                          ? pendingUpload?.height || item.height
                          : pendingUpload?.width || item.width}
                        px
                        {rotation !== 0 && ' (rotated)'}
                      </Text>
                    </Stack>
                    <Stack space={2}>
                      <Label size={1}>Height</Label>
                      <Text size={1} muted>
                        {rotation === 90 || rotation === 270
                          ? pendingUpload?.width || item.width
                          : pendingUpload?.height || item.height}
                        px
                        {rotation !== 0 && ' (rotated)'}
                      </Text>
                    </Stack>
                  </Grid>

                  {/* EXIF Info (read-only) */}
                  {item.exif?.dateTime && (
                    <Stack space={2}>
                      <Label size={1}>Date Taken</Label>
                      <Text size={1} muted>
                        {item.exif.dateTime}
                      </Text>
                    </Stack>
                  )}

                  {(item.exif?.lensMake || item.exif?.lensModel) && (
                    <Stack space={2}>
                      <Label size={1}>Lens</Label>
                      <Text size={1} muted>
                        {[item.exif.lensMake, item.exif.lensModel].filter(Boolean).join(' ')}
                      </Text>
                    </Stack>
                  )}

                  {item.location?.lat && item.location?.lon && (
                    <Stack space={2}>
                      <Label size={1}>Location</Label>
                      <Text size={1} muted>
                        {item.location.lat.toFixed(6)}, {item.location.lon.toFixed(6)}
                      </Text>
                    </Stack>
                  )}
                </>
              ) : (
                <>
                  {/* Video Orientation */}
                  <Stack space={2}>
                    <Label size={1}>Orientation</Label>
                    <Select
                      value={orientation}
                      onChange={(e) =>
                        setOrientation(e.currentTarget.value as 'horizontal' | 'vertical')
                      }
                    >
                      <option value="horizontal">Horizontal (2 columns)</option>
                      <option value="vertical">Vertical (1 column)</option>
                    </Select>
                    <Text size={0} muted>
                      Affects how the video spans in the grid layout
                    </Text>
                  </Stack>

                  {/* MIME Type (read-only) */}
                  {item.mimeType && (
                    <Stack space={2}>
                      <Label size={1}>Format</Label>
                      <Text size={1} muted>
                        {item.mimeType}
                      </Text>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          </Card>

          {/* Actions */}
          <Flex gap={2} justify="flex-end">
            <Button text="Cancel" mode="ghost" onClick={onClose} />
            <Button
              text="Save Changes"
              tone="primary"
              onClick={handleSave}
              disabled={isUploading}
            />
          </Flex>
        </Stack>
      </Box>
    </Dialog>
  );
}
