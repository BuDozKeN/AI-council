/**
 * OnboardingFlow - Zero Friction Onboarding
 *
 * A single component that orchestrates the 4-step onboarding flow:
 * 1. input - Paste LinkedIn URL
 * 2. loading - "Magic Mirror" construction animation
 * 3. preview - Show council + magic question
 * 4. ready - CTA to start deliberation
 *
 * PRINCIPLE: Reuses existing UI components. No new components created.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, MotionStyle } from 'framer-motion';
import {
  Crown,
  Settings,
  Rocket,
  Code,
  Lightbulb,
  Server,
  Check,
  Linkedin,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { FormField, Input } from '../ui/FormField';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { logger } from '../../utils/logger';
import { springs } from '../../lib/animations';
import { api, OnboardingProfileResponse } from '../../api';
import { useAuth } from '../../AuthContext';
import type { OnboardingProfile, OnboardingStep } from './types';
import { MOCK_PROFILE_AGENCY, COUNCIL_MEMBERS } from './mockData';
import { SoftGateModal } from './SoftGateModal';
import { HardGateModal } from './HardGateModal';
import { ClaudeIcon, ChatGPTIcon, GeminiIcon, GrokIcon, DeepSeekIcon } from '../icons/BrandIcons';
import './OnboardingFlow.css';

// Map provider to icon component
const PROVIDER_ICONS: Record<string, React.ElementType> = {
  anthropic: ClaudeIcon,
  openai: ChatGPTIcon,
  google: GeminiIcon,
  xai: GrokIcon,
  deepseek: DeepSeekIcon,
};

// Icon mapping for departments
const DEPARTMENT_ICONS: Record<string, React.ElementType> = {
  crown: Crown,
  settings: Settings,
  rocket: Rocket,
  code: Code,
  lightbulb: Lightbulb,
  server: Server,
};

interface OnboardingFlowProps {
  /** Called when user completes onboarding and wants to start deliberation */
  onComplete: (profile: OnboardingProfile, question: string) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  // Query params for testing mode
  const [searchParams] = useSearchParams();
  const isFreshMode = useMemo(() => searchParams.get('fresh') === '1', [searchParams]);

  // Auth context
  const { user, getAccessToken } = useAuth();

  // State machine
  const [step, setStep] = useState<OnboardingStep>('input');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  // Track thin profiles for fallback form (TODO: implement in Batch 2)
  const [_isThinProfile, setIsThinProfile] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // Track if we're using mock data (to prevent overwriting real user profile)
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  // Gate modal state
  const [showSoftGate, setShowSoftGate] = useState(false);
  const [showHardGate, setShowHardGate] = useState(false);
  const [hardGateReason, setHardGateReason] = useState<'trial_exhausted' | 'no_api_key'>(
    'trial_exhausted'
  );

  // Refs for animation timing and API call tracking
  const loadingIntervalRef = useRef<number | null>(null);
  const apiCallInProgressRef = useRef(false);

  // Validate LinkedIn URL
  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError('Please enter your LinkedIn URL');
      return false;
    }
    if (!url.includes('linkedin.com/in/')) {
      setUrlError('Please enter a valid LinkedIn profile URL (linkedin.com/in/...)');
      return false;
    }
    setUrlError('');
    return true;
  };

  // Convert API response to OnboardingProfile
  const convertApiResponse = (response: OnboardingProfileResponse): OnboardingProfile | null => {
    if (!response.success || !response.profile) {
      return null;
    }
    return {
      full_name: response.profile.full_name,
      role: response.profile.role,
      company: response.profile.company,
      industry: response.profile.industry,
      employees: response.profile.employees,
      bio: response.profile.bio,
      magic_question: response.profile.magic_question,
      departments: response.profile.departments,
    };
  };

  // Handle URL submission
  const handleSubmit = useCallback(async () => {
    if (!validateUrl(linkedInUrl)) return;
    if (apiCallInProgressRef.current) return;

    // Reset error state
    setApiError(null);
    setIsThinProfile(false);
    setIsUsingMockData(false); // Real data from API

    // Reset loading step for animation
    setCurrentLoadingStep(0);

    // Transition to loading
    setStep('loading');

    // Start API call
    apiCallInProgressRef.current = true;
    try {
      const response = await api.analyzeLinkedInProfile(linkedInUrl);

      // Check for API-level errors
      if (!response.success) {
        setApiError(response.error || 'Failed to analyze profile');
        return;
      }

      const profileData = convertApiResponse(response);
      if (!profileData) {
        setApiError('Failed to process profile data');
        return;
      }

      setProfile(profileData);
      setIsThinProfile(response.fallback_required);
    } catch (error) {
      logger.error('Failed to analyze profile:', error);
      setApiError(error instanceof Error ? error.message : 'Failed to analyze profile');
      // Stay on loading step - the error will be shown
    } finally {
      apiCallInProgressRef.current = false;
    }
  }, [linkedInUrl]);

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Handle "Skip for now" - use mock data to demo the flow
  const handleSkipWithMock = useCallback(() => {
    // Clear any previous error state
    setApiError(null);

    // IMPORTANT: Mark as mock data to prevent overwriting real user profile
    setIsUsingMockData(true);

    // Use mock profile to demonstrate the flow
    const mockProfile = MOCK_PROFILE_AGENCY;
    setProfile(mockProfile);

    // Reset loading step for animation
    setCurrentLoadingStep(0);

    // Transition to loading (will auto-advance to preview)
    setStep('loading');
  }, []);

  // Animate loading steps
  useEffect(() => {
    if (step !== 'loading') return;

    // If there's an error, don't animate
    if (apiError) return;

    // Clear any existing interval
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
    }

    // Progress through council members (5 members)
    // We use totalMembers + 1 to allow the last member (DeepSeek) to have its full "active" time
    // Step 0-4: Each member is active in turn
    // Step 5: All members recruited, transition to preview
    const totalMembers = COUNCIL_MEMBERS.length;
    loadingIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingStep((prev) => {
        const next = prev + 1;
        if (next > totalMembers) {
          // Animation complete - all members have had their time
          if (loadingIntervalRef.current) {
            clearInterval(loadingIntervalRef.current);
          }
          // Only transition to preview if we have profile data
          if (profile) {
            setTimeout(() => setStep('preview'), 800);
          }
          return prev;
        }
        return next;
      });
    }, 2000); // 2s per council member = ~12s total for premium feel

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [step, profile, apiError]);

  // Handle when API completes but animation already finished
  useEffect(() => {
    // Only transition when we've gone PAST the last member (step 5+)
    // This ensures DeepSeek (index 4) gets its full active time
    if (
      step === 'loading' &&
      profile &&
      currentLoadingStep > COUNCIL_MEMBERS.length - 1 &&
      !apiError
    ) {
      // Animation finished and API succeeded - transition to preview
      setTimeout(() => setStep('preview'), 500);
    }
  }, [step, profile, currentLoadingStep, apiError]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    setApiError(null);
    setStep('input');
    setCurrentLoadingStep(0);
    setProfile(null);
  }, []);

  // Check trial status and proceed with deliberation
  const checkTrialAndProceed = useCallback(async () => {
    if (!profile) return;

    // Fresh mode: skip trial check entirely (for testing)
    if (isFreshMode) {
      onComplete(profile, profile.magic_question);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        // Should not happen if user is authenticated, but handle gracefully
        setShowSoftGate(true);
        return;
      }

      // Check trial status
      const trialStatus = await api.getTrialStatus(token);

      if (trialStatus.has_trial_available) {
        // Trial available - proceed!
        onComplete(profile, profile.magic_question);
      } else if (trialStatus.has_api_key) {
        // Has API key - proceed!
        onComplete(profile, profile.magic_question);
      } else {
        // No trial, no API key - show hard gate
        setHardGateReason('trial_exhausted');
        setShowHardGate(true);
      }
    } catch (error) {
      logger.error('Failed to check trial status:', error);
      // On error, show hard gate as fallback
      setHardGateReason('no_api_key');
      setShowHardGate(true);
    }
  }, [profile, getAccessToken, onComplete, isFreshMode]);

  // Handle start deliberation
  const handleStartDeliberation = useCallback(() => {
    if (!profile) return;

    // Fresh mode: skip auth check entirely (for UI testing)
    if (isFreshMode) {
      onComplete(profile, profile.magic_question);
      return;
    }

    // If not authenticated, show soft gate
    if (!user) {
      setShowSoftGate(true);
      return;
    }

    // User is authenticated - check trial status
    checkTrialAndProceed();
  }, [profile, user, checkTrialAndProceed, isFreshMode, onComplete]);

  // Handle successful authentication from soft gate
  const handleSoftGateAuthenticated = useCallback(async () => {
    setShowSoftGate(false);

    // CRITICAL: Only save profile data if it came from real LinkedIn analysis
    // Do NOT overwrite user's real profile with mock demo data
    if (profile && !isUsingMockData) {
      try {
        // Build profile update with only non-empty values
        const profileUpdate: Parameters<typeof api.updateProfile>[0] = {};
        if (profile.full_name) profileUpdate.display_name = profile.full_name;
        if (profile.company) profileUpdate.company = profile.company;
        if (profile.role) profileUpdate.role = profile.role;
        if (profile.bio) profileUpdate.bio = profile.bio;
        if (linkedInUrl) profileUpdate.linkedin_url = linkedInUrl;

        if (Object.keys(profileUpdate).length > 0) {
          await api.updateProfile(profileUpdate);
        }
      } catch (err) {
        // Non-blocking - don't prevent council from running if profile save fails
        logger.warn('Failed to save onboarding data to profile:', err);
      }
    } else if (isUsingMockData) {
      logger.info('Skipping profile save - using mock demo data');
    }

    // After auth, check trial and proceed
    checkTrialAndProceed();
  }, [checkTrialAndProceed, profile, linkedInUrl, isUsingMockData]);

  // Handle "Add API Key" from hard gate
  const handleAddApiKey = useCallback(() => {
    setShowHardGate(false);
    // Navigate to settings - this will be handled by the parent component
    // For now, just close the modal and let the user navigate manually
    // TODO: Pass a callback to open settings modal
  }, []);

  return (
    <div className="onboarding-flow">
      <AnimatePresence mode="wait">
        {/* STEP 1: LinkedIn Input */}
        {step === 'input' && (
          <motion.div
            key="input"
            className="onboarding-step onboarding-input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={springs.gentle}
          >
            <div className="onboarding-header">
              <Sparkles className="onboarding-icon" />
              <h1 className="onboarding-title">Build your personal AI Board of Directors</h1>
              <p className="onboarding-subtitle">in 30 seconds</p>
            </div>

            <Card className="onboarding-card">
              <CardContent className="onboarding-card-content">
                <FormField
                  label="Your LinkedIn Profile"
                  hint="We'll analyze your profile to create a personalized council"
                  error={urlError}
                >
                  <div className="onboarding-input-wrapper">
                    <Linkedin className="onboarding-input-icon" />
                    <Input
                      type="url"
                      value={linkedInUrl}
                      onChange={(e) => setLinkedInUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="https://linkedin.com/in/yourprofile"
                      inputMode="url"
                      autoComplete="url"
                      autoFocus
                    />
                  </div>
                </FormField>

                <div className="onboarding-actions">
                  <Button
                    onClick={handleSubmit}
                    disabled={!linkedInUrl.trim()}
                    className="onboarding-submit"
                  >
                    Assemble Council
                    <ArrowRight className="button-icon" />
                  </Button>
                  <Button variant="ghost" onClick={handleSkipWithMock} className="onboarding-skip">
                    Skip for now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Premium Council Assembly Loading */}
        {step === 'loading' && (
          <motion.div
            key="loading"
            className="onboarding-step onboarding-loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={springs.gentle}
          >
            {apiError ? (
              // Error state
              <Card className="onboarding-card onboarding-loading-card">
                <CardContent className="onboarding-card-content">
                  <div className="onboarding-error">
                    <AlertCircle className="onboarding-error-icon" />
                    <h2 className="onboarding-error-title">Unable to analyze profile</h2>
                    <p className="onboarding-error-message">{apiError}</p>
                  </div>
                  <div className="onboarding-actions">
                    <Button onClick={handleRetry} className="onboarding-submit">
                      Try Again
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleSkipWithMock}
                      className="onboarding-skip"
                    >
                      Skip for now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Premium loading state with council members
              <div className="council-assembly">
                <div className="council-assembly-header">
                  <motion.h2
                    className="council-assembly-title"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    Assembling Your Council
                  </motion.h2>
                  <motion.p
                    className="council-assembly-subtitle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    5 AI experts joining your board
                  </motion.p>
                </div>

                {/* Council members circle */}
                <div className="council-members-grid">
                  {COUNCIL_MEMBERS.map((member, index) => {
                    const isRevealed = currentLoadingStep > index;
                    const isActive = currentLoadingStep === index;
                    const IconComponent = PROVIDER_ICONS[member.provider];
                    // Grok (xai) has white brand color - needs dark icon when active
                    const isLightBg = member.provider === 'xai';

                    return (
                      <motion.div
                        key={member.id}
                        className={`council-member-card ${isRevealed ? 'revealed' : ''} ${isActive ? 'active' : ''} ${isLightBg ? 'light-bg' : ''}`}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{
                          opacity: isRevealed || isActive ? 1 : 0.3,
                          scale: isRevealed ? 1 : isActive ? 1.05 : 0.9,
                          y: 0,
                        }}
                        transition={{
                          duration: 0.5,
                          delay: index * 0.1,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{ '--member-color': member.color } as MotionStyle}
                      >
                        <div className={`council-member-avatar ${isActive ? 'pulsing' : ''}`}>
                          {IconComponent && <IconComponent size={28} />}
                        </div>
                        <div className="council-member-info">
                          <span className="council-member-name">{member.name}</span>
                          <span className="council-member-role">{member.role}</span>
                        </div>
                        {isRevealed && (
                          <motion.div
                            className="council-member-check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          >
                            <Check size={14} />
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Progress indicator */}
                <motion.div
                  className="council-progress"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="council-progress-bar">
                    <motion.div
                      className="council-progress-fill"
                      initial={{ width: '0%' }}
                      animate={{
                        width: `${Math.min(((currentLoadingStep + 1) / COUNCIL_MEMBERS.length) * 100, 100)}%`,
                      }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="council-progress-text">
                    {currentLoadingStep < COUNCIL_MEMBERS.length
                      ? `Recruiting ${COUNCIL_MEMBERS[currentLoadingStep]?.name}...`
                      : 'Council ready!'}
                  </span>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 3: Council Preview */}
        {step === 'preview' && profile && (
          <motion.div
            key="preview"
            className="onboarding-step onboarding-preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={springs.gentle}
          >
            <div className="onboarding-header">
              <h1 className="onboarding-welcome">Welcome, {profile.full_name.split(' ')[0]}.</h1>
              <p className="onboarding-welcome-sub">Your Council is assembled.</p>
            </div>

            {/* Departments Grid */}
            <div className="onboarding-departments">
              {profile.departments.map((dept, index) => {
                const IconComponent = DEPARTMENT_ICONS[dept.icon] || Settings;
                return (
                  <motion.div
                    key={dept.id}
                    className="onboarding-department"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="onboarding-department-icon">
                      <IconComponent />
                    </div>
                    <h3 className="onboarding-department-name">{dept.name}</h3>
                    <p className="onboarding-department-purpose">{dept.purpose}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Magic Question */}
            <Card className="onboarding-card onboarding-magic-question-card">
              <CardContent className="onboarding-card-content">
                <p className="onboarding-magic-intro">
                  Your Council has identified a strategic priority for {profile.company}:
                </p>
                <blockquote className="onboarding-magic-question">
                  {profile.magic_question}
                </blockquote>
                <Button
                  onClick={handleStartDeliberation}
                  size="lg"
                  className="onboarding-start-btn"
                >
                  <Sparkles />
                  Start Deliberation
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gate Modals */}
      <SoftGateModal
        isOpen={showSoftGate}
        onClose={() => setShowSoftGate(false)}
        companyName={profile?.company}
        onAuthenticated={handleSoftGateAuthenticated}
      />

      <HardGateModal
        isOpen={showHardGate}
        onClose={() => setShowHardGate(false)}
        onAddApiKey={handleAddApiKey}
        companyName={profile?.company}
        reason={hardGateReason}
      />
    </div>
  );
}

export default OnboardingFlow;
