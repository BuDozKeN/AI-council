import { useState, useCallback } from 'react';
import { api } from '../../api';
import { Spinner } from './Spinner';
import './AIWriteAssist.css';

/**
 * AI Writing Assistant - Context-aware help for form fields
 *
 * Provides a "magic wand" button that helps users write better content
 * by sending their draft to an LLM with a context-specific prompt.
 *
 * Usage:
 *   <AIWriteAssist
 *     context="project-title"
 *     value={title}
 *     onSuggestion={setTitle}
 *     placeholder="What should this project be called?"
 *   />
 *
 * Or wrap an existing input:
 *   <AIWriteAssist context="description" value={desc} onSuggestion={setDesc}>
 *     <textarea value={desc} onChange={e => setDesc(e.target.value)} />
 *   </AIWriteAssist>
 *
 * Context Types (determines the AI prompt):
 *   - "project-title": Generate a clear, concise project name
 *   - "project-description": Write a compelling project description
 *   - "project-context": Structure project context markdown
 *   - "company-context": Write comprehensive company context
 *   - "department-description": Describe what a department does
 *   - "role-description": Describe what a role does
 *   - "role-prompt": Write an AI role system prompt
 *   - "playbook-content": Structure SOP/policy content
 *   - "decision-title": Generate a clear decision title
 *   - "decision-statement": Clarify a decision statement
 *   - "knowledge-reasoning": Explain reasoning behind a decision
 *   - "question-refine": Help refine a council question
 *   - "generic": General writing improvement
 */

// Context-specific prompts for the AI
// Button text should be PLAIN ENGLISH - what your mum would understand
const CONTEXT_PROMPTS = {
  'project-title': {
    instruction: 'Generate a clear, concise project name (3-6 words) based on this description:',
    placeholder: 'Describe your project briefly...',
    buttonText: 'Write title for me',
    emptyHint: 'Type a few words about your project',
  },
  'project-description': {
    instruction: 'Write a clear 1-2 sentence project description based on this:',
    placeholder: 'What is this project about?',
    buttonText: 'AI, rewrite this better',
    emptyHint: 'Describe what you\'re building',
  },
  'project-context': {
    instruction: `Take what I wrote and turn it into a clear, well-organized project document.

Use clean markdown formatting:
- Use ## for section headers
- Use - for bullet points

Include sections for:
- Objective (what we're building)
- Goals (what success looks like)
- Deliverables (specific things to create)
- Constraints (budget, timeline, resources)
- Technical notes (if applicable)

Keep it concise but comprehensive:`,
    placeholder: 'Tell us about your project...',
    buttonText: 'AI, rewrite this better',
    emptyHint: 'Just type what you know about the project',
  },
  'company-context': {
    instruction: `Take what I wrote and turn it into a clear company overview with sections for:
- Company Overview (what you do, stage, size)
- Mission & Vision
- Current Goals & Priorities
- Constraints (budget, resources, timeline)
- Key Policies & Standards

This context will be used by AI advisors, so be specific:`,
    placeholder: 'Tell us about your company...',
    buttonText: 'Expand this for me',
    emptyHint: 'Just type what you know about your company',
  },
  'department-description': {
    instruction: 'Write a clear 1-2 sentence description of what this department does based on:',
    placeholder: 'What does this department handle?',
    buttonText: 'Help me write this',
    emptyHint: 'Describe what this team does',
  },
  'role-description': {
    instruction: 'Write a clear description of this role\'s responsibilities based on:',
    placeholder: 'What does this role do?',
    buttonText: 'Help me write this',
    emptyHint: 'Describe what this person does',
  },
  'role-prompt': {
    instruction: `Create instructions for an AI advisor playing this role. The instructions should:
- Define what they're an expert in
- Set how they think (analytical, creative, practical, etc.)
- Be written as "You are..."

Based on this role:`,
    placeholder: 'Describe the role...',
    buttonText: 'Write instructions',
    emptyHint: 'Describe what kind of advisor this should be',
  },
  'playbook-content': {
    instruction: `Turn this into a proper step-by-step guide with:
- Clear purpose at the top
- Numbered steps
- Who's responsible for what
- How to know if it worked
- Common mistakes to avoid

Make it easy to follow:`,
    placeholder: 'Describe what you want documented...',
    buttonText: 'Write it for me',
    emptyHint: 'Just describe what you want - AI will write the steps',
  },
  'decision-title': {
    instruction: 'Generate a clear, searchable title for this decision (format: "[Action] [Subject] [Context]"):',
    placeholder: 'What was decided?',
    buttonText: 'Write title for me',
    emptyHint: 'Summarize the decision briefly',
  },
  'decision-statement': {
    instruction: 'Rewrite this as a clear statement of what was decided and what to do next:',
    placeholder: 'What was decided?',
    buttonText: 'Make it clearer',
    emptyHint: 'State what was decided',
  },
  'knowledge-reasoning': {
    instruction: 'Expand this into clear reasoning that explains WHY this decision was made:',
    placeholder: 'Why was this decided?',
    buttonText: 'Help me explain',
    emptyHint: 'Add any reasoning you remember',
  },
  'question-refine': {
    instruction: `Make this question clearer and more specific so the AI council can give better advice:`,
    placeholder: 'What do you want to ask?',
    buttonText: 'Help me ask better',
    emptyHint: 'Type your question',
  },
  'generic': {
    instruction: 'Improve the clarity of this text while keeping the same meaning:',
    placeholder: 'Enter your text...',
    buttonText: 'Help me write this',
    emptyHint: 'Type something',
  },
};

