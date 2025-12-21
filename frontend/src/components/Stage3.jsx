import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { MultiDepartmentSelect } from './ui/MultiDepartmentSelect';
import { Spinner } from './ui/Spinner';
import { CopyButton } from './ui/CopyButton';
import { BottomSheet } from './ui/BottomSheet';
import { Bookmark, FileText, Layers, ScrollText, FolderKanban, ChevronDown, Plus, Sparkles, CheckCircle2 } from 'lucide-react';
import { getModelPersona } from '../config/modelPersonas';
import './Stage3.css';

// Check if we're on mobile/tablet (for bottom sheet vs dropdown)
// Use 768px to include tablets like iPad Mini
const isMobileDevice = () => window.innerWidth <= 768;

// Minimum interval between decision status checks (ms)
const DECISION_CHECK_THROTTLE = 5000;

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

  // Fallback pattern matching
  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('gpt') || lowerModel.includes('o1')) return '/icons/openai.svg';
  if (lowerModel.includes('claude') || lowerModel.includes('opus') || lowerModel.includes('sonnet') || lowerModel.includes('haiku')) return '/icons/anthropic.svg';
  if (lowerModel.includes('gemini')) return '/icons/gemini.svg';
  if (lowerModel.includes('grok')) return '/icons/grok.svg';
  if (lowerModel.includes('deepseek')) return '/icons/deepseek.svg';

  return null;
}

// Playbook type definitions with icons
const DOC_TYPES = [
  { value: 'sop', label: 'SOP', icon: ScrollText, description: 'Standard Operating Procedure - step-by-step instructions' },
  { value: 'framework', label: 'Framework', icon: Layers, description: 'Framework - guidelines and best practices' },
  { value: 'policy', label: 'Policy', icon: FileText, description: 'Policy - rules and requirements' }
];

