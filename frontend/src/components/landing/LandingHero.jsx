/**
 * LandingHero - Perplexity-style landing page with omni-bar
 *
 * Intent-first design: single input, minimal cognitive load, maximum clarity.
 * User types their question first, context is secondary.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { AuroraBackground } from '../ui/aurora-background';
import { ContextChip } from './ContextChip';
import { QuickActionChips } from './QuickActionChips';
import './LandingHero.css';

// Rotating placeholder examples
const PLACEHOLDER_EXAMPLES = [
  "How should I price my SaaS product?",
  "Draft a response to this customer complaint...",
  "What's the best approach to entering a new market?",
  "Review this contract for potential risks...",
  "Help me plan a product launch strategy",
  "How do I handle a difficult employee situation?",
];

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
  onUpdatePreferences,
  // Mode
  chatMode = 'council',
  onChatModeChange,
  // Submit handler
  onSubmit,
  isLoading = false,
}) {
  const [input, setInput] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showSubmitButton, setShowSubmitButton] = useState(false);
  const textareaRef = useRef(null);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Show submit button when user starts typing
  useEffect(() => {
    setShowSubmitButton(input.trim().length > 0);
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to focus input
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (input.trim() && !isLoading && onSubmit) {
      onSubmit(input.trim(), chatMode);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (prompt) => {
    setInput(prompt);
    textareaRef.current?.focus();
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
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo and headline */}
        <motion.div
          className="landing-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="landing-logo">
            <span className="landing-logo-text">AxCouncil</span>
          </div>
          <h1 className="landing-headline">
            What high-stakes decision can we help you solve?
          </h1>
        </motion.div>

        {/* Omni-bar */}
        <motion.form
          className="omni-bar-container"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div className={`omni-bar ${input.trim() ? 'has-content' : ''} ${isLoading ? 'is-loading' : ''}`}>
            <TextareaAutosize
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
              className="omni-bar-input"
              minRows={1}
              maxRows={6}
              disabled={isLoading}
            />

            {/* Keyboard shortcut hint */}
            <AnimatePresence>
              {!input.trim() && !isLoading && (
                <motion.kbd
                  className="omni-bar-kbd"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  ⌘K
                </motion.kbd>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSubmitButton && (
                <motion.button
                  type="submit"
                  className="omni-bar-submit"
                  disabled={isLoading || !input.trim()}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isLoading ? (
                    <svg className="omni-bar-spinner" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Controls row */}
          <motion.div
            className="omni-bar-controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            {/* Mode toggle */}
            <div className="mode-toggle-landing">
              <button
                type="button"
                className={`mode-btn-landing ${chatMode === 'chat' ? 'active' : ''}`}
                onClick={() => onChatModeChange?.('chat')}
              >
                Quick
              </button>
              <button
                type="button"
                className={`mode-btn-landing ${chatMode === 'council' ? 'active' : ''}`}
                onClick={() => onChatModeChange?.('council')}
              >
                Full Council
              </button>
            </div>

            {/* Context chip */}
            <ContextChip
              displayText={getContextDisplayText()}
              isSmartAuto={!selectedBusiness}
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
              onUpdatePreferences={onUpdatePreferences}
            />
          </motion.div>
        </motion.form>

        {/* Quick action chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <QuickActionChips onSelect={handleQuickAction} />
        </motion.div>
      </motion.div>
    </AuroraBackground>
  );
}

export default LandingHero;
