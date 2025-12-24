/**
 * AddContextModal - Collect missing context from user
 *
 * When the Council identifies missing information during deliberation,
 * this modal allows the user to provide that information.
 * The response is then merged into company/department context for future use.
 *
 * Supports two modes:
 * 1. Text input for open-ended questions
 * 2. Yes/No toggle for binary questions (swipeable on mobile)
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AppModal } from '../ui/AppModal';
import { Button } from '../ui/button';
import { AIWriteAssist } from '../ui/AIWriteAssist';
import { logger } from '../../utils/logger';
import './AddContextModal.css';

/**
 * Detect if a question is Yes/No based on common patterns
 */
function isYesNoQuestion(question) {
  if (!question) return false;
  const q = question.toLowerCase().trim();

  // Common yes/no question starters
  const yesNoPatterns = [
    /^do you/,
    /^does your/,
    /^did you/,
    /^have you/,
    /^has your/,
    /^is your/,
    /^is there/,
    /^are you/,
    /^are there/,
    /^can you/,
    /^could you/,
    /^would you/,
    /^will you/,
    /^should/,
    /^was there/,
    /^were there/,
  ];

  return yesNoPatterns.some(pattern => pattern.test(q));
}

// Simple, friendly SVG icons
const SparkleIcon = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
  </svg>
);

const CompanyIcon = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 3v18"/>
    <path d="M3 9h6"/>
    <path d="M3 15h6"/>
    <circle cx="16" cy="12" r="2"/>
  </svg>
);

const TeamIcon = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="3"/>
    <circle cx="6" cy="14" r="2.5"/>
    <circle cx="18" cy="14" r="2.5"/>
    <path d="M12 11v2"/>
    <path d="M8.5 15.5L10 14"/>
    <path d="M15.5 15.5L14 14"/>
  </svg>
);

const CheckCircleIcon = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

/**
 * YesNoToggle - Swipeable Yes/No selector
 * Works with mouse drag and touch swipe
 */
