// ============================================================
// MIANX.AI V3 — Comprehensive TypeScript Types
// The Agentic AI Operating System for Modern Teams
// ============================================================

// Re-export all Prisma-generated enums for convenience
export type {
  OrganizationStatus,
  MembershipStatus,
  DomainStatus,
  SubscriptionStatus,
  EntitlementStatus,
  TrialStatus,
  AgentStatus,
  MissionStatus,
  TaskStatus,
  OutcomeStatus,
  VerificationType,
  WorkflowRunStatus,
  JobPriority,
  OutboxStatus,
  ToolRiskLevel,
  AutonomyLevel,
  UserMode,
  ActorType,
  SettingScope,
  MemoryScope,
  FailureClassification,
} from '@prisma/client'

import type {
  OrganizationStatus,
  MembershipStatus,
  AgentStatus,
  MissionStatus,
  TaskStatus,
  OutcomeStatus,
  WorkflowRunStatus,
  SubscriptionStatus,
  TrialStatus,
  AutonomyLevel,
  UserMode,
  ActorType,
  ToolRiskLevel,
  VerificationType,
  SettingScope,
  MemoryScope,
  JobPriority,
} from '@prisma/client'

// ============================================================
// View names for hash-based SPA router
// ============================================================

export type ViewName =
  | 'landing'
  | 'login'
  | 'home'
  | 'dashboard'
  | 'missions'
  | 'mission-detail'
  | 'agents'
  | 'workflows'
  | 'billing'
  | 'organizations'
  | 'org-settings'
  | 'integrations'
  | 'trust-center'
  | 'command-center'
  | 'settings'

// ============================================================
// DTOs — Data Transfer Objects (API request bodies)
// ============================================================

// -- Organization DTOs --

export interface CreateOrganizationDto {
  name: string
  slug?: string
  timezone?: string
  locale?: string
  currency?: string
}

export interface UpdateOrganizationDto {
  name?: string
  slug?: string
  status?: OrganizationStatus
  timezone?: string
  locale?: string
  currency?: string
}

// -- Agent DTOs --

export interface CreateAgentDto {
  name: string
  slug: string
  description?: string
  type?: string
  status?: AgentStatus
  domainId?: string
  configuration?: Record<string, unknown>
  capabilities?: string[]
  successMetrics?: Record<string, unknown>
}

export interface UpdateAgentDto {
  name?: string
  slug?: string
  description?: string
  type?: string
  status?: AgentStatus
  domainId?: string | null
  configuration?: Record<string, unknown>
  capabilities?: string[]
  successMetrics?: Record<string, unknown>
  version?: string
}

// -- Mission DTOs --

export interface CreateMissionDto {
  title: string
  goal: string
  objective?: string
  constraints?: Record<string, unknown>
  budget?: number
  estimatedCost?: number
  deadline?: string
  successCriteria?: unknown[]
  plan?: Record<string, unknown>
  userMode?: UserMode
  agentIds?: string[]
}

export interface UpdateMissionDto {
  title?: string
  goal?: string
  objective?: string
  constraints?: Record<string, unknown>
  budget?: number
  estimatedCost?: number
  actualCost?: number
  deadline?: string | null
  successCriteria?: unknown[]
  plan?: Record<string, unknown>
  status?: MissionStatus
  userMode?: UserMode
}

// -- Mission Task DTOs --

export interface CreateMissionTaskDto {
  title: string
  description?: string
  parentTaskId?: string
  agentId?: string
  assignedTools?: string[]
  dependencies?: string[]
  verificationConfig?: Record<string, unknown>
  input?: Record<string, unknown>
}

export interface UpdateMissionTaskDto {
  title?: string
  description?: string
  status?: TaskStatus
  agentId?: string | null
  assignedTools?: string[]
  dependencies?: string[]
  verificationConfig?: Record<string, unknown>
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string | null
  maxRetries?: number
}

// -- Workflow DTOs --

export interface CreateWorkflowDto {
  name: string
  slug: string
  status?: string
  definition?: Record<string, unknown>
  triggerType?: string
  domainId?: string
}

