# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Feed is a single-user social media timeline built with Next.js 15 and Sanity CMS. It displays a curated feed of posts containing images and videos with rich EXIF metadata. The project is under active development (WIP).

## Commands

```bash
pnpm dev              # Start dev server with Turbopack
pnpm build            # Next.js production build
pnpm start            # Run production server
pnpm lint             # ESLint checks
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 with Turbopack, React 18, TypeScript
- **CMS**: Sanity CMS with next-sanity integration
- **Styling**: Tailwind CSS 4, shadcn/ui (New York style), Radix UI primitives
- **Fonts**: Custom Array font (local WOFF2 files)

### Source Structure
```
/src
  /app
    layout.tsx                    # Root layout with theme provider & fonts
    /studio/[[...tool]]/page.tsx  # Sanity Studio at /studio
    /(frontend)/page.tsx          # Main feed page
  /components
    FeedMedia.tsx                 # Media wrapper for images/videos with metadata
    MetadataDialog.tsx            # Dialog showing EXIF data (location, camera)
    Video.tsx                     # Video player with orientation support
    Windup.tsx                    # Typewriter text animation
    /ui/*.tsx                     # shadcn/ui components
  /sanity
    env.ts                        # Environment variables
    structure.ts                  # Sanity Studio structure
    /lib
      client.ts                   # next-sanity client config
      image.ts                    # Sanity image URL builder
    /schemaTypes
      postType.ts                 # Post document schema
```

### Content Model (Post)
Posts contain:
- Title and slug
- Images array (required, min 1) with EXIF metadata, LQIP placeholders, location data
- Videos array (optional) with orientation field

### Key Patterns
- Server components by default with Suspense for async operations
- Path alias: `@/*` maps to `./src/*`
- Tailwind uses OKLch color model with CSS variables
- Grid layout: horizontal images span 2 columns, vertical span 1

### Environment Variables
- `NEXT_PUBLIC_SANITY_PROJECT_ID` (required)
- `NEXT_PUBLIC_SANITY_DATASET` (required)
- `NEXT_PUBLIC_SANITY_API_VERSION` (defaults to 2025-03-03)
