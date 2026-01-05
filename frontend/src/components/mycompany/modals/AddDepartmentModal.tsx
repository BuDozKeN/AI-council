import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { Spinner } from '../../ui/Spinner';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { Sparkles, Check, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { logger } from '../../../utils/logger';
import { hapticSuccess } from '../../../lib/haptics';
import { CELEBRATION } from '../../../lib/animation-constants';
import '../../ProjectModal.css'; // Reuse ProjectModal styles

interface AddDepartmentModalProps {
  companyId: string;
  onSave: (name: string, description?: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Add Department Modal - Multi-step wizard with AI assistance
 *
 * Flow:
 * Option A: AI-assisted - describe department, AI structures it, review/edit, confirm
 * Option B: Manual - skip AI and enter everything directly
 *
 * Matches the ProjectModal pattern for consistent UX.
 */
export function AddDepartmentModal({ companyId, onSave, onClose }: AddDepartmentModalProps) {
  const { t } = useTranslation();

  // Step state: 'input', 'review', 'manual', or 'success'
  const [step, setStep] = useState<'input' | 'review' | 'manual' | 'success'>('input');

  // Input state (Step 1)
  const [freeText, setFreeText] = useState('');

  // AI result state / editable fields (Step 2)
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [suggestedRoles, setSuggestedRoles] = useState<string[]>([]);

  // UI state
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setIsAIGenerated] = useState(false);

  // Process with AI
  const processWithAI = async (text?: string) => {
    const inputText = text || freeText;
    if (!inputText.trim()) {
      setError(t('modals.tellUsAboutDepartment', 'Tell us about your department'));
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      const result = await api.structureDepartment(inputText, companyId);
      if (result?.structured) {
        setEditedName(result.structured.name || '');
        setEditedDescription(result.structured.description || '');
        setSuggestedRoles(result.structured.suggested_roles || []);
        setIsAIGenerated(true);
        setStep('review');
      } else {
        setError(t('modals.couldntUnderstand', "Couldn't understand the input"));
      }
    } catch (err) {
      logger.error('Failed to structure department:', err);
      setError(t('modals.aiWentWrong', 'AI processing failed. Please try again.'));
    } finally {
      setStructuring(false);
    }
  };

  // Skip AI - go directly to manual entry
  const handleSkipAI = () => {
    setEditedName('');
    setEditedDescription('');
    setSuggestedRoles([]);
    setIsAIGenerated(false);
    setStep('manual');
  };

  // Save the department
  const handleSave = async () => {
    if (!editedName.trim()) {
      setError(t('modals.departmentNeedsName', 'Department needs a name'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave(editedName.trim(), editedDescription.trim() || undefined);

      // Show success state
      setSaving(false);
      setStep('success');
      hapticSuccess();

      // Auto-close after celebration
      setTimeout(() => {
        onClose();
      }, CELEBRATION.PROJECT_SUCCESS);
    } catch (err) {
      logger.error('Failed to create department:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('modals.couldntCreateDepartment', 'Failed to create department')
      );
      setSaving(false);
    }
  };

  // Go back to input step
  const handleBackToEdit = () => {
    setStep('input');
    setError(null);
  };

  // Regenerate AI output
  const handleRegenerate = () => {
    processWithAI();
  };

  // Get title based on step
  const getTitle = () => {
    if (step === 'input') return t('modals.newDepartment', 'New Department');
    if (step === 'manual') return t('modals.addDepartment', 'Add Department');
    if (step === 'success') return t('modals.departmentCreated', 'Department Created!');
    return t('modals.reviewDepartment', 'Review Department');
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      title={getTitle()}
      size="md"
      contentClassName="pm-modal-body"
    >
      {/* Error */}
      {error && (
        <div className="pm-error">
          <span>&#9888;&#65039;</span>
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Input */}
      {step === 'input' && (
        <div className="pm-form">
          {/* AI Intro */}
          <div className="pm-field pm-context-field">
            <div className="pm-ai-intro">
              <Sparkles className="pm-ai-intro-icon" />
              <span>
                {t('modals.aiIntroDepartment', 'Describe your department and AI will structure it')}
              </span>
            </div>
            <textarea
              id="department-description"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t(
                'modals.departmentPlaceholderAI',
                'E.g., "A team that handles customer complaints and ensures satisfaction..." or "Engineering team focused on mobile apps"'
              )}
              disabled={structuring}
              rows={4}
              autoFocus
              enterKeyHint="done"
            />
            {structuring && (
              <div className="pm-ai-structuring">
                <Spinner size="sm" variant="brand" />
                <span>
                  {t('modals.aiStructuringDepartment', 'AI is structuring your department...')}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pm-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={structuring}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="ghost" onClick={handleSkipAI} disabled={structuring}>
              <FileText size={16} />
              {t('modals.skipAI', 'Skip AI')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => processWithAI()}
              disabled={structuring || !freeText.trim()}
            >
              {structuring ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.aiProcessing', 'Processing...')}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {t('modals.createWithAI', 'Create with AI')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Review AI output */}
      {step === 'review' && (
        <div className="pm-form">
          {/* AI Success badge */}
          <div className="pm-ai-success">
            <Check className="pm-ai-success-icon" />
            <span>{t('modals.aiCreatedDepartment', 'AI created your department')}</span>
          </div>

          {/* Editable Name */}
          <div className="pm-field">
            <label htmlFor="department-name">{t('modals.departmentName')} *</label>
            <input
              id="department-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder={t('modals.departmentName')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Editable Description */}
          <div className="pm-field">
            <label htmlFor="department-desc">{t('modals.description')}</label>
            <AIWriteAssist
              context="department-description"
              value={editedDescription}
              onSuggestion={setEditedDescription}
              additionalContext={editedName ? `Department: ${editedName}` : ''}
            >
              <textarea
                id="department-desc"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder={t('modals.departmentDescPlaceholder', 'What does this department do?')}
                disabled={saving}
                rows={3}
                enterKeyHint="done"
              />
            </AIWriteAssist>
          </div>

          {/* Suggested Roles (read-only info) */}
          {suggestedRoles.length > 0 && (
            <div className="pm-field">
              <label>{t('modals.suggestedRoles', 'Suggested Roles')}</label>
              <div className="pm-departments-display">
                {suggestedRoles.map((role, idx) => (
                  <span
                    key={idx}
                    className="pm-dept-badge"
                    style={{
                      background: 'var(--color-slate-100)',
                      borderColor: 'var(--color-slate-300)',
                      color: 'var(--color-slate-700)',
                    }}
                  >
                    {role}
                  </span>
                ))}
              </div>
              <p className="pm-field-hint">
                {t(
                  'modals.suggestedRolesHint',
                  'You can add these roles after creating the department'
                )}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pm-actions pm-actions-review">
            <Button type="button" variant="ghost" onClick={handleBackToEdit} disabled={saving}>
              {t('modals.startOver', 'Start Over')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRegenerate}
              disabled={saving || structuring}
            >
              <RefreshCw size={16} className={structuring ? 'pm-spinning' : ''} />
              {t('modals.tryAgain', 'Try Again')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={saving || !editedName.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {t('modals.createDepartment')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* MANUAL: Direct entry without AI */}
      {step === 'manual' && (
        <div className="pm-form">
          {/* Manual mode badge */}
          <div className="pm-manual-badge">
            <FileText className="pm-manual-badge-icon" />
            <span>{t('modals.manualEntry', 'Manual Entry')}</span>
          </div>

          {/* Department Name */}
          <div className="pm-field">
            <label htmlFor="manual-name">
              {t('modals.departmentName')} <span className="pm-required">*</span>
            </label>
            <input
              id="manual-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder={t('modals.departmentPlaceholder', 'E.g., Engineering, Marketing, HR')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="pm-field">
            <label htmlFor="manual-desc">
              {t('modals.description')}{' '}
              <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <AIWriteAssist
              context="department-description"
              value={editedDescription}
              onSuggestion={setEditedDescription}
              additionalContext={editedName ? `Department: ${editedName}` : ''}
            >
              <textarea
                id="manual-desc"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder={t('modals.departmentDescPlaceholder', 'What does this department do?')}
                disabled={saving}
                rows={3}
                enterKeyHint="done"
              />
            </AIWriteAssist>
          </div>

          {/* Actions */}
          <div className="pm-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('input')}
              disabled={saving}
            >
              <Sparkles size={16} />
              {t('modals.useAI', 'Use AI')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={saving || !editedName.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {t('modals.createDepartment')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* SUCCESS: Celebration moment */}
      {step === 'success' && (
        <div className="pm-success-state">
          <div className="pm-success-icon-wrapper">
            <CheckCircle2 className="pm-success-icon animate-success-pop" />
          </div>
          <h3 className="pm-success-title">
            {editedName} {t('modals.created', 'created')}!
          </h3>
          <p className="pm-success-message">
            {t('modals.departmentReady', 'Your department is ready. Add roles to get started.')}
          </p>
        </div>
      )}
    </AppModal>
  );
}
