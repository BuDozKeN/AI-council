import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { MultiDepartmentSelect } from './ui/MultiDepartmentSelect';
import { Spinner } from './ui/Spinner';
import { Bookmark, FileText, Layers, ScrollText, FolderKanban, ChevronDown, Plus } from 'lucide-react';
import './Stage3.css';

// Playbook type definitions with icons
const DOC_TYPES = [
  { value: 'sop', label: 'SOP', icon: ScrollText },
  { value: 'framework', label: 'Framework', icon: Layers },
  { value: 'policy', label: 'Policy', icon: FileText }
];

// Copy button component
function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title={label}>
      {copied ? (
        <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

// Custom code block renderer with copy button
// Only shows header with copy button for actual code blocks (multi-line or has language)
function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  // Only show header with copy button for actual code blocks:
  // - Has a language specified, OR
  // - Has multiple lines, OR
  // - Is longer than 60 characters
  const isActualCodeBlock = language || code.includes('\n') || code.length > 60;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // For short single-line code without language, render as inline code (not a block)
  if (!isActualCodeBlock) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block-wrapper">
      {language && <span className="code-language">{language}</span>}
      <button className={`copy-code-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy code">
        {copied ? (
          <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        )}
      </button>
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
  const lastVisibilityCheck = useRef(0); // Throttle visibility checks

  // Get current project name from list
  const currentProjectBasic = projects.find(p => p.id === selectedProjectId);
  // Use full data if available, otherwise basic
  const currentProject = fullProjectData?.id === selectedProjectId ? fullProjectData : currentProjectBasic;

  // Fetch full project data when project is selected (needed for context_md)
  // Also sync the department selector to match the project's department
  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== fullProjectData?.id) {
      api.getProject(selectedProjectId)
        .then(data => {
          const project = data.project || data;
          setFullProjectData(project);
          // Sync department selector to project's departments (multi-department support)
          if (project.department_ids?.length > 0) {
            console.log('[Stage3] Syncing departments to project:', project.department_ids);
            setSelectedDeptIds(project.department_ids);
          } else if (project.department_id) {
            // Fallback to single department_id for older projects
            console.log('[Stage3] Syncing department to project (legacy):', project.department_id);
            setSelectedDeptIds([project.department_id]);
          }
        })
        .catch(err => console.error('Failed to load project:', err));
    } else if (!selectedProjectId) {
      setFullProjectData(null);
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

  // Check if this conversation already has a saved decision and/or linked project
  useEffect(() => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;

    // Check for existing linked project
    api.getConversationLinkedProject(conversationId, companyId)
      .then(data => {
        if (data?.project) {
          console.log('[Stage3] Found linked project:', data.project.name);
          setSelectedProjectId(data.project.id);
          // Also notify parent if callback exists
          if (onSelectProject) {
            onSelectProject(data.project.id);
          }
        }
      })
      .catch(err => console.log('[Stage3] No linked project found'));

    // Check for existing saved decision for this response
    api.getConversationDecision(conversationId, companyId, responseIndex)
      .then(data => {
        if (data?.decision) {
          console.log('[Stage3] Found existing decision:', data.decision.id);
          setSavedDecisionId(data.decision.id);
          setSaveState('saved');
          // If decision has a project linked, use that
          if (data.decision.project_id) {
            setSelectedProjectId(data.decision.project_id);
          }
        }
      })
      .catch(err => console.log('[Stage3] No existing decision found'));
  }, [conversationId, companyId, responseIndex]);

  // Re-check decision status when tab becomes visible (catches deletions done elsewhere)
  useEffect(() => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && savedDecisionId) {
        // Re-verify the decision still exists
        api.getConversationDecision(conversationId, companyId, responseIndex)
          .then(data => {
            if (!data?.decision) {
              // Decision was deleted
              console.log('[Stage3] Decision was deleted, clearing state');
              setSavedDecisionId(null);
              setSaveState('idle');
            }
          })
          .catch(() => {
            // Error checking = assume deleted
            setSavedDecisionId(null);
            setSaveState('idle');
          });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [conversationId, companyId, responseIndex, savedDecisionId]);

  // Re-check decision status when component scrolls into view (catches in-app navigation)
  useEffect(() => {
    if (!containerRef.current || !conversationId || !companyId || conversationId.startsWith('temp-')) return;
    if (!savedDecisionId) return; // Only re-check if we think there's a saved decision

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Throttle: only check once every 2 seconds
            const now = Date.now();
            if (now - lastVisibilityCheck.current < 2000) return;
            lastVisibilityCheck.current = now;

            // Re-verify the decision still exists
            api.getConversationDecision(conversationId, companyId, responseIndex)
              .then(data => {
                if (!data?.decision) {
                  console.log('[Stage3] Decision was deleted (intersection check), clearing state');
                  setSavedDecisionId(null);
                  setSaveState('idle');
                }
              })
              .catch(() => {
                setSavedDecisionId(null);
                setSaveState('idle');
              });
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% visible
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [conversationId, companyId, responseIndex, savedDecisionId]);

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
    // Allow re-saving to project even if decision exists (for updating project context)
    // Only block if: no company, already saving, or (decision exists AND no project selected)
    if (!companyId || saveState === 'saving') return;
    if (savedDecisionId && !selectedProjectId) return; // Already saved without project - don't duplicate

    setSaveState('saving');
    try {
      // If project selected, merge decision into project context AND save decision
      if (selectedProjectId && currentProject) {
        console.log('Merging decision into project:', selectedProjectId, 'departments:', selectedDeptIds);

        const mergeResult = await api.mergeDecisionIntoProject(
          selectedProjectId,
          currentProject.context_md || '',
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

        console.log('Merge result:', mergeResult);

        // Update project context with merged content
        if (mergeResult?.merged?.context_md) {
          await api.updateProject(selectedProjectId, {
            context_md: mergeResult.merged.context_md
          });
        }

        // Get the saved decision ID from the response
        // Backend returns 'saved_decision_id' not 'decision_id'
        const decisionId = mergeResult?.saved_decision_id;
        if (decisionId) {
          setSavedDecisionId(decisionId);
        }
        setSaveState('saved');
      } else {
        // No project - just save as decision
        const result = await api.createCompanyDecision(companyId, {
          title: getTitle(),
          content: displayText,
          department_id: selectedDeptIds.length > 0 ? selectedDeptIds[0] : null,
          source_conversation_id: conversationId?.startsWith('temp-') ? null : conversationId,
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
      console.error('Failed to save decision:', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
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
        department_id: selectedDeptIds.length > 0 ? selectedDeptIds[0] : null,
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
        department_id: selectedDeptIds.length > 0 ? selectedDeptIds[0] : null
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
  const shortModelName = chairmanModel.split('/')[1] || chairmanModel;
  const isComplete = !isStreaming && !hasError && displayText;

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Show thinking state if stage3 is loading but no streaming data yet
  if (!displayText && isLoading) {
    return (
      <div className="stage stage3">
        <h3 className="stage-title">
          Stage 3: Final Council Answer
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>
        <div className="final-response">
          <div className="chairman-label">
            Chairman: {shortModelName}
            <span className="thinking-badge">Thinking<span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span></span>
          </div>
          <div className="thinking-container">
            <div className="thinking-message">
              <span className="thinking-icon">🧠</span>
              <span>Analyzing all council responses and peer rankings to synthesize the final answer...</span>
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
        Stage 3: Final Council Answer
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        {isCollapsed && savedDecisionId && (
          <span className="collapsed-summary">
            <span className="kb-saved-badge">Decision saved</span>
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <div className="final-response">
          {/* Sticky copy button - always visible */}
          {isComplete && (
            <div className="sticky-copy-btn">
              <CopyButton text={displayText} label="Copy full response" />
            </div>
          )}
          <div className="chairman-label">
            <span className="chairman-info">
              Chairman: {shortModelName}
              {isStreaming && <span className="typing-indicator">●</span>}
              {isComplete && <span className="complete-badge">Complete</span>}
              {hasError && <span className="error-badge">Error</span>}
            </span>
          </div>
        <div className={`final-text markdown-content ${hasError ? 'error-text' : ''}`}>
          {hasError ? (
            <p className="empty-message">{displayText || 'An error occurred while generating the synthesis.'}</p>
          ) : (
            <>
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
                  }
                }}
              >
                {displayText}
              </ReactMarkdown>
              {isStreaming && <span className="cursor">▊</span>}
            </>
          )}
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
                    title={currentProject ? `Linked to: ${currentProject.name}` : 'Select project'}
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    <span>{currentProject ? currentProject.name : 'Project'}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showProjectDropdown && createPortal(
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
                              onCreateProject();
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

                {/* Type selector pills */}
                <div className="save-type-pills">
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
                        title={isSaved && isSelected ? `Saved as ${type.label}` : `Save as ${type.label}`}
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
                      // Verify decision still exists before navigating
                      try {
                        const check = await api.getConversationDecision(conversationId, companyId, responseIndex);
                        if (!check?.decision) {
                          // Decision was deleted - reset state
                          setSavedDecisionId(null);
                          setSaveState('idle');
                          return;
                        }
                      } catch {
                        // Decision not found - reset state
                        setSavedDecisionId(null);
                        setSaveState('idle');
                        return;
                      }

                      if (promotedPlaybookId) {
                        onViewDecision && onViewDecision(savedDecisionId, 'playbook', promotedPlaybookId);
                      } else if (currentProject) {
                        onViewDecision && onViewDecision(savedDecisionId, 'project', currentProject.id);
                      } else {
                        handleViewDecision();
                      }
                    }}
                  >
                    View in project
                  </button>
                </div>
              ) : (
                // Not saved yet - show save button
                <button
                  className={`save-action-btn ${saveState === 'saving' || saveState === 'promoting' ? 'loading' : ''}`}
                  onClick={selectedDocType ? handleSaveAndPromote : handleSaveForLater}
                  disabled={saveState === 'saving' || saveState === 'promoting'}
                  title={currentProject
                    ? 'Save this decision and merge into the project context'
                    : selectedDocType
                      ? `Save as ${DOC_TYPES.find(t => t.value === selectedDocType)?.label} to your knowledge base`
                      : 'Save to your knowledge base for later'}
                >
                  {(saveState === 'saving' || saveState === 'promoting') ? (
                    <>
                      <Spinner size="sm" variant="muted" />
                      <span>{currentProject ? 'Saving...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" />
                      <span>{currentProject ? `Save to ${currentProject.name}` : 'Save Decision'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
