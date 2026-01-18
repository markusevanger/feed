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
 * Uses a greedy algorithm that tries to fill each row optimally.
 *
 * Strategy:
 * - Separate items by their natural span (1 or 2 columns)
 * - Build rows by combining items to reach exactly 3 columns
 * - Possible combinations: [2,1], [1,2], [1,1,1], or [3] (single item stretched)
 * - When we can't make a perfect 3, we may stretch a 2-span to fill 3
 */
export function packIntoRows(items: MediaItem[], targetColumns = 3): GridRow[] {
  if (items.length === 0) return [];

  // Calculate natural spans for all items
  const itemsWithSpans: GridItem[] = items.map((media) => ({
    media,
    colSpan: getNaturalSpan(media),
  }));

  const rows: GridRow[] = [];
  let remaining = [...itemsWithSpans];

  while (remaining.length > 0) {
    const row = buildRow(remaining, targetColumns);
    rows.push(row);

    // Remove used items from remaining
    const usedKeys = new Set(row.items.map((i) => i.media._key));
    remaining = remaining.filter((i) => !usedKeys.has(i.media._key));
  }

  return rows;
}

/**
 * Build a single row from available items, trying to fill exactly targetColumns
 */
function buildRow(available: GridItem[], targetColumns: number): GridRow {
  // Try to find the best combination that fills the row
  const span1Items = available.filter((i) => i.colSpan === 1);
  const span2Items = available.filter((i) => i.colSpan === 2);

  // Priority 1: [2, 1] - one horizontal + one vertical (most common and looks good)
  if (span2Items.length >= 1 && span1Items.length >= 1) {
    return {
      items: [span2Items[0], span1Items[0]],
      totalSpan: 3,
    };
  }

  // Priority 2: [1, 1, 1] - three verticals
  if (span1Items.length >= 3) {
    return {
      items: [span1Items[0], span1Items[1], span1Items[2]],
      totalSpan: 3,
    };
  }

  // Priority 3: [2] stretched to 3 - single horizontal fills the row
  if (span2Items.length >= 1) {
    return {
      items: [{ ...span2Items[0], colSpan: 3 as unknown as 2 }], // Stretch to 3
      totalSpan: 3,
    };
  }

  // Priority 4: [1, 1] - two verticals (leaves 1 column empty, but acceptable for last row)
  if (span1Items.length >= 2) {
    return {
      items: [span1Items[0], span1Items[1]],
      totalSpan: 2,
    };
  }

  // Fallback: single item (last row edge case)
  return {
    items: [available[0]],
    totalSpan: available[0].colSpan,
  };
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
