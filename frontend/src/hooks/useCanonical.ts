/**
 * useCanonical - Dynamic canonical URL management
 *
 * Updates the canonical URL in <head> based on current route.
 * This helps SEO by telling search engines the "true" URL for each page.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://axcouncil.ai';

export function useCanonical() {
  const location = useLocation();

  useEffect(() => {
    // Build the canonical URL
    // For routes like /chat/:id, we normalize to just /chat
    // This prevents search engines from indexing user-specific content
    let canonicalPath = location.pathname;

    // Normalize conversation routes
    if (canonicalPath.startsWith('/chat/')) {
      canonicalPath = '/'; // Conversations are user-specific, canonical is home
    }

    // Normalize company item routes
    if (canonicalPath.match(/^\/company\/[^/]+\/[^/]+/)) {
      // /company/decisions/abc123 -> /company/decisions
      canonicalPath = canonicalPath.split('/').slice(0, 3).join('/');
    }

    const canonicalUrl = `${BASE_URL}${canonicalPath === '/' ? '' : canonicalPath}`;

    // Find or create canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

    if (canonicalLink) {
      canonicalLink.href = canonicalUrl;
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      canonicalLink.href = canonicalUrl;
      document.head.appendChild(canonicalLink);
    }
  }, [location.pathname]);
}

export default useCanonical;
