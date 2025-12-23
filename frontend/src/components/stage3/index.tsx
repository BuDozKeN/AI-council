import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { CopyButton } from '../ui/CopyButton';
import { api } from '../../api';
import { getModelPersona } from '../../config/modelPersonas';
import { logger } from '../../utils/logger';
import { useDecisionState } from './hooks/useDecisionState';
import { useSaveActions } from './hooks/useSaveActions';
import Stage3Content from './Stage3Content';
import { Stage3Actions } from './Stage3Actions';
import '../Stage3.css';

const log = logger.scope('Stage3');

// Provider icon paths
const PROVIDER_ICON_PATH = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  xai: '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
};

// Get icon path for a model
function getModelIconPath(modelId) {
  if (!modelId) return null;

  const persona = getModelPersona(modelId);
  if (persona.provider && PROVIDER_ICON_PATH[persona.provider]) {
    return PROVIDER_ICON_PATH[persona.provider];
  }

  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('gpt') || lowerModel.includes('o1')) return '/icons/openai.svg';
  if (lowerModel.includes('claude') || lowerModel.includes('opus') || lowerModel.includes('sonnet') || lowerModel.includes('haiku')) return '/icons/anthropic.svg';
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
}) {
  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [isCollapsed, setIsCollapsed] = useState(isMobile ? false : defaultCollapsed);
  const [departments, setDepartments] = useState([]);
  const [fullProjectData, setFullProjectData] = useState(null);
  const [floatingCopyPos, setFloatingCopyPos] = useState(null);

  const containerRef = useRef(null);
  const finalResponseRef = useRef(null);

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
    lastSyncedProjectIdRef
  } = useDecisionState({
    conversationId,
    companyId,
    responseIndex,
    currentProjectId,
    departmentId
  });

  // Get display text
  const displayText = finalResponse?.response || streaming?.text || '';

  // Generate title
  const getTitle = () => {
    if (userQuestion) {
      const cleaned = userQuestion.trim().replace(/\n+/g, ' ');
      return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
    }
    return conversationTitle ||
      (displayText.split('\n')[0].slice(0, 100)) ||
      'Council Decision';
  };

  // Get current project
  const currentProjectBasic = projects.find(p => p.id === selectedProjectId);
  const currentProject = fullProjectData?.id === selectedProjectId ? fullProjectData : currentProjectBasic;

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
    getTitle
  });

  // View decision handler
  const handleViewDecision = (decisionId, viewType, contextId) => {
    if (onViewDecision) {
      onViewDecision(decisionId || savedDecisionId, viewType, contextId);
    }
  };

  // Fetch full project data when project is selected
  useEffect(() => {
    if (selectedProjectId && lastSyncedProjectIdRef.current !== selectedProjectId) {
      lastSyncedProjectIdRef.current = selectedProjectId;

      api.getProject(selectedProjectId)
        .then(data => {
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
        .catch(err => {
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
  }, [selectedProjectId, setSelectedProjectId, setSelectedDeptIds, setFullProjectData, lastSyncedProjectIdRef]);

  // Load departments
  useEffect(() => {
    if (companyId && departments.length === 0 && !streaming?.error) {
      api.getCompanyTeam(companyId)
        .then(data => {
          setDepartments(data.departments || []);
          if (departmentId) {
            setSelectedDeptIds([departmentId]);
          }
        })
        .catch(err => log.error('Failed to load departments:', err));
    }
  }, [companyId, departmentId, departments.length, streaming?.error, setSelectedDeptIds]);

  // IntersectionObserver for re-checking when scrolled into view
  useEffect(() => {
    if (!containerRef.current || !conversationId || !companyId || conversationId.startsWith('temp-')) return;
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

  // Streaming states
  const isStreaming = streaming && !streaming.complete;
  const hasError = streaming?.error;
  const chairmanModel = finalResponse?.model || streaming?.model || 'google/gemini-3-pro-preview';
  const chairmanIconPath = getModelIconPath(chairmanModel);
  const isComplete = !isStreaming && !hasError && displayText;

  // Floating copy button
  useEffect(() => {
    if (!isComplete || !displayText || !finalResponseRef.current || isCollapsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing position with DOM state
      setFloatingCopyPos(null);
      return;
    }

    if (isMobile) {
      const responseRect = finalResponseRef.current?.getBoundingClientRect();
      if (responseRect) {
        setFloatingCopyPos({
          top: 80,
          right: 16
        });
      }
      return;
    }

    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    const handleScroll = () => {
      const responseRect = finalResponseRef.current?.getBoundingClientRect();
      if (!responseRect) return;

      const headerScrolledOut = responseRect.top < 80;
      const responseStillVisible = responseRect.bottom > 120;

      if (headerScrolledOut && responseStillVisible) {
        setFloatingCopyPos({
          top: 80,
          right: window.innerWidth - responseRect.right + 16
        });
      } else {
        setFloatingCopyPos(null);
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [isComplete, displayText, isCollapsed, isMobile]);

  const toggleCollapsed = () => {
    if (!isMobile) {
      setIsCollapsed(!isCollapsed);
    }
  };

  // Show thinking state
  if (!displayText && isLoading) {
    return (
      <div className="stage stage3">
        <h3 className="stage-title">
          <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <span className="font-semibold tracking-tight">Step 3: Final Recommendation</span>
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>
        <div className="final-response">
          <div className="thinking-container">
            <div className="thinking-message">
              <Spinner size="sm" />
              <span>Combining expert opinions...</span>
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
    <div ref={containerRef} className={`stage stage3 ${isCollapsed ? 'collapsed' : ''}`}>
      <h3
        className={`stage-title ${!isMobile ? 'clickable' : ''}`}
        onClick={!isMobile ? toggleCollapsed : undefined}
      >
        {!isMobile && <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>}
        <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <span className="font-semibold tracking-tight">Step 3: Final Recommendation</span>
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        {isCollapsed && savedDecisionId && (
          <span className="collapsed-summary">
            <span className="kb-saved-badge">Saved</span>
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <div className="final-response" ref={finalResponseRef}>
          <Stage3Content
            displayText={displayText}
            hasError={hasError}
            isStreaming={isStreaming}
            isComplete={isComplete}
            chairmanIconPath={chairmanIconPath}
            isMobile={isMobile}
          />

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

      {/* Floating copy button */}
      {floatingCopyPos && createPortal(
        <div
          className="stage3-floating-copy"
          style={{
            position: 'fixed',
            top: floatingCopyPos.top,
            right: floatingCopyPos.right,
            zIndex: 100
          }}
        >
          <CopyButton text={displayText} size="sm" className="stage3-copy-btn" />
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(Stage3);
