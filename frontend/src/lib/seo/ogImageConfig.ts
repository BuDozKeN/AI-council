/**
 * Dynamic OG Image Configuration
 *
 * This file provides configuration for generating dynamic Open Graph images
 * for social sharing. Currently uses a static image, but includes utilities
 * for future dynamic image generation via:
 * - Vercel OG Image Generation API
 * - Custom API endpoint with canvas/puppeteer
 * - Pre-generated images per route
 *
 * Benefits of dynamic OG images:
 * - Better social media engagement (custom visuals per page)
 * - Improved CTR from social shares
 * - Professional appearance in Slack, Twitter, LinkedIn
 */

const BASE_URL = 'https://axcouncil.vercel.app';

// Default OG image config (used as fallback)
const DEFAULT_OG_IMAGE: OGImageConfig = {
  url: `${BASE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: 'AxCouncil - Strategic AI Advisory Platform',
  type: 'image/png',
};

export interface OGImageConfig {
  url: string;
  width: number;
  height: number;
  alt: string;
  type?: string;
}

/**
 * Route-specific OG images
 * Future: Replace with dynamic generation endpoint
 */
export const OG_IMAGES: Record<string, OGImageConfig> = {
  '/': {
    url: `${BASE_URL}/og-image.png`,
    width: 1200,
    height: 630,
    alt: 'AxCouncil - Strategic AI Advisory Platform',
    type: 'image/png',
  },
  '/leaderboard': {
    url: `${BASE_URL}/og-image.png`, // TODO: Create leaderboard-specific image
    width: 1200,
    height: 630,
    alt: 'AI Model Leaderboard - AxCouncil',
    type: 'image/png',
  },
  // Add more route-specific images here
};

/**
 * Get OG image config for current route
 */
export function getOGImageForRoute(pathname: string): OGImageConfig {
  return OG_IMAGES[pathname] ?? DEFAULT_OG_IMAGE;
}

/**
 * FUTURE IMPLEMENTATION: Dynamic OG Image Generation
 *
 * Option 1: Vercel OG Image API (recommended for Vercel deployment)
 * ----------------------------------------------------------------
 * 1. Create /api/og route handler
 * 2. Use @vercel/og to generate images on the fly
 * 3. Pass title, description as query params
 *
 * Example:
 * ```typescript
 * // api/og/route.ts
 * import { ImageResponse } from '@vercel/og';
 *
 * export async function GET(request: Request) {
 *   const { searchParams } = new URL(request.url);
 *   const title = searchParams.get('title') || 'AxCouncil';
 *   const description = searchParams.get('description') || '';
 *
 *   return new ImageResponse(
 *     (
 *       <div style={{ display: 'flex', background: '#0a0a0a', width: '100%', height: '100%' }}>
 *         <h1>{title}</h1>
 *         <p>{description}</p>
 *       </div>
 *     ),
 *     { width: 1200, height: 630 }
 *   );
 * }
 * ```
 *
 * Option 2: Pre-generate images (build-time)
 * ------------------------------------------
 * 1. Create script to generate images during build
 * 2. Use node-canvas or puppeteer
 * 3. Save to public/og-images/[route].png
 *
 * Option 3: External service
 * --------------------------
 * - Use services like Cloudinary, Imgix, or RenderForm
 * - Pass template + data via API
 * - Cache generated images on CDN
 */

/**
 * Dynamic URL generator (for future implementation)
 */
export function generateDynamicOGImageUrl(route: string, _title: string, _description: string): string {
  // Future: Point to /api/og endpoint
  // return `${BASE_URL}/api/og?route=${encodeURIComponent(route)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

  // For now, return static image
  return getOGImageForRoute(route).url;
}

/**
 * Twitter Card type selector
 */
export function getTwitterCardType(pathname: string): 'summary' | 'summary_large_image' | 'player' | 'app' {
  // Use large image for landing, leaderboard, blog posts
  if (pathname === '/' || pathname === '/leaderboard' || pathname.startsWith('/blog/')) {
    return 'summary_large_image';
  }

  // Use summary for settings, company pages
  return 'summary';
}
