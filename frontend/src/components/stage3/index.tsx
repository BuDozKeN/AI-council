import { useState, useEffect, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { CopyButton } from '../ui/CopyButton';
import { api } from '../../api';
import { getModelPersona } from '../../config/modelPersonas';
import { logger } from '../../utils/logger';
import { useDecisionState } from './hooks/useDecisionState';
import { useSaveActions } from './hooks/useSaveActions';
import Stage3Content from './Stage3Content';
import { Stage3Actions } from './Stage3Actions';
// TableOfContents import removed - TOC hidden for now
// import { TableOfContents } from '../ui/TableOfContents';
import type { Department, Project } from '../../types/business';
import type { UsageData } from '../../types/conversation';
import '../Stage3.css';

const log = logger.scope('Stage3');

type Provider = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

interface FinalResponse {
  response?: string;
  model?: string;
}

interface StreamingState {
  text?: string;
  complete?: boolean;
  error?: boolean;
  truncated?: boolean;
  model?: string;
}

interface Stage3Props {
  finalResponse: FinalResponse | null;
  streaming: StreamingState | null;
  isLoading: boolean;
  companyId: string | null;
  departmentId: string | null;
  conversationId: string | null;
  conversationTitle: string | null;
  userQuestion: string;
  responseIndex?: number;
  defaultCollapsed?: boolean;
  onViewDecision?: (decisionId: string | null, viewType?: string, contextId?: string) => void;
  projects?: Project[];
  currentProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  onCreateProject?: (data: {
    userQuestion: string;
    councilResponse: string;
    departmentIds: string[];
  }) => void;
  usage?: UsageData;
}

// Provider icon paths
const PROVIDER_ICON_PATH: Record<Provider, string> = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  xai: '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
};

// Get icon path for a model
function getModelIconPath(modelId: string | undefined): string | null {
  if (!modelId) return null;

  const persona = getModelPersona(modelId);
  if (persona.provider && PROVIDER_ICON_PATH[persona.provider as Provider]) {
    return PROVIDER_ICON_PATH[persona.provider as Provider];
  }

  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('gpt') || lowerModel.includes('o1')) return '/icons/openai.svg';
  if (
    lowerModel.includes('claude') ||
    lowerModel.includes('opus') ||
    lowerModel.includes('sonnet') ||
    lowerModel.includes('haiku')
  )
    return '/icons/anthropic.svg';
  if (lowerModel.includes('gemini')) return '/icons/gemini.svg';
  if (lowerModel.includes('grok')) return '/icons/grok.svg';
  if (lowerModel.includes('deepseek')) return '/icons/deepseek.svg';

  return null;
}

