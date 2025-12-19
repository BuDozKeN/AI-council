/**
 * ChatInput - Textarea with image attach and send/stop buttons
 *
 * Handles the input area for composing and sending messages.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

export function ChatInput({
  input,
  onInputChange,
  onKeyDown,
  onSubmit,
  isLoading,
  onStopGeneration,
  chatMode,
  hasMessages,
  hasImages,
  imageUpload
}) {
  const placeholder = !hasMessages
    ? "Ask a question... (Enter to send, Shift+Enter for new line)"
    : chatMode === 'chat'
    ? "Quick follow-up with the Chairman..."
    : "Send to the full council for deliberation...";

  const buttonLabel = !hasMessages ? 'Send' : chatMode === 'chat' ? 'Chat' : 'Council';

  return (
    <>
      {/* Image error display */}
      {imageUpload.errorDisplay}

      {/* Image previews */}
      {imageUpload.previews}

      <div className="input-row">
        <div className="textarea-wrapper">
          <textarea
            className="message-input"
            placeholder={placeholder}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={imageUpload.handlePaste}
            disabled={isLoading}
            rows={2}
          />
          {/* Image attach button - inside textarea */}
          <button
            type="button"
            className="attach-image-btn-inline"
            onClick={imageUpload.openFilePicker}
            disabled={isLoading}
            title="Attach images (drag & drop, paste, or click)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
        </div>
        {isLoading ? (
          <button
            type="button"
            className="stop-button"
            onClick={onStopGeneration}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="send-button"
            disabled={!input.trim() && !hasImages}
            onClick={onSubmit}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </>
  );
}
