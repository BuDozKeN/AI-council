import './AddPlaybookModal.css';
import '../../project-modal/index.css'; // Reuse ProjectModal styles
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { Spinner } from '../../ui/Spinner';
import { AIWriteAssist } from '../../ui/AIWriteAssist';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { Sparkles, Check, RefreshCw, FileText, CheckCircle2, Bookmark } from 'lucide-react';
import { logger } from '../../../utils/logger';
import { hapticSuccess } from '../../../lib/haptics';
import { CELEBRATION } from '../../../lib/animation-constants';
import { getPlaybookTypeColor } from '../../../lib/colors';
import { DOC_TYPES } from '../constants';
import type { Department } from '../../../types/business';

type PlaybookType = 'sop' | 'framework' | 'policy';

interface AddPlaybookModalProps {
  companyId?: string;
  departments?: Department[];
  onSave: (
    title: string,
    docType: string,
    content?: string,
    departmentId?: string | null,
    additionalDepartments?: string[]
  ) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

/**
 * Add Playbook Modal - Multi-step wizard with AI assistance
 *
 * Flow:
 * Option A: AI-assisted - describe playbook, AI structures it (including doc type), review/edit, confirm
 * Option B: Manual - skip AI and enter everything directly
 *
 * Matches the ProjectModal pattern for consistent UX.
 */
export function AddPlaybookModal({
  companyId,
  departments = [],
  onSave,
  onClose,
}: AddPlaybookModalProps) {
  const { t } = useTranslation();

  // Step state: 'input', 'review', 'manual', or 'success'
  const [step, setStep] = useState<'input' | 'review' | 'manual' | 'success'>('input');

  // Input state (Step 1)
  const [freeText, setFreeText] = useState('');

  // AI result state / editable fields (Step 2)
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDocType, setEditedDocType] = useState<PlaybookType | null>(null); // null = let AI decide
  const [editedContent, setEditedContent] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  // UI state
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setIsAIGenerated] = useState(false);

  // Process with AI
  const processWithAI = async (text?: string) => {
    const inputText = text || freeText;
    if (!inputText.trim()) {
      setError(t('modals.tellUsAboutPlaybook', 'Tell us about your playbook'));
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      // Pass the user's preselected doc type to the API (if they selected one)
      // If user selected a type, the backend will use that type's specialized persona
      // If not (null/undefined), the backend will detect the type from the description
      logger.info('[AddPlaybookModal] Calling structurePlaybook with:', {
        inputTextLength: inputText.length,
        companyId,
        editedDocType,
        willSendDocType: editedDocType || undefined,
      });
      const result = await api.structurePlaybook(inputText, companyId, editedDocType || undefined);
      logger.info('[AddPlaybookModal] API response:', {
        hasStructured: !!result?.structured,
        returnedTitle: result?.structured?.title,
        returnedDocType: result?.structured?.doc_type,
      });
      if (result?.structured) {
        setEditedTitle(result.structured.title || '');
        setEditedDocType((result.structured.doc_type as PlaybookType) || 'sop');
        setEditedContent(result.structured.content || '');
        setIsAIGenerated(true);
        setStep('review');
      } else {
        setError(t('modals.couldntUnderstand', "Couldn't understand the input"));
      }
    } catch (err) {
      logger.error('Failed to structure playbook:', err);
      setError(t('modals.aiWentWrong', 'AI processing failed. Please try again.'));
    } finally {
      setStructuring(false);
    }
  };

  // Skip AI - go directly to manual entry (preserve user's type selection)
  const handleSkipAI = () => {
    setEditedTitle('');
    // Keep editedDocType - user may have already selected a type
    setEditedContent('');
    setSelectedDepts([]);
    setIsAIGenerated(false);
    setStep('manual');
  };

  // Save the playbook
  const handleSave = async () => {
    if (!editedTitle.trim() || !editedContent.trim()) {
      setError(t('modals.playbookNeedsTitleAndContent', 'Playbook needs a title and content'));
      return;
    }

    // Require a doc type when saving (should always be set after AI/manual input)
    if (!editedDocType) {
      setError(t('modals.playbookNeedsType', 'Please select a document type'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // First selected department becomes owner, rest are additional
      const [primaryDept, ...additionalDepts] = selectedDepts;
      await onSave(
        editedTitle.trim(),
        editedDocType,
        editedContent.trim(),
        primaryDept || null,
        additionalDepts
      );

      // Show success state
      setSaving(false);
      setStep('success');
      hapticSuccess();

      // Auto-close after celebration
      setTimeout(() => {
        onClose();
      }, CELEBRATION.PROJECT_SUCCESS);
    } catch (err) {
      logger.error('Failed to create playbook:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('modals.couldntCreatePlaybook', 'Failed to create playbook')
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
    if (step === 'input') return t('modals.newPlaybook', 'New Playbook');
    if (step === 'manual') return t('modals.createPlaybook', 'Create Playbook');
    if (step === 'success') return t('modals.playbookCreated', 'Playbook Created!');
    return t('modals.reviewPlaybook', 'Review Playbook');
  };

  // Get the type label for display
  const getTypeLabel = () => {
    if (!editedDocType) return 'Playbook';
    const typeInfo = DOC_TYPES.find((t) => t.value === editedDocType);
    return typeInfo?.label || 'Playbook';
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
          {/* Document Type Pills - User can optionally preselect (null = AI decides) */}
          <div className="pm-field">
            <label>
              {t('modals.type')} <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <div className="mc-type-pills-unified">
              {DOC_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = editedDocType === type.value;
                const colors = getPlaybookTypeColor(type.value);
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`mc-type-pill-unified ${type.value} ${isSelected ? 'selected' : ''}`}
                    style={
                      isSelected
                        ? {
                            background: colors.bg,
                            color: colors.text,
                            boxShadow: `0 1px 2px ${colors.shadowColor}`,
                          }
                        : {}
                    }
                    onClick={() => setEditedDocType(isSelected ? null : type.value)} // Toggle off if already selected
                    disabled={structuring}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
            {!editedDocType && (
              <p className="pm-field-hint">
                {t(
                  'modals.aiWillDetermineType',
                  'AI will determine the best type from your description'
                )}
              </p>
            )}
          </div>

          {/* AI Intro + Description */}
          <div className="pm-field pm-context-field">
            <div className="pm-ai-intro">
              <Sparkles className="pm-ai-intro-icon" />
              <span>
                {t('modals.aiIntroPlaybook', 'Describe your playbook and AI will structure it')}
              </span>
            </div>
            <textarea
              id="playbook-description"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t(
                'modals.playbookPlaceholderAI',
                'E.g., "How to onboard new engineers" or "Our code review policy" or "Decision-making framework for product priorities"'
              )}
              disabled={structuring}
              rows={5}
              autoFocus
              enterKeyHint="done"
            />
            {structuring && (
              <div className="pm-ai-structuring">
                <Spinner size="sm" variant="brand" />
                <span>
                  {t('modals.aiStructuringPlaybook', 'AI is structuring your playbook...')}
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
            <span>{t('modals.aiCreatedPlaybook', 'AI created your playbook')}</span>
          </div>

          {/* Editable Title */}
          <div className="pm-field">
            <label htmlFor="playbook-title">{t('modals.title')} *</label>
            <input
              id="playbook-title"
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('modals.playbookTitlePlaceholder', 'E.g., Engineer Onboarding Guide')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Document Type Pills */}
          <div className="pm-field">
            <label>{t('modals.type')} *</label>
            <div className="mc-type-pills-unified">
              {DOC_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = editedDocType === type.value;
                const colors = getPlaybookTypeColor(type.value);
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`mc-type-pill-unified ${type.value} ${isSelected ? 'selected' : ''}`}
                    style={
                      isSelected
                        ? {
                            background: colors.bg,
                            color: colors.text,
                            boxShadow: `0 1px 2px ${colors.shadowColor}`,
                          }
                        : {}
                    }
                    onClick={() => setEditedDocType(type.value)}
                    disabled={saving}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Departments */}
          <div className="pm-field">
            <label>{t('modals.departments')}</label>
            <MultiDepartmentSelect
              value={selectedDepts}
              onValueChange={setSelectedDepts}
              departments={departments}
              placeholder={t('modals.companyWideAllDepts', 'Company-wide (all departments)')}
              disabled={saving}
            />
          </div>

          {/* Editable Content */}
          <div className="pm-field">
            <label htmlFor="playbook-content">{t('modals.content')} *</label>
            <AIWriteAssist
              context="playbook-content"
              value={editedContent}
              onSuggestion={setEditedContent}
              additionalContext={editedTitle ? `Playbook: ${editedTitle}` : ''}
              playbookType={editedDocType || 'sop'}
            >
              <textarea
                id="playbook-content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder={t(
                  'modals.playbookContentPlaceholder',
                  'Write your playbook content in markdown...'
                )}
                disabled={saving}
                rows={10}
                className="pm-context-editor"
                enterKeyHint="done"
              />
            </AIWriteAssist>
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
              disabled={saving || !editedTitle.trim() || !editedContent.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <Bookmark size={16} />
                  {t('modals.createType', { type: getTypeLabel() })}
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

          {/* Title */}
          <div className="pm-field">
            <label htmlFor="manual-title">
              {t('modals.title')} <span className="pm-required">*</span>
            </label>
            <input
              id="manual-title"
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('modals.playbookTitlePlaceholder', 'E.g., Engineer Onboarding Guide')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Document Type Pills */}
          <div className="pm-field">
            <label>
              {t('modals.type')} <span className="pm-required">*</span>
            </label>
            <div className="mc-type-pills-unified">
              {DOC_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = editedDocType === type.value;
                const colors = getPlaybookTypeColor(type.value);
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`mc-type-pill-unified ${type.value} ${isSelected ? 'selected' : ''}`}
                    style={
                      isSelected
                        ? {
                            background: colors.bg,
                            color: colors.text,
                            boxShadow: `0 1px 2px ${colors.shadowColor}`,
                          }
                        : {}
                    }
                    onClick={() => setEditedDocType(type.value)}
                    disabled={saving}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Departments */}
          <div className="pm-field">
            <label>
              {t('modals.departments')}{' '}
              <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <MultiDepartmentSelect
              value={selectedDepts}
              onValueChange={setSelectedDepts}
              departments={departments}
              placeholder={t('modals.companyWideAllDepts', 'Company-wide (all departments)')}
              disabled={saving}
            />
          </div>

          {/* Content */}
          <div className="pm-field">
            <label htmlFor="manual-content">
              {t('modals.content')} <span className="pm-required">*</span>
            </label>
            <AIWriteAssist
              context="playbook-content"
              value={editedContent}
              onSuggestion={setEditedContent}
              onTitleSuggestion={(suggestedTitle) => {
                if (!editedTitle.trim()) {
                  setEditedTitle(suggestedTitle);
                }
              }}
              additionalContext={editedTitle ? `Playbook: ${editedTitle}` : ''}
              playbookType={editedDocType || 'sop'}
            >
              <textarea
                id="manual-content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder={t(
                  'modals.playbookContentPlaceholder',
                  'Write your playbook content in markdown...'
                )}
                disabled={saving}
                rows={10}
                className="pm-context-editor"
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
              disabled={saving || !editedTitle.trim() || !editedContent.trim()}
            >
              {saving ? (
                <>
                  <Spinner size="sm" variant="muted" />
                  {t('modals.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <Bookmark size={16} />
                  {t('modals.createType', { type: getTypeLabel() })}
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
            {editedTitle} {t('modals.created', 'created')}!
          </h3>
          <p className="pm-success-message">
            {t('modals.playbookReady', 'Your playbook is ready to use.')}
          </p>
        </div>
      )}
    </AppModal>
  );
}
