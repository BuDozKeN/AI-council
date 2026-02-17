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
import '../../project-modal/index.css'; // Reuse ProjectModal styles

interface AddCompanyContextModalProps {
  companyId: string;
  companyName?: string | undefined;
  onSave: (contextMd: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Add Company Context Modal - Multi-step wizard with AI assistance
 *
 * Flow:
 * Option A: AI-assisted - describe company, AI generates context document, review/edit, confirm
 * Option B: Manual - skip AI and write context directly
 *
 * Matches the Department/Role/Playbook wizard pattern for consistent UX.
 */
export function AddCompanyContextModal({
  companyId,
  companyName,
  onSave,
  onClose,
}: AddCompanyContextModalProps) {
  const { t } = useTranslation();

  // Step state: 'input', 'review', 'manual', or 'success'
  const [step, setStep] = useState<'input' | 'review' | 'manual' | 'success'>('input');

  // Input state (Step 1)
  const [freeText, setFreeText] = useState('');

  // AI result state / editable context (Step 2)
  const [editedContext, setEditedContext] = useState('');

  // UI state
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setIsAIGenerated] = useState(false);

  // Process with AI
  const processWithAI = async (text?: string) => {
    const inputText = text || freeText;
    if (!inputText.trim()) {
      setError(t('modals.tellUsAboutCompany', 'Tell us about your company'));
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      const result = await api.structureCompanyContext(companyId, inputText, companyName);
      if (result?.structured?.context_md) {
        setEditedContext(result.structured.context_md);
        setIsAIGenerated(true);
        setStep('review');
      } else {
        setError(t('modals.couldntUnderstand', "Couldn't understand the input"));
      }
    } catch (err) {
      logger.error('Failed to structure company context:', err);
      setError(t('modals.aiWentWrong', 'AI processing failed. Please try again.'));
    } finally {
      setStructuring(false);
    }
  };

  // Skip AI - go directly to manual entry
  const handleSkipAI = () => {
    setEditedContext('');
    setIsAIGenerated(false);
    setStep('manual');
  };

  // Save the context
  const handleSave = async () => {
    if (!editedContext.trim()) {
      setError(t('modals.contextNeedsContent', 'Context document needs content'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave(editedContext.trim());

      // Show success state
      setSaving(false);
      setStep('success');
      hapticSuccess();

      // Auto-close after celebration
      setTimeout(() => {
        onClose();
      }, CELEBRATION.PROJECT_SUCCESS);
    } catch (err) {
      logger.error('Failed to save company context:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('modals.couldntSaveContext', 'Failed to save context')
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
    if (step === 'input') return t('modals.generateContext', 'Generate Company Context');
    if (step === 'manual') return t('modals.writeContext', 'Write Company Context');
    if (step === 'success') return t('modals.contextCreated', 'Context Created!');
    return t('modals.reviewContext', 'Review Context');
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      title={getTitle()}
      size="lg"
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
                {t(
                  'modals.aiIntroContext',
                  'Describe your company and AI will create a comprehensive context document'
                )}
              </span>
            </div>
            <textarea
              id="company-description"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t(
                'modals.contextPlaceholderAI',
                'E.g., "We\'re a B2B SaaS startup building productivity tools. Team of 8, seed-funded, focused on launching MVP this quarter. We value speed over perfection and async communication..."'
              )}
              disabled={structuring}
              rows={6}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              enterKeyHint="done"
            />
            {structuring && (
              <div className="pm-ai-structuring">
                <Spinner size="sm" variant="brand" />
                <span>
                  {t('modals.aiStructuringContext', 'AI is creating your company context...')}
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
            <span>{t('modals.aiCreatedContext', 'AI created your company context')}</span>
          </div>

          {/* Editable Context */}
          <div className="pm-field">
            <label htmlFor="context-md">{t('modals.companyContext')} *</label>
            <AIWriteAssist
              context="company-context"
              value={editedContext}
              onSuggestion={setEditedContext}
              additionalContext={companyName ? `Company: ${companyName}` : ''}
            >
              <textarea
                id="context-md"
                className="mc-edit-textarea-full"
                value={editedContext}
                onChange={(e) => setEditedContext(e.target.value)}
                placeholder={t(
                  'modals.companyContextPlaceholder',
                  'Your company context document...'
                )}
                disabled={saving}
                rows={15}
                enterKeyHint="done"
              />
            </AIWriteAssist>
            <p className="pm-field-hint">
              {t(
                'modals.contextEditHint',
                'Review and edit as needed. This document will guide AI advisors in understanding your company.'
              )}
            </p>
          </div>

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
              disabled={saving || !editedContext.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {t('modals.saveContext', 'Save Context')}
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

          {/* Context */}
          <div className="pm-field">
            <label htmlFor="manual-context">
              {t('modals.companyContext')} <span className="pm-required">*</span>
            </label>
            <AIWriteAssist
              context="company-context"
              value={editedContext}
              onSuggestion={setEditedContext}
              additionalContext={companyName ? `Company: ${companyName}` : ''}
            >
              <textarea
                id="manual-context"
                className="mc-edit-textarea-full"
                value={editedContext}
                onChange={(e) => setEditedContext(e.target.value)}
                placeholder={t(
                  'modals.contextManualPlaceholder',
                  '# Company Overview\n\nDescribe your company, mission, current priorities, constraints, and decision-making culture...'
                )}
                disabled={saving}
                rows={15}
                autoFocus
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
              disabled={saving || !editedContext.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {t('modals.saveContext', 'Save Context')}
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
          <h3 className="pm-success-title">{t('modals.contextSaved', 'Context saved')}!</h3>
          <p className="pm-success-message">
            {t(
              'modals.contextReady',
              'Your company context is ready. AI advisors will now use this to provide more relevant recommendations.'
            )}
          </p>
        </div>
      )}
    </AppModal>
  );
}
