/**
 * Mock Onboarding Profiles
 *
 * Hardcoded test data for developing the onboarding flow.
 * These profiles match the council synthesis spec.
 */

import type { OnboardingProfile, LoadingStep, CouncilMember } from './types';

/**
 * The 5 AI Council Members
 * These are the actual LLMs that will deliberate on user questions
 */
export const COUNCIL_MEMBERS: CouncilMember[] = [
  {
    id: 'claude',
    name: 'Claude',
    role: 'Strategic Analyst',
    provider: 'anthropic',
    color: '#d4a574', // Anthropic warm brown
  },
  {
    id: 'gpt',
    name: 'GPT-4',
    role: 'Business Advisor',
    provider: 'openai',
    color: '#10a37f', // OpenAI green
  },
  {
    id: 'gemini',
    name: 'Gemini',
    role: 'Innovation Lead',
    provider: 'google',
    color: '#4285f4', // Google blue
  },
  {
    id: 'grok',
    name: 'Grok',
    role: 'Market Analyst',
    provider: 'xai',
    color: '#ffffff', // X white
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    role: 'Technical Expert',
    provider: 'deepseek',
    color: '#6366f1', // DeepSeek indigo
  },
];

/**
 * Profile A: Agency Owner (SMB target)
 * Small team, founder-led, service business
 */
export const MOCK_PROFILE_AGENCY: OnboardingProfile = {
  full_name: 'Sarah Jenkins',
  role: 'Founder & CEO',
  company: 'Elevate Digital',
  industry: 'Marketing Services',
  employees: 12,
  bio: 'Founder of a boutique SEO agency focused on FinTech. 10 years experience. Struggling to scale beyond founder-led sales.',
  magic_question:
    'How can Elevate Digital transition from founder-led sales to a scalable outbound system without sacrificing the high-touch consultancy brand?',
  departments: [
    {
      id: 'exec-strategy',
      name: 'Executive Strategy',
      icon: 'crown',
      purpose: 'High-level strategic decisions and company direction',
    },
    {
      id: 'agency-ops',
      name: 'Agency Operations',
      icon: 'settings',
      purpose: 'Day-to-day operational efficiency and delivery',
    },
    {
      id: 'new-business',
      name: 'New Business',
      icon: 'rocket',
      purpose: 'Revenue growth and client acquisition',
    },
  ],
};

/**
 * Profile B: SaaS CTO (Scale-up target)
 * Larger team, technical leadership, product company
 */
export const MOCK_PROFILE_SAAS: OnboardingProfile = {
  full_name: 'David Chen',
  role: 'CTO',
  company: 'CloudFlow',
  industry: 'SaaS / Logistics',
  employees: 150,
  bio: 'Technical leader managing a team of 40. Focused on reducing technical debt while shipping features for Series C prep.',
  magic_question:
    'Evaluate the trade-offs of rewriting our legacy logistics engine in Rust vs. refactoring the existing Python codebase, considering our Series C timeline of 9 months.',
  departments: [
    {
      id: 'eng-arch',
      name: 'Engineering Architecture',
      icon: 'code',
      purpose: 'System design, technical standards, and architecture decisions',
    },
    {
      id: 'product-strategy',
      name: 'Product Strategy',
      icon: 'lightbulb',
      purpose: 'Product direction, roadmap priorities, and feature decisions',
    },
    {
      id: 'devops',
      name: 'DevOps & Infrastructure',
      icon: 'server',
      purpose: 'Deployment, scaling, reliability, and cloud infrastructure',
    },
  ],
};

/**
 * All mock profiles for random selection
 */
export const MOCK_PROFILES: OnboardingProfile[] = [MOCK_PROFILE_AGENCY, MOCK_PROFILE_SAAS];

/**
 * Get a mock profile (cycles between available profiles)
 * In production, this will be replaced by LinkedIn API call
 */
export function getMockProfile(url: string): OnboardingProfile {
  // Simple selection based on URL content
  if (url.toLowerCase().includes('david') || url.toLowerCase().includes('tech')) {
    return MOCK_PROFILE_SAAS;
  }
  return MOCK_PROFILE_AGENCY;
}

/**
 * Loading steps for the "Magic Mirror" animation
 * These will be animated sequentially
 */
export function getLoadingSteps(companyName: string): LoadingStep[] {
  return [
    { id: 'profile', label: 'Analyzing profile...', status: 'pending' },
    { id: 'company', label: `Extracting context from ${companyName}...`, status: 'pending' },
    { id: 'dept1', label: 'Recruiting Head of Strategy...', status: 'pending' },
    { id: 'dept2', label: 'Recruiting Operations Lead...', status: 'pending' },
    { id: 'chairman', label: 'Briefing the Chairman...', status: 'pending' },
  ];
}
