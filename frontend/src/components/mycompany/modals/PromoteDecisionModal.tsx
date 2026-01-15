/**
 * PromoteDecisionModal - Promote a council decision to a playbook or project
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import './PromoteDecisionModal.css';
import '../../ui/Modal.css';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownViewer from '../../MarkdownViewer';
import { AppModal } from '../../ui/AppModal';
import { Button } from '../../ui/button';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { ProjectSelect } from '../../ui/ProjectSelect';
import { Spinner } from '../../ui/Spinner';
import {
  Bookmark,
  ScrollText,
  Layers,
  FileText,
  FolderKanban,
  RefreshCw,
  LucideIcon,
} from 'lucide-react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { Department, Project } from '../../../types/business';
import type { TranslationKey } from '../../../types/i18n';

interface Decision {
  id: string;
  title?: string;
  content?: string;
  content_summary?: string;
  question?: string;
  department_ids?: string[];
  project_id?: string;
  source_conversation_id?: string;
}

interface DocType {
  value: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  descKey: TranslationKey;
}

const DOC_TYPES: DocType[] = [
  {
    value: 'sop',
    labelKey: 'modals.promoteType_sop',
    icon: ScrollText,
    descKey: 'modals.promoteTypeDesc_sop',
  },
  {
    value: 'framework',
    labelKey: 'modals.promoteType_framework',
    icon: Layers,
    descKey: 'modals.promoteTypeDesc_framework',
  },
  {
    value: 'policy',
    labelKey: 'modals.promoteType_policy',
    icon: FileText,
    descKey: 'modals.promoteTypeDesc_policy',
  },
  {
    value: 'project',
    labelKey: 'modals.promoteType_project',
    icon: FolderKanban,
    descKey: 'modals.promoteTypeDesc_project',
  },
];

interface PromoteDecisionModalProps {
  decision: Decision;
  departments: Department[];
  projects?: Project[];
  companyId: string;
  onPromote: (
    docType: string,
    title: string,
    departmentIds: string[],
    projectId: string | null
  ) => void;
  onClose: () => void;
  saving: boolean;
  onViewSource?: (conversationId: string) => void;
}

export function PromoteDecisionModal({
  decision,
  departments,
  projects = [],
  companyId,
  onPromote,
  onClose,
  saving,
  onViewSource,
}: PromoteDecisionModalProps) {
  const { t } = useTranslation();

  // If decision already belongs to a project, default to 'project' type
  const hasExistingProject = !!decision?.project_id;
  const [docType, setDocType] = useState(hasExistingProject ? 'project' : 'sop');
  const [title, setTitle] = useState(decision?.title || '');
  // Initialize with decision's department_ids
  const [departmentIds, setDepartmentIds] = useState(decision?.department_ids || []);
  // For project selection - pre-select if decision already has a project
  const [selectedProjectId, setSelectedProjectId] = useState(decision?.project_id || '');

  // Summary state - use content_summary (AI summary) if available
  const [summary, setSummary] = useState(decision?.content_summary || '');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Generate summary on-demand if missing
  const handleGenerateSummary = async () => {
    if (!companyId || !decision?.id) return;
    setGeneratingSummary(true);
    try {
      const result = await api.generateDecisionSummary(companyId, decision.id);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      logger.error('Failed to generate summary:', err);
    }
    setGeneratingSummary(false);
  };

  // Auto-generate summary if missing and we have companyId
  useEffect(() => {
    if (!summary && decision?.question && companyId && decision?.id) {
      // Don't auto-generate - let user trigger it if they want
      // This avoids unnecessary API calls
    }
  }, [summary, decision, companyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (docType === 'project') {
      // Promote to project
      onPromote('project', title.trim(), departmentIds, selectedProjectId || null);
    } else {
      // Promote to playbook
      onPromote(docType, title.trim(), departmentIds, null);
    }
  };

  const hasSource =
    decision?.source_conversation_id && !decision.source_conversation_id.startsWith('temp-');

  // Filter to only show active projects
  const activeProjects = (projects || []).filter((p) => p.status === 'active');

  // Find existing project name if decision belongs to one
  const existingProject = hasExistingProject
    ? activeProjects.find((p) => p.id === decision.project_id)
    : null;

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      title={t('modals.promoteDecision')}
      size="xl"
      contentClassName="mc-modal-no-padding"
    >
      <form onSubmit={handleSubmit}>
        <div className="mc-promote-layout-v2">
          {/* TITLE - Full width at top for maximum space */}
          <div className="mc-promote-title-row">
            <label htmlFor="promote-decision-title" className="mc-label-unified">
              {t('modals.title')}
            </label>
            <input
              id="promote-decision-title"
              name="promote-title"
              type="text"
              className="mc-input-unified"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder={t('modals.titlePlaceholder')}
              autoComplete="off"
              inputMode="text"
            />
          </div>

          {/* Two-column grid with aligned rows */}
          <div className="mc-promote-grid">
            {/* ROW 1: DEPARTMENTS label | SUMMARY header */}
            <label className="mc-label-unified mc-grid-area-dept-label">
              {t('modals.departments')}
            </label>
            <div className="mc-grid-area-summary-header">
              <label className="mc-label-unified">{t('modals.summary')}</label>
              <div className="mc-summary-actions">
                {summary && (
                  <button
                    type="button"
                    className="mc-expand-btn"
                    onClick={() => setSummaryExpanded(!summaryExpanded)}
                    title={summaryExpanded ? t('modals.collapse') : t('modals.expand')}
                  >
                    {summaryExpanded ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="14" y1="10" x2="21" y2="3" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    )}
                  </button>
                )}
                {!summary && companyId && decision?.id && (
                  <button
                    type="button"
                    className="mc-generate-summary-btn"
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                  >
                    {generatingSummary ? (
                      <>
                        <Spinner size="xs" variant="muted" />
                        {t('modals.generating')}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        {t('modals.generate')}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* ROW 2: DEPARTMENTS select | SUMMARY content */}
            <div className="mc-grid-area-dept-select">
              <MultiDepartmentSelect
                value={departmentIds}
                onValueChange={setDepartmentIds}
                departments={departments || []}
                placeholder={t('modals.selectDepartments')}
                className="mc-dept-select-modal"
              />
            </div>
            <div className={`mc-promote-question-text mc-grid-area-summary-content ${summaryExpanded ? 'expanded' : ''}`}>
              {generatingSummary ? (
                <span className="mc-generating-text">{t('modals.generatingAISummary')}</span>
              ) : summary ? (
                <MarkdownViewer content={summary} />
              ) : (
                <span className="mc-no-summary">{t('modals.noSummaryAvailable')}</span>
              )}
            </div>

            {/* ROW 3: PROMOTE TO label | COUNCIL DECISION label */}
            <label className="mc-label-unified mc-grid-area-type-label">
              {t('modals.promoteTo')}
            </label>
            <label className="mc-label-unified mc-grid-area-decision-label">
              {t('modals.councilDecision')}
            </label>

            {/* ROW 4: Type cards + Council Decision in flex row (left column controls height) */}
            <div className="mc-type-row">
              <div className="mc-grid-area-type-cards">
                <div className="mc-type-cards">
                  {DOC_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = docType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={`mc-type-card ${type.value} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setDocType(type.value)}
                      >
                        <Icon className="mc-type-card-icon" />
                        <div className="mc-type-card-text">
                          <span className="mc-type-card-label">{t(type.labelKey)}</span>
                          <span className="mc-type-card-desc">{t(type.descKey)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Project selector - only shown when docType is 'project' */}
                {docType === 'project' && (
                  <div className="mc-project-select-wrapper">
                    <label className="mc-label-unified">{t('modals.addToProject')}</label>
                    <ProjectSelect
                      value={selectedProjectId || null}
                      onValueChange={setSelectedProjectId}
                      projects={activeProjects}
                      includeCreate={true}
                      createLabel={t('modals.newProject')}
                      currentProjectId={decision?.project_id ?? null}
                    />
                    {existingProject && (
                      <p className="mc-existing-project-hint">
                        {t('modals.decisionAlreadyInProject', { name: existingProject.name })}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mc-grid-area-decision-content">
                <div className="mc-promote-content-rendered">
                  {decision?.content ? (
                    <MarkdownViewer content={decision.content} />
                  ) : (
                    <p className="mc-no-content">{t('modals.noContentAvailable')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Source link - separate grid row for proper alignment */}
            {hasSource && onViewSource && (
              <button
                type="button"
                className="mc-source-link-compact mc-grid-area-source-link"
                onClick={() => onViewSource(decision.source_conversation_id!)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                {t('modals.viewSource')}
              </button>
            )}
          </div>
        </div>

        <AppModal.Footer>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="default" disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                {t('modals.creating')}
              </>
            ) : (
              <>
                {docType === 'project' ? (
                  <>
                    <FolderKanban className="h-4 w-4" />
                    {selectedProjectId ? t('modals.addToProjectBtn') : t('modals.createProjectBtn')}
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    {t('modals.createType', {
                      type: t(
                        DOC_TYPES.find((tp) => tp.value === docType)?.labelKey ??
                          'modals.promoteType_sop'
                      ),
                    })}
                  </>
                )}
              </>
            )}
          </Button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}
