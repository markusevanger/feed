'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Stack,
  Text,
  Tooltip,
} from '@sanity/ui';
import {
  DragHandleIcon,
  ImageIcon,
  PlayIcon,
  TrashIcon,
  ResetIcon,
} from '@sanity/icons';
import type { SelfHostedMedia } from '@feed/shared';

// Row height - sized so 1-col items have phone aspect ratio (9:16)
// Grid is ~300px wide total, so 1-col ≈ 100px wide
// For 9:16 ratio: height = width * 16/9 = 100 * 1.78 ≈ 180px
const ROW_HEIGHT = 180;

export interface MediaGridItem {
  _key: string;
  _type: 'selfHostedMedia';
  mediaType?: 'image' | 'video';
  url?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  lqip?: string;
  orientation?: 'horizontal' | 'vertical';
  thumbnailUrl?: string;
}

interface MediaGridPreviewProps {
  items: MediaGridItem[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (key: string) => void;
  onAutoArrange: () => void;
  onItemClick?: (key: string) => void;
  readOnly?: boolean;
}

/**
 * Get the natural column span for a media item (matches frontend logic)
 */
function getNaturalSpan(item: MediaGridItem): 1 | 2 {
  if (item.mediaType === 'image') {
    const aspectRatio = item.aspectRatio || 1;
    return aspectRatio > 1 ? 2 : 1;
  }
  // Video
  return item.orientation === 'horizontal' ? 2 : 1;
}

/**
 * Calculate row assignments for preview display
 * This mirrors the frontend packing algorithm
 */
function calculateRowLayout(items: MediaGridItem[]): Array<{ item: MediaGridItem; span: 1 | 2 | 3; rowIndex: number }> {
  if (items.length === 0) return [];

  const result: Array<{ item: MediaGridItem; span: 1 | 2 | 3; rowIndex: number }> = [];
  let currentRowSpan = 0;
  let rowIndex = 0;
  const itemsWithSpans = items.map(item => ({ item, naturalSpan: getNaturalSpan(item) }));

  // Simple greedy packing - place items in order, wrapping when row is full
  for (let i = 0; i < itemsWithSpans.length; i++) {
    const { item, naturalSpan } = itemsWithSpans[i];

    // Check if item fits in current row
    if (currentRowSpan + naturalSpan <= 3) {
      result.push({ item, span: naturalSpan, rowIndex });
      currentRowSpan += naturalSpan;
    } else {
      // Start new row
      rowIndex++;
      result.push({ item, span: naturalSpan, rowIndex });
      currentRowSpan = naturalSpan;
    }

    // Check if row is exactly full
    if (currentRowSpan === 3) {
      rowIndex++;
      currentRowSpan = 0;
    }
  }

  return result;
}

export function MediaGridPreview({
  items,
  onReorder,
  onRemove,
  onAutoArrange,
  onItemClick,
  readOnly = false,
}: MediaGridPreviewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const layoutItems = useMemo(() => calculateRowLayout(items), [items]);

  // Group by rows for visualization
  const rows = useMemo(() => {
    const rowMap = new Map<number, typeof layoutItems>();
    for (const item of layoutItems) {
      const existing = rowMap.get(item.rowIndex) || [];
      existing.push(item);
      rowMap.set(item.rowIndex, existing);
    }
    return Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [layoutItems]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  if (items.length === 0) {
    return (
      <Card padding={4} border radius={2} tone="transparent">
        <Flex justify="center" align="center" style={{ minHeight: 100 }}>
          <Text size={1} muted>No media items yet. Upload or browse to add.</Text>
        </Flex>
      </Card>
    );
  }

  // Check if any rows are incomplete (not filling 3 columns)
  const hasIncompleteRows = rows.some(([rowIdx, rowItems]) => {
    const totalSpan = rowItems.reduce((sum, i) => sum + i.span, 0);
    // Last row is allowed to be incomplete
    return rowIdx < rows.length - 1 && totalSpan < 3;
  });

  return (
    <Card padding={3} border radius={2}>
      <Stack space={3}>
        {/* Header with actions */}
        <Flex justify="space-between" align="center">
          <Flex gap={2} align="center">
            <Text size={1} weight="semibold">Grid Preview</Text>
            <Text size={0} muted>({items.length} items)</Text>
          </Flex>
          {!readOnly && (
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={1}>Auto-arrange for optimal layout</Text>
                </Box>
              }
              placement="top"
            >
              <Button
                icon={ResetIcon}
                text="Auto-arrange"
                mode="ghost"
                tone={hasIncompleteRows ? 'caution' : 'default'}
                fontSize={1}
                padding={2}
                onClick={onAutoArrange}
              />
            </Tooltip>
          )}
        </Flex>

        {/* Row indicators and grid */}
        <Stack space={2}>
          {rows.map(([rowIndex, rowItems]) => {
            const totalSpan = rowItems.reduce((sum, i) => sum + i.span, 0);
            const isComplete = totalSpan === 3;
            const isLastRow = rowIndex === rows.length - 1;

            return (
              <Box key={rowIndex}>
                {/* Row header */}
                <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                  <Text size={0} muted>Row {rowIndex + 1}</Text>
                  <Text
                    size={0}
                    style={{
                      color: isComplete || isLastRow
                        ? 'var(--card-muted-fg-color)'
                        : 'var(--card-caution-fg-color)'
                    }}
                  >
                    {totalSpan}/3 cols
                  </Text>
                </Flex>

                {/* Grid row */}
                <Grid columns={3} gap={2}>
                  {rowItems.map((layoutItem) => {
                    const itemIndex = items.findIndex(i => i._key === layoutItem.item._key);
                    const isDragging = draggedIndex === itemIndex;
                    const isDragOver = dragOverIndex === itemIndex;

                    return (
                      <MediaGridItem
                        key={layoutItem.item._key}
                        item={layoutItem.item}
                        span={layoutItem.span}
                        isDragging={isDragging}
                        isDragOver={isDragOver}
                        readOnly={readOnly}
                        onDragStart={(e) => handleDragStart(e, itemIndex)}
                        onDragOver={(e) => handleDragOver(e, itemIndex)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, itemIndex)}
                        onDragEnd={handleDragEnd}
                        onRemove={() => onRemove(layoutItem.item._key)}
                        onClick={() => onItemClick?.(layoutItem.item._key)}
                      />
                    );
                  })}

                  {/* Empty slots indicator for incomplete rows */}
                  {!isComplete && !isLastRow && (
                    Array.from({ length: 3 - totalSpan }).map((_, i) => (
                      <Card
                        key={`empty-${i}`}
                        padding={3}
                        style={{
                          gridColumn: 'span 1',
                          height: ROW_HEIGHT,
                          border: '2px dashed var(--card-caution-fg-color)',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.5,
                        }}
                      >
                        <Text size={0} muted>Empty</Text>
                      </Card>
                    ))
                  )}
                </Grid>
              </Box>
            );
          })}
        </Stack>

        {/* Warning for incomplete layout */}
        {hasIncompleteRows && (
          <Card padding={2} tone="caution" radius={2}>
            <Flex gap={2} align="center">
              <Text size={1}>
                ⚠️ Some rows have gaps. Click &quot;Auto-arrange&quot; to optimize.
              </Text>
            </Flex>
          </Card>
        )}
      </Stack>
    </Card>
  );
}

interface MediaGridItemProps {
  item: MediaGridItem;
  span: 1 | 2 | 3;
  isDragging: boolean;
  isDragOver: boolean;
  readOnly: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onClick?: () => void;
}

function MediaGridItem({
  item,
  span,
  isDragging,
  isDragOver,
  readOnly,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRemove,
  onClick,
}: MediaGridItemProps) {
  const isImage = item.mediaType === 'image';
  const hasUrl = !!item.url;

  return (
    <Card
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      padding={0}
      radius={2}
      style={{
        gridColumn: `span ${span}`,
        height: ROW_HEIGHT,
        opacity: isDragging ? 0.5 : 1,
        border: isDragOver
          ? '2px solid var(--card-focus-ring-color)'
          : '1px solid var(--card-border-color)',
        cursor: readOnly ? 'default' : 'grab',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 0.15s, opacity 0.15s',
      }}
    >
      {/* Thumbnail or placeholder */}
      {hasUrl ? (
        isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          // Video - show thumbnail, lqip, or placeholder
          <Flex
            align="center"
            justify="center"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'var(--card-bg2-color)',
              position: 'relative',
            }}
          >
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : item.lqip ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.lqip}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'blur(10px)',
                  transform: 'scale(1.1)',
                }}
              />
            ) : null}
            {/* Play icon overlay */}
            <PlayIcon
              style={{
                fontSize: 32,
                opacity: 0.8,
                position: 'absolute',
                color: 'white',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            />
          </Flex>
        )
      ) : (
        <Flex
          align="center"
          justify="center"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--card-bg2-color)',
          }}
        >
          {isImage ? (
            <ImageIcon style={{ fontSize: 24, opacity: 0.3 }} />
          ) : (
            <PlayIcon style={{ fontSize: 24, opacity: 0.3 }} />
          )}
        </Flex>
      )}

      {/* Overlay with controls */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.4) 100%)',
          opacity: 0,
          transition: 'opacity 0.15s',
          pointerEvents: 'none',
        }}
        className="media-grid-overlay"
      />

      {/* Top bar - type badge and drag handle */}
      <Flex
        justify="space-between"
        align="center"
        padding={1}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        <Box
          padding={1}
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 4,
            fontSize: 10,
            color: 'white',
            fontWeight: 600,
          }}
        >
          {isImage ? 'IMG' : 'VID'} • {span}col
        </Box>
        {!readOnly && (
          <Box
            padding={1}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 4,
              cursor: 'grab',
            }}
          >
            <DragHandleIcon style={{ color: 'white', fontSize: 16 }} />
          </Box>
        )}
      </Flex>

      {/* Bottom bar - remove button */}
      {!readOnly && (
        <Flex
          justify="flex-end"
          padding={1}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <Button
            icon={TrashIcon}
            mode="bleed"
            tone="critical"
            padding={1}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 4,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        </Flex>
      )}

      {/* CSS for hover effect */}
      <style>{`
        .media-grid-overlay:hover {
          opacity: 1 !important;
        }
      `}</style>
    </Card>
  );
}