function Stage3({
  finalResponse,
  streaming,
  isLoading,
  companyId,
  departmentId,
  conversationId,
  conversationTitle,
  userQuestion,
  responseIndex = 0,
  defaultCollapsed = false,
  onViewDecision,
  projects = [],
  currentProjectId = null,
  onSelectProject,
  onCreateProject,
  usage,
}: Stage3Props) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [departments, setDepartments] = useState<Department[]>([]);
  // ProjectWithContext type matches what useSaveActions expects
  interface ProjectWithContext {
    id: string;
    name: string;
    context_md?: string;
    description?: string;
    status?: 'active' | 'completed' | 'archived';
    company_id?: string;
    department_ids?: string[];
    created_at?: string;
    updated_at?: string;
  }
  const [fullProjectData, setFullProjectData] = useState<ProjectWithContext | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const finalResponseRef = useRef<HTMLDivElement>(null);

  // Use custom hooks for state management
  const {
    saveState,
    setSaveState,
    savedDecisionId,
    setSavedDecisionId,
    promotedPlaybookId,
    setPromotedPlaybookId,
    selectedProjectId,
    setSelectedProjectId,
    selectedDeptIds,
    setSelectedDeptIds,
    selectedDocType,
    setSelectedDocType,
    checkDecisionStatus,
    lastSyncedProjectIdRef,
  } = useDecisionState({
    conversationId,
    companyId,
    responseIndex,
    currentProjectId,
    departmentId,
  });

  // Get display text
  const displayText = finalResponse?.response || streaming?.text || '';

  // Generate title - clean and format for display
  const getTitle = () => {
    let title = '';
    if (userQuestion) {
      title = userQuestion.trim().replace(/\n+/g, ' ');
    } else if (conversationTitle) {
      title = conversationTitle;
    } else if (displayText) {
      title = (displayText.split('\n')[0] ?? '').slice(0, 100);
    } else {
      return 'Council Decision';
    }

    // Remove common prefixes like "CONTEXT:", "Context:", etc.
    title = title.replace(/^(context|question|q):\s*/i, '');

    // Truncate if too long
    if (title.length > 60) {
      title = title.slice(0, 57) + '...';
    }

    return title || 'Council Decision';
  };

  // Get current project - cast to ProjectWithContext for consistency with useSaveActions
  const currentProjectBasic = projects.find((p) => p.id === selectedProjectId);
  const currentProject: ProjectWithContext | null =
    fullProjectData?.id === selectedProjectId
      ? fullProjectData
      : currentProjectBasic
        ? { ...currentProjectBasic }
        : null;

  // Use save actions hook
  const { handleSaveForLater, handleSaveAndPromote } = useSaveActions({
    companyId,
    conversationId,
    responseIndex,
    displayText,
    userQuestion,
    conversationTitle,
    selectedProjectId,
    selectedDeptIds,
    selectedDocType,
    currentProject,
    fullProjectData,
    projects,
    saveState,
    savedDecisionId,
    setSaveState,
    setSavedDecisionId,
    setPromotedPlaybookId,
    setFullProjectData,
    getTitle,
  });

  // View decision handler
  const handleViewDecision = (decisionId: string | null, viewType?: string, contextId?: string) => {
    if (onViewDecision) {
      onViewDecision(decisionId || savedDecisionId, viewType, contextId);
    }
  };

  // Fetch full project data when project is selected
  useEffect(() => {
    if (selectedProjectId && lastSyncedProjectIdRef.current !== selectedProjectId) {
      lastSyncedProjectIdRef.current = selectedProjectId;

      api
        .getProject(selectedProjectId)
        .then((data) => {
          if (lastSyncedProjectIdRef.current !== selectedProjectId) return;

          const project = data.project || data;
          if (!project || !project.id) {
            log.debug('Project was deleted, clearing selectedProjectId:', selectedProjectId);
            setSelectedProjectId(null);
            setFullProjectData(null);
            lastSyncedProjectIdRef.current = null;
            return;
          }
          setFullProjectData(project);
          if (project.department_ids?.length > 0) {
            log.debug('Syncing departments to project:', project.department_ids);
            setSelectedDeptIds(project.department_ids);
          }
        })
        .catch((err) => {
          log.error('Failed to load project (may be deleted):', err);
          setSelectedProjectId(null);
          setFullProjectData(null);
          lastSyncedProjectIdRef.current = null;
        });
    } else if (!selectedProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: clear project data when none selected
      setFullProjectData(null);
      lastSyncedProjectIdRef.current = null;
    }
  }, [
    selectedProjectId,
    setSelectedProjectId,
    setSelectedDeptIds,
    setFullProjectData,
    lastSyncedProjectIdRef,
  ]);

  // Load departments
  useEffect(() => {
    if (companyId && departments.length === 0 && !streaming?.error) {
      api
        .getCompanyTeam(companyId)
        .then((data) => {
          setDepartments(data.departments || []);
          if (departmentId) {
            setSelectedDeptIds([departmentId]);
          }
        })
        .catch((err) => log.error('Failed to load departments:', err));
    }
  }, [companyId, departmentId, departments.length, streaming?.error, setSelectedDeptIds]);

  // IntersectionObserver for re-checking when scrolled into view
  useEffect(() => {
    if (
      !containerRef.current ||
      !conversationId ||
      !companyId ||
      conversationId.startsWith('temp-')
    )
      return;
    if (!savedDecisionId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            checkDecisionStatus();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [checkDecisionStatus, savedDecisionId, conversationId, companyId]);

  // Streaming states - explicitly type as boolean
  const isStreaming: boolean = Boolean(streaming && !streaming.complete);
  const hasError: boolean = Boolean(streaming?.error);
  const wasTruncated: boolean = Boolean(streaming?.truncated);
  const chairmanModel = finalResponse?.model || streaming?.model || 'google/gemini-3-pro-preview';
  const chairmanIconPath = getModelIconPath(chairmanModel);
  const isComplete: boolean = !isStreaming && !hasError && Boolean(displayText);

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Show thinking state with chairman icon animation
  if (!displayText && isLoading) {
    return (
      <div className="stage stage3" aria-busy="true" aria-live="polite">
        <h3 className="stage-title">
          <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <span className="font-semibold tracking-tight">{t('stages.bestAnswer')}</span>
        </h3>
        <div className="final-response noise-overlay">
          <div
            className="chairman-loading-container"
            role="status"
            aria-label={t('stages.loadingCouncil')}
          >
            <div className="chairman-loading-icon-wrapper">
              <img
                src={chairmanIconPath || '/icons/gemini.svg'}
                alt=""
                className="chairman-loading-icon"
                loading="lazy"
                decoding="async"
              />
              <div className="chairman-loading-pulse" />
            </div>
            <div className="chairman-loading-text">
              <span className="chairman-loading-title">{t('stages.chairmanWriting')}</span>
              <span className="chairman-loading-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!displayText && !isLoading) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`stage stage3 ${isCollapsed ? 'collapsed' : ''}`}
      data-stage="stage3"
      aria-busy={isStreaming}
      aria-live="polite"
    >
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <span className="font-semibold tracking-tight">{t('stages.bestAnswer')}</span>
        {isCollapsed && savedDecisionId && (
          <span className="collapsed-summary">
            <span className="kb-saved-badge">{t('common.saved')}</span>
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <div className="final-response noise-overlay" ref={finalResponseRef}>
          {/* Sticky toolbar - copy button only (TOC hidden for now) */}
          {isComplete && displayText && (
            <div className="stage3-sticky-toolbar">
              <CopyButton text={displayText} size="sm" className="stage3-copy-btn" />
            </div>
          )}

          <Stage3Content
            displayText={displayText}
            hasError={hasError}
            wasTruncated={wasTruncated}
            isStreaming={isStreaming}
            isComplete={isComplete}
            chairmanIconPath={chairmanIconPath}
            {...(usage ? { usage } : {})}
          />

          {/* Floating TOC hidden for now */}

          {isComplete && companyId && (
            <Stage3Actions
              companyId={companyId}
              departments={departments}
              selectedDeptIds={selectedDeptIds}
              setSelectedDeptIds={setSelectedDeptIds}
              selectedDocType={selectedDocType}
              setSelectedDocType={setSelectedDocType}
              currentProject={currentProject}
              projects={projects}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              onSelectProject={onSelectProject}
              onCreateProject={onCreateProject}
              saveState={saveState}
              savedDecisionId={savedDecisionId}
              promotedPlaybookId={promotedPlaybookId}
              handleSaveForLater={handleSaveForLater}
              handleSaveAndPromote={handleSaveAndPromote}
              handleViewDecision={handleViewDecision}
              checkDecisionStatus={checkDecisionStatus}
              userQuestion={userQuestion}
              displayText={displayText}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default memo(Stage3);
