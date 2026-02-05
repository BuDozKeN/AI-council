/**
 * API client for the AI Council backend.
 *
 * This is the barrel module that composes all domain methods into the single
 * `api` export. Consumers import from this file — no import changes needed.
 *
 * Domain modules (in ./api/):
 * - client.ts      — shared infrastructure (auth, errors, base URL)
 * - types.ts       — all exported type interfaces
 * - conversations.ts — conversation CRUD, streaming, triage, leaderboard
 * - context.ts     — context sections, suggestions, settings
 * - projects.ts    — project CRUD, stats, utilities
 * - billing.ts     — profile, billing, attachments
 * - knowledge.ts   — knowledge base, AI structuring
 * - company.ts     — company overview, team, playbooks, decisions, members
 * - llm.ts         — LLM ops, presets, model registry, personas
 * - admin.ts       — admin portal, invitations, user management, impersonation
 * - public.ts      — public endpoints, onboarding, feature flags
 *
 * Split from 4,447 lines during CRITICAL-3 tech debt remediation.
 */

// Domain method objects
import { conversationsMethods } from './api/conversations';
import { contextMethods } from './api/context';
import { projectsMethods } from './api/projects';
import { billingMethods } from './api/billing';
import { knowledgeMethods } from './api/knowledge';
import { companyMethods } from './api/company';
import { llmMethods } from './api/llm';
import { adminMethods } from './api/admin';
import { publicMethods } from './api/public';

// Compose the single api object from all domain modules
export const api = {
  ...conversationsMethods,
  ...contextMethods,
  ...projectsMethods,
  ...billingMethods,
  ...knowledgeMethods,
  ...companyMethods,
  ...llmMethods,
  ...adminMethods,
  ...publicMethods,
};

// Re-export infrastructure
export { APIError, setTokenGetter } from './api/client';

// Re-export all types for consumers
export type {
  ListConversationsOptions,
  SendMessageStreamOptions,
  ChatStreamOptions,
  ListDecisionsOptions,
  ListActivityOptions,
  ContextWriteAssistOptions,
  SaveDecisionOptions,
  SSEEventCallback,
  OnboardingProfileResponse,
  TrialStatusResponse,
  AdminStats,
  ModelRanking,
  DepartmentLeaderboard,
  ModelAnalyticsResponse,
  AdminPlatformUser,
  AdminUsersResponse,
  AdminCompanyInfo,
  AdminCompaniesResponse,
  AdminUserInfo,
  AdminAuditLog,
  AdminAuditLogsResponse,
  AdminAuditFilters,
  AdminAuditCategoryOption,
  AdminAuditCategories,
  AdminAuditExportResponse,
  AdminUserDetails,
  AdminDeleteUserResponse,
  AdminDeletedUser,
  AdminRestoreUserResponse,
  AdminUpdateUserResponse,
  CreateInvitationRequest,
  CreateInvitationResponse,
  AdminInvitation,
  AdminInvitationsResponse,
  ResendInvitationResponse,
  InvitationValidation,
  AcceptInvitationResponse,
  ImpersonationSession,
  StartImpersonationRequest,
  StartImpersonationResponse,
  ImpersonationStatusResponse,
  EndImpersonationResponse,
  ImpersonationSessionHistoryItem,
  ImpersonationSessionsResponse,
  CouncilStats,
  Persona,
  UpdatePersonaPayload,
  UpdatePresetPayload,
  UpdateModelPayload,
  CreateModelPayload,
  StageConfig,
  LLMPresetFull,
  ModelRegistryEntry,
} from './api/types';
