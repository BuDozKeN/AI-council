/**
 * LandingHero - Perplexity-style landing page with omni-bar
 *
 * Intent-first design: single input, minimal cognitive load, maximum clarity.
 * User types their question first, context is secondary.
 * Now uses shared OmniBar component for visual consistency with in-app experience.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AuroraBackground } from '../ui/aurora-background';
import { OmniBar } from '../shared';
import { ContextChip } from './ContextChip';
import { QuickActionChips } from './QuickActionChips';
import { springs, springWithDelay } from '../../lib/animations';
import type { Business, Department, Role, Project, Playbook, UserPreferences } from '../../types/business';
import './LandingHero.css';

interface LandingHeroProps {
  // Context state
  businesses?: Business[];
  selectedBusiness: string | null;
  onSelectBusiness: (id: string | null) => void;
  departments?: Department[];
  selectedDepartments?: string[];
  onSelectDepartments: (ids: string[]) => void;
  allRoles?: Role[];
  selectedRoles?: string[];
  onSelectRoles: (ids: string[]) => void;
  projects?: Project[];
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks: (ids: string[]) => void;
  // User preferences
  userPreferences: UserPreferences | null;
  onUpdatePreferences?: (prefs: Partial<UserPreferences>) => void;
  // Mode
  chatMode?: 'chat' | 'council';
  onChatModeChange: (mode: 'chat' | 'council') => void;
  // Submit handler
  onSubmit: (content: string, mode?: string) => void;
  isLoading?: boolean;
}

export function LandingHero({
  // Context state
  businesses = [],
  selectedBusiness,
  onSelectBusiness,
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  allRoles = [],
  selectedRoles = [],
  onSelectRoles,
  projects = [],
  selectedProject,
  onSelectProject,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  // User preferences
  userPreferences,
  onUpdatePreferences: _onUpdatePreferences,
  // Mode
  chatMode = 'council',
  onChatModeChange,
  // Submit handler
  onSubmit,
  isLoading = false,
}: LandingHeroProps) {
  const [input, setInput] = useState('');

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  // Get Smart Auto hint text (shows last-used context when no explicit selection)
  const getSmartAutoHint = () => {
    if (!userPreferences?.last_company_id) return null;
    const company = businesses.find(b => b.id === userPreferences.last_company_id);
    if (!company) return null;
    return company.name;
  };

  // Get current context display text
  const getContextDisplayText = () => {
    if (!selectedBusiness) return 'Smart Auto';

    const company = businesses.find(b => b.id === selectedBusiness);
    const companyName = company?.name || 'Company';

    if (selectedRoles.length > 0) {
      const role = allRoles.find(r => selectedRoles.includes(r.id));
      if (role) return `${companyName} · ${role.name}`;
    }

    if (selectedDepartments.length > 0) {
      const dept = departments.find(d => selectedDepartments.includes(d.id));
      if (dept) return `${companyName} · ${dept.name}`;
    }

    return companyName;
  };

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
            What high-stakes decision can we help you solve?
          </h1>
        </motion.div>

        {/* Shared OmniBar Component */}
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
            showShortcutHint={true}
            autoFocus={true}
          />

          {/* Controls row: Mode toggle (left) + Context chip (right) */}
          <motion.div
            className="omni-bar-controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springWithDelay('smooth', 0.25)}
          >
            {/* Mode toggle - left side */}
            <div className="mode-toggle-landing">
              <button
                type="button"
                className={`mode-btn-landing ${chatMode === 'chat' ? 'active' : ''}`}
                onClick={() => onChatModeChange('chat')}
              >
                Quick
              </button>
              <button
                type="button"
                className={`mode-btn-landing ${chatMode === 'council' ? 'active' : ''}`}
                onClick={() => onChatModeChange('council')}
              >
                Full Council
              </button>
            </div>

            {/* Context chip - right side */}
            <ContextChip
              displayText={getContextDisplayText()}
              isSmartAuto={!selectedBusiness}
              smartAutoHint={getSmartAutoHint()}
              businesses={businesses}
              selectedBusiness={selectedBusiness}
              onSelectBusiness={onSelectBusiness}
              departments={departments}
              selectedDepartments={selectedDepartments}
              onSelectDepartments={onSelectDepartments}
              allRoles={allRoles}
              selectedRoles={selectedRoles}
              onSelectRoles={onSelectRoles}
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={onSelectProject}
              playbooks={playbooks}
              selectedPlaybooks={selectedPlaybooks}
              onSelectPlaybooks={onSelectPlaybooks}
              userPreferences={userPreferences}
            />
          </motion.div>
        </motion.div>

        {/* Quick action chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springWithDelay('smooth', 0.35)}
        >
          <QuickActionChips onSelect={handleQuickAction} />
        </motion.div>
      </motion.div>
    </AuroraBackground>
  );
}

export default LandingHero;
