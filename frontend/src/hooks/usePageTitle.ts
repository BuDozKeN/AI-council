/**
 * usePageTitle - Manage document title for accessibility and SEO
 *
 * Updates the page title dynamically based on the current view.
 * Screen readers announce page title changes for better navigation context.
 *
 * @example
 * usePageTitle('My Company - AxCouncil');
 * usePageTitle('Settings', 'AxCouncil');
 */

import { useEffect } from 'react';

const APP_NAME = 'AxCouncil';

export function usePageTitle(title: string, appName = APP_NAME) {
  useEffect(() => {
    const previousTitle = document.title;

    // Set new title
    document.title = title.includes(appName) ? title : `${title} - ${appName}`;

    // Restore previous title on unmount (for nested routes)
    return () => {
      document.title = previousTitle;
    };
  }, [title, appName]);
}

/**
 * Update page title imperatively (for dynamic updates)
 */
export function setPageTitle(title: string, appName = APP_NAME) {
  document.title = title.includes(appName) ? title : `${title} - ${appName}`;
}
