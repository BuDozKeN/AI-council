/**
 * Article Schema Hook - Blog Post SEO
 *
 * Dynamically generates and injects Article structured data for blog posts
 * to improve search engine visibility and enable rich snippets. This helps
 * Google and other search engines understand article content, authorship,
 * publication date, and images.
 *
 * Features:
 * - Automatic Article schema generation for blog posts
 * - Author, publisher, date information
 * - Image metadata for rich snippets
 * - Only active on /blog/* routes
 *
 * Usage:
 * Call this hook with article metadata in your BlogPost component.
 * For now, this is prepared for future blog implementation.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface ArticleMetadata {
  headline: string;
  description: string;
  image: string;
  author: {
    name: string;
    url?: string;
  };
  datePublished: string; // ISO 8601 format: 2026-01-13T10:00:00Z
  dateModified?: string; // ISO 8601 format
  wordCount?: number;
  keywords?: string[];
}

const PUBLISHER_INFO = {
  name: 'AxCouncil',
  logo: {
    '@type': 'ImageObject',
    url: 'https://axcouncil.ai/favicon.svg',
    width: 512,
    height: 512,
  },
};

/**
 * Generates Article schema and injects into <head>
 *
 * @param metadata - Article metadata (headline, author, dates, etc.)
 */
export function useArticleSchema(metadata?: ArticleMetadata) {
  const location = useLocation();

  useEffect(() => {
    // Only show Article schema on blog routes
    if (!location.pathname.startsWith('/blog/') || !metadata) {
      removeArticleSchema();
      return;
    }

    // Build Article schema
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: metadata.headline,
      description: metadata.description,
      image: metadata.image,
      author: {
        '@type': 'Person',
        name: metadata.author.name,
        ...(metadata.author.url && { url: metadata.author.url }),
      },
      publisher: {
        '@type': 'Organization',
        ...PUBLISHER_INFO,
      },
      datePublished: metadata.datePublished,
      ...(metadata.dateModified && { dateModified: metadata.dateModified }),
      ...(metadata.wordCount && { wordCount: metadata.wordCount }),
      ...(metadata.keywords && { keywords: metadata.keywords.join(', ') }),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://axcouncil.ai${location.pathname}`,
      },
    };

    // Inject or update the schema in <head>
    const scriptId = 'article-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(articleSchema);

    // Cleanup function
    return () => {
      removeArticleSchema();
    };
  }, [location.pathname, metadata]);
}

/**
 * Removes Article schema from DOM
 */
function removeArticleSchema() {
  const script = document.getElementById('article-schema');
  if (script) {
    script.remove();
  }
}

/**
 * Example usage in a BlogPost component:
 *
 * ```tsx
 * import { useArticleSchema } from './hooks/useArticleSchema';
 *
 * function BlogPost({ post }) {
 *   useArticleSchema({
 *     headline: post.title,
 *     description: post.excerpt,
 *     image: post.coverImage,
 *     author: {
 *       name: post.author.name,
 *       url: `https://axcouncil.ai/authors/${post.author.slug}`
 *     },
 *     datePublished: post.publishedAt,
 *     dateModified: post.updatedAt,
 *     wordCount: post.content.split(' ').length,
 *     keywords: post.tags
 *   });
 *
 *   return <article>{/* Blog post content *\/}</article>;
 * }
 * ```
 */
