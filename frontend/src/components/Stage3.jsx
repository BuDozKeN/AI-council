import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { DepartmentSelect } from './ui/DepartmentSelect';
import { Bookmark, FileText, Layers, ScrollText } from 'lucide-react';
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
    <button className="copy-btn" onClick={handleCopy} title={label}>
      {copied ? (
        <span className="copy-icon">✓</span>
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
      <button className="copy-code-btn" onClick={handleCopy} title="Copy code">
        {copied ? (
          <span className="copy-icon">✓</span>
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
  defaultCollapsed = false,
  onViewDecision,  // Callback to open My Company with decision
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'promoting' | 'promoted' | 'error'
  const [savedDecisionId, setSavedDecisionId] = useState(null); // ID of saved decision
  const [promotedPlaybookId, setPromotedPlaybookId] = useState(null); // ID of promoted playbook

  // Save toolbar state
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState(departmentId || 'all');
  const [selectedDocType, setSelectedDocType] = useState('');

  // Load departments when complete (for the toolbar)
  useEffect(() => {
    if (companyId && departments.length === 0 && !streaming?.error) {
      api.getCompanyTeam(companyId)
        .then(data => {
          setDepartments(data.departments || []);
          if (departmentId) {
            setSelectedDeptId(departmentId);
          }
        })
        .catch(err => console.error('Failed to load departments:', err));
    }
  }, [companyId, departmentId, departments.length, streaming?.error]);

  // Determine what to display (moved up so displayText is available)
  const displayText = finalResponse?.response || streaming?.text || '';

  // Generate title from conversation or first line
  const getTitle = () => {
    return conversationTitle ||
      (displayText.split('\n')[0].slice(0, 100)) ||
      'Council Decision';
  };

  // Save as Decision only (for later promotion)
  const handleSaveForLater = async () => {
    if (!companyId || saveState === 'saving' || savedDecisionId) return;

    setSaveState('saving');
    try {
      const result = await api.createCompanyDecision(companyId, {
        title: getTitle(),
        content: displayText,
        department_id: selectedDeptId === 'all' ? null : selectedDeptId,
        source_conversation_id: conversationId?.startsWith('temp-') ? null : conversationId,
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
        department_id: selectedDeptId === 'all' ? null : selectedDeptId,
        source_conversation_id: conversationId?.startsWith('temp-') ? null : conversationId,
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
        department_id: selectedDeptId === 'all' ? null : selectedDeptId
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
    <div className={`stage stage3 ${isCollapsed ? 'collapsed' : ''}`}>
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
              {/* Left group: Department + Type in a visual container */}
              <div className="save-options-group">
                {/* Compact department selector with colors */}
                <DepartmentSelect
                  value={selectedDeptId}
                  onValueChange={setSelectedDeptId}
                  departments={departments}
                  includeAll={true}
                  allLabel="All Departments"
                  disabled={saveState !== 'idle'}
                  className="save-dept-trigger"
                  compact={true}
                />

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

              {/* Save/Access button - transforms after save */}
              {(saveState === 'saved' || saveState === 'promoted') ? (
                <button
                  className="save-access-btn"
                  onClick={() => {
                    if (promotedPlaybookId) {
                      onViewDecision && onViewDecision(savedDecisionId, 'playbook', promotedPlaybookId);
                    } else {
                      handleViewDecision();
                    }
                  }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>
                    {selectedDocType
                      ? `Access ${DOC_TYPES.find(t => t.value === selectedDocType)?.label}`
                      : 'Access Decision'}
                  </span>
                </button>
              ) : (
                <button
                  className={`save-action-btn ${saveState === 'saving' || saveState === 'promoting' ? 'loading' : ''}`}
                  onClick={selectedDocType ? handleSaveAndPromote : handleSaveForLater}
                  disabled={saveState === 'saving' || saveState === 'promoting'}
                  title={selectedDocType ? `Save as ${DOC_TYPES.find(t => t.value === selectedDocType)?.label} to your knowledge base` : 'Save to your knowledge base for later'}
                >
                  {(saveState === 'saving' || saveState === 'promoting') ? (
                    <>
                      <span className="save-spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" />
                      <span>{selectedDocType ? `Save ${DOC_TYPES.find(t => t.value === selectedDocType)?.label}` : 'Save'}</span>
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
