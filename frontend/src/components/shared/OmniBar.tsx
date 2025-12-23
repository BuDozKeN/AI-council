/**
 * OmniBar - Unified input component for landing hero and in-app chat
 *
 * Provides a consistent, premium input experience across the app.
 * Used in both the landing page hero and the chat interface.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, StopCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import './OmniBar.css';

// Rotating placeholder examples for empty state
const PLACEHOLDER_EXAMPLES = [
  "How should I price my SaaS product?",
  "Draft a response to this customer complaint...",
  "What's the best approach to entering a new market?",
  "Review this contract for potential risks...",
  "Help me plan a product launch strategy",
  "How do I handle a difficult employee situation?",
];

export function OmniBar({
  // Core input state
  value = '',
  onChange,
  onSubmit,

  // Loading/streaming state
  isLoading = false,
  onStop,

  // Mode configuration
  chatMode = 'council',
  onChatModeChange,
  showModeToggle = true,

  // Appearance variants
  variant = 'default', // 'default' | 'landing' | 'compact'
  placeholder,

  // Image upload support
  hasImages = false,
  onImageClick,
  showImageButton = true,

  // Keyboard shortcuts
  showShortcutHint = true,

  // Auto-focus
  autoFocus = false,

  // Additional className
  className = '',
}) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const textareaRef = useRef(null);

  // Rotate placeholder text
  useEffect(() => {
    if (variant !== 'landing' || value.trim()) return;

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [variant, value]);

  // Focus on mount if autoFocus
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

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
    if ((value.trim() || hasImages) && !isLoading && onSubmit) {
      onSubmit(value.trim(), chatMode);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const currentPlaceholder = placeholder ||
    (variant === 'landing' ? PLACEHOLDER_EXAMPLES[placeholderIndex] :
     chatMode === 'chat' ? "Quick follow-up..." : "Ask the council...");

  const hasContent = value.trim().length > 0 || hasImages;

  const containerClasses = `
    omni-bar-wrapper
    ${variant === 'landing' ? 'omni-bar-landing' : ''}
    ${variant === 'compact' ? 'omni-bar-compact' : ''}
    ${hasContent ? 'has-content' : ''}
    ${isLoading ? 'is-loading' : ''}
    ${className}
  `.trim();

  return (
    <div className={containerClasses}>
      {/* Mode toggle - only for landing variant */}
      {showModeToggle && variant === 'landing' && onChatModeChange && (
        <div className="omni-mode-toggle">
          <button
            type="button"
            className={`omni-mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
            onClick={() => onChatModeChange('chat')}
          >
            Quick
          </button>
          <button
            type="button"
            className={`omni-mode-btn ${chatMode === 'council' ? 'active' : ''}`}
            onClick={() => onChatModeChange('council')}
          >
            Full Council
          </button>
        </div>
      )}

      <div className="omni-bar">
        {/* Image attach button */}
        {showImageButton && onImageClick && (
          <button
            type="button"
            className="omni-attach-btn"
            onClick={onImageClick}
            disabled={isLoading}
            title="Attach images"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
        )}

        <TextareaAutosize
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentPlaceholder}
          className="omni-bar-input"
          minRows={1}
          maxRows={6}
          disabled={isLoading}
        />

        {/* Keyboard shortcut hint */}
        <AnimatePresence>
          {showShortcutHint && !hasContent && !isLoading && variant === 'landing' && (
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

        {/* Submit/Stop button */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.button
              key="stop"
              type="button"
              className="omni-bar-submit omni-bar-stop"
              onClick={onStop}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <StopCircle className="h-5 w-5" />
            </motion.button>
          ) : hasContent ? (
            <motion.button
              key="submit"
              type="submit"
              className="omni-bar-submit"
              disabled={!hasContent}
              onClick={handleSubmit}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Send className="h-5 w-5" />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default OmniBar;