function YesNoToggle({ value, onChange, disabled }) {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);

  // Handle touch/mouse start
  const handleStart = (clientX) => {
    if (disabled) return;
    setIsDragging(true);
    startX.current = clientX;
    setDragX(0);
  };

  // Handle touch/mouse move
  const handleMove = (clientX) => {
    if (!isDragging || disabled) return;
    const delta = clientX - startX.current;
    // Clamp drag to reasonable range
    setDragX(Math.max(-100, Math.min(100, delta)));
  };

  // Handle touch/mouse end
  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Determine selection based on drag direction
    if (dragX > 30) {
      onChange('Yes');
    } else if (dragX < -30) {
      onChange('No');
    }
    setDragX(0);
  };

  // Touch events
  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  // Mouse events
  const onMouseDown = (e) => handleStart(e.clientX);
  const onMouseMove = (e) => { if (isDragging) handleMove(e.clientX); };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => { if (isDragging) handleEnd(); };

  return (
    <div className="yesno-toggle-container">
      <p className="yesno-hint">Tap or swipe to answer</p>
      <div
        ref={trackRef}
        className={`yesno-toggle ${isDragging ? 'dragging' : ''} ${value ? 'has-value' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{ '--drag-x': `${dragX}px` }}
      >
        <button
          type="button"
          className={`yesno-btn yesno-no ${value === 'No' ? 'selected' : ''}`}
          onClick={() => !disabled && onChange('No')}
          disabled={disabled}
        >
          <span className="yesno-icon">✗</span>
          <span>No</span>
        </button>

        <div className="yesno-divider">
          <span className="yesno-or">or</span>
        </div>

        <button
          type="button"
          className={`yesno-btn yesno-yes ${value === 'Yes' ? 'selected' : ''}`}
          onClick={() => !disabled && onChange('Yes')}
          disabled={disabled}
        >
          <span className="yesno-icon">✓</span>
          <span>Yes</span>
        </button>
      </div>
    </div>
  );
}

export function AddContextModal({
  isOpen,
  onClose,
  question,           // The detected gap/question
  suggestedField: _suggestedField, // What type of info this is (reserved for future categorization)
  companyName,        // Company name for context
  departments = [],   // Available departments for scope selection
  onSave              // Called with { response, scope, departmentId }
}) {
  const [response, setResponse] = useState('');
  const [scope, setScope] = useState('company'); // 'company' or 'department'
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setResponse('');
      setScope('company');
      setSelectedDepartment(departments.length > 0 ? departments[0].id : '');
    }
  }, [isOpen, departments]);

  const handleSave = async () => {
    if (!response.trim() || !onSave) return;
    if (scope === 'department' && !selectedDepartment) return;

    setIsSaving(true);
    try {
      await onSave({
        response: response.trim(),
        scope,
        departmentId: scope === 'department' ? selectedDepartment : null
      });
      setResponse('');
      onClose();
    } catch (error) {
      logger.error('Failed to save context:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setResponse('');
      onClose();
    }
  };

  // Find selected department name for display
  const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name || 'this team';

  // Detect if this is a yes/no question
  const isBinaryQuestion = isYesNoQuestion(question);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Help Us Help You Better"
      size="md"
      closeOnOverlayClick={!isSaving}
    >
      <div className="add-context-modal">
        {/* Friendly explanation */}
        <div className="acm-explanation">
          <SparkleIcon className="acm-icon" size={20} />
          <p>
            To give you better advice, we'd love to know:
          </p>
        </div>

        {/* The question - what we need to know */}
        <div className="acm-question">
          "{question}"
        </div>

        {/* Response input - different UI for yes/no vs text */}
        {isBinaryQuestion ? (
          /* Yes/No toggle for binary questions */
          <div className="acm-input-section">
            <YesNoToggle
              value={response}
              onChange={setResponse}
              disabled={isSaving}
            />
          </div>
        ) : (
          /* Text input for open-ended questions */
          <div className="acm-input-section">
            <label className="acm-label">Tell us in your own words</label>
            <p className="acm-label-hint">Write a few sentences, or just keywords — our AI can help you polish it.</p>
            <AIWriteAssist
              context="company-context"
              value={response}
              onSuggestion={setResponse}
              additionalContext={companyName ? `Company: ${companyName}` : ''}
              buttonLabel="Write it nicely for me"
            >
              <textarea
                className="acm-textarea"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Example: We have 50 employees, mostly in sales and engineering..."
                rows={4}
                autoFocus
                disabled={isSaving}
              />
            </AIWriteAssist>
          </div>
        )}

        {/* Scope selector - where should we remember this? */}
        <div className="acm-scope-section">
          <label className="acm-label">Where should we remember this?</label>
          <div className="acm-scope-options">
            <button
              type="button"
              className={`acm-scope-btn ${scope === 'company' ? 'active' : ''}`}
              onClick={() => setScope('company')}
              disabled={isSaving}
            >
              <CompanyIcon size={24} />
              <span className="acm-scope-title">Whole Company</span>
              <span className="acm-scope-hint">Use this info for all my questions</span>
            </button>

            {departments.length > 0 && (
              <button
                type="button"
                className={`acm-scope-btn ${scope === 'department' ? 'active' : ''}`}
                onClick={() => setScope('department')}
                disabled={isSaving}
              >
                <TeamIcon size={24} />
                <span className="acm-scope-title">Just One Team</span>
                <span className="acm-scope-hint">Only for questions about this team</span>
              </button>
            )}
          </div>

          {/* Department selector when team scope is chosen */}
          {scope === 'department' && departments.length > 0 && (
            <div className="acm-department-selector">
              <label className="acm-dept-label">Which team?</label>
              <select
                className="acm-department-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={isSaving}
              >
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* What happens next - clear benefit */}
        <div className="acm-benefit">
          <CheckCircleIcon size={16} className="acm-benefit-icon" />
          <span>
            {scope === 'company'
              ? "Once saved, we'll automatically use this info whenever you ask us anything"
              : `Once saved, we'll use this when you ask about ${selectedDeptName}`
            }
          </span>
        </div>
      </div>

      <AppModal.Footer>
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={isSaving}
        >
          Maybe later
        </Button>
        <Button
          variant="default"
          onClick={handleSave}
          disabled={!response.trim() || isSaving || (scope === 'department' && !selectedDepartment)}
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="acm-spinner" />
              Saving...
            </>
          ) : (
            'Save this'
          )}
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}

export default AddContextModal;
