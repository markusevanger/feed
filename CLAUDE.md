# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Feed is a single-user social media timeline built with Next.js 16 and Sanity CMS. It displays a curated feed of posts containing images and videos with rich EXIF metadata. The project uses **self-hosted media storage** to avoid Sanity CDN costs.

## Monorepo Structure

This is a **pnpm + Turborepo** monorepo with the following packages:

```
/apps
  /web                  # Next.js 16 frontend + Sanity Studio
  /media-server         # Express media server with metadata extraction

/packages
  /shared               # Shared TypeScript types (@feed/shared)

/migrations             # One-off migration scripts
```

## Commands

```bash
# Development
pnpm dev                 # Start all dev servers via Turborepo
pnpm dev:web             # Start only web app (port 3000)
pnpm dev:media           # Start only media server (port 3001)

# Building
pnpm build               # Build all packages
pnpm build:web           # Build web app only
pnpm build:media         # Build media server only

# Other
pnpm lint                # Run ESLint across all packages
pnpm typecheck           # Type-check all packages
pnpm clean               # Clean all build artifacts

# Sanity type generation
pnpm --filter @feed/web sanity:extract
pnpm --filter @feed/web sanity:typegen
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 with Turbopack, React 19, TypeScript
- **CMS**: Sanity 5 with next-sanity integration (content only, no media hosting)
- **Media**: Self-hosted Express server with Sharp for metadata extraction
- **Styling**: Tailwind CSS 4, shadcn/ui (New York style), Radix UI primitives
- **Monorepo**: pnpm workspaces + Turborepo
- **Fonts**: Custom Array font (local WOFF2 files)

### Package Details

**@feed/web** (`apps/web`)
```
/src
  /app
    layout.tsx                    # Root layout with theme provider & fonts
    /studio/[[...tool]]/page.tsx  # Sanity Studio at /studio
    /(frontend)/page.tsx          # Main feed page
    /api                          # API routes for media operations
  /components
    FeedMedia.tsx                 # Media wrapper for images/videos with metadata
    MetadataDialog.tsx            # Dialog showing EXIF data (location, camera)
    Video.tsx                     # Video player with orientation support
    /ui/*.tsx                     # shadcn/ui components
  /sanity
    /schemaTypes                  # Sanity document/field schemas
    /plugins
      /selfHostedMedia            # Custom upload components
      /mediaBrowser               # Media browser tool
```

**@feed/media-server** (`apps/media-server`)
```
/src
  index.ts              # Express server with upload/delete endpoints
  metadata.ts           # Sharp-based EXIF/LQIP extraction
Dockerfile              # Production container
docker-compose.yml      # Local development
```

**@feed/shared** (`packages/shared`)
- Shared TypeScript types for media metadata, upload responses, Sanity documents

### Content Model

**Post** document contains:
- `title` (string, required)
- `slug` (slug, required)
- `images` (array of `selfHostedImage`, min 1 required)
- `videos` (array of `selfHostedVideo`, optional)

**selfHostedImage** stores:
- `url` - Direct URL to self-hosted file
- `width`, `height`, `aspectRatio` - Dimensions
- `lqip` - Base64 blur placeholder
- `alt` - Accessibility text
- `exif` - { dateTime, lensMake, lensModel }
- `location` - { lat, lon }

**selfHostedVideo** stores:
- `url` - Direct URL to self-hosted file
- `mimeType` - Video MIME type
- `orientation` - "horizontal" | "vertical"

### Self-Hosted Media Flow

1. User uploads in Sanity Studio via custom input component
2. File sent to media server (`POST /upload`)
3. Media server extracts metadata with Sharp, stores file, returns URL + metadata
4. Sanity stores the metadata directly (no asset reference)
5. Frontend fetches URLs directly from media server (no Sanity CDN)

### Key Patterns
- Server components by default with Suspense for async operations
- Path alias: `@/*` maps to `./src/*` (in apps/web)
- Shared types: `@feed/shared` for cross-package types
- Tailwind uses OKLch color model with CSS variables
- Grid layout: horizontal images span 2 columns, vertical span 1
- Types generated via `sanity typegen` in `apps/web/sanity.types.ts`

### Environment Variables

**Web App (apps/web/.env.local):**
- `NEXT_PUBLIC_SANITY_PROJECT_ID` (required)
- `NEXT_PUBLIC_SANITY_DATASET` (required)
- `NEXT_PUBLIC_SANITY_API_VERSION` (defaults to 2025-03-03)
- `MEDIA_SERVER_URL` - Media server URL for API routes (required for media features)
- `MEDIA_API_KEY` - API key for media server authentication
- `SANITY_STUDIO_MEDIA_SERVER_URL` - Media server URL for Studio uploads (can be same as MEDIA_SERVER_URL)
- `SANITY_STUDIO_MEDIA_API_KEY` - API key for Studio uploads (can be same as MEDIA_API_KEY)
- `MEDIA_SERVER_HOSTNAME` - Hostname for Next.js Image optimization

**Media Server (apps/media-server/.env):**
- `PORT` - Server port (default 3001)
- `UPLOAD_DIR` - Directory for stored files
- `PUBLIC_URL` - Base URL for generated file URLs
- `API_KEY` - Optional authentication key