/**
 * AIWriteAssist Component
 *
 * @param {string} context - The type of content (determines AI prompt)
 * @param {string} value - Current input value
 * @param {function} onSuggestion - Called with AI suggestion
 * @param {string} [additionalContext] - Extra context for the AI (e.g., company name)
 * @param {boolean} [disabled] - Disable the assist button
 * @param {React.ReactNode} [children] - Wrap an existing input
 * @param {string} [className] - Additional CSS class
 * @param {boolean} [inline] - Show button inline with input
 */
export function AIWriteAssist({
  context = 'generic',
  value = '',
  onSuggestion,
  additionalContext = '',
  playbookType = null, // For playbook content: 'sop', 'framework', 'policy'
  disabled = false,
  children,
  className = '',
  inline = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [suggestion, setSuggestion] = useState('');

  const config = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.generic;
  const hasContent = value && value.trim().length > 0;

  const handleAssist = useCallback(async () => {
    if (!hasContent || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Build the prompt
      let prompt = config.instruction + '\n\n';
      if (additionalContext) {
        prompt += `Context: ${additionalContext}\n\n`;
      }
      prompt += `User input:\n${value}`;

      // Call the API with playbook type if applicable
      const result = await api.aiWriteAssist({ prompt, context, playbookType });

      if (result.suggestion) {
        setSuggestion(result.suggestion);
        setShowPreview(true);
      } else {
        setError('No suggestion returned');
      }
    } catch (err) {
      console.error('AI assist error:', err);
      setError(err.message || 'Failed to get suggestion');
    } finally {
      setLoading(false);
    }
  }, [value, hasContent, loading, config.instruction, additionalContext, context, playbookType]);

  const handleAccept = useCallback(() => {
    if (suggestion && onSuggestion) {
      onSuggestion(suggestion);
    }
    setShowPreview(false);
    setSuggestion('');
  }, [suggestion, onSuggestion]);

  const handleReject = useCallback(() => {
    setShowPreview(false);
    setSuggestion('');
  }, []);

  // If wrapping children, add the button alongside
  if (children) {
    return (
      <div className={`ai-assist-wrapper ${inline ? 'ai-assist-inline' : ''} ${className}`}>
        <div className="ai-assist-input-area">
          {children}
        </div>
        <div className="ai-assist-controls">
          <button
            type="button"
            className="ai-assist-btn"
            onClick={handleAssist}
            disabled={disabled || loading || !hasContent}
            title={hasContent ? config.buttonText : config.emptyHint}
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <span className="ai-assist-icon">✨</span>
                <span className="ai-assist-text">{config.buttonText}</span>
              </>
            )}
          </button>
          {error && <span className="ai-assist-error">{error}</span>}
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="ai-assist-preview">
            <div className="ai-assist-preview-header">
              <span className="ai-assist-preview-title">✨ AI Suggestion</span>
            </div>
            <div className="ai-assist-preview-content">
              {suggestion}
            </div>
            <div className="ai-assist-preview-actions">
              <button
                type="button"
                className="ai-assist-preview-btn reject"
                onClick={handleReject}
              >
                Keep Original
              </button>
              <button
                type="button"
                className="ai-assist-preview-btn accept"
                onClick={handleAccept}
              >
                Use Suggestion
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standalone mode - just the button (for use next to existing inputs)
  return (
    <div className={`ai-assist-standalone ${className}`}>
      <button
        type="button"
        className="ai-assist-btn"
        onClick={handleAssist}
        disabled={disabled || loading || !hasContent}
        title={hasContent ? config.buttonText : config.emptyHint}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            <span className="ai-assist-icon">✨</span>
            <span className="ai-assist-text">{config.buttonText}</span>
          </>
        )}
      </button>
      {error && <span className="ai-assist-error">{error}</span>}

      {/* Preview Modal */}
      {showPreview && (
        <div className="ai-assist-preview">
          <div className="ai-assist-preview-header">
            <span className="ai-assist-preview-title">✨ AI Suggestion</span>
          </div>
          <div className="ai-assist-preview-content">
            {suggestion}
          </div>
          <div className="ai-assist-preview-actions">
            <button
              type="button"
              className="ai-assist-preview-btn reject"
              onClick={handleReject}
            >
              Keep Original
            </button>
            <button
              type="button"
              className="ai-assist-preview-btn accept"
              onClick={handleAccept}
            >
              Use Suggestion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Smart Input - Input with integrated AI assistance
 */
export function SmartInput({
  context = 'generic',
  value,
  onChange,
  additionalContext,
  placeholder,
  className = '',
  ...props
}) {
  const config = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.generic;

  return (
    <AIWriteAssist
      context={context}
      value={value}
      onSuggestion={onChange}
      additionalContext={additionalContext}
      inline
    >
      <input
        type="text"
        className={`form-input ${className}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || config.placeholder}
        {...props}
      />
    </AIWriteAssist>
  );
}

/**
 * Smart Textarea - Textarea with integrated AI assistance
 */
export function SmartTextarea({
  context = 'generic',
  value,
  onChange,
  additionalContext,
  placeholder,
  rows = 3,
  className = '',
  ...props
}) {
  const config = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.generic;

  return (
    <AIWriteAssist
      context={context}
      value={value}
      onSuggestion={onChange}
      additionalContext={additionalContext}
    >
      <textarea
        className={`form-textarea ${className}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || config.placeholder}
        rows={rows}
        {...props}
      />
    </AIWriteAssist>
  );
}

export default AIWriteAssist;
