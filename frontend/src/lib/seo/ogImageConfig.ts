/**
 * OG Image Configuration
 *
 * Provides configuration for Open Graph images used in social sharing.
 * Currently uses static images with route-specific alt text.
 */

const BASE_URL = 'https://axcouncil.ai';

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
    url: `${BASE_URL}/og-image.png`,
    width: 1200,
    height: 630,
    alt: 'AI Model Leaderboard - AxCouncil',
    type: 'image/png',
  },
};

/**
 * Get OG image config for current route
 */
export function getOGImageForRoute(pathname: string): OGImageConfig {
  return OG_IMAGES[pathname] ?? DEFAULT_OG_IMAGE;
}
