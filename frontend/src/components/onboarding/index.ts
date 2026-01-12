/**
 * Onboarding Module Exports
 */

export { OnboardingFlow } from './OnboardingFlow';
export { SoftGateModal } from './SoftGateModal';
export { HardGateModal } from './HardGateModal';
export type {
  OnboardingProfile,
  OnboardingDepartment,
  OnboardingStep,
  OnboardingState,
  LoadingStep,
} from './types';
export {
  MOCK_PROFILE_AGENCY,
  MOCK_PROFILE_SAAS,
  getMockProfile,
  getLoadingSteps,
} from './mockData';
