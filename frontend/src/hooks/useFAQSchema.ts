/**
 * FAQ Schema Hook - AI Search Engine Optimization
 *
 * Injects FAQPage structured data for landing page to improve visibility
 * in AI search engines (Google SGE, Bing Copilot, Perplexity) and enable
 * rich snippet FAQ accordions in search results.
 *
 * Features:
 * - Comprehensive FAQ schema for common questions
 * - AI-optimized answers
 * - Only injected on landing page
 * - Automatic cleanup
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface FAQItem {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

// FAQ content optimized for AI search engines
const FAQ_ITEMS: FAQItem[] = [
  {
    '@type': 'Question',
    name: 'What is AxCouncil?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'AxCouncil is an AI-powered strategic decision platform that orchestrates multiple leading AI models (Claude, GPT, Gemini, Grok, DeepSeek) through a unique 3-stage deliberation process. Each model provides independent analysis, reviews peer responses, and contributes to a synthesized final recommendation.',
    },
  },
  {
    '@type': 'Question',
    name: 'How does the 3-stage council deliberation work?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: "Stage 1: Each AI model independently analyzes your question and provides initial recommendations. Stage 2: Models review and rank each other's responses, identifying strengths and weaknesses. Stage 3: A chairman model synthesizes all insights into a comprehensive final recommendation that incorporates diverse perspectives.",
    },
  },
  {
    '@type': 'Question',
    name: 'Which AI models are included in AxCouncil?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'AxCouncil includes five leading AI models: Claude 3.5 Sonnet (Anthropic), GPT-4 Turbo (OpenAI), Gemini 2.0 Flash (Google), Grok 2 (xAI), and DeepSeek V3. Each model brings unique strengths in reasoning, creativity, and domain expertise.',
    },
  },
  {
    '@type': 'Question',
    name: 'What types of decisions is AxCouncil best for?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: "AxCouncil excels at strategic business decisions, technical architecture choices, hiring decisions, product roadmap planning, market analysis, and any complex decision requiring multiple perspectives. It's particularly valuable when you need to consider trade-offs, risks, and diverse viewpoints.",
    },
  },
  {
    '@type': 'Question',
    name: 'How much does AxCouncil cost?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'AxCouncil is currently free to use. Users need their own OpenRouter API key to access the AI models. OpenRouter charges pay-as-you-go based on actual model usage, with costs typically ranging from $0.10 to $1.00 per council deliberation depending on query complexity.',
    },
  },
  {
    '@type': 'Question',
    name: 'What is OpenRouter and why do I need an API key?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'OpenRouter is a unified API gateway that provides access to multiple AI models through a single API key. You need an OpenRouter API key to use AxCouncil because it handles routing your requests to Claude, GPT, Gemini, Grok, and DeepSeek models. You can get an API key for free at openrouter.ai.',
    },
  },
  {
    '@type': 'Question',
    name: 'Can I customize which AI models participate in the council?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Yes, AxCouncil allows you to configure which models participate in each stage of deliberation through the LLM Hub. You can enable/disable specific models, adjust their roles, and customize the council composition based on your needs and budget.',
    },
  },
  {
    '@type': 'Question',
    name: 'How does AxCouncil handle my company data and privacy?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Your company context, playbooks, and decision logs are stored securely in Supabase with row-level security (RLS). Conversation data is only sent to AI models when you initiate a query, and each model provider has its own data retention policies. AxCouncil does not train on your data.',
    },
  },
  {
    '@type': 'Question',
    name: 'What is the difference between regular chat and council mode?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Regular chat mode uses a single AI model for quick responses. Council mode activates the full 3-stage deliberation process with multiple models, providing comprehensive analysis with diverse perspectives. Council mode takes longer but delivers more thorough, balanced recommendations for complex decisions.',
    },
  },
  {
    '@type': 'Question',
    name: 'Can I integrate AxCouncil with my existing tools?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'AxCouncil offers API access for programmatic integration, webhook support for notifications, and CSV/JSON export for decision logs. We are actively developing integrations with popular tools like Slack, Notion, and Linear. Check our documentation for the latest integration options.',
    },
  },
];

/**
 * Injects FAQ schema on landing page only
 */
export function useFAQSchema() {
  const location = useLocation();

  useEffect(() => {
    // Only show FAQ schema on landing page
    if (location.pathname !== '/') {
      removeFAQSchema();
      return;
    }

    // Create FAQ schema
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS,
    };

    // Inject or update the schema in <head>
    const scriptId = 'faq-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(faqSchema);

    // Cleanup function
    return () => {
      removeFAQSchema();
    };
  }, [location.pathname]);
}

/**
 * Removes FAQ schema from DOM
 */
function removeFAQSchema() {
  const script = document.getElementById('faq-schema');
  if (script) {
    script.remove();
  }
}