export interface UpdateWorkflowDto {
  name?: string
  slug?: string
  status?: string
  definition?: Record<string, unknown>
  triggerType?: string
  domainId?: string | null
}

// -- Approval DTOs --

export interface CreateApprovalDecisionDto {
  approvalId: string
  decision: 'approved' | 'rejected'
  reason?: string
}

// ============================================================
// API Response Envelope
// ============================================================

export interface ApiResponseMeta {
  total?: number
  cursor?: string | null
  hasMore?: boolean
  limit?: number
  page?: number
  [key: string]: unknown
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiResponseEnvelope<T = unknown> {
  data: T
  meta?: ApiResponseMeta
  error?: ApiError
  request_id: string
}

// ============================================================
// Store Types
// ============================================================

export interface AuthState {
  user: ProfileDto | null
  isAuthenticated: boolean
  setUser: (user: ProfileDto | null) => void
  logout: () => void
}

export interface AppState {
  currentView: ViewName
  viewParams: Record<string, string>
 sidebarOpen: boolean
  userMode: UserMode
  setCurrentView: (view: ViewName, params?: Record<string, string>) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setUserMode: (mode: UserMode) => void
}

export interface OrgState {
  organizations: OrganizationDto[]
  activeOrgId: string | null
  activeDomainId: string | null
  setOrganizations: (orgs: OrganizationDto[]) => void
  setActiveOrgId: (id: string | null) => void
  setActiveDomainId: (id: string | null) => void
}

export interface MissionState {
  missions: MissionDto[]
  activeMissionId: string | null
  tasks: MissionTaskDto[]
  setMissions: (missions: MissionDto[]) => void
  setActiveMissionId: (id: string | null) => void
  setTasks: (tasks: MissionTaskDto[]) => void
  addMission: (mission: MissionDto) => void
  updateMission: (id: string, data: Partial<MissionDto>) => void
  removeMission: (id: string) => void
}

export interface UiState {
  toasts: UiToast[]
  modals: UiModal[]
 addToast: (toast: Omit<UiToast, 'id'>) => void
  removeToast: (id: string) => void
  openModal: (modal: Omit<UiModal, 'id'>) => void
  closeModal: (id: string) => void
}

export interface UiToast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
  duration?: number
}

export interface UiModal {
  id: string
  component: string
  props?: Record<string, unknown>
}

export type StoreState = AuthState & AppState & OrgState & MissionState & UiState

// ============================================================
// Lightweight DTOs (for frontend store usage)
// ============================================================

export interface ProfileDto {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  locale: string
  timezone: string
  createdAt: string
}

export interface OrganizationDto {
  id: string
  name: string
  slug: string
  status: OrganizationStatus
  timezone: string
  locale: string
  currency: string
  createdAt: string
  updatedAt: string
}

export interface AgentDto {
  id: string
  organizationId: string
  domainId: string | null
  name: string
  slug: string
  description: string | null
  status: AgentStatus
  type: string
  configuration: string
  capabilities: string
  version: string
  successMetrics: string
  createdAt: string
  updatedAt: string
}

export interface MissionDto {
  id: string
  organizationId: string
  userId: string | null
  title: string
  goal: string
  objective: string | null
  constraints: string
  budget: number
  estimatedCost: number
  actualCost: number
  deadline: string | null
  successCriteria: string
  plan: string
  status: MissionStatus
  userMode: UserMode
  correlationId: string | null
  createdAt: string
  updatedAt: string
}