// Custom code block renderer with copy button
// Only shows header with copy button for actual code blocks (multi-line or has language)
function CodeBlock({ children, className }) {
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  // Only show header with copy button for actual code blocks:
  // - Has a language specified, OR
  // - Has multiple lines, OR
  // - Is longer than 60 characters
  const isActualCodeBlock = language || code.includes('\n') || code.length > 60;

  // For short single-line code without language, render as inline code (not a block)
  if (!isActualCodeBlock) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block-wrapper">
      {language && <span className="code-language">{language}</span>}
      <CopyButton text={code} size="sm" position="absolute" />
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function Stage3({
  finalResponse,
  streaming,
  isLoading,
  companyId,
  departmentId,
  conversationId,
  conversationTitle,
  userQuestion,  // The original user question that led to this response
  responseIndex = 0,  // Index of this response within the conversation (for multi-turn)
  defaultCollapsed = false,
  onViewDecision,  // Callback to open My Company with decision
  projects = [],  // Available projects for this company
  currentProjectId = null,  // Currently selected project in chat
  onSelectProject,  // Callback to select/change project
  onCreateProject,  // Callback to create a new project
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'promoting' | 'promoted' | 'error'
  const [savedDecisionId, setSavedDecisionId] = useState(null); // ID of saved decision
  const [promotedPlaybookId, setPromotedPlaybookId] = useState(null); // ID of promoted playbook

  // Save toolbar state
  const [departments, setDepartments] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState(departmentId ? [departmentId] : []);
  const [selectedDocType, setSelectedDocType] = useState('');

  // Project state
  const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [fullProjectData, setFullProjectData] = useState(null); // Full project with context_md
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const projectButtonRef = useRef(null);
  const containerRef = useRef(null);
  const finalResponseRef = useRef(null);
  const [floatingCopyPos, setFloatingCopyPos] = useState(null); // { top, right } for floating copy button
  const lastDecisionCheck = useRef(0); // Throttle all decision status checks
  const isCheckingDecision = useRef(false); // Prevent concurrent checks
  const lastSyncedProjectId = useRef(null); // Prevent duplicate project syncs

  // Unified decision status check - throttled and deduped
  const checkDecisionStatus = useCallback(async (force = false) => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;
    if (!savedDecisionId && !force) return; // Nothing to check unless forced
    if (isCheckingDecision.current) return; // Already checking

    const now = Date.now();
    if (!force && now - lastDecisionCheck.current < DECISION_CHECK_THROTTLE) return;

    isCheckingDecision.current = true;
    lastDecisionCheck.current = now;

    try {
      const data = await api.getConversationDecision(conversationId, companyId, responseIndex);
      if (data?.decision) {
        if (!savedDecisionId) {
          // Found existing decision on initial check
          setSavedDecisionId(data.decision.id);
          setSaveState('saved');
        }
        if (data.decision.project_id && !selectedProjectId) {
          setSelectedProjectId(data.decision.project_id);
        }
      } else if (savedDecisionId) {
        // Decision was deleted
        console.log('[Stage3] Decision was deleted, clearing state');
        setSavedDecisionId(null);
        setSaveState('idle');
      }
    } catch {
      if (savedDecisionId) {
        // Error checking = assume deleted
        setSavedDecisionId(null);
        setSaveState('idle');
      }
    } finally {
      isCheckingDecision.current = false;
    }
  }, [conversationId, companyId, responseIndex, savedDecisionId, selectedProjectId]);

  // Track previous conversationId to detect actual changes (not initial mount)
  const prevConversationRef = useRef(null); // Start as null to detect initial mount
  const prevResponseIndexRef = useRef(null);
  const isInitialMount = useRef(true);

  // Reset saved decision state when conversation changes
  // This prevents "Decision saved" from persisting across different conversations
  useEffect(() => {
    // Skip reset on initial mount - let the "initial load" effect handle it
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevConversationRef.current = conversationId;
      prevResponseIndexRef.current = responseIndex;
      return;
    }

    const conversationChanged = prevConversationRef.current !== conversationId;
    const responseIndexChanged = prevResponseIndexRef.current !== responseIndex;

    // Update refs
    prevConversationRef.current = conversationId;
    prevResponseIndexRef.current = responseIndex;

    // Only reset if conversation or response index actually changed
    if (conversationChanged || responseIndexChanged) {
      console.log('[Stage3] Conversation/response changed, resetting saved state');
      setSavedDecisionId(null);
      setSaveState('idle');
      setPromotedPlaybookId(null);
      setSelectedProjectId(currentProjectId);
      setFullProjectData(null);
      // Reset department selection to the prop value (or empty)
      setSelectedDeptIds(departmentId ? [departmentId] : []);
      setSelectedDocType('');
      lastDecisionCheck.current = 0;
      isCheckingDecision.current = false;
      lastSyncedProjectId.current = null; // Reset project sync guard
    }
  }, [conversationId, responseIndex]); // Only reset when conversation or response index changes (not other props)

  // Sync selectedProjectId when currentProjectId prop changes (e.g., after creating a new project)
  useEffect(() => {
    if (currentProjectId && currentProjectId !== selectedProjectId) {
      console.log('[Stage3] Syncing selectedProjectId from prop:', currentProjectId);
      setSelectedProjectId(currentProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]); // Only re-run when currentProjectId changes (intentionally omit selectedProjectId to avoid loops)

  // Get current project name from list
  const currentProjectBasic = projects.find(p => p.id === selectedProjectId);
  // Use full data if available, otherwise basic
  const currentProject = fullProjectData?.id === selectedProjectId ? fullProjectData : currentProjectBasic;

  // Fetch full project data when project is selected (needed for context_md)
  // Also sync the department selector to match the project's department
  useEffect(() => {
    // Guard against duplicate syncs - only fetch if we haven't already synced this project
    if (selectedProjectId && lastSyncedProjectId.current !== selectedProjectId) {
      // Mark as syncing BEFORE the async call to prevent race conditions
      lastSyncedProjectId.current = selectedProjectId;

      api.getProject(selectedProjectId)
        .then(data => {
          // Double-check we're still on the same project (user might have changed selection)
          if (lastSyncedProjectId.current !== selectedProjectId) return;

          const project = data.project || data;
          setFullProjectData(project);
          // Sync department selector to project's departments
          if (project.department_ids?.length > 0) {
            console.log('[Stage3] Syncing departments to project:', project.department_ids);
            setSelectedDeptIds(project.department_ids);
          }
        })
        .catch(err => console.error('Failed to load project:', err));
    } else if (!selectedProjectId) {
      setFullProjectData(null);
      lastSyncedProjectId.current = null;
    }
  }, [selectedProjectId]);

  // Close project dropdown when clicking outside
  useEffect(() => {
    if (!showProjectDropdown) return;

    const handleClickOutside = (e) => {
      // Check if click is outside both the button and the dropdown
      if (projectButtonRef.current && !projectButtonRef.current.contains(e.target)) {
        // Also check if the click is on the portal dropdown
        const portalDropdown = document.querySelector('.save-project-dropdown-portal');
        if (!portalDropdown || !portalDropdown.contains(e.target)) {
          setShowProjectDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectDropdown]);

  // Load departments when complete (for the toolbar)
  useEffect(() => {
    if (companyId && departments.length === 0 && !streaming?.error) {
      api.getCompanyTeam(companyId)
        .then(data => {
          setDepartments(data.departments || []);
          if (departmentId) {
            setSelectedDeptIds([departmentId]);
          }
        })
        .catch(err => console.error('Failed to load departments:', err));
    }
  }, [companyId, departmentId, departments.length, streaming?.error]);

  // Initial load: Check for existing linked project and decision (single combined fetch)
  useEffect(() => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;

    // Only fetch decision status for THIS specific response (by responseIndex)
    // Don't fetch linked-project - that's conversation-level and causes cross-talk between Stage3 instances
    api.getConversationDecision(conversationId, companyId, responseIndex)
      .then(decisionData => {
        if (decisionData?.decision) {
          const decision = decisionData.decision;
          console.log(`[Stage3:${responseIndex}] Found existing decision:`, decision.id);
          setSavedDecisionId(decision.id);
          setSaveState('saved');
          // Restore all saved state from THIS decision
          if (decision.project_id) {
            setSelectedProjectId(decision.project_id);
          }
          // Restore departments from decision
          if (decision.department_ids?.length > 0) {
            setSelectedDeptIds(decision.department_ids);
          }
          // Restore doc type if saved
          if (decision.doc_type) {
            setSelectedDocType(decision.doc_type);
          }
        }
        // Update last check time since we just fetched
        lastDecisionCheck.current = Date.now();
      })
      .catch(() => null);
  }, [conversationId, companyId, responseIndex]);

  // Re-check decision status when tab becomes visible or component scrolls into view
  // Uses unified throttled check function
  useEffect(() => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDecisionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkDecisionStatus, conversationId, companyId]);

  // IntersectionObserver for re-checking when scrolled into view
  useEffect(() => {
    if (!containerRef.current || !conversationId || !companyId || conversationId.startsWith('temp-')) return;
    if (!savedDecisionId) return; // Only re-check if we think there's a saved decision

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            checkDecisionStatus();
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% visible
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [checkDecisionStatus, savedDecisionId, conversationId, companyId]);

  // Determine what to display (moved up so displayText is available)
  const displayText = finalResponse?.response || streaming?.text || '';

  // Generate title from user question (most unique) or conversation title
  const getTitle = () => {
    // Prefer userQuestion as it's unique per response
    if (userQuestion) {
      // Truncate and clean up long questions
      const cleaned = userQuestion.trim().replace(/\n+/g, ' ');
      return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
    }
    return conversationTitle ||
      (displayText.split('\n')[0].slice(0, 100)) ||
      'Council Decision';
  };

  // Save as Decision only (for later promotion)
  // If a project is selected, also merge into project context
  const handleSaveForLater = async () => {
    console.log('[Stage3] handleSaveForLater called:', {
      companyId,
      saveState,
      savedDecisionId,
      selectedProjectId,
      currentProject: currentProject ? { id: currentProject.id, name: currentProject.name, hasContextMd: !!currentProject.context_md } : null,
      fullProjectData: fullProjectData ? { id: fullProjectData.id, name: fullProjectData.name } : null
    });

    // Allow re-saving to project even if decision exists (for updating project context)
    // Only block if: no company, already saving, or (decision exists AND no project selected)
    if (!companyId || saveState === 'saving') {
      console.log('[Stage3] Early return - no companyId or already saving');
      return;
    }
    if (savedDecisionId && !selectedProjectId) {
      console.log('[Stage3] Early return - already saved without project');
      return; // Already saved without project - don't duplicate
    }

    setSaveState('saving');
    try {
      // If project selected, merge decision into project context AND save decision
      // Note: currentProject might be null if full data hasn't loaded yet - fetch it if needed
      let projectToUse = currentProject;
      if (selectedProjectId && !projectToUse) {
        console.log('[Stage3] Project selected but no current data, fetching...');
        try {
          const data = await api.getProject(selectedProjectId);
          projectToUse = data.project || data;
          setFullProjectData(projectToUse);
        } catch (err) {
          console.error('[Stage3] Failed to fetch project:', err);
        }
      }

      if (selectedProjectId && projectToUse) {
        console.log('[Stage3] Merging decision into project:', selectedProjectId, 'departments:', selectedDeptIds);
        console.log('[Stage3] Calling mergeDecisionIntoProject API... (this may take 10-30s due to AI processing)');

        const mergeResult = await api.mergeDecisionIntoProject(
          selectedProjectId,
          projectToUse.context_md || '',
          displayText,
          userQuestion || conversationTitle || '',
          {
            saveDecision: true,
            companyId,
            conversationId: conversationId?.startsWith('temp-') ? null : conversationId,
            responseIndex,  // Track which response in the conversation this is
            decisionTitle: getTitle(),
            departmentId: selectedDeptIds.length > 0 ? selectedDeptIds[0] : null,  // Primary for backwards compat
            departmentIds: selectedDeptIds  // All selected departments
          }
        );

        console.log('[Stage3] Merge result received:', JSON.stringify(mergeResult, null, 2));

        // Update project context with merged content
        if (mergeResult?.merged?.context_md) {
          console.log('[Stage3] Updating project context with merged content');
          await api.updateProject(selectedProjectId, {
            context_md: mergeResult.merged.context_md
          });
        }

        // Get the saved decision ID from the response
        // Backend returns 'saved_decision_id' not 'decision_id'
        const decisionId = mergeResult?.saved_decision_id;
        const saveError = mergeResult?.decision_save_error;
        console.log('[Stage3] saved_decision_id from response:', decisionId);
        if (saveError) {
          console.error('[Stage3] Backend reported save error:', saveError);
        }
        if (decisionId) {
          setSavedDecisionId(decisionId);
          setSaveState('saved');
        } else {
          // Decision failed to save (backend returned an error or no ID)
          // This can happen if auth token is missing or DB insert fails
          console.error('[Stage3] Merge succeeded but decision was NOT saved - no decision ID returned');
          console.error('[Stage3] mergeResult:', mergeResult);
          const errorMsg = saveError || 'Decision was not saved. Please try again.';
          throw new Error(errorMsg);
        }
      } else {
        console.log('[Stage3] No project selected, saving as standalone decision');
        // No project - just save as decision
        const result = await api.createCompanyDecision(companyId, {
          title: getTitle(),
          content: displayText,
          user_question: userQuestion || null,  // Store what the user asked for context
          department_ids: selectedDeptIds,  // Use canonical array field
          source_conversation_id: conversationId?.startsWith('temp-') ? null : conversationId,
          response_index: responseIndex,  // Track which response in the conversation this is
          project_id: selectedProjectId || null,
          tags: []
        });

        console.log('Save result:', result);
        const decisionId = result?.decision?.id || result?.id;
        if (!decisionId) {
          console.error('No decision ID in response:', result);
          throw new Error('No decision ID returned');
        }
        setSavedDecisionId(decisionId);
        setSaveState('saved');
      }
    } catch (err) {
      console.error('[Stage3] Failed to save decision:', err);
      console.error('[Stage3] Error details:', err.message, err.stack);
      setSaveState('error');
      // Keep error visible longer so user can see it
      setTimeout(() => setSaveState('idle'), 5000);
    }
  };

  // Save AND promote to playbook in one step
  const handleSaveAndPromote = async () => {
    if (!companyId || !selectedDocType || saveState === 'saving' || saveState === 'promoting') return;

    setSaveState('promoting');
    try {
      // Step 1: Save as decision first
      console.log('Saving decision...');
      const saveResult = await api.createCompanyDecision(companyId, {
        title: getTitle(),
        content: displayText,
        department_ids: selectedDeptIds,  // Use canonical array field
        source_conversation_id: conversationId?.startsWith('temp-') ? null : conversationId,
        project_id: selectedProjectId || null,
        tags: []
      });

      console.log('Save result:', saveResult);
      const decisionId = saveResult?.decision?.id || saveResult?.id;
      if (!decisionId) {
        console.error('No decision ID in response:', saveResult);
        throw new Error('No decision ID returned');
      }
      setSavedDecisionId(decisionId);

      // Step 2: Immediately promote to playbook
      console.log('Promoting to playbook...', decisionId);
      const promoteResult = await api.promoteDecisionToPlaybook(companyId, decisionId, {
        doc_type: selectedDocType,
        title: getTitle(),
        department_ids: selectedDeptIds  // Use canonical array field
      });

      console.log('Promote result:', promoteResult);
      const playbookId = promoteResult?.playbook?.id || promoteResult?.id;
      setPromotedPlaybookId(playbookId);
      setSaveState('promoted');
    } catch (err) {
      console.error('Failed to save and promote:', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  // View the saved decision in My Company
  const handleViewDecision = () => {
    if (savedDecisionId && onViewDecision) {
      onViewDecision(savedDecisionId);
    }
  };

  const isStreaming = streaming && !streaming.complete;
  const hasError = streaming?.error;
  const chairmanModel = finalResponse?.model || streaming?.model || 'google/gemini-3-pro-preview';
  const chairmanIconPath = getModelIconPath(chairmanModel);
  const isComplete = !isStreaming && !hasError && displayText;

  // Floating copy button - show when header copy button is scrolled out of view
  useEffect(() => {
    if (!isComplete || !displayText || !finalResponseRef.current || isCollapsed) {
      setFloatingCopyPos(null);
      return;
    }

    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    const handleScroll = () => {
      const responseRect = finalResponseRef.current?.getBoundingClientRect();
      if (!responseRect) return;

      // Check if we've scrolled past the header (first ~50px of the response)
      // and if the response is still in view
      const headerScrolledOut = responseRect.top < 80; // Header is above viewport
      const responseStillVisible = responseRect.bottom > 120; // Bottom still in view

      if (headerScrolledOut && responseStillVisible) {
        // Show floating button positioned at top-right of the visible area
        setFloatingCopyPos({
          top: 80, // Below context bar
          right: window.innerWidth - responseRect.right + 16
        });
      } else {
        setFloatingCopyPos(null);
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [isComplete, displayText, isCollapsed]);

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Show thinking state if stage3 is loading but no streaming data yet
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
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
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
          {/* Header row: Chairman LLM icon + status + copy button */}
          <div className="stage3-header-row">
            <div className="chairman-indicator">
              {chairmanIconPath && (
                <img src={chairmanIconPath} alt="" className="chairman-icon" />
              )}
              {isStreaming && <span className="typing-indicator">●</span>}
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {hasError && <span className="error-badge">Error</span>}
            </div>
            {/* Copy button - inline in header */}
            {isComplete && displayText && (
              <CopyButton text={displayText} size="sm" className="stage3-copy-btn stage3-header-copy" />
            )}
          </div>
          {/* Content wrapper */}
          <div className="final-content-wrapper">
            <div className={`final-text ${hasError ? 'error-text' : ''}`}>
          {hasError ? (
            <p className="empty-message">{displayText || 'An error occurred while generating the synthesis.'}</p>
          ) : (
            <>
              <article className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:my-1 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-700 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Override pre to render our CodeBlock wrapper
                    pre({ children, node }) {
                      // Extract the code element's props
                      const codeElement = node?.children?.[0];
                      const className = codeElement?.properties?.className?.[0] || '';
                      const codeContent = codeElement?.children?.[0]?.value || '';
                      return <CodeBlock className={className}>{codeContent}</CodeBlock>;
                    },
                    // For inline code only (not wrapped in pre)
                    code({ node, className, children, ...props }) {
                      // If this code is inside a pre, let pre handle it
                      // Otherwise render as inline code
                      return <code className={className} {...props}>{children}</code>;
                    },
                    // Wrap tables in scrollable container for mobile
                    table({ children, ...props }) {
                      return (
                        <div className="table-scroll-wrapper">
                          <table {...props}>{children}</table>
                        </div>
                      );
                    }
                  }}
                >
                  {displayText}
                </ReactMarkdown>
              </article>
              {isStreaming && <span className="cursor">▊</span>}
            </>
          )}
        </div>
          </div>
        {isComplete && companyId && (
          <div className="stage3-actions">
            {/* Error state */}
            {saveState === 'error' && (
              <div className="save-error-bar" style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>Failed to save. Please try again.</span>
              </div>
            )}
            {/* Compact inline save toolbar - unified design */}
            <div className="save-toolbar-unified">
              {/* Left group: Department + Project + Type in a visual container */}
              <div className="save-options-group">
                {/* Multi-department selector with colors */}
                <MultiDepartmentSelect
                  value={selectedDeptIds}
                  onValueChange={setSelectedDeptIds}
                  departments={departments}
                  disabled={saveState !== 'idle'}
                  placeholder="Departments"
                  className="save-dept-trigger"
                  title="Tag this answer with relevant departments"
                />

                {/* Divider */}
                <div className="save-divider" />

                {/* Project selector - inline pill style like department */}
                <div className="save-project-selector-inline">
                  <button
                    ref={projectButtonRef}
                    className={`save-project-pill ${currentProject ? 'has-project' : ''}`}
                    onClick={() => {
                      if (!showProjectDropdown && projectButtonRef.current) {
                        const rect = projectButtonRef.current.getBoundingClientRect();
                        setDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left
                        });
                      }
                      setShowProjectDropdown(!showProjectDropdown);
                    }}
                    disabled={saveState === 'saving' || saveState === 'promoting'}
                    title={currentProject ? `Linked to: ${currentProject.name}` : 'Link this answer to a project for easy access later'}
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    <span>{currentProject ? currentProject.name : 'Project'}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {/* Mobile: BottomSheet, Desktop: Portal dropdown */}
                  {showProjectDropdown && isMobileDevice() ? (
                    <BottomSheet
                      isOpen={showProjectDropdown}
                      onClose={() => setShowProjectDropdown(false)}
                      title="Select Project"
                    >
                      <div className="save-project-list-mobile">
                        {/* No project option */}
                        <button
                          type="button"
                          className={`save-project-option-mobile ${!selectedProjectId ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedProjectId(null);
                            onSelectProject && onSelectProject(null);
                            setShowProjectDropdown(false);
                          }}
                        >
                          <span className="save-project-option-name">No Project</span>
                          <span className="save-project-option-desc">Save without linking to a project</span>
                        </button>
                        {/* Active projects */}
                        {projects.filter(p => p.status === 'active').map(project => (
                          <button
                            type="button"
                            key={project.id}
                            className={`save-project-option-mobile ${selectedProjectId === project.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedProjectId(project.id);
                              onSelectProject && onSelectProject(project.id);
                              setShowProjectDropdown(false);
                            }}
                          >
                            <span className="save-project-option-name">{project.name}</span>
                            {project.description && (
                              <span className="save-project-option-desc">{project.description}</span>
                            )}
                          </button>
                        ))}
                        {/* Create new project */}
                        {onCreateProject && (
                          <button
                            type="button"
                            className="save-project-create-btn-mobile"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Close BottomSheet first, then open modal after animation completes
                              // This prevents Radix Dialog conflicts between BottomSheet and ProjectModal
                              setShowProjectDropdown(false);
                              setTimeout(() => {
                                onCreateProject({
                                  userQuestion,
                                  councilResponse: displayText,
                                  departmentIds: selectedDeptIds
                                });
                              }, 250);
                            }}
                            onTouchEnd={(e) => {
                              // Ensure touch events trigger on mobile
                              e.stopPropagation();
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            <span>Create New Project</span>
                          </button>
                        )}
                      </div>
                    </BottomSheet>
                  ) : showProjectDropdown && createPortal(
                    <div
                      className="save-project-dropdown-portal"
                      style={{
                        position: 'fixed',
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        zIndex: 9999,
                        minWidth: '260px',
                        maxWidth: '320px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)',
                        overflow: 'hidden'
                      }}
                    >
                      <div className="save-project-dropdown-header">Select Project</div>
                      <div className="save-project-list">
                        {/* No project option */}
                        <button
                          className={`save-project-option ${!selectedProjectId ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedProjectId(null);
                            onSelectProject && onSelectProject(null);
                            setShowProjectDropdown(false);
                          }}
                        >
                          <span className="save-project-option-name">No Project</span>
                          <span className="save-project-option-desc">Save without linking to a project</span>
                        </button>
                        {/* Active projects */}
                        {projects.filter(p => p.status === 'active').map(project => (
                          <button
                            key={project.id}
                            className={`save-project-option ${selectedProjectId === project.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedProjectId(project.id);
                              onSelectProject && onSelectProject(project.id);
                              setShowProjectDropdown(false);
                            }}
                          >
                            <span className="save-project-option-name">{project.name}</span>
                            {project.description && (
                              <span className="save-project-option-desc">{project.description}</span>
                            )}
                          </button>
                        ))}
                      </div>
                      {/* Create new project */}
                      {onCreateProject && (
                        <div className="save-project-create">
                          <button
                            className="save-project-create-btn"
                            onClick={() => {
                              setShowProjectDropdown(false);
                              // Pass council context for auto-populating project
                              // Include selectedDeptIds so ProjectModal can pre-select them
                              onCreateProject({
                                userQuestion,
                                councilResponse: displayText,
                                departmentIds: selectedDeptIds
                              });
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Create New Project</span>
                          </button>
                        </div>
                      )}
                    </div>,
                    document.body
                  )}
                </div>

                {/* Divider */}
                <div className="save-divider" />

                {/* Type selector pills - optional classification */}
                <div className="save-type-pills" title="Optionally classify as a document type">
                  {DOC_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSaved = saveState === 'saved' || saveState === 'promoted';
                    const isSelected = selectedDocType === type.value;
                    return (
                      <button
                        key={type.value}
                        className={`save-type-pill ${type.value} ${isSelected ? 'selected' : ''} ${isSaved && isSelected ? 'saved' : ''}`}
                        onClick={() => !isSaved && setSelectedDocType(isSelected ? '' : type.value)}
                        disabled={saveState === 'saving' || saveState === 'promoting'}
                        title={isSaved && isSelected ? `Saved as ${type.label}` : type.description}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save/Access button - logic:
                  - If saved: show clear "Decision saved" status with link to view
                  - Otherwise: show "Save" button */}
              {(saveState === 'saved' || saveState === 'promoted') ? (
                // Already saved - show clear status message with link
                <div className="save-status-group">
                  <span className="save-status-text">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Decision saved
                  </span>
                  <button
                    className="save-view-link"
                    onClick={async () => {
                      // Quick check if decision still exists (force check bypasses throttle)
                      await checkDecisionStatus(true);
                      // If state was reset, don't navigate
                      if (!savedDecisionId) return;

                      if (promotedPlaybookId) {
                        onViewDecision && onViewDecision(savedDecisionId, 'playbook', promotedPlaybookId);
                      } else if (currentProject) {
                        onViewDecision && onViewDecision(savedDecisionId, 'project', currentProject.id);
                      } else {
                        handleViewDecision();
                      }
                    }}
                  >
                    {promotedPlaybookId ? 'View Playbook' : currentProject ? 'View in Project' : 'View Decision'}
                  </button>
                </div>
              ) : (
                // Not saved yet - show save button
                <button
                  className={`save-action-btn ${saveState === 'saving' || saveState === 'promoting' ? 'loading' : ''}`}
                  onClick={selectedDocType ? handleSaveAndPromote : handleSaveForLater}
                  disabled={saveState === 'saving' || saveState === 'promoting'}
                  title={currentProject
                    ? 'Save this answer and add it to your project'
                    : selectedDocType
                      ? `Save as ${DOC_TYPES.find(t => t.value === selectedDocType)?.label} to your knowledge base`
                      : 'Save this answer to access it later from My Company'}
                >
                  {(saveState === 'saving' || saveState === 'promoting') ? (
                    <>
                      <Spinner size="sm" variant="muted" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" />
                      <span>{currentProject ? `Save to ${currentProject.name}` : 'Save Answer'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      )}

      {/* Floating copy button - appears when scrolling through long content */}
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
