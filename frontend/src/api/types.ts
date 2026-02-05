/**
 * API type definitions.
 * All exported interfaces used by consumers of the api module.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

// =============================================================================
// Request Option Types
// =============================================================================

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  includeArchived?: boolean;
  sortBy?: 'date' | 'activity';
  companyId?: string | null;
}

export interface SendMessageStreamOptions {
  businessId?: string | null;
  department?: string | null;
  role?: string | null;
  departments?: string[] | null;
  roles?: string[] | null;
  playbooks?: string[] | null;
  projectId?: string | null;
  attachmentIds?: string[] | null;
  signal?: AbortSignal | null;
  /** LLM preset override (conservative/balanced/creative). If null, uses department default. */
  preset?: 'conservative' | 'balanced' | 'creative' | null;
}

export interface ChatStreamOptions {
  businessId?: string | null;
  departmentId?: string | null;
  departmentIds?: string[] | null;
  roleIds?: string[] | null;
  playbookIds?: string[] | null;
  projectId?: string | null;
  attachmentIds?: string[] | null;
  signal?: AbortSignal | null;
}

export interface ListDecisionsOptions {
  departmentId?: string | null;
  projectId?: string | null;
  category?: string | null;
  status?: string | null;
  search?: string | null;
  limit?: number | null;
}

export interface ListActivityOptions {
  limit?: number;
  eventType?: string | null;
  days?: number | null;
}

export interface ContextWriteAssistOptions {
  playbookType?: string | null;
}

export interface SaveDecisionOptions {
  saveDecision?: boolean | undefined;
  companyId?: string | undefined;
  conversationId?: string | undefined;
  responseIndex?: number | undefined;
  decisionTitle?: string | undefined;
  departmentId?: string | null | undefined;
  departmentIds?: string[] | null | undefined;
}

export type SSEEventCallback = (eventType: string, data: Record<string, unknown>) => void;

// =============================================================================
// Onboarding Types
// =============================================================================

export interface OnboardingProfileResponse {
  success: boolean;
  profile?: {
    full_name: string;
    role: string;
    company: string;
    industry: string;
    employees: number;
    bio: string;
    magic_question: string;
    departments: Array<{
      id: string;
      name: string;
      purpose: string;
      icon: string;
    }>;
  };
  fallback_required: boolean;
  error?: string;
}

export interface TrialStatusResponse {
  has_trial_available: boolean;
  has_api_key: boolean;
  trial_count: number;
  trial_limit: number;
}

// =============================================================================
// Admin Portal Types
// =============================================================================

export interface AdminStats {
  total_users: number;
  total_companies: number;
  total_conversations: number;
  total_messages: number;
  active_users_24h: number;
  active_users_7d: number;
}

export interface ModelRanking {
  model: string;
  avg_rank: number;
  sessions: number;
  wins: number;
  win_rate: number;
}

export interface DepartmentLeaderboard {
  department: string;
  leader: ModelRanking | null;
  sessions: number;
  leaderboard: ModelRanking[];
}

export interface ModelAnalyticsResponse {
  overall_leader: ModelRanking | null;
  total_sessions: number;
  overall_leaderboard: ModelRanking[];
  departments: DepartmentLeaderboard[];
}

export interface AdminPlatformUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
}

