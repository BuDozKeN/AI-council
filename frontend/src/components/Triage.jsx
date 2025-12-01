import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Triage.css';

export default function Triage({
  triageResult,
  originalQuestion,
  onRespond,
  onSkip,
  onProceed,
  isLoading,
}) {
  const [response, setResponse] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (response.trim()) {
      onRespond(response.trim());
      setResponse('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!triageResult) return null;

  const { ready, constraints, missing, questions, enhanced_query } = triageResult;

  // If ready, show success state
  if (ready) {
    return (
      <div className="triage-container">
        {/* User's original question */}
        <div className="triage-user-question">
          <div className="message-label">You</div>
          <div className="message-content">{originalQuestion}</div>
        </div>

        {/* Triage ready response */}
        <div className="triage-response">
          <div className="message-label">Pre-Council Check</div>
          <div className="triage-card ready">
            <div className="triage-header ready">
              <span className="triage-header-icon">✅</span>
              <span className="triage-header-text">Ready to send to the council</span>
            </div>
            <div className="triage-body">
              <div className="triage-summary">
                <p className="triage-summary-intro">Here's what I understood from your question:</p>
                <ul className="triage-summary-list">
                  {constraints.who && (
                    <li><strong>Who's doing this:</strong> {constraints.who}</li>
                  )}
                  {constraints.goal && (
                    <li><strong>Your goal:</strong> {constraints.goal}</li>
                  )}
                  {constraints.budget && (
                    <li><strong>Budget:</strong> {constraints.budget}</li>
                  )}
                  {constraints.risk && (
                    <li><strong>Quality priority:</strong> {constraints.risk}</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="triage-ready-actions">
              <button
                className="triage-proceed-btn"
                onClick={() => onProceed(enhanced_query)}
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send to Council'} →
              </button>
              <button
                className="triage-edit-btn"
                onClick={onSkip}
                disabled={isLoading}
              >
                Edit & Resend
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not ready - show what's needed
  return (
    <div className="triage-container">
      {/* User's original question */}
      <div className="triage-user-question">
        <div className="message-label">You</div>
        <div className="message-content">{originalQuestion}</div>
      </div>

      {/* Triage needs more info */}
      <div className="triage-response">
        <div className="message-label">Pre-Council Check</div>
        <div className="triage-card needs-info">
          <div className="triage-header needs-info">
            <span className="triage-header-icon">🔍</span>
            <span className="triage-header-text">A few more details will help get better answers</span>
          </div>
          <div className="triage-body">
            {/* What we already know */}
            {Object.values(constraints).some(v => v) && (
              <div className="triage-known">
                <div className="triage-section-title">
                  <span>✓</span> What I already know:
                </div>
                <ul className="triage-known-list">
                  {constraints.who && <li><strong>Who:</strong> {constraints.who}</li>}
                  {constraints.goal && <li><strong>Goal:</strong> {constraints.goal}</li>}
                  {constraints.budget && <li><strong>Budget:</strong> {constraints.budget}</li>}
                  {constraints.risk && <li><strong>Quality:</strong> {constraints.risk}</li>}
                </ul>
              </div>
            )}

            {/* What's missing */}
            <div className="triage-missing">
              <div className="triage-section-title missing">
                <span>⚠</span> What I still need:
              </div>
              <ul className="triage-missing-list">
                {missing?.includes('who') && (
                  <li className="triage-missing-item">
                    <div className="triage-missing-title">Who will do this?</div>
                    <div className="triage-missing-hint">Are you (the founder) doing this yourself, or your developer, or hiring someone?</div>
                  </li>
                )}
                {missing?.includes('goal') && (
                  <li className="triage-missing-item">
                    <div className="triage-missing-title">What's your main goal?</div>
                    <div className="triage-missing-hint">Do you need cash flow NOW (survival), or are you building for a future exit?</div>
                  </li>
                )}
                {missing?.includes('budget') && (
                  <li className="triage-missing-item">
                    <div className="triage-missing-title">What's your budget?</div>
                    <div className="triage-missing-hint">Is this $0 (use what you have), or can you invest some money?</div>
                  </li>
                )}
                {missing?.includes('risk') && (
                  <li className="triage-missing-item">
                    <div className="triage-missing-title">Speed or quality?</div>
                    <div className="triage-missing-hint">Can we prioritize speed, or is quality/defensibility non-negotiable?</div>
                  </li>
                )}
              </ul>
            </div>

            {/* Custom AI questions if any */}
            {questions && (
              <div className="triage-questions">
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{questions}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="triage-input-area">
            <form className="triage-input-form" onSubmit={handleSubmit}>
              <textarea
                className="triage-textarea"
                placeholder="Type your answers here... (Enter to send, Shift+Enter for new line)"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={2}
                autoFocus
              />
              <div className="triage-input-actions">
                <button
                  type="button"
                  className="triage-skip-btn"
                  onClick={onSkip}
                  disabled={isLoading}
                >
                  Skip & Send Anyway
                </button>
                <button
                  type="submit"
                  className="triage-send-btn"
                  disabled={!response.trim() || isLoading}
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
