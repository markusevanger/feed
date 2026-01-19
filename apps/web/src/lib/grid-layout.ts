import type { SelfHostedMedia } from "../../sanity.types";

type MediaItem = { _key: string } & SelfHostedMedia;

export interface GridItem {
  media: MediaItem;
  colSpan: 1 | 2;
}

export interface GridRow {
  items: GridItem[];
  totalSpan: number;
}

/**
 * Calculate the natural column span for a media item
 * Horizontal images/videos span 2, vertical span 1
 */
function getNaturalSpan(media: SelfHostedMedia): 1 | 2 {
  if (media.mediaType === "image") {
    const aspectRatio = media.aspectRatio || 1;
    return aspectRatio > 1 ? 2 : 1;
  }
  // Video
  return media.orientation === "horizontal" ? 2 : 1;
}

/**
 * Pack media items into rows that fill exactly 3 columns each.
 * Respects the order from Sanity - items are placed sequentially.
 *
 * Strategy:
 * - Process items in order, filling rows as we go
 * - Each item gets its natural span (horizontal=2, vertical=1)
 * - When a row reaches 3 columns, start a new row
 * - If an item would overflow, start a new row
 */
export function packIntoRows(items: MediaItem[], targetColumns = 3): GridRow[] {
  if (items.length === 0) return [];

  const rows: GridRow[] = [];
  let currentRow: GridItem[] = [];
  let currentSpan = 0;

  for (const media of items) {
    const span = getNaturalSpan(media);

    // If adding this item would overflow the row, start a new row
    if (currentSpan + span > targetColumns) {
      if (currentRow.length > 0) {
        rows.push({ items: currentRow, totalSpan: currentSpan });
      }
      currentRow = [];
      currentSpan = 0;
    }

    currentRow.push({ media, colSpan: span });
    currentSpan += span;

    // If row is exactly full, start a new row
    if (currentSpan === targetColumns) {
      rows.push({ items: currentRow, totalSpan: currentSpan });
      currentRow = [];
      currentSpan = 0;
    }
  }

  // Don't forget the last partial row
  if (currentRow.length > 0) {
    rows.push({ items: currentRow, totalSpan: currentSpan });
  }

  return rows;
}

/**
 * Get the Tailwind class for a column span
 */
export function getColSpanClass(span: number): string {
  switch (span) {
    case 1:
      return "lg:col-span-1";
    case 2:
      return "lg:col-span-2";
    case 3:
      return "lg:col-span-3";
    default:
      return "lg:col-span-1";
  }
}
