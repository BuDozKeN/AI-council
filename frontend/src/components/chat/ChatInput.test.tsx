/**
 * ChatInput Tests
 *
 * Safety net for the ChatInput omnibar component.
 * Tests: textarea behavior, send/stop buttons, mode toggle,
 * context icon visibility, attach button, disabled states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test/test-utils';
import { ChatInput } from './ChatInput';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../hooks/useCouncilStats', () => ({
  useCouncilStats: () => ({
    aiCount: 5,
    rounds: 3,
    providers: ['openai', 'anthropic', 'google', 'xai', 'deepseek'],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

// Mock Radix Popover to render inline (avoids portal issues in jsdom)
vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="popover-root" data-open={open}>
      {children}
    </div>
  ),
  Trigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <button>{children}</button>,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

// Mock Radix Tooltip to render inline
vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Trigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <button>{children}</button>,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  Arrow: () => null,
}));

// Mock BottomSheet
vi.mock('../ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null,
}));

// Mock ContextSelectItem - respects mode prop for correct ARIA role in tests
vi.mock('../ui/ContextSelectItem', () => ({
  ContextSelectItem: ({
    label,
    isSelected,
    onToggle,
    mode = 'checkbox',
  }: {
    label: string;
    isSelected: boolean;
    onToggle: () => void;
    mode?: 'checkbox' | 'radio';
  }) => (
    <label data-testid={`ctx-item-${label}`}>
      <input
        type={mode === 'radio' ? 'radio' : 'checkbox'}
        checked={isSelected}
        onChange={() => onToggle()}
        onClick={() => onToggle()}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  ),
}));

// Mock DepartmentCheckboxItem
vi.mock('../ui/DepartmentCheckboxItem', () => ({
  DepartmentCheckboxItem: ({
    department,
    isSelected,
    onToggle,
  }: {
    department: { id: string; name: string };
    isSelected: boolean;
    onToggle: (id: string) => void;
  }) => (
    <label data-testid={`dept-item-${department.id}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(department.id)}
        aria-label={department.name}
      />
      <span>{department.name}</span>
    </label>
  ),
}));

// Mock ResponseStyleSelector
vi.mock('./ResponseStyleSelector', () => ({
  ResponseStyleSelector: () => <div data-testid="response-style-selector" />,
}));

// Mock CSS module
vi.mock('./input/ChatInput.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === 'string' ? prop : ''),
    }
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultProps(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  return {
    input: '',
    onInputChange: vi.fn(),
    onKeyDown: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
    onStopGeneration: vi.fn(),
    hasMessages: false,
    hasImages: false,
    imageUpload: {
      errorDisplay: null,
      previews: null,
      handlePaste: vi.fn(),
      openFilePicker: vi.fn(),
    },
    ...overrides,
  };
}

function renderChatInput(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const props = createDefaultProps(overrides);
  return { ...render(<ChatInput {...props} />), props };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to desktop viewport
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
  });

  // =========================================================================
  // Textarea Behavior
  // =========================================================================

  describe('Textarea', () => {
    it('renders a textarea with the correct placeholder (no messages)', () => {
      renderChatInput();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', 'chat.askCouncil');
    });

    it('shows follow-up placeholder in council mode with messages', () => {
      renderChatInput({ hasMessages: true, onChatModeChange: vi.fn() });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'chat.askFollowUp');
    });

    it('shows quick follow-up placeholder in chat mode with messages', () => {
      renderChatInput({ hasMessages: true, chatMode: 'chat', onChatModeChange: vi.fn() });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'chat.askQuickFollowUp');
    });

    it('fires onInputChange when user types', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInput();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'a');
      expect(props.onInputChange).toHaveBeenCalledWith('a');
    });

    it('fires onKeyDown when user presses a key', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInput();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '{Enter}');
      expect(props.onKeyDown).toHaveBeenCalled();
    });

    it('disables the textarea when isLoading', () => {
      renderChatInput({ isLoading: true });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('displays the input value', () => {
      renderChatInput({ input: 'Hello world' });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Hello world');
    });

    it('has an aria-label matching the placeholder', () => {
      renderChatInput();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-label', 'chat.askCouncil');
    });
  });

  // =========================================================================
  // Send / Stop Button
  // =========================================================================

  describe('Send / Stop Button', () => {
    it('renders send button when not loading', () => {
      renderChatInput({ input: 'test' });
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).toBeInTheDocument();
    });

    it('disables send button when input is empty and no images', () => {
      renderChatInput({ input: '', hasImages: false });
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).toBeDisabled();
    });

    it('enables send button when input has text', () => {
      renderChatInput({ input: 'Hello' });
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).not.toBeDisabled();
    });

    it('enables send button when images are attached (even empty input)', () => {
      renderChatInput({ input: '', hasImages: true });
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).not.toBeDisabled();
    });

    it('calls onSubmit when send button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInput({ input: 'test' });
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      await user.click(sendBtn);
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });

    it('renders stop button when isLoading', () => {
      renderChatInput({ isLoading: true });
      const stopBtn = screen.getByRole('button', { name: /stop generation/i });
      expect(stopBtn).toBeInTheDocument();
    });

    it('calls onStopGeneration when stop button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderChatInput({ isLoading: true });
      const stopBtn = screen.getByRole('button', { name: /stop generation/i });
      await user.click(stopBtn);
      expect(props.onStopGeneration).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Attach Button
  // =========================================================================

  describe('Attach Button', () => {
    it('renders the attach button', () => {
      renderChatInput();
      const attachBtn = screen.getByRole('button', { name: /attach image/i });
      expect(attachBtn).toBeInTheDocument();
    });

    it('calls openFilePicker when attach button is clicked', async () => {
      const user = userEvent.setup();
      const openFilePicker = vi.fn();
      renderChatInput({
        imageUpload: { errorDisplay: null, previews: null, handlePaste: vi.fn(), openFilePicker },
      });
      const attachBtn = screen.getByRole('button', { name: /attach image/i });
      await user.click(attachBtn);
      expect(openFilePicker).toHaveBeenCalledTimes(1);
    });

    it('disables attach button when isLoading', () => {
      renderChatInput({ isLoading: true });
      const attachBtn = screen.getByRole('button', { name: /attach image/i });
      expect(attachBtn).toBeDisabled();
    });
  });

  // =========================================================================
  // Image Upload Integration
  // =========================================================================

  describe('Image Upload Integration', () => {
    it('renders error display from imageUpload', () => {
      renderChatInput({
        imageUpload: {
          errorDisplay: <div data-testid="upload-error">Error!</div>,
          previews: null,
          handlePaste: vi.fn(),
          openFilePicker: vi.fn(),
        },
      });
      expect(screen.getByTestId('upload-error')).toBeInTheDocument();
    });

    it('renders previews from imageUpload', () => {
      renderChatInput({
        imageUpload: {
          errorDisplay: null,
          previews: <div data-testid="upload-previews">3 images</div>,
          handlePaste: vi.fn(),
          openFilePicker: vi.fn(),
        },
      });
      expect(screen.getByTestId('upload-previews')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Mode Toggle (1 AI / N AIs)
  // =========================================================================

  describe('Mode Toggle', () => {
    it('does not render mode toggle when hasMessages is false', () => {
      renderChatInput({ hasMessages: false, onChatModeChange: vi.fn() });
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('does not render mode toggle when onChatModeChange is not provided', () => {
      renderChatInput({ hasMessages: true });
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('renders mode toggle with 1 AI and N AIs when both hasMessages and onChatModeChange', () => {
      renderChatInput({ hasMessages: true, onChatModeChange: vi.fn() });
      const radiogroup = screen.getByRole('radiogroup', { name: /response mode/i });
      expect(radiogroup).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /1 AI/i })).toBeInTheDocument();
      expect(screen.getByText(/5 AIs/)).toBeInTheDocument();
    });

    it('marks council mode button as checked by default', () => {
      renderChatInput({ hasMessages: true, onChatModeChange: vi.fn() });
      const councilBtn = screen.getByRole('radio', { checked: true });
      expect(councilBtn).toHaveTextContent('5 AIs');
    });

    it('marks chat mode button as checked when chatMode is chat', () => {
      renderChatInput({ hasMessages: true, chatMode: 'chat', onChatModeChange: vi.fn() });
      const chatBtn = screen.getByRole('radio', { name: /1 AI/i });
      expect(chatBtn).toHaveAttribute('aria-checked', 'true');
    });

    it('calls onChatModeChange when clicking mode buttons', async () => {
      const user = userEvent.setup();
      const onChatModeChange = vi.fn();
      renderChatInput({ hasMessages: true, onChatModeChange });
      const chatBtn = screen.getByText('1 AI');
      await user.click(chatBtn);
      expect(onChatModeChange).toHaveBeenCalledWith('chat');
    });

    it('disables mode toggle buttons when isLoading', () => {
      renderChatInput({ hasMessages: true, onChatModeChange: vi.fn(), isLoading: true });
      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).toBeDisabled();
      });
    });
  });

  // =========================================================================
  // Context Icons (Desktop)
  // =========================================================================

  describe('Context Icons (Desktop)', () => {
    const contextProps = {
      hasMessages: true,
      onChatModeChange: vi.fn(),
      departments: [
        { id: 'dept-1', name: 'Engineering', slug: 'engineering', company_id: 'c1' },
        { id: 'dept-2', name: 'Marketing', slug: 'marketing', company_id: 'c1' },
      ],
      selectedDepartments: [] as string[],
      onSelectDepartments: vi.fn(),
      roles: [
        { id: 'role-1', name: 'CTO', company_id: 'c1' },
        { id: 'role-2', name: 'CFO', company_id: 'c1' },
      ],
      selectedRoles: [] as string[],
      onSelectRoles: vi.fn(),
      projects: [
        { id: 'proj-1', name: 'Project Alpha', company_id: 'c1', status: 'active' as const },
      ],
      selectedProject: null as string | null,
      onSelectProject: vi.fn(),
    };

    it('does not show context icons when hasMessages is false', () => {
      renderChatInput({
        ...contextProps,
        hasMessages: false,
      });
      expect(screen.queryByText('context.context')).not.toBeInTheDocument();
    });

    it('renders desktop context trigger button when context options are available', () => {
      renderChatInput(contextProps);
      expect(screen.getByText('context.context')).toBeInTheDocument();
    });

    it('shows selection count badge when items are selected', () => {
      renderChatInput({
        ...contextProps,
        selectedDepartments: ['dept-1'],
        selectedProject: 'proj-1',
      });
      // Total selection count = 1 project + 1 department = 2
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('does not render context trigger when no context options are available', () => {
      renderChatInput({
        hasMessages: true,
        onChatModeChange: vi.fn(),
        departments: [],
        roles: [],
        projects: [],
        playbooks: [],
      });
      expect(screen.queryByText('context.context')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Response Style Selector
  // =========================================================================

  describe('Response Style Selector', () => {
    it('renders ResponseStyleSelector when onSelectPreset is provided', () => {
      renderChatInput({
        hasMessages: true,
        onChatModeChange: vi.fn(),
        onSelectPreset: vi.fn(),
      });
      expect(screen.getByTestId('response-style-selector')).toBeInTheDocument();
    });

    it('does not render ResponseStyleSelector when onSelectPreset is not provided', () => {
      renderChatInput({ hasMessages: true, onChatModeChange: vi.fn() });
      expect(screen.queryByTestId('response-style-selector')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Disabled States
  // =========================================================================

  describe('Disabled States', () => {
    it('disables textarea, attach button, and mode toggles when isLoading', () => {
      renderChatInput({
        isLoading: true,
        hasMessages: true,
        onChatModeChange: vi.fn(),
      });
      expect(screen.getByRole('textbox')).toBeDisabled();
      expect(screen.getByRole('button', { name: /attach image/i })).toBeDisabled();
      const radios = screen.getAllByRole('radio');
      radios.forEach((r) => expect(r).toBeDisabled());
    });
  });

  // =========================================================================
  // Project Selection (Radio-style)
  // =========================================================================

  describe('Project Selection (Mobile BottomSheet)', () => {
    const projectProps = {
      hasMessages: true,
      onChatModeChange: vi.fn(),
      projects: [
        { id: 'proj-1', name: 'Alpha', company_id: 'c1', status: 'active' as const },
        { id: 'proj-2', name: 'Beta', company_id: 'c1', status: 'active' as const },
      ],
      selectedProject: null as string | null,
      onSelectProject: vi.fn(),
    };

    it('renders project radios in mobile bottom sheet after opening context and section', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      const user = userEvent.setup();
      renderChatInput(projectProps);

      // Click mobile context button to open BottomSheet
      const contextBtn = screen.getByLabelText(/configure/i);
      await user.click(contextBtn);

      // Expand the project section
      const projectHeader = screen.getByText('context.project');
      await user.click(projectHeader);

      // Now project radios should be visible
      const alphaRadio = screen.getByRole('radio', { name: 'Alpha' });
      expect(alphaRadio).toBeInTheDocument();
    });

    it('calls onSelectProject when a project is selected via mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      const user = userEvent.setup();
      const onSelectProject = vi.fn();
      renderChatInput({ ...projectProps, onSelectProject });

      // Open context and project section
      await user.click(screen.getByLabelText(/configure/i));
      await user.click(screen.getByText('context.project'));

      const alphaRadio = screen.getByRole('radio', { name: 'Alpha' });
      await user.click(alphaRadio);
      expect(onSelectProject).toHaveBeenCalledWith('proj-1');
    });

    it('calls onSelectProject(null) when deselecting an already-selected project', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      const user = userEvent.setup();
      const onSelectProject = vi.fn();
      renderChatInput({ ...projectProps, selectedProject: 'proj-1', onSelectProject });

      await user.click(screen.getByLabelText(/configure/i));
      await user.click(screen.getByText('Alpha'));

      const alphaRadio = screen.getByRole('radio', { name: 'Alpha' });
      await user.click(alphaRadio);
      expect(onSelectProject).toHaveBeenCalledWith(null);
    });
  });

  // =========================================================================
  // Role Selection (Checkbox-style via Mobile BottomSheet)
  // =========================================================================

  describe('Role Selection (Mobile BottomSheet)', () => {
    const roleProps = {
      hasMessages: true,
      onChatModeChange: vi.fn(),
      roles: [
        { id: 'role-1', name: 'CTO', company_id: 'c1' },
        { id: 'role-2', name: 'CFO', company_id: 'c1' },
      ],
      selectedRoles: [] as string[],
      onSelectRoles: vi.fn(),
    };

    it('calls onSelectRoles with toggled array when a role is checked', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      const user = userEvent.setup();
      const onSelectRoles = vi.fn();
      renderChatInput({ ...roleProps, onSelectRoles });

      // Open context and roles section
      await user.click(screen.getByLabelText(/configure/i));
      await user.click(screen.getByText('roles.title'));

      const ctoCheckbox = screen.getByRole('checkbox', { name: 'CTO' });
      await user.click(ctoCheckbox);
      expect(onSelectRoles).toHaveBeenCalledWith(['role-1']);
    });

    it('calls onSelectRoles with removed item when a role is unchecked', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
      const user = userEvent.setup();
      const onSelectRoles = vi.fn();
      renderChatInput({ ...roleProps, selectedRoles: ['role-1', 'role-2'], onSelectRoles });

      await user.click(screen.getByLabelText(/configure/i));
      await user.click(screen.getByText('roles.title'));

      const ctoCheckbox = screen.getByRole('checkbox', { name: 'CTO' });
      await user.click(ctoCheckbox);
      expect(onSelectRoles).toHaveBeenCalledWith(['role-2']);
    });
  });

  // =========================================================================
  // Reset All
  // =========================================================================

  describe('Reset All', () => {
    it('renders clear all button when there are selections and onResetAll is provided', () => {
      renderChatInput({
        hasMessages: true,
        onChatModeChange: vi.fn(),
        departments: [{ id: 'd1', name: 'Eng', slug: 'eng', company_id: 'c1' }],
        selectedDepartments: ['d1'],
        onSelectDepartments: vi.fn(),
        onResetAll: vi.fn(),
      });
      expect(screen.getByText('common.clearAll')).toBeInTheDocument();
    });

    it('calls onResetAll when clear all button is clicked', async () => {
      const user = userEvent.setup();
      const onResetAll = vi.fn();
      renderChatInput({
        hasMessages: true,
        onChatModeChange: vi.fn(),
        departments: [{ id: 'd1', name: 'Eng', slug: 'eng', company_id: 'c1' }],
        selectedDepartments: ['d1'],
        onSelectDepartments: vi.fn(),
        onResetAll,
      });
      const clearBtn = screen.getByText('common.clearAll');
      await user.click(clearBtn);
      expect(onResetAll).toHaveBeenCalledTimes(1);
    });
  });
});
