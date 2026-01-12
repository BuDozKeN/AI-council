import { useState, useCallback, useMemo } from 'react';
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { Spinner } from './Spinner';
import { logger } from '../../utils/logger';
import './AIWriteAssist.css';

type ContextType =
  | 'project-title'
  | 'project-description'
  | 'project-context'
  | 'company-context'
  | 'department-description'
  | 'role-description'
  | 'role-prompt'
  | 'playbook-content'
  | 'decision-title'
  | 'decision-statement'
  | 'knowledge-reasoning'
  | 'question-refine'
  | 'generic';

interface ContextPromptConfig {
  instruction: string;
  placeholder: string;
  buttonText: string;
  emptyHint: string;
}

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
const CONTEXT_PROMPTS: Record<ContextType, ContextPromptConfig> = {
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
    emptyHint: "Describe what you're building",
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
    instruction: `Take what I wrote and turn it into a clear, well-organized answer.
Keep my original meaning but make it sound professional and complete.
If I only gave a few words, expand them into a proper sentence or two.`,
    placeholder: 'Tell us about your company...',
    buttonText: 'Write it nicely for me',
    emptyHint: 'Just type what you know',
  },
  'department-description': {
    instruction: 'Write a clear 1-2 sentence description of what this department does based on:',
    placeholder: 'What does this department handle?',
    buttonText: 'Help me write this',
    emptyHint: 'Describe what this team does',
  },
  'role-description': {
    instruction: "Write a clear description of this role's responsibilities based on:",
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
    placeholder: 'Describe what you need (e.g., "how we onboard new customers")...',
    buttonText: 'Let our expert write this', // Dynamic: updated based on playbookType
    emptyHint: 'Type a brief description - AI will write the full document',
  },
  'decision-title': {
    instruction:
      'Generate a clear, searchable title for this decision (format: "[Action] [Subject] [Context]"):',
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
  generic: {
    instruction: 'Improve the clarity of this text while keeping the same meaning:',
    placeholder: 'Enter your text...',
    buttonText: 'Help me write this',
    emptyHint: 'Type something',
  },
};

type PlaybookType = 'sop' | 'framework' | 'policy';

interface AIWriteAssistProps {
  context?: ContextType | undefined;
  value?: string | undefined;
  onSuggestion?: ((suggestion: string) => void) | undefined;
  /** Callback for AI-generated title (only for playbook content) */
  onTitleSuggestion?: ((title: string) => void) | undefined;
  additionalContext?: string | undefined;
  buttonLabel?: string | null | undefined;
  playbookType?: PlaybookType | null | undefined;
  disabled?: boolean | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
  inline?: boolean | undefined;
}

/**
 * AIWriteAssist Component
 */