export interface AdminUsersResponse {
  users: AdminPlatformUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminCompanyInfo {
  id: string;
  name: string;
  created_at: string;
  user_count: number;
  conversation_count: number;
  owner_email: string | null;
}

export interface AdminCompaniesResponse {
  companies: AdminCompanyInfo[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  role: string;
  created_at: string; // When admin access was granted
  user_metadata?: Record<string, unknown> | null;
}

export interface AdminAuditLog {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_type: 'user' | 'admin' | 'system' | 'api';
  action: string;
  action_category: 'auth' | 'user' | 'company' | 'admin' | 'data' | 'api' | 'billing' | 'security';
  resource_type: string | null;
  resource_id: string | null;
  resource_name: string | null;
  company_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AdminAuditLogsResponse {
  logs: AdminAuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminAuditFilters {
  page?: number;
  page_size?: number;
  action_category?: string;
  actor_type?: string;
  resource_type?: string;
  company_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface AdminAuditCategoryOption {
  value: string;
  label: string;
}

export interface AdminAuditCategories {
  action_categories: AdminAuditCategoryOption[];
  actor_types: AdminAuditCategoryOption[];
  resource_types: AdminAuditCategoryOption[];
}

export interface AdminAuditExportResponse {
  success: boolean;
  count: number;
  exported_at: string;
  logs: AdminAuditLog[];
}

// =============================================================================
// Admin User Management Types
// =============================================================================

export interface AdminUserDetails {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
  is_suspended: boolean;
  companies: Array<{ id: string; name: string; created_at: string }>;
  conversation_count: number;
}

export interface AdminDeleteUserResponse {
  success: boolean;
  message: string;
  type: 'soft_delete' | 'permanent';
  // For soft delete
  restoration_deadline_days?: number;
  data_preserved?: {
    companies: number;
    conversations: number;
  };
  // For permanent delete
  deleted?: {
    companies: number;
    conversations: number;
  };
}

export interface AdminDeletedUser {
  user_id: string;
  email: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deletion_reason: string | null;
  restoration_deadline: string;
  can_restore: boolean;
  days_until_anonymization: number | null;
  is_anonymized: boolean;
}

export interface AdminRestoreUserResponse {
  success: boolean;
  message: string;
  user_id: string;
}

export interface AdminUpdateUserResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// Admin Invitation Types
// =============================================================================

export interface CreateInvitationRequest {
  email: string;
  name?: string;
  notes?: string;
  target_company_id?: string;
  target_company_role?: 'owner' | 'admin' | 'member';
}

export interface CreateInvitationResponse {
  success: boolean;
  invitation_id: string;
  email: string;
  expires_at: string;
  email_sent: boolean;
  email_preview_mode: boolean;
}

export interface AdminInvitation {
  id: string;
  email: string;
  name: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'revoked';
  invited_by_email: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  target_company_name: string | null;
  resend_count: number;
}

export interface AdminInvitationsResponse {
  invitations: AdminInvitation[];
  total: number;
  page: number;
  page_size: number;
}

export interface ResendInvitationResponse {
  success: boolean;
  message: string;
  new_expires_at: string;
  email_sent: boolean;
  email_preview_mode: boolean;
}

// Public invitation validation (no auth required)
export interface InvitationValidation {
  is_valid: boolean;
  email: string | null;
  name: string | null;
  expires_at: string | null;
  target_company_name: string | null;
  error: string | null;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  added_to_company: boolean;
  company_name: string | null;
}

// =============================================================================
// Admin Impersonation Types
// =============================================================================

export interface ImpersonationSession {
  session_id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string;
  target_user_email: string;
  started_at: string;
  expires_at: string;
  reason: string;
}

export interface StartImpersonationRequest {
  reason: string;
}

export interface StartImpersonationResponse {
  success: boolean;
  session: ImpersonationSession;
}

export interface ImpersonationStatusResponse {
  is_impersonating: boolean;
  session: ImpersonationSession | null;
}

export interface EndImpersonationResponse {
  success: boolean;
  message: string;
  ended_count: number;
}

export interface ImpersonationSessionHistoryItem {
  session_id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string;
  target_user_email: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  ended_reason: 'manual' | 'expired' | 'admin_logout' | 'target_deleted' | null;
  reason: string;
  is_active: boolean;
}

export interface ImpersonationSessionsResponse {
  sessions: ImpersonationSessionHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Public Endpoint Types
// =============================================================================

/**
 * Council configuration stats returned by the public endpoint.
 */
export interface CouncilStats {
  stage1_count: number; // Number of AIs in Stage 1 (initial responses)
  stage2_count: number; // Number of AIs in Stage 2 (peer review)
  stage3_count: number; // Number of chairman models
  total_rounds: number; // Always 3 (the deliberation stages)
  providers: string[]; // List of unique provider names for carousel display
}

// =============================================================================
// LLM Hub Types
// =============================================================================

export interface Persona {
  id: string;
  persona_key: string;
  name: string;
  category: string;
  description?: string;
  system_prompt: string;
  user_prompt_template?: string;
  is_global: boolean;
  updated_at?: string;
}

export interface UpdatePersonaPayload {
  name?: string;
  description?: string;
  system_prompt?: string;
  user_prompt_template?: string;
}

export interface UpdatePresetPayload {
  config: {
    stage1: StageConfig;
    stage2: StageConfig;
    stage3: StageConfig;
  };
}

export interface UpdateModelPayload {
  model_id?: string;
  priority?: number;
  is_enabled?: boolean;
}

export interface CreateModelPayload {
  role: string;
  model_id: string;
  priority?: number;
}

export interface StageConfig {
  temperature: number;
  max_tokens: number;
}

/**
 * Full LLM preset with configuration for all stages.
 */
export interface LLMPresetFull {
  id: string; // 'conservative' | 'balanced' | 'creative'
  name: string;
  description?: string;
  config: {
    stage1: StageConfig;
    stage2: StageConfig;
    stage3: StageConfig;
  };
  recommended_for: string[];
  updated_at?: string;
}

/**
 * A model entry in the model registry.
 */
export interface ModelRegistryEntry {
  id: string;
  role: string;
  model_id: string;
  display_name?: string;
  priority: number;
  is_active: boolean;
  is_global?: boolean;
  notes?: string;
}
