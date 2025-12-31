/**
 * LandingHero - Perplexity-style landing page with omni-bar
 *
 * Intent-first design: single input, minimal cognitive load, maximum clarity.
 * User types their question first, context is secondary.
 * Uses shared OmniBar component with context icons INSIDE the bar.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AuroraBackground } from '../ui/aurora-background';
import { OmniBar } from '../shared';
import { springs, springWithDelay } from '../../lib/animations';
import type { Business, Department, Role, Playbook } from '../../types/business';
import './LandingHero.css';

interface LandingHeroProps {
  // Company selection (passed to OmniBar icons)
  businesses?: Business[];
  selectedBusiness?: string | null;
  onSelectBusiness: (id: string | null) => void;
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
  isLoading?: boolean;
}

export function LandingHero({
  // Company selection
  businesses = [],
  selectedBusiness = null,
  onSelectBusiness,
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
  isLoading = false,
}: LandingHeroProps) {
  const [input, setInput] = useState('');

  // Filter roles to those belonging to selected departments
  const availableRoles = allRoles.filter(
    (role) =>
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
            The only AI worth <span className="headline-emphasis">trusting.</span>
          </h1>
          <div className="landing-stats">
            <div className="stat-pill">
              <span className="stat-number">5</span>
              <span className="stat-label">AIs</span>
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
              <span className="stat-number">3</span>
              <span className="stat-label">rounds</span>
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
              <span className="stat-label">answer</span>
            </div>
          </div>
        </motion.div>

        {/* OmniBar with context icons INSIDE */}
        <motion.div
          className="omni-bar-container"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springWithDelay('smooth', 0.15)}
        >
          <OmniBar
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            isLoading={isLoading}
            chatMode={chatMode}
            onChatModeChange={onChatModeChange}
            variant="landing"
            showModeToggle={false}
            showImageButton={false}
            showShortcutHint={false}
            autoFocus={true}
            // Context icons (inside the bar like ChatInput)
            showContextIcons={true}
            // Company selection
            businesses={businesses}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={onSelectBusiness}
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
          />
        </motion.div>
      </motion.div>
    </AuroraBackground>
  );
}

export default LandingHero;
