/**
 * Breadcrumb Schema Hook - Rich Snippets SEO
 *
 * Dynamically generates and injects BreadcrumbList structured data
 * for improved search engine rich snippets. This helps search engines
 * understand the site hierarchy and can result in breadcrumb navigation
 * appearing in search results.
 *
 * Features:
 * - Automatic breadcrumb generation from URL structure
 * - JSON-LD schema injection
 * - Route-aware labels
 * - Cleanup on unmount
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://axcouncil.vercel.app';

// Human-readable labels for breadcrumb segments
const BREADCRUMB_LABELS: Record<string, string> = {
  '': 'Home',
  chat: 'Chat',
  settings: 'Settings',
  company: 'My Company',
  leaderboard: 'Leaderboard',
  overview: 'Overview',
  team: 'Team',
  projects: 'Projects',
  playbooks: 'Playbooks',
  decisions: 'Decision Log',
  activity: 'Activity',
  usage: 'Usage Analytics',
  'llm-hub': 'LLM Hub',
  profile: 'Profile',
  'api-keys': 'API Keys',
  billing: 'Billing',
  developer: 'Developer',
};

interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

/**
 * Generates BreadcrumbList structured data and injects into <head>
 */
export function useBreadcrumbSchema() {
  const location = useLocation();

  useEffect(() => {
    // Only show breadcrumbs for nested routes
    const pathSegments = location.pathname.split('/').filter(Boolean);

    if (pathSegments.length === 0) {
      // Home page - no breadcrumbs needed
      removeBreadcrumbSchema();
      return;
    }

    // Build breadcrumb items
    const breadcrumbItems: BreadcrumbItem[] = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const position = index + 2;
      const label = BREADCRUMB_LABELS[segment] || segment;

      // Last item doesn't need an item URL (current page)
      if (index === pathSegments.length - 1) {
        breadcrumbItems.push({
          '@type': 'ListItem',
          position,
          name: label,
        });
      } else {
        breadcrumbItems.push({
          '@type': 'ListItem',
          position,
          name: label,
          item: `${BASE_URL}${currentPath}`,
        });
      }
    });

    // Create breadcrumb schema
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    };

    // Inject or update the schema in <head>
    const scriptId = 'breadcrumb-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(breadcrumbSchema);

    // Cleanup function
    return () => {
      removeBreadcrumbSchema();
    };
  }, [location.pathname]);
}

/**
 * Removes breadcrumb schema from DOM
 */
function removeBreadcrumbSchema() {
  const script = document.getElementById('breadcrumb-schema');
  if (script) {
    script.remove();
  }
}
