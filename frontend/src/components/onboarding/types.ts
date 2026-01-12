/**
 * Onboarding Types
 *
 * Minimal type definitions for the onboarding flow.
 * These match the council synthesis spec.
 */

export interface OnboardingDepartment {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  purpose: string;
}

export interface OnboardingProfile {
  full_name: string;
  role: string;
  company: string;
  industry: string;
  employees: number;
  bio: string;
  magic_question: string;
  departments: OnboardingDepartment[];
}

export type OnboardingStep = 'input' | 'loading' | 'preview' | 'ready';

export interface OnboardingState {
  step: OnboardingStep;
  linkedInUrl: string;
  profile: OnboardingProfile | null;
  error: string | null;
}

// Loading step configuration
export interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

// Council member for the loading animation
export interface CouncilMember {
  id: string;
  name: string;
  role: string;
  provider: 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';
  color: string; // Brand color for glow effect
}
