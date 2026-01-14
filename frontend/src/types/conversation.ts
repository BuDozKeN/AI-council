/**
 * Conversation and Message type definitions
 */

export interface Stage1Response {
  model: string;
  content: string;
  tokens?: number;
}

export interface Stage2Evaluation {
  model: string;
  ranking: string;
  scores?: Record<string, number>;
}

export interface Stage3Synthesis {
  content: string;
  model?: string;
  tokens?: number;
}

export interface StreamingState {
  text?: string;
  complete?: boolean;
  error?: boolean;
  truncated?: boolean;
}

export interface MessageMetadata {
  total_tokens?: number;
  duration_ms?: number;
  model_versions?: Record<string, string>;
}

/** Token usage data for a council query */
export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  by_model: Record<
    string,
    {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    }
  >;
}

export interface LoadingState {
  stage1: boolean;
  stage2: boolean;
  stage3: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;

  // Council response stages
  stage1?: Stage1Response[];
  stage1Streaming?: Record<string, StreamingState>;
  stage2?: Stage2Evaluation[];
  stage2Streaming?: Record<string, StreamingState>;
  stage3?: Stage3Synthesis;
  stage3Streaming?: StreamingState;

  // Metadata
  metadata?: MessageMetadata;
  loading?: LoadingState;
  stopped?: boolean;

  // Token usage (for cost display)
  usage?: UsageData;

  // Attachments
  attachments?: string[];

  created_at?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  company_id?: string;
  department?: string;
  is_starred?: boolean;
  is_archived?: boolean;
  message_count?: number;
  isTemp?: boolean;
  created_at: string;
  updated_at?: string;
  last_updated?: string;
}

export interface Decision {
  id: string;
  conversation_id: string;
  company_id: string;
  title: string;
  summary?: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  council_type?: string;
  project_id?: string;
  department_ids?: string[];
  playbook_type?: 'sop' | 'framework' | 'policy';
  created_at: string;
  updated_at: string;
}

export type ConversationSortBy = 'date' | 'activity' | 'title';
