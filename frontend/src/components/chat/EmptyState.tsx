/**
 * EmptyState - Welcome screen when no conversation selected or conversation has no messages
 *
 * Extracted from ChatInterface.jsx for better maintainability.
 */

export function WelcomeState() {
  return (
    <div className="chat-interface">
      <div className="empty-state">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-2xl">AX</span>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to AxCouncil</h2>
        <p className="text-gray-500">Create a new conversation to get started</p>
      </div>
    </div>
  );
}

export function ConversationEmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <h2>Ask the Council</h2>
      <p>Get insights from 5 AI models who debate and synthesize the best answer</p>
      <div className="empty-state-hints">
        <span className="hint-item">Try: "What's the best approach to..."</span>
        <span className="hint-item">Paste images with Ctrl+V</span>
      </div>
    </div>
  );
}
