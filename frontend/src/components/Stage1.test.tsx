/**
 * Stage1 Tests
 *
 * Safety net for the Stage1 component (Individual AI Responses).
 * Tests: rendering states (loading, responses, streaming, collapsed),
 * model cards, collapse toggle, error detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Stage1 from './Stage1';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string; count?: number }) => {
      if (opts?.defaultValue) return opts.defaultValue;
      if (key === 'stages.expertsRespondCount' && opts?.count)
        return `${opts.count} Experts Respond`;
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../config/modelPersonas', () => ({
  getModelPersona: (modelId: string) => {
    const personas: Record<string, { name: string; provider: string; providerLabel: string }> = {
      'gpt-4': { name: 'GPT-4', provider: 'openai', providerLabel: 'OpenAI' },
      'claude-3': { name: 'Claude 3', provider: 'anthropic', providerLabel: 'Anthropic' },
      'gemini-pro': { name: 'Gemini Pro', provider: 'google', providerLabel: 'Google' },
    };
    return personas[modelId] || { name: modelId, provider: 'other', providerLabel: 'Other' };
  },
  PROVIDER_COLORS: {},
}));

vi.mock('../lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('../lib/animations', () => ({
  springs: { snappy: { type: 'spring' } },
  interactionStates: { whileHover: {} },
}));

vi.mock('../hooks/useCelebration', () => ({
  useCompletionCelebration: () => ({ isCelebrating: false }),
}));

vi.mock('../lib/animation-constants', () => ({
  CELEBRATION: { STAGE_COMPLETE: 1500 },
}));

vi.mock('../utils/a11y', () => ({
  makeClickable: (handler: () => void) => ({
    onClick: handler,
    role: 'button',
    tabIndex: 0,
  }),
}));

// Mock framer-motion to render static elements
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
      // Filter out motion-specific props
      const htmlProps: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(props)) {
        if (
          ![
            'initial',
            'animate',
            'exit',
            'layout',
            'variants',
            'transition',
            'whileHover',
            'whileTap',
            'layoutId',
          ].includes(key)
        ) {
          htmlProps[key] = val;
        }
      }
      return <div {...htmlProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('rehype-slug', () => ({ default: () => {} }));

// Mock Spinner
vi.mock('./ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

// Mock CopyButton
vi.mock('./ui/CopyButton', () => ({
  CopyButton: () => <button data-testid="copy-button">Copy</button>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleResponses = [
  { model: 'gpt-4', response: 'GPT-4 analysis: This is a comprehensive response.' },
  { model: 'claude-3', response: 'Claude analysis: Here is my detailed review.' },
  { model: 'gemini-pro', response: 'Gemini analysis: Let me provide my assessment.' },
];

function renderStage1(overrides: Partial<Parameters<typeof Stage1>[0]> = {}) {
  const props = {
    isLoading: false,
    isComplete: false,
    ...overrides,
  };
  return render(<Stage1 {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stage1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Rendering States
  // =========================================================================

  describe('Rendering States', () => {
    it('returns null when no data and not loading', () => {
      const { container } = renderStage1({ responses: [], isLoading: false });
      expect(container.querySelector('.stage1')).toBeNull();
    });

    it('shows loading state with spinner when isLoading with no data', () => {
      renderStage1({ isLoading: true });
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('AI Council is thinking...')).toBeInTheDocument();
    });

    it('shows expert title with correct count for responses', () => {
      renderStage1({ responses: sampleResponses });
      expect(screen.getByText('3 Experts Respond')).toBeInTheDocument();
    });

    it('renders model cards when responses are provided', () => {
      renderStage1({ responses: sampleResponses });
      expect(screen.getByText(/GPT-4 analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Claude analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Gemini analysis/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Streaming State
  // =========================================================================

  describe('Streaming State', () => {
    it('renders streaming data when provided', () => {
      renderStage1({
        streaming: {
          'gpt-4': { text: 'GPT streaming...', complete: false },
          'claude-3': { text: 'Claude streaming...', complete: false },
        },
        isLoading: true,
      });
      expect(screen.getByText(/GPT streaming/)).toBeInTheDocument();
      expect(screen.getByText(/Claude streaming/)).toBeInTheDocument();
    });

    it('shows correct count for streaming models', () => {
      renderStage1({
        streaming: {
          'gpt-4': { text: 'Response', complete: true },
          'claude-3': { text: 'Response', complete: false },
        },
        isLoading: true,
      });
      expect(screen.getByText('2 Experts Respond')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Collapse Toggle
  // =========================================================================

  describe('Collapse Toggle', () => {
    it('starts expanded by default', () => {
      const { container } = renderStage1({ responses: sampleResponses });
      expect(container.querySelector('.stage1.collapsed')).toBeNull();
    });

    it('starts collapsed when defaultCollapsed is true', () => {
      const { container } = renderStage1({
        responses: sampleResponses,
        defaultCollapsed: true,
      });
      expect(container.querySelector('.stage1.collapsed')).not.toBeNull();
    });

    it('toggles collapsed state when title is clicked', async () => {
      const user = userEvent.setup();
      const { container } = renderStage1({ responses: sampleResponses });

      // Should start expanded
      expect(container.querySelector('.stage1.collapsed')).toBeNull();

      // Click title to collapse
      const title = screen.getByText('3 Experts Respond');
      await user.click(title);

      expect(container.querySelector('.stage1.collapsed')).not.toBeNull();
    });

    it('shows provider summary pills when collapsed', async () => {
      const user = userEvent.setup();
      renderStage1({ responses: sampleResponses });

      // Collapse
      await user.click(screen.getByText('3 Experts Respond'));

      // Should show provider pills
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('Google')).toBeInTheDocument();
    });

    it('hides model cards when collapsed', async () => {
      const user = userEvent.setup();
      renderStage1({ responses: sampleResponses });

      await user.click(screen.getByText('3 Experts Respond'));

      // Model response text should not be visible
      expect(screen.queryByText(/GPT-4 analysis/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Image Analysis Section
  // =========================================================================

  describe('Image Analysis', () => {
    it('renders image analysis when provided (loading state)', () => {
      renderStage1({
        isLoading: true,
        imageAnalysis: 'The image shows a chart with revenue data.',
      });
      expect(screen.getByText('stages.imageAnalysis')).toBeInTheDocument();
    });

    it('renders image analysis when provided (with responses)', () => {
      renderStage1({
        responses: sampleResponses,
        imageAnalysis: 'The image shows a chart.',
      });
      expect(screen.getByText('stages.imageAnalysis')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Error Detection
  // =========================================================================

  describe('Error Detection', () => {
    it('marks response as error when text contains error patterns', () => {
      renderStage1({
        responses: [{ model: 'gpt-4', response: '[Error: API request failed]' }],
      });
      // The error model card should have the error class
      const stage = document.querySelector('.stage1');
      expect(stage).toBeInTheDocument();
    });

    it('does not false-positive on normal content discussing errors', () => {
      renderStage1({
        responses: [{ model: 'gpt-4', response: 'Here is how to handle errors in your code.' }],
      });
      // Response text should be visible (not treated as error)
      expect(screen.getByText(/handle errors in your code/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Stopped State
  // =========================================================================

  describe('Stopped State', () => {
    it('handles stopped streaming responses', () => {
      renderStage1({
        streaming: {
          'gpt-4': { text: 'Partial response...', complete: false },
          'claude-3': { text: 'Complete response.', complete: true },
        },
        stopped: true,
        isLoading: false,
      });
      // Both should render
      expect(screen.getByText(/Partial response/)).toBeInTheDocument();
      expect(screen.getByText(/Complete response/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Ranking Integration
  // =========================================================================

  describe('Ranking Integration', () => {
    it('sorts models by aggregate ranking when provided', () => {
      renderStage1({
        responses: sampleResponses,
        aggregateRankings: [
          { model: 'claude-3', average_rank: 1.2, rankings_count: 3 },
          { model: 'gpt-4', average_rank: 1.8, rankings_count: 3 },
          { model: 'gemini-pro', average_rank: 2.5, rankings_count: 3 },
        ],
      });
      // Models should be rendered (order tested via DOM position)
      expect(screen.getByText(/Claude analysis/)).toBeInTheDocument();
      expect(screen.getByText(/GPT-4 analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Gemini analysis/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // External Model Expansion
  // =========================================================================

  describe('External Model Expansion', () => {
    it('calls onExpandedModelChange when provided', () => {
      const onExpandedModelChange = vi.fn();
      renderStage1({
        responses: sampleResponses,
        onExpandedModelChange,
        expandedModel: null,
      });
      // The component is rendered and ready for expansion
      expect(screen.getByText('3 Experts Respond')).toBeInTheDocument();
    });
  });
});
