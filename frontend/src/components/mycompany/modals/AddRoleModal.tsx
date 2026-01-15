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

interface AddRoleModalProps {
  deptId: string;
  companyId?: string;
  onSave: (deptId: string, name: string, title: string, systemPrompt?: string) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

/**
 * Add Role Modal - Multi-step wizard with AI assistance
 *
 * Flow:
 * Option A: AI-assisted - describe role, AI structures it, review/edit, confirm
 * Option B: Manual - skip AI and enter everything directly
 *
 * Matches the ProjectModal pattern for consistent UX.
 */
export function AddRoleModal({ deptId, companyId, onSave, onClose }: AddRoleModalProps) {
  const { t } = useTranslation();

  // Step state: 'input', 'review', 'manual', or 'success'
  const [step, setStep] = useState<'input' | 'review' | 'manual' | 'success'>('input');

  // Input state (Step 1)
  const [freeText, setFreeText] = useState('');

  // AI result state / editable fields (Step 2)
  const [editedName, setEditedName] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');

  // UI state
  const [structuring, setStructuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setIsAIGenerated] = useState(false);

  // Process with AI
  const processWithAI = async (text?: string) => {
    const inputText = text || freeText;
    if (!inputText.trim()) {
      setError(t('modals.tellUsAboutRole', 'Tell us about the role'));
      return;
    }

    setStructuring(true);
    setError(null);

    try {
      const result = await api.structureRole(inputText, deptId, companyId);
      if (result?.structured) {
        setEditedName(result.structured.name || '');
        setEditedTitle(result.structured.title || '');
        setEditedDescription(result.structured.description || '');
        setResponsibilities(result.structured.responsibilities || []);
        setSystemPrompt(result.structured.system_prompt || '');
        setIsAIGenerated(true);
        setStep('review');
      } else {
        setError(t('modals.couldntUnderstand', "Couldn't understand the input"));
      }
    } catch (err) {
      logger.error('Failed to structure role:', err);
      setError(t('modals.aiWentWrong', 'AI processing failed. Please try again.'));
    } finally {
      setStructuring(false);
    }
  };

  // Skip AI - go directly to manual entry
  const handleSkipAI = () => {
    setEditedName('');
    setEditedTitle('');
    setEditedDescription('');
    setResponsibilities([]);
    setSystemPrompt('');
    setIsAIGenerated(false);
    setStep('manual');
  };

  // Save the role
  const handleSave = async () => {
    if (!editedName.trim()) {
      setError(t('modals.roleNeedsName', 'Role needs a name'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave(
        deptId,
        editedName.trim(),
        editedTitle.trim() || editedName.trim(),
        systemPrompt.trim() || undefined
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
      logger.error('Failed to create role:', err);
      setError(
        err instanceof Error ? err.message : t('modals.couldntCreateRole', 'Failed to create role')
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
    if (step === 'input') return t('modals.newRole', 'New Role');
    if (step === 'manual') return t('modals.addRole', 'Add Role');
    if (step === 'success') return t('modals.roleCreated', 'Role Created!');
    return t('modals.reviewRole', 'Review Role');
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
              <span>{t('modals.aiIntroRole', 'Describe the role and AI will structure it')}</span>
            </div>
            <textarea
              id="role-description"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t(
                'modals.rolePlaceholderAI',
                'E.g., "Someone who writes code, reviews PRs, and mentors junior developers" or "Customer support lead who handles escalations"'
              )}
              disabled={structuring}
              rows={4}
              autoFocus
              enterKeyHint="done"
            />
            {structuring && (
              <div className="pm-ai-structuring">
                <Spinner size="sm" variant="brand" />
                <span>{t('modals.aiStructuringRole', 'AI is structuring your role...')}</span>
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
            <span>{t('modals.aiCreatedRole', 'AI created your role')}</span>
          </div>

          {/* Editable Name */}
          <div className="pm-field">
            <label htmlFor="role-name">{t('modals.roleName')} *</label>
            <input
              id="role-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder={t('modals.roleNamePlaceholder', 'E.g., Software Engineer')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Editable Title */}
          <div className="pm-field">
            <label htmlFor="role-title">{t('modals.roleTitle')}</label>
            <input
              id="role-title"
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('modals.roleTitlePlaceholder', 'E.g., Senior Software Engineer')}
              disabled={saving}
            />
          </div>

          {/* Description (read-only info from AI) */}
          {editedDescription && (
            <div className="pm-field">
              <label>{t('modals.description')}</label>
              <AIWriteAssist
                context="role-description"
                value={editedDescription}
                onSuggestion={setEditedDescription}
                additionalContext={editedName ? `Role: ${editedName}` : ''}
              >
                <textarea
                  id="role-desc"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder={t('modals.roleDescPlaceholder', 'What does this role do?')}
                  disabled={saving}
                  rows={2}
                  enterKeyHint="done"
                />
              </AIWriteAssist>
            </div>
          )}

          {/* Responsibilities (read-only info) */}
          {responsibilities.length > 0 && (
            <div className="pm-field">
              <label>{t('modals.keyResponsibilities', 'Key Responsibilities')}</label>
              <div
                className="pm-departments-display"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}
              >
                {responsibilities.map((resp, idx) => (
                  <span
                    key={idx}
                    className="pm-dept-badge"
                    style={{
                      background: 'var(--color-slate-100)',
                      borderColor: 'var(--color-slate-300)',
                      color: 'var(--color-slate-700)',
                      display: 'block',
                      width: '100%',
                    }}
                  >
                    {resp}
                  </span>
                ))}
              </div>
              <p className="pm-field-hint">
                {t('modals.responsibilitiesHint', 'These are displayed for reference only')}
              </p>
            </div>
          )}

          {/* AI System Prompt - how this role advises as an AI */}
          {systemPrompt && (
            <div className="pm-field">
              <label htmlFor="role-prompt">{t('modals.aiPersonality', 'AI Personality')}</label>
              <AIWriteAssist
                context="role-prompt"
                value={systemPrompt}
                onSuggestion={setSystemPrompt}
                additionalContext={
                  editedName ? `Role: ${editedName}${editedTitle ? ` (${editedTitle})` : ''}` : ''
                }
              >
                <textarea
                  id="role-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t(
                    'modals.aiPersonalityPlaceholder',
                    'How this role should behave as an AI advisor...'
                  )}
                  disabled={saving}
                  rows={6}
                  enterKeyHint="done"
                />
              </AIWriteAssist>
              <p className="pm-field-hint">
                {t(
                  'modals.aiPersonalityHint',
                  'Defines how this role behaves when acting as an AI advisor in the council'
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
                  {t('modals.createRole')}
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

          {/* Role Name */}
          <div className="pm-field">
            <label htmlFor="manual-name">
              {t('modals.roleName')} <span className="pm-required">*</span>
            </label>
            <input
              id="manual-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder={t('modals.roleNamePlaceholder', 'E.g., Software Engineer')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Title */}
          <div className="pm-field">
            <label htmlFor="manual-title">
              {t('modals.roleTitle')} <span className="pm-optional">({t('common.optional')})</span>
            </label>
            <input
              id="manual-title"
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('modals.roleTitlePlaceholder', 'E.g., Senior Software Engineer')}
              disabled={saving}
            />
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
                  {t('modals.createRole')}
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
            {t('modals.roleReady', 'Your role is ready. You can now assign it to team members.')}
          </p>
        </div>
      )}
    </AppModal>
  );
}
