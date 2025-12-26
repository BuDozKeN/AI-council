/**
 * Type definitions for Stage components (Stage1, Stage2, Stage3)
 */

import type { ReactNode } from 'react';
import type { StreamingState } from './conversation';

// =============================================================================
// SHARED TYPES
// =============================================================================

/** Provider names for icon mapping */
export type Provider = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

/** Provider icon path mapping */
export type ProviderIconPaths = Record<Provider, string>;

/** Aggregate ranking entry from cross-evaluation */
export interface AggregateRanking {
  model: string;
  average_rank: number;
  rankings_count: number;
}

// =============================================================================
// STAGE 1 TYPES
// =============================================================================

/** Individual model response data for display */
export interface Stage1DisplayData {
  model: string;
  response: string;
  isStreaming: boolean;
  isComplete: boolean;
  hasError: boolean;
  isEmpty: boolean;
  isStopped: boolean;
}

/** Rank data for a model card */
export interface RankData {
  position: number;
  average_rank: number;
  rankings_count: number;
  totalVoters: number;
}

/** Props for the ModelCard component */
export interface ModelCardProps {
  data: Stage1DisplayData;
  isComplete: boolean;
  onExpand: (model: string | null) => void;
  isExpanded: boolean;
  rankData: RankData | null;
}

/** Props for Stage1 component */
export interface Stage1Props {
  responses?: Array<{ model: string; response: string }>;
  streaming?: Record<string, StreamingState>;
  isLoading: boolean;
  stopped?: boolean;
  isComplete: boolean;
  defaultCollapsed?: boolean;
  conversationTitle?: string;
  imageAnalysis?: string;
  expandedModel?: string | null;
  onExpandedModelChange?: (model: string | null) => void;
  aggregateRankings?: AggregateRanking[];
}

/** Provider group for collapsed summary */
export interface ProviderGroup {
  label: string;
  iconPath: string | null;
  models: Stage1DisplayData[];
  allComplete: boolean;
  hasStreaming: boolean;
  hasError: boolean;
}

// =============================================================================
// STAGE 2 TYPES
// =============================================================================

/** Individual ranking data for display */
export interface Stage2DisplayData {
  model: string;
  ranking: string;
  isStreaming: boolean;
  isComplete: boolean;
  hasError: boolean;
  isEmpty: boolean;
  parsed_ranking: string[] | null;
}

/** Props for Stage2 component */
export interface Stage2Props {
  rankings?: Array<{ model: string; ranking: string; parsed_ranking?: string[] }>;
  streaming?: Record<string, StreamingState>;
  labelToModel?: Record<string, string>;
  aggregateRankings?: AggregateRanking[];
  isLoading: boolean;
  isComplete: boolean;
  defaultCollapsed?: boolean;
  conversationTitle?: string;
  onModelClick?: (model: string) => void;
}

// =============================================================================
// STAGE 3 TYPES
// =============================================================================

/** Props for Stage3Content component */
export interface Stage3ContentProps {
  displayText: string;
  hasError: boolean;
  isStreaming: boolean;
  isComplete: boolean;
  chairmanIconPath: string | null;
}

/** Props for Stage3 component */
export interface Stage3Props {
  synthesis?: { content: string; model?: string };
  streaming?: { text: string; complete: boolean };
  isLoading: boolean;
  isComplete: boolean;
  chairmanModel?: string;
}

// =============================================================================
// CODE BLOCK TYPES
// =============================================================================

/** Props for CodeBlock component */
export interface CodeBlockProps {
  children: ReactNode;
  className?: string;
}

// =============================================================================
// TOUCH TRACKING
// =============================================================================

/** Touch start position for swipe detection */
export interface TouchStartData {
  x: number;
  y: number;
  time: number;
}
