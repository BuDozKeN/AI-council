/**
 * Dynamic Meta Tags Hook - SEO Optimization
 *
 * Updates page title, meta description, Open Graph tags, and Twitter Cards
 * based on the current route. This ensures each section of the SPA has
 * unique, descriptive meta tags for better SEO and social sharing.
 *
 * Features:
 * - Route-specific titles and descriptions
 * - Dynamic OG tags for social sharing
 * - Twitter Card updates
 * - Canonical URL sync
 * - Fallback to default meta tags
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MetaConfig {
  title: string;
  description: string;
  ogImage?: string;
  keywords?: string;
}

const BASE_URL = 'https://axcouncil.vercel.app';

// Route-specific meta configurations
const META_CONFIGS: Record<string, MetaConfig> = {
  '/': {
    title: 'AxCouncil - Strategic AI Advisory Platform',
    description: 'Get expert AI advice from multiple models working together. Claude, GPT, Gemini, Grok, and DeepSeek collaborate to provide comprehensive decision-making support.',
    keywords: 'AI advisory, multi-model AI, strategic decisions, Claude, GPT, Gemini, business intelligence',
  },
  '/chat': {
    title: 'Chat - AxCouncil',
    description: 'Engage with multiple AI models simultaneously for comprehensive advice and strategic insights.',
    keywords: 'AI chat, multi-model conversation, AI consultation',
  },
  '/settings': {
    title: 'Settings - AxCouncil',
    description: 'Configure your AxCouncil account preferences, API keys, billing, and developer settings.',
    keywords: 'settings, account configuration, API keys',
  },
  '/settings/profile': {
    title: 'Profile Settings - AxCouncil',
    description: 'Manage your personal profile and account preferences.',
    keywords: 'profile, account settings, user preferences',
  },
  '/settings/api-keys': {
    title: 'API Keys - AxCouncil',
    description: 'Manage your OpenRouter API keys and LLM model access.',
    keywords: 'API keys, OpenRouter, model access',
  },
  '/settings/billing': {
    title: 'Billing - AxCouncil',
    description: 'View and manage your subscription and billing information.',
    keywords: 'billing, subscription, payment',
  },
  '/settings/team': {
    title: 'Team Settings - AxCouncil',
    description: 'Manage team members and collaboration settings.',
    keywords: 'team management, collaboration, members',
  },
  '/settings/developer': {
    title: 'Developer Settings - AxCouncil',
    description: 'Configure advanced developer options, debugging, and API settings.',
    keywords: 'developer settings, API configuration, debugging',
  },
  '/company': {
    title: 'My Company - AxCouncil',
    description: 'Manage your company profile, team structure, projects, and strategic decisions.',
    keywords: 'company management, organization, team structure',
  },
  '/company/overview': {
    title: 'Company Overview - AxCouncil',
    description: 'View your company profile, mission, and organizational context.',
    keywords: 'company overview, organization profile, business context',
  },
  '/company/team': {
    title: 'Team Management - AxCouncil',
    description: 'Manage departments, roles, and team structure.',
    keywords: 'team management, departments, organizational roles',
  },
  '/company/projects': {
    title: 'Projects - AxCouncil',
    description: 'Track and manage strategic projects and initiatives.',
    keywords: 'project management, strategic initiatives, tracking',
  },
  '/company/playbooks': {
    title: 'Playbooks - AxCouncil',
    description: 'Create and manage organizational playbooks, SOPs, and best practices.',
    keywords: 'playbooks, SOPs, best practices, documentation',
  },
  '/company/decisions': {
    title: 'Decision Log - AxCouncil',
    description: 'Track important decisions and their context for future reference.',
    keywords: 'decision tracking, knowledge base, decision history',
  },
  '/company/activity': {
    title: 'Activity Feed - AxCouncil',
    description: 'View recent activity and updates across your organization.',
    keywords: 'activity feed, updates, recent changes',
  },
  '/company/usage': {
    title: 'Usage Analytics - AxCouncil',
    description: 'Monitor AI model usage, costs, and performance metrics.',
    keywords: 'usage analytics, cost tracking, performance metrics',
  },
  '/company/llm-hub': {
    title: 'LLM Hub - AxCouncil',
    description: 'Configure and manage AI models for your organization.',
    keywords: 'LLM configuration, AI models, model management',
  },
  '/leaderboard': {
    title: 'Model Leaderboard - AxCouncil',
    description: 'Compare AI model performance, accuracy, and rankings across different scenarios.',
    keywords: 'AI leaderboard, model comparison, performance rankings',
  },
};

/**
 * Updates document meta tags based on current route
 */
export function useDynamicMeta() {
  const location = useLocation();

  useEffect(() => {
    // Build the route path from location
    const pathSegments = location.pathname.split('/').filter(Boolean);
    let routeKey = '/';

    if (pathSegments.length > 0) {
      // Try exact match first (e.g., /company/projects)
      routeKey = `/${pathSegments.join('/')}`;

      // If no exact match, try base path (e.g., /company)
      if (!META_CONFIGS[routeKey] && pathSegments.length > 0) {
        routeKey = `/${pathSegments[0]}`;
      }

      // If still no match, default to home
      if (!META_CONFIGS[routeKey]) {
        routeKey = '/';
      }
    }

    const meta = META_CONFIGS[routeKey] || META_CONFIGS['/'];

    // Update document title
    document.title = meta.title;

    // Update meta description
    updateMetaTag('name', 'description', meta.description);

    // Update keywords
    if (meta.keywords) {
      updateMetaTag('name', 'keywords', meta.keywords);
    }

    // Update Open Graph tags
    updateMetaTag('property', 'og:title', meta.title);
    updateMetaTag('property', 'og:description', meta.description);
    updateMetaTag('property', 'og:url', `${BASE_URL}${location.pathname}`);
    if (meta.ogImage) {
      updateMetaTag('property', 'og:image', `${BASE_URL}${meta.ogImage}`);
    }

    // Update Twitter Card tags
    updateMetaTag('name', 'twitter:title', meta.title);
    updateMetaTag('name', 'twitter:description', meta.description);
    if (meta.ogImage) {
      updateMetaTag('name', 'twitter:image', `${BASE_URL}${meta.ogImage}`);
    }

    // Update canonical URL (it should already be managed by useCanonical, but ensure consistency)
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      // Only update for public routes, not authenticated ones
      const isPublicRoute = routeKey === '/' || routeKey === '/leaderboard';
      if (isPublicRoute) {
        canonicalLink.setAttribute('href', `${BASE_URL}${location.pathname}`);
      } else {
        // Authenticated routes should canonicalize to home
        canonicalLink.setAttribute('href', BASE_URL);
      }
    }
  }, [location.pathname, location.search]);
}

/**
 * Helper function to update or create meta tags
 */
function updateMetaTag(attribute: 'name' | 'property', value: string, content: string) {
  const selector = `meta[${attribute}="${value}"]`;
  let tag = document.querySelector(selector);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}
