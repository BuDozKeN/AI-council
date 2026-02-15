/**
 * LandingHero - Perplexity-style landing page with omni-bar
 *
 * Intent-first design: single input, minimal cognitive load, maximum clarity.
 * User types their question first, context is secondary.
 * Uses shared OmniBar component with context icons INSIDE the bar.
 *
 * Stats are fetched dynamically from the backend to reflect LLM Hub configuration.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AuroraBackground } from '../ui/aurora-background';
import { OmniBar } from '../shared';
import ImageUpload from '../ImageUpload';
import { springs, springWithDelay } from '../../lib/animations';
import { useCouncilStats } from '../../hooks/useCouncilStats';
import type { Business, Department, Role, Playbook, Project } from '../../types/business';
import './LandingHero.css';
import '../ImageUpload.css';

// Image upload type (matching ImageUpload.tsx)
interface UploadedImage {
  file: File;
  preview: string;
  name: string;
  size: number;
  type: string;
}

interface LandingHeroProps {
  // Company selection (passed to OmniBar icons)
  businesses?: Business[];
  selectedBusiness?: string | null;
  onSelectBusiness: (id: string | null) => void;
  // Project selection (passed to OmniBar icons)
  projects?: Project[];
  selectedProject?: string | null;
  onSelectProject: (id: string | null) => void;
  // Context selection (passed to OmniBar icons)
  departments?: Department[];
  selectedDepartments?: string[];
  onSelectDepartments: (ids: string[]) => void;
  allRoles?: Role[];
  selectedRoles?: string[];
  onSelectRoles: (ids: string[]) => void;
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks: (ids: string[]) => void;
  // Mode
  chatMode?: 'chat' | 'council';
  onChatModeChange: (mode: 'chat' | 'council') => void;
  // Submit handler
  onSubmit: (content: string, mode?: string) => void;
  // Reset all selections
  onResetAll?: () => void;
  isLoading?: boolean;
  // Response style selector (LLM preset)
  selectedPreset?: import('../../types/business').LLMPresetId | null;
  departmentPreset?: import('../../types/business').LLMPresetId;
  onSelectPreset?: (preset: import('../../types/business').LLMPresetId | null) => void;
  onOpenLLMHub?: () => void;
  // Image upload (passed up to App for submission)
  attachedImages?: UploadedImage[];
  onImagesChange?: (images: UploadedImage[]) => void;
  // Navigation sheet (swipe-up gesture on mobile)
  onOpenNavigation?: {
    onNewChat: () => void;
    onOpenHistory: () => void;
    onOpenLeaderboard: () => void;
    onOpenMyCompany: () => void;
    onOpenSettings: () => void;
  };
}

export function LandingHero({
  // Company selection
  businesses = [],
  selectedBusiness = null,
  onSelectBusiness,
  // Project selection
  projects = [],
  selectedProject = null,
  onSelectProject,
  // Context selection
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  allRoles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  // Mode
  chatMode = 'council',
  onChatModeChange,
  // Submit handler
  onSubmit,
  // Reset all selections
  onResetAll,
  isLoading = false,
  // Response style selector
  selectedPreset = null,
  departmentPreset = 'balanced',
  onSelectPreset,
  onOpenLLMHub,
  // Image upload
  attachedImages = [],
  onImagesChange,
}: LandingHeroProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  // Image upload hook (only if onImagesChange is provided)
  const imageUpload = ImageUpload({
    images: attachedImages,
    onImagesChange: onImagesChange || (() => {}),
    disabled: isLoading,
    maxImages: 5,
    maxSizeMB: 10,
  });

  // Dynamic council stats from LLM Hub configuration (per-company, cached)
  const { aiCount, rounds } = useCouncilStats(selectedBusiness);

  // Filter roles to those belonging to selected departments
  // IMPORTANT: Always include selected roles even if they're from a different department
  // This prevents the confusing UX where selected items disappear from the list
  const availableRoles = allRoles.filter(
    (role) =>
      selectedRoles.includes(role.id) || // Always show selected roles
      selectedDepartments.length === 0 ||
      (role.departmentId && selectedDepartments.includes(role.departmentId))
  );

  return (
    <AuroraBackground className="landing-hero-aurora">
      <motion.div
        className="landing-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
      >
        {/* Logo and headline */}
        <motion.div
          className="landing-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springWithDelay('smooth', 0.1)}
        >
          <div className="landing-logo">
            <span className="landing-logo-text">AxCouncil</span>
          </div>
          <h1 className="landing-headline">
            {t('landing.headline')}{' '}
            <span className="headline-emphasis">{t('landing.headlineEmphasis')}</span>
          </h1>
          <div className="landing-stats">
            <div className="stat-pill">
              <span className="stat-number">{aiCount}</span>
              <span className="stat-label">
                {aiCount === 1 ? t('landing.statsAI') : t('landing.statsAIs')}
              </span>
            </div>
            <svg className="stat-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14m-4-4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="stat-pill">
              <span className="stat-number">{rounds}</span>
              <span className="stat-label">
                {rounds === 1 ? t('landing.statsRound') : t('landing.statsRounds')}
              </span>
            </div>
            <svg className="stat-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14m-4-4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="stat-pill stat-pill-highlight">
              <span className="stat-number">1</span>
              <span className="stat-label">{t('landing.statsAnswer')}</span>
            </div>
          </div>
        </motion.div>

        {/* OmniBar with context icons INSIDE */}
        <motion.div
          className={`omni-bar-container ${imageUpload.isDragging ? 'dragging' : ''}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springWithDelay('smooth', 0.15)}
          {...(onImagesChange ? imageUpload.dropZoneProps : {})}
        >
          {/* Drag overlay for image drop */}
          {onImagesChange && imageUpload.dragOverlay}
          {/* Hidden file input */}
          {onImagesChange && imageUpload.fileInput}
          {/* Image error display */}
          {onImagesChange && imageUpload.errorDisplay}
          {/* Image previews */}
          {onImagesChange && imageUpload.previews}

          <OmniBar
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            isLoading={isLoading}
            chatMode={chatMode}
            onChatModeChange={onChatModeChange}
            variant="landing"
            showModeToggle={false}
            showImageButton={!!onImagesChange}
            onImageClick={onImagesChange ? imageUpload.openFilePicker : undefined}
            hasImages={attachedImages.length > 0}
            showShortcutHint={false}
            autoFocus={false} // Disabled to allow skip-to-main-content link to work (ISS-010)
            // Context icons (inside the bar like ChatInput)
            showContextIcons={true}
            // Company selection
            businesses={businesses}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={onSelectBusiness}
            // Project selection
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            // Departments, roles, playbooks
            departments={departments}
            selectedDepartments={selectedDepartments}
            onSelectDepartments={onSelectDepartments}
            roles={availableRoles}
            selectedRoles={selectedRoles}
            onSelectRoles={onSelectRoles}
            playbooks={playbooks}
            selectedPlaybooks={selectedPlaybooks}
            onSelectPlaybooks={onSelectPlaybooks}
            onResetAll={onResetAll}
            // Response style selector (compact icon)
            selectedPreset={selectedPreset}
            departmentPreset={departmentPreset}
            onSelectPreset={onSelectPreset}
            onOpenLLMHub={onOpenLLMHub}
          />

          {/* Keyboard shortcut hint */}
          <p className="keyboard-hint">
            {navigator.platform?.includes('Mac')
              ? t('landing.shortcutHint')
              : t('landing.shortcutHintWindows')}
          </p>
        </motion.div>
      </motion.div>
    </AuroraBackground>
  );
}

export default LandingHero;
