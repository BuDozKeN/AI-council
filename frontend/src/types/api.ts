/**
 * API request and response type definitions
 */

import type { Conversation } from './conversation';
import type { Business, Project, Playbook } from './business';

// Generic API response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  has_more: boolean;
  total?: number;
}

// Conversation endpoints
export interface ListConversationsParams {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'date' | 'activity';
  companyId?: string;
}

export interface ListConversationsResponse {
  conversations: Conversation[];
  has_more: boolean;
}

// Business endpoints
export type ListBusinessesResponse = Business[];

export interface ListProjectsResponse {
  projects: Project[];
}

export interface ListPlaybooksResponse {
  playbooks: Playbook[];
}

// Message endpoints
export interface SendMessageParams {
  conversationId: string;
  content: string;
  businessId?: string | null;
  departmentId?: string | null;
  departmentIds?: string[] | null;
  roleIds?: string[] | null;
  playbookIds?: string[] | null;
  projectId?: string | null;
  attachmentIds?: string[] | null;
}

// SSE Event types
export type SSEEventType =
  | 'stage1_start'
  | 'stage1_token'
  | 'stage1_model_complete'
  | 'stage1_model_error'
  | 'stage1_complete'
  | 'stage2_start'
  | 'stage2_token'
  | 'stage2_model_complete'
  | 'stage2_model_error'
  | 'stage2_complete'
  | 'stage3_start'
  | 'stage3_token'
  | 'stage3_error'
  | 'stage3_complete'
  | 'title_complete'
  | 'error'
  | 'cancelled';

export interface SSEEvent {
  type: SSEEventType;
  model?: string;
  content?: string;
  data?: unknown;
  error?: string;
  response?: string;
  ranking?: string;
  metadata?: Record<string, unknown>;
}

// Triage endpoints
export interface TriageResult {
  enhanced_query?: string;
  constraints?: Record<string, unknown>;
  suggestions?: string[];
  skip_triage?: boolean;
}

// Knowledge/Decision endpoints
export interface SaveDecisionParams {
  conversationId: string;
  companyId: string;
  title: string;
  content: string;
  summary?: string;
  departmentIds?: string[];
  projectId?: string;
  playbookType?: 'sop' | 'framework' | 'policy';
  scope?: 'company' | 'department' | 'project';
  autoInject?: boolean;
}

// Profile endpoints
export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  company?: string;
  phone?: string;
  bio?: string;
}

// Billing endpoints
export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    queries_per_month: number;
    team_members: number;
  };
}

export interface Subscription {
  id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'past_due';
  current_period_end: string;
  usage: {
    queries_used: number;
    queries_limit: number;
  };
}

// Team endpoints
export interface TeamMember {
  id: string;
  email: string;
  display_name?: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

// API Key (BYOK) endpoints
export interface ApiKeyStatus {
  status: 'configured' | 'not_configured' | 'invalid';
  masked_key?: string;
  is_valid?: boolean;
  provider?: string;
}