export function AIWriteAssist({
  context = 'generic',
  value = '',
  onSuggestion,
  onTitleSuggestion,
  additionalContext = '',
  buttonLabel = null,
  playbookType = null,
  disabled = false,
  children,
  className = '',
  inline = false,
}: AIWriteAssistProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<string>('');
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);

  const config = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.generic;
  const hasContent = value && value.trim().length > 0;

  // Map context type to translation key prefix
  const contextKeyMap: Record<ContextType, string> = useMemo(
    () => ({
      'project-title': 'projectTitle',
      'project-description': 'projectDescription',
      'project-context': 'projectContext',
      'company-context': 'companyContext',
      'department-description': 'departmentDescription',
      'role-description': 'roleDescription',
      'role-prompt': 'rolePrompt',
      'playbook-content': 'playbookContent',
      'decision-title': 'decisionTitle',
      'decision-statement': 'decisionStatement',
      'knowledge-reasoning': 'knowledgeReasoning',
      'question-refine': 'questionRefine',
      generic: 'generic',
    }),
    []
  );

  // Get translated button text for playbook content based on type
  const getPlaybookButtonText = useCallback(
    (type: PlaybookType | null): string => {
      switch (type) {
        case 'sop':
          return t('aiAssist.contexts.playbookContent.buttonSop');
        case 'framework':
          return t('aiAssist.contexts.playbookContent.buttonFramework');
        case 'policy':
          return t('aiAssist.contexts.playbookContent.buttonPolicy');
        default:
          return t('aiAssist.contexts.playbookContent.button');
      }
    },
    [t]
  );

  // Get translated button text based on context
  const getButtonText = useCallback((): string => {
    const contextKey = contextKeyMap[context];
    return t(`aiAssist.contexts.${contextKey}.button`, { defaultValue: config.buttonText });
  }, [t, context, contextKeyMap, config.buttonText]);

  // Get translated empty hint based on context
  const getEmptyHint = useCallback((): string => {
    const contextKey = contextKeyMap[context];
    return t(`aiAssist.contexts.${contextKey}.hint`, { defaultValue: config.emptyHint });
  }, [t, context, contextKeyMap, config.emptyHint]);

  const displayButtonText =
    buttonLabel ||
    (context === 'playbook-content' && playbookType
      ? getPlaybookButtonText(playbookType)
      : getButtonText());

  const displayEmptyHint = getEmptyHint();

  const handleAssist = useCallback(async () => {
    if (!hasContent || loading) return;

    setLoading(true);
    setError(null);
    setSuggestedTitle(null);

    try {
      // Build the prompt
      let prompt = config.instruction + '\n\n';
      if (additionalContext) {
        prompt += `Context: ${additionalContext}\n\n`;
      }
      prompt += `User input:\n${value}`;

      // Call the API with playbook type if applicable
      const apiParams: { prompt: string; context: string; playbookType?: string } = {
        prompt,
        context,
      };
      if (playbookType) {
        apiParams.playbookType = playbookType;
      }
      const result = await api.aiWriteAssist(apiParams);
      logger.info('[AIWriteAssist] API response received:', {
        hasTitle: !!result.title,
        titleValue: result.title,
        suggestionLength: result.suggestion?.length,
      });

      if (result.suggestion) {
        setSuggestion(result.suggestion);
        // Capture title if returned (for playbook content)
        if (result.title) {
          logger.info('[AIWriteAssist] Setting suggestedTitle:', result.title);
          setSuggestedTitle(result.title);
        }
        setShowPreview(true);
      } else {
        setError(t('aiAssist.noSuggestion'));
      }
    } catch (err) {
      logger.error('AI assist error:', err);
      const errorMessage = err instanceof Error ? err.message : t('aiAssist.failedToGet');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t, value, hasContent, loading, config.instruction, additionalContext, context, playbookType]);

  const handleAccept = useCallback(() => {
    logger.info('[AIWriteAssist] Accept clicked', {
      hasSuggestion: !!suggestion,
      hasTitle: !!suggestedTitle,
      titleValue: suggestedTitle,
      hasCallback: !!onTitleSuggestion,
    });

    if (suggestion && onSuggestion) {
      onSuggestion(suggestion);
    }
    // Also pass the title if available
    if (suggestedTitle && onTitleSuggestion) {
      logger.info('[AIWriteAssist] Calling onTitleSuggestion with:', suggestedTitle);
      onTitleSuggestion(suggestedTitle);
    }
    setShowPreview(false);
    setSuggestion('');
    setSuggestedTitle(null);
  }, [suggestion, onSuggestion, suggestedTitle, onTitleSuggestion]);

  const handleReject = useCallback(() => {
    setShowPreview(false);
    setSuggestion('');
    setSuggestedTitle(null);
  }, []);

  // If wrapping children, add the button alongside
  if (children) {
    return (
      <div className={`ai-assist-wrapper ${inline ? 'ai-assist-inline' : ''} ${className}`}>
        <div className="ai-assist-input-area">{children}</div>
        <div className="ai-assist-controls">
          <button
            type="button"
            className="ai-assist-btn"
            onClick={handleAssist}
            disabled={disabled || loading || !hasContent}
            title={hasContent ? displayButtonText : displayEmptyHint}
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <span className="ai-assist-icon">✨</span>
                <span className="ai-assist-text">{displayButtonText}</span>
              </>
            )}
          </button>
          {error && <span className="ai-assist-error">{error}</span>}
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="ai-assist-preview">
            <div className="ai-assist-preview-header">
              <span className="ai-assist-preview-title">✨ {t('aiAssist.suggestion')}</span>
            </div>
            {suggestedTitle && (
              <div className="ai-assist-preview-title-suggestion">
                <span className="ai-assist-preview-label">{t('common.suggestedTitle')}:</span>
                <span className="ai-assist-preview-title-text">{suggestedTitle}</span>
              </div>
            )}
            <div className="ai-assist-preview-content">{suggestion}</div>
            <div className="ai-assist-preview-actions">
              <button type="button" className="ai-assist-preview-btn reject" onClick={handleReject}>
                {t('common.keepOriginal')}
              </button>
              <button type="button" className="ai-assist-preview-btn accept" onClick={handleAccept}>
                {t('common.useSuggestion')}
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
        title={hasContent ? displayButtonText : displayEmptyHint}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            <span className="ai-assist-icon">✨</span>
            <span className="ai-assist-text">{displayButtonText}</span>
          </>
        )}
      </button>
      {error && <span className="ai-assist-error">{error}</span>}

      {/* Preview Modal */}
      {showPreview && (
        <div className="ai-assist-preview">
          <div className="ai-assist-preview-header">
            <span className="ai-assist-preview-title">✨ {t('aiAssist.suggestion')}</span>
          </div>
          {suggestedTitle && (
            <div className="ai-assist-preview-title-suggestion">
              <span className="ai-assist-preview-label">{t('common.suggestedTitle')}:</span>
              <span className="ai-assist-preview-title-text">{suggestedTitle}</span>
            </div>
          )}
          <div className="ai-assist-preview-content">{suggestion}</div>
          <div className="ai-assist-preview-actions">
            <button type="button" className="ai-assist-preview-btn reject" onClick={handleReject}>
              {t('common.keepOriginal')}
            </button>
            <button type="button" className="ai-assist-preview-btn accept" onClick={handleAccept}>
              {t('common.useSuggestion')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SmartInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  context?: ContextType | undefined;
  value: string;
  onChange: (value: string) => void;
  additionalContext?: string | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

// Map context type to translation key prefix (duplicated for subcomponents)
const CONTEXT_KEY_MAP: Record<ContextType, string> = {
  'project-title': 'projectTitle',
  'project-description': 'projectDescription',
  'project-context': 'projectContext',
  'company-context': 'companyContext',
  'department-description': 'departmentDescription',
  'role-description': 'roleDescription',
  'role-prompt': 'rolePrompt',
  'playbook-content': 'playbookContent',
  'decision-title': 'decisionTitle',
  'decision-statement': 'decisionStatement',
  'knowledge-reasoning': 'knowledgeReasoning',
  'question-refine': 'questionRefine',
  generic: 'generic',
};

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
}: SmartInputProps) {
  const { t } = useTranslation();
  const config = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.generic;
  const contextKey = CONTEXT_KEY_MAP[context];
  const translatedPlaceholder = t(`aiAssist.contexts.${contextKey}.placeholder`, {
    defaultValue: config.placeholder,
  });

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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || translatedPlaceholder}
        {...props}
      />
    </AIWriteAssist>
  );
}

interface SmartTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  context?: ContextType | undefined;
  value: string;
  onChange: (value: string) => void;
  additionalContext?: string | undefined;
  placeholder?: string | undefined;
  rows?: number | undefined;
  className?: string | undefined;
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
}: SmartTextareaProps) {
  const { t } = useTranslation();
  const config = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.generic;
  const contextKey = CONTEXT_KEY_MAP[context];
  const translatedPlaceholder = t(`aiAssist.contexts.${contextKey}.placeholder`, {
    defaultValue: config.placeholder,
  });

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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || translatedPlaceholder}
        rows={rows}
        {...props}
      />
    </AIWriteAssist>
  );
}

export default AIWriteAssist;