export interface MissionTaskDto {
  id: string
  missionId: string
  parentTaskId: string | null
  title: string
  description: string | null
  status: TaskStatus
  agentId: string | null
  assignedTools: string
  dependencies: string
  verificationConfig: string
  input: string
  output: string
  error: string | null
  retryCount: number
  maxRetries: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowDto {
  id: string
  organizationId: string
  domainId: string | null
  name: string
  slug: string
  status: string
  definition: string
  triggerType: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowRunDto {
  id: string
  workflowId: string
  organizationId: string
  status: WorkflowRunStatus
  input: string
  output: string | null
  currentStep: string | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OutcomeDto {
  id: string
  organizationId: string
  missionId: string
  objective: string
  baseline: string
  target: string
  currentResult: string
  progress: number
  confidence: number
  status: OutcomeStatus
  evidence: string
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EventDto {
  id: string
  eventType: string
  eventVersion: string
  organizationId: string | null
  missionId: string | null
  workflowRunId: string | null
  sourceType: ActorType
  sourceId: string | null
  actorType: ActorType
  actorId: string | null
  correlationId: string | null
  payload: string
  occurredAt: string
  createdAt: string
}

export interface WorkflowApprovalDto {
  id: string
  workflowRunId: string | null
  missionId: string | null
  organizationId: string
  requestedAction: string
  riskLevel: string
  requestedBy: string | null
  approvedBy: string | null
  decision: string | null
  reason: string | null
  expiresAt: string | null
  createdAt: string
  decidedAt: string | null
}

// ============================================================
// Billing DTOs
// ============================================================

export interface PlanDto {
  id: string
  name: string
  description: string | null
  billingModel: string
  currentVersion: PlanVersionDto | null
  createdAt: string
  updatedAt: string
}

export interface PlanVersionDto {
  id: string
  planId: string
  version: string
  includedFeatures: string
  includedDomains: string
  limits: string
  usageAllowances: string
  seatAllowances: string | null
  aiAllowance: string | null
  createdAt: string
}

export interface SubscriptionDto {
  id: string
  organizationId: string
  planVersionId: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceDto {
  id: string
  organizationId: string
  subscriptionId: string
  periodStart: string
  periodEnd: string | null
  lineItems: string
  subtotal: number
  discount: number
  tax: number
  total: number
  currency: string
  status: string
  issuedAt: string
  dueAt: string | null
  paidAt: string | null
}

export interface UsageRecordDto {
  id: string
  organizationId: string
  meterKey: string
  quantity: number
  unit: string
  source: string | null
  occurredAt: string
  idempotencyKey: string
  metadata: string | null
  createdAt: string
}

export interface UsageMeterDto {
  id: string
  key: string
  name: string
  unit: string
  aggregation: string
  period: string
  createdAt: string
}

export interface BillingOverview {
  subscription: SubscriptionDto | null
  plan: PlanDto | null
  invoices: InvoiceDto[]
  usage: UsageSummary[]
  trial: {
    status: TrialStatus
    startsAt: string
    endsAt: string | null
    durationDays: number
  } | null
}

export interface UsageSummary {
  meterKey: string
  meterName: string
  unit: string
  current: number
  limit: number | null
  period: string
}

// ============================================================
// Permission & Role DTOs
// ============================================================

export interface PermissionDto {
  id: string
  key: string
  description: string | null
}

export interface RoleDto {
  id: string
  organizationId: string | null
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  permissions: PermissionDto[]
  createdAt: string
  updatedAt: string
}

// ============================================================
// Query Parameter Types
// ============================================================

export interface PaginationParams {
  cursor?: string
  limit?: number
}

export interface ListParams extends PaginationParams {
 organizationId: string
  status?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ============================================================
// Utility Types
// ============================================================

export type JsonObject = Record<string, unknown>
export type JsonArray = unknown[]

/** Parse a JSON string field from Prisma into a typed object */
export function parseJsonField<T>(field: string, fallback: T): T {
  if (!field || field === 'undefined' || field === 'null') return fallback
  try {
    return JSON.parse(field) as T
  } catch {
    return fallback
  }
}

/** Serialize an object into a JSON string for Prisma storage */
export function toJsonField<T>(value: T): string {
  return JSON.stringify(value ?? {})
}

/** Generate a request ID for API tracing */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/** Create a slug from a name string */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Safe parseInt with fallback */
export function safeParseInt(value: string | undefined | null, fallback: number = 20): number {
  if (!value) return fallback
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, 1), 100)
}
