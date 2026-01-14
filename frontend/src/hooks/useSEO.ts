/**
 * SEO Hook for Internationalized Meta Tags
 *
 * Manages dynamic meta tags, hreflang links, and Open Graph tags
 * for proper SEO across multiple languages.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { supportedLanguages } from '../i18n';

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  url?: string;
}

/**
 * Update document meta tags for SEO and social sharing
 */
export function useSEO(config: SEOConfig = {}) {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const currentLang = i18n.language.split('-')[0];
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;

    // Default values with translation fallbacks
    const title = config.title || t('seo.defaultTitle', 'AxCouncil - AI Decision Council');
    const description =
      config.description ||
      t(
        'seo.defaultDescription',
        'Make better decisions with an AI council. Get diverse perspectives from Claude, GPT, Gemini, and more in a 3-stage deliberation process.'
      );
    const image = config.image || `${baseUrl}/og-image.png`;
    const type = config.type || 'website';
    const url = config.url || `${baseUrl}${currentPath}`;

    // Update document title
    document.title = title;

    // Helper to set or update a meta tag
    const setMetaTag = (property: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;

      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, property);
        document.head.appendChild(meta);
      }

      meta.content = content;
    };

    // Standard meta tags
    setMetaTag('description', description);

    // Open Graph tags
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:image', image, true);
    setMetaTag('og:type', type, true);
    setMetaTag('og:url', url, true);
    setMetaTag('og:locale', i18n.language, true);

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', image);

    // Add alternate locale tags for Open Graph
    // Note: og:locale:alternate requires MULTIPLE tags (one per language),
    // so we can't use setMetaTag which reuses existing tags.
    // First, remove any existing alternate locale tags
    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el) => el.remove());

    // Then create a new tag for each alternate language
    supportedLanguages.forEach((lang) => {
      if (lang.code !== currentLang) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:locale:alternate');
        meta.content = lang.code;
        document.head.appendChild(meta);
      }
    });

    // Clean up function
    return () => {
      // Meta tags persist across routes, so we don't remove them
      // They'll be updated on next route/language change
    };
  }, [config, i18n.language, t]);
}

/**
 * Add hreflang links for all supported languages
 * This helps search engines understand which language versions exist
 */
export function useHreflangLinks() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;

    // Remove any existing hreflang links
    document.querySelectorAll('link[rel="alternate"]').forEach((link) => {
      if (link.getAttribute('hreflang')) {
        link.remove();
      }
    });

    // Add hreflang links for all supported languages
    supportedLanguages.forEach((lang) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang.code;
      // In a real implementation, you might have different URLs per language
      // For now, we use the same URL with a language parameter
      link.href = `${baseUrl}${currentPath}?lang=${lang.code}`;
      document.head.appendChild(link);
    });

    // Add x-default hreflang for default language
    const defaultLink = document.createElement('link');
    defaultLink.rel = 'alternate';
    defaultLink.hreflang = 'x-default';
    defaultLink.href = `${baseUrl}${currentPath}`;
    document.head.appendChild(defaultLink);

    // Cleanup function
    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => {
        link.remove();
      });
    };
  }, [i18n.language]);
}

/**
 * Add canonical URL to prevent duplicate content issues
 * Uses useLocation() to reactively update when route changes
 */
export function useCanonicalURL(url?: string) {
  const location = useLocation();

  useEffect(() => {
    const baseUrl = window.location.origin;
    const canonicalUrl = url || `${baseUrl}${location.pathname}`;

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }

    link.href = canonicalUrl;

    return () => {
      // Keep canonical link, it will be updated on next route
    };
  }, [url, location.pathname]);
}

/**
 * Combined SEO hook with all features
 * Use this for most pages
 */
export function useFullSEO(config: SEOConfig = {}) {
  useSEO(config);
  useHreflangLinks();
  useCanonicalURL(config.url);
}
