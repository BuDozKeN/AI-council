import { useState, FormEvent, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import { Pencil } from 'lucide-react';
import './Triage.css';

interface TriageResult {
  ready?: boolean;
  constraints?: Record<string, unknown>;
  questions?: string;
  follow_up_question?: string;
  enhanced_query?: string;
}

interface TriageProps {
  triageResult: TriageResult | null;
  originalQuestion: string;
  onRespond: (response: string) => void;
  onSkip: () => void;
  onProceed: (query: string) => void;
  isLoading: boolean;
}

export default function Triage({
  triageResult,
  originalQuestion,
  onRespond,
  onSkip,
  onProceed,
  isLoading,
}: TriageProps) {
  const [response, setResponse] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedConstraints, setEditedConstraints] = useState<Record<string, unknown> | null>(null);

  const handleSubmit = (e: FormEvent | KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (response.trim()) {
      onRespond(response.trim());
      setResponse('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startEditing = () => {
    setEditedConstraints(triageResult?.constraints ? { ...triageResult.constraints } : {});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedConstraints(null);
    setIsEditing(false);
  };

  const saveEdits = () => {
    // Build enhanced query with edited constraints
    const c = editedConstraints ?? {};
    const getStr = (v: unknown): string => (typeof v === 'string' ? v : 'Not specified');
    const enhanced = `${originalQuestion}

Context:
- Who: ${getStr(c.who)}
- Goal: ${getStr(c.goal)}
- Budget: ${getStr(c.budget)}
- Priority: ${getStr(c.risk)}`;

    setIsEditing(false);
    onProceed(enhanced);
  };

  const updateConstraint = (key: string, value: string) => {
    setEditedConstraints(prev => prev ? { ...prev, [key]: value } : { [key]: value });
  };

  if (!triageResult) return null;

  const { ready, constraints, questions, enhanced_query } = triageResult;
  const displayConstraints = isEditing ? editedConstraints : constraints;

  // Ready state - show summary and proceed
  if (ready) {
    return (
      <div className="triage-conversation">
        {/* User's question */}
        <div className="triage-message user">
          <div className="message-label">You</div>
          <div className="message-bubble user">{originalQuestion}</div>
        </div>

        {/* AI ready response */}
        <div className="triage-message ai">
          <div className="message-label">Pre-Council</div>
          <div className="message-bubble ai ready">
            <div className="ready-header">
              <span className="ready-icon">✓</span>
              <span>Got it! Here's what I understood:</span>
              {!isEditing && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={startEditing} title="Edit constraints">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="constraints-summary">
              {displayConstraints?.who !== undefined && (
                <div className="constraint-row">
                  <span className="constraint-label">Who:</span>
                  {isEditing ? (
                    <textarea
                      id="triage-constraint-who"
                      name="constraint-who"
                      className="constraint-edit"
                      value={typeof editedConstraints?.who === 'string' ? editedConstraints.who : ''}
                      onChange={(e) => updateConstraint('who', e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <span className="constraint-value">{String(constraints?.who ?? '')}</span>
                  )}
                </div>
              )}
              {displayConstraints?.goal !== undefined && (
                <div className="constraint-row">
                  <span className="constraint-label">Goal:</span>
                  {isEditing ? (
                    <textarea
                      id="triage-constraint-goal"
                      name="constraint-goal"
                      className="constraint-edit"
                      value={typeof editedConstraints?.goal === 'string' ? editedConstraints.goal : ''}
                      onChange={(e) => updateConstraint('goal', e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <span className="constraint-value">{String(constraints?.goal ?? '')}</span>
                  )}
                </div>
              )}
              {displayConstraints?.budget !== undefined && (
                <div className="constraint-row">
                  <span className="constraint-label">Budget:</span>
                  {isEditing ? (
                    <textarea
                      id="triage-constraint-budget"
                      name="constraint-budget"
                      className="constraint-edit"
                      value={typeof editedConstraints?.budget === 'string' ? editedConstraints.budget : ''}
                      onChange={(e) => updateConstraint('budget', e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <span className="constraint-value">{String(constraints?.budget ?? '')}</span>
                  )}
                </div>
              )}
              {displayConstraints?.risk !== undefined && (
                <div className="constraint-row">
                  <span className="constraint-label">Priority:</span>
                  {isEditing ? (
                    <textarea
                      id="triage-constraint-priority"
                      name="constraint-priority"
                      className="constraint-edit"
                      value={typeof editedConstraints?.risk === 'string' ? editedConstraints.risk : ''}
                      onChange={(e) => updateConstraint('risk', e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <span className="constraint-value">{String(constraints?.risk ?? '')}</span>
                  )}
                </div>
              )}
            </div>

            <div className="ready-actions">
              {isEditing ? (
                <>
                  <Button
                    onClick={saveEdits}
                    disabled={isLoading}
                  >
                    Save & Send →
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEditing}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => onProceed(enhanced_query ?? originalQuestion)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Sending...' : 'Send to Council →'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={isLoading}
                  >
                    Start over
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not ready - show conversation
  return (
    <div className="triage-conversation">
      {/* User's question */}
      <div className="triage-message user">
        <div className="message-label">You</div>
        <div className="message-bubble user">{originalQuestion}</div>
      </div>

      {/* AI asking for context */}
      <div className="triage-message ai">
        <div className="message-label">Pre-Council</div>
        <div className="message-bubble ai">
          {questions ? (
            <div className="ai-questions">
              <ReactMarkdown>{questions}</ReactMarkdown>
            </div>
          ) : (
            <div className="ai-questions">
              <p>Before I send this to the council, could you tell me:</p>
              <ul>
                <li>Who would handle this?</li>
                <li>What's your budget?</li>
                <li>Is this for immediate revenue or long-term value?</li>
                <li>Speed or quality priority?</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Response input */}
      <div className="triage-input">
        <form onSubmit={handleSubmit}>
          <textarea
            id="triage-response"
            name="triage-response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={isLoading}
            rows={2}
            autoFocus
          />
          <div className="input-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={onSkip}
              disabled={isLoading}
            >
              Skip
            </Button>
            <Button
              type="submit"
              disabled={!response.trim() || isLoading}
            >
              {isLoading ? '...' : 'Reply'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
