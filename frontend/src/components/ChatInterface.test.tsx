/**
 * ChatInterface Tests
 *
 * Safety net for the ChatInterface shell component.
 * Tests: rendering states (no conversation, loading, welcome, messages),
 * form submission, keyboard handling, back-to-company button, progress capsule.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import ChatInterface from './ChatInterface';
import type { Conversation } from '../types/conversation';

// ---------------------------------------------------------------------------
// jsdom polyfills for scroll methods
// ---------------------------------------------------------------------------

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../hooks/useImagePreUpload', () => ({
  useImagePreUpload: () => ({
    images: [],
    addImages: vi.fn(),
    removeImage: vi.fn(),
    clearImages: vi.fn(),
    getAttachmentIds: vi.fn().mockResolvedValue([]),
    hasUploadsInProgress: false,
  }),
}));

// Mock ImageUpload to return a simple object
vi.mock('./ImageUpload', () => ({
  default: () => ({
    dropZoneProps: {},
    handlePaste: vi.fn(),
    isDragging: false,
    error: null,
    removeImage: vi.fn(),
    openFilePicker: vi.fn(),
    fileInput: null,
    previews: null,
    errorDisplay: null,
    dragOverlay: null,
  }),
}));

// Mock child components as stubs
vi.mock('./chat', () => ({
  WelcomeState: () => <div data-testid="welcome-state">Welcome</div>,
  ContextIndicator: () => <div data-testid="context-indicator" />,
  MessageList: ({ messages }: { messages: unknown[] }) => (
    <div data-testid="message-list">{messages?.length ?? 0} messages</div>
  ),
  ChatInput: ({
    input,
    onInputChange,
    onSubmit,
    isLoading,
    onStopGeneration,
  }: {
    input: string;
    onInputChange: (v: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
    onStopGeneration: () => void;
    [key: string]: unknown;
  }) => (
    <div data-testid="chat-input">
      <input
        data-testid="chat-input-textarea"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        aria-label="Message input"
      />
      {isLoading ? (
        <button data-testid="stop-btn" onClick={onStopGeneration}>
          Stop
        </button>
      ) : (
        <button data-testid="send-btn" onClick={onSubmit}>
          Send
        </button>
      )}
    </div>
  ),
}));

vi.mock('./CouncilProgressCapsule', () => ({
  default: (props: { isComplete?: boolean }) => (
    <div data-testid="progress-capsule" data-complete={props.isComplete} />
  ),
}));

vi.mock('./ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('./ui/CouncilLoader', () => ({
  CouncilLoader: ({ text }: { text: string }) => <div data-testid="council-loader">{text}</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConversation: Conversation = {
  id: 'conv-1',
  title: 'Test Conversation',
  messages: [
    { role: 'user', content: 'What is the plan?', timestamp: new Date().toISOString() },
    {
      role: 'assistant',
      content: 'Here is the plan...',
      timestamp: new Date().toISOString(),
      stage1: [{ model: 'gpt-4', text: 'response' }],
      stage3: { text: 'Synthesized answer' },
    },
  ],
  created_at: new Date().toISOString(),
};

function createDefaultProps(overrides: Partial<Parameters<typeof ChatInterface>[0]> = {}) {
  return {
    conversation: baseConversation as Conversation,
    onSendMessage: vi.fn(),
    onSendChatMessage: vi.fn(),
    onStopGeneration: vi.fn(),
    isLoading: false,
    selectedBusiness: null,
    onSelectBusiness: vi.fn(),
    departments: [],
    selectedDepartment: null,
    onSelectDepartment: vi.fn(),
    selectedDepartments: [],
    onSelectDepartments: vi.fn(),
    allRoles: [],
    selectedRoles: [],
    onSelectRoles: vi.fn(),
    playbooks: [],
    selectedPlaybooks: [],
    onSelectPlaybooks: vi.fn(),
    roles: [],
    selectedRole: null,
    onSelectRole: vi.fn(),
    channels: [],
    selectedChannel: null,
    onSelectChannel: vi.fn(),
    styles: [],
    selectedStyle: null,
    onSelectStyle: vi.fn(),
    projects: [],
    selectedProject: null,
    onSelectProject: vi.fn(),
    onOpenProjectModal: vi.fn(),
    onProjectCreated: vi.fn(),
    useCompanyContext: false,
    onToggleCompanyContext: vi.fn(),
    useDepartmentContext: false,
    onToggleDepartmentContext: vi.fn(),
    isUploading: false,
    onViewDecision: vi.fn(),
    scrollToStage3: false,
    scrollToResponseIndex: null,
    onScrollToStage3Complete: vi.fn(),
    returnToMyCompanyTab: null,
    returnToProjectId: null,
    returnToDecisionId: null,
    onReturnToMyCompany: vi.fn(),
    onOpenSidebar: vi.fn(),
    ...overrides,
  };
}

function renderChatInterface(overrides: Partial<Parameters<typeof ChatInterface>[0]> = {}) {
  const props = createDefaultProps(overrides);
  return { ...render(<ChatInterface {...props} />), props };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Rendering States
  // =========================================================================

  describe('Rendering States', () => {
    it('shows WelcomeState when conversation is null and not loading', () => {
      renderChatInterface({ conversation: null, isLoadingConversation: false });
      expect(screen.getByTestId('welcome-state')).toBeInTheDocument();
    });

    it('shows CouncilLoader when conversation is null and isLoadingConversation', () => {
      renderChatInterface({ conversation: null, isLoadingConversation: true });
      expect(screen.getByTestId('council-loader')).toBeInTheDocument();
      expect(screen.getByText(/getting your conversation ready/i)).toBeInTheDocument();
    });

    it('renders chat-interface region when conversation exists', () => {
      renderChatInterface();
      expect(screen.getByRole('region', { name: 'Chat interface' })).toBeInTheDocument();
    });

    it('renders an sr-only h1 with conversation title', () => {
      renderChatInterface();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Conversation');
    });

    it('renders MessageList when conversation has messages', () => {
      renderChatInterface();
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
    });

    it('renders ContextIndicator when conversation has messages', () => {
      renderChatInterface();
      expect(screen.getByTestId('context-indicator')).toBeInTheDocument();
    });

    it('does not render ContextIndicator when conversation has no messages', () => {
      renderChatInterface({
        conversation: { ...baseConversation, messages: [] },
      });
      expect(screen.queryByTestId('context-indicator')).not.toBeInTheDocument();
    });

    it('renders the ChatInput component', () => {
      renderChatInterface();
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Message Submission
  // =========================================================================

  describe('Message Submission', () => {
    it('calls onSendMessage for first message (no previous conversation)', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInterface({
        conversation: { ...baseConversation, messages: [] },
      });

      const input = screen.getByTestId('chat-input-textarea');
      await user.type(input, 'Hello council');

      const sendBtn = screen.getByTestId('send-btn');
      await user.click(sendBtn);

      await waitFor(() => {
        expect(props.onSendMessage).toHaveBeenCalledWith('Hello council', null);
      });
    });

    it('does not submit when input is empty', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInterface();

      const sendBtn = screen.getByTestId('send-btn');
      await user.click(sendBtn);

      expect(props.onSendMessage).not.toHaveBeenCalled();
      expect(props.onSendChatMessage).not.toHaveBeenCalled();
    });

    it('clears input after successful send', async () => {
      const user = userEvent.setup();
      renderChatInterface({
        conversation: { ...baseConversation, messages: [] },
      });

      const input = screen.getByTestId('chat-input-textarea');
      await user.type(input, 'Hello');

      const sendBtn = screen.getByTestId('send-btn');
      await user.click(sendBtn);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  // =========================================================================
  // Keyboard Handling
  // =========================================================================

  describe('Keyboard Handling', () => {
    it('submits form on Enter key (without Shift)', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInterface({
        conversation: { ...baseConversation, messages: [] },
      });

      const input = screen.getByTestId('chat-input-textarea');
      await user.type(input, 'Test message');

      // The form's onSubmit handler is connected to handleSubmit
      // Simulate Enter key on the form
      const form = input.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      await waitFor(() => {
        expect(props.onSendMessage).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Back to My Company Button
  // =========================================================================

  describe('Back to My Company Button', () => {
    it('renders back button when returnToMyCompanyTab is set', () => {
      renderChatInterface({
        returnToMyCompanyTab: 'decisions',
        returnToProjectId: 'proj-1',
        returnToDecisionId: 'dec-1',
      });
      expect(screen.getByText(/Back to Decisions/)).toBeInTheDocument();
    });

    it('does not render back button when returnToMyCompanyTab is null', () => {
      renderChatInterface({ returnToMyCompanyTab: null });
      expect(screen.queryByText(/Back to/)).not.toBeInTheDocument();
    });

    it('calls onReturnToMyCompany with correct args when back button clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInterface({
        returnToMyCompanyTab: 'projects',
        returnToProjectId: 'proj-1',
        returnToDecisionId: 'dec-1',
      });

      await user.click(screen.getByText(/Back to Projects/));

      expect(props.onReturnToMyCompany).toHaveBeenCalledWith('projects', 'proj-1', 'dec-1');
    });

    it('shows correct tab names for different tabs', () => {
      renderChatInterface({ returnToMyCompanyTab: 'activity' });
      expect(screen.getByText(/Back to Activity/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Progress Capsule
  // =========================================================================

  describe('Progress Capsule', () => {
    it('renders progress capsule when last message has stage3 (complete)', () => {
      renderChatInterface();
      // baseConversation has stage3, so progress capsule should render
      expect(screen.getByTestId('progress-capsule')).toBeInTheDocument();
    });

    it('does not render progress capsule when last message is user role', () => {
      renderChatInterface({
        conversation: {
          ...baseConversation,
          messages: [{ role: 'user', content: 'Hello', timestamp: new Date().toISOString() }],
        },
      });
      expect(screen.queryByTestId('progress-capsule')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Loading States
  // =========================================================================

  describe('Loading States', () => {
    it('renders CouncilLoader when loading conversation with no messages', () => {
      renderChatInterface({
        conversation: { ...baseConversation, messages: [] },
        isLoadingConversation: true,
      });
      expect(screen.getByTestId('council-loader')).toBeInTheDocument();
    });

    it('shows stop button when isLoading', () => {
      renderChatInterface({ isLoading: true });
      expect(screen.getByTestId('stop-btn')).toBeInTheDocument();
    });

    it('calls onStopGeneration when stop button clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInterface({ isLoading: true });

      await user.click(screen.getByTestId('stop-btn'));
      expect(props.onStopGeneration).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  describe('Accessibility', () => {
    it('has region role with correct label', () => {
      renderChatInterface();
      expect(screen.getByRole('region', { name: 'Chat interface' })).toBeInTheDocument();
    });

    it('has sr-only h1 when loading conversation', () => {
      renderChatInterface({ conversation: null, isLoadingConversation: true });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Loading Conversation');
    });
  });
});
