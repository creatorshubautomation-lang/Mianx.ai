// ============================================================
// MIANX.AI V3 — Zod Validation Schemas
// Validates all API request bodies and query parameters
// ============================================================

import { z } from 'zod'

// ============================================================
// Shared / Reusable Primitives
// ============================================================

/** ISO-8601 datetime string (e.g. "2025-01-15T10:30:00Z") */
export const datetimeString = z.string().datetime({ offset: true }).or(z.string().datetime())

/** CUID or UUID identifier */
export const idString = z.string().min(1)

/** Generic JSON object (Record<string, unknown>) */
export const jsonObject = z.record(z.string(), z.unknown())

/** Generic JSON array (unknown[]) */
export const jsonArray = z.array(z.unknown())

/** Positive number (>= 0) */
export const nonNegativeNumber = z.number().min(0)

/** Slug string — lowercase, alphanumeric, hyphens, no leading/trailing hyphens */
export const slugString = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Must be a valid slug (lowercase, alphanumeric, hyphens)')

/** Loose slug — allows single-char slugs like "a" */
export const slugStringLoose = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Must be a valid slug')

// ============================================================
// Enum Schemas (mirrors Prisma enums)
// ============================================================

export const OrganizationStatusEnum = z.enum(['active', 'suspended', 'archived'])
export const MembershipStatusEnum = z.enum(['invited', 'active', 'suspended', 'removed'])
export const DomainStatusEnum = z.enum(['draft', 'development', 'published', 'active', 'deprecated', 'archived'])
export const SubscriptionStatusEnum = z.enum(['trialing', 'active', 'past_due', 'grace_period', 'paused', 'cancelled', 'expired', 'suspended'])
export const EntitlementStatusEnum = z.enum(['enabled', 'disabled', 'limited', 'trial', 'expired', 'suspended'])
export const TrialStatusEnum = z.enum(['started', 'active', 'ending', 'converted', 'expired'])
export const AgentStatusEnum = z.enum(['draft', 'testing', 'active', 'paused', 'deprecated', 'retired'])
export const MissionStatusEnum = z.enum(['draft', 'planning', 'approved', 'executing', 'verifying', 'completed', 'failed', 'cancelled'])
export const TaskStatusEnum = z.enum(['planned', 'queued', 'running', 'waiting_tool', 'waiting_approval', 'verifying', 'retrying', 'failed', 'completed', 'cancelled', 'blocked'])
export const OutcomeStatusEnum = z.enum(['not_started', 'in_progress', 'near_target', 'achieved', 'missed', 'failed'])
export const VerificationTypeEnum = z.enum(['schema_validation', 'test', 'typecheck', 'lint', 'build', 'security', 'accessibility', 'business_rule', 'artifact_check', 'metric_threshold'])
export const WorkflowRunStatusEnum = z.enum(['queued', 'running', 'waiting', 'waiting_approval', 'completed', 'failed', 'cancelled', 'timed_out', 'dead_lettered'])
export const JobPriorityEnum = z.enum(['critical', 'high', 'normal', 'low'])
export const OutboxStatusEnum = z.enum(['pending', 'published', 'failed'])
export const ToolRiskLevelEnum = z.enum(['READ', 'LOW_WRITE', 'MEDIUM_WRITE', 'HIGH_WRITE', 'CRITICAL'])
export const AutonomyLevelEnum = z.enum(['conservative', 'balanced', 'autonomous'])
export const UserModeEnum = z.enum(['simple', 'pro', 'expert'])
export const ActorTypeEnum = z.enum(['human', 'ai_agent', 'system', 'integration'])
export const SettingScopeEnum = z.enum(['platform', 'organization', 'domain', 'module', 'user'])
export const MemoryScopeEnum = z.enum(['session', 'conversation', 'user', 'organization', 'domain', 'agent', 'operational'])
export const FailureClassificationEnum = z.enum(['validation_error', 'authorization_error', 'not_found', 'conflict'])

// ============================================================
// Organization Schemas
// ============================================================

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugStringLoose.optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(10).optional(),
  currency: z.string().max(3).optional(),
})

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: slugStringLoose.optional(),
  status: OrganizationStatusEnum.optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(10).optional(),
  currency: z.string().max(3).optional(),
})

// ============================================================
// Agent Schemas
// ============================================================

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugStringLoose,
  description: z.string().max(2000).optional(),
  type: z.string().max(100).optional(),
  status: AgentStatusEnum.optional(),
  domainId: idString.optional(),
  configuration: jsonObject.optional(),
  capabilities: z.array(z.string()).optional(),
  successMetrics: jsonObject.optional(),
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: slugStringLoose.optional(),
  description: z.string().max(2000).optional(),
  type: z.string().max(100).optional(),
  status: AgentStatusEnum.optional(),
  domainId: idString.nullable().optional(),
  configuration: jsonObject.optional(),
  capabilities: z.array(z.string()).optional(),
  successMetrics: jsonObject.optional(),
  version: z.string().max(50).optional(),
})

// ============================================================
// Mission Schemas
// ============================================================

export const createMissionSchema = z.object({
  title: z.string().min(1).max(500),
  goal: z.string().min(1).max(5000),
  objective: z.string().max(5000).optional(),
  constraints: jsonObject.optional(),
  budget: nonNegativeNumber.optional(),
  estimatedCost: nonNegativeNumber.optional(),
  deadline: z.string().optional(),
  successCriteria: jsonArray.optional(),
  plan: jsonObject.optional(),
  userMode: UserModeEnum.optional(),
  agentIds: z.array(idString).optional(),
})

export const updateMissionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  goal: z.string().min(1).max(5000).optional(),
  objective: z.string().max(5000).optional(),
  constraints: jsonObject.optional(),
  budget: nonNegativeNumber.optional(),
  estimatedCost: nonNegativeNumber.optional(),
  actualCost: nonNegativeNumber.optional(),
  deadline: z.string().nullable().optional(),
  successCriteria: jsonArray.optional(),
  plan: jsonObject.optional(),
  status: MissionStatusEnum.optional(),
  userMode: UserModeEnum.optional(),
})

// ============================================================
// Mission Task Schemas
// ============================================================

export const createMissionTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  parentTaskId: idString.optional(),
  agentId: idString.optional(),
  assignedTools: z.array(idString).optional(),
  dependencies: z.array(idString).optional(),
  verificationConfig: jsonObject.optional(),
  input: jsonObject.optional(),
})

export const updateMissionTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: TaskStatusEnum.optional(),
  agentId: idString.nullable().optional(),
  assignedTools: z.array(idString).optional(),
  dependencies: z.array(idString).optional(),
  verificationConfig: jsonObject.optional(),
  input: jsonObject.optional(),
  output: jsonObject.optional(),
  error: z.string().nullable().optional(),
  maxRetries: z.number().int().min(0).max(20).optional(),
})

// ============================================================
// Workflow Schemas
// ============================================================

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugStringLoose,
  status: z.string().max(50).optional(),
  definition: jsonObject.optional(),
  triggerType: z.string().max(100).optional(),
  domainId: idString.optional(),
})

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: slugStringLoose.optional(),
  status: z.string().max(50).optional(),
  definition: jsonObject.optional(),
  triggerType: z.string().max(100).optional(),
  domainId: idString.nullable().optional(),
})

// ============================================================
// Approval Decision Schema
// ============================================================

export const createApprovalDecisionSchema = z.object({
  approvalId: idString,
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().max(2000).optional(),
})

// ============================================================
// Query Parameter Schemas
// ============================================================

/** Base pagination query parameters */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

/** Full list query parameters with filtering and sorting */
export const listQuerySchema = z.object({
  organizationId: idString,
  status: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.string().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

// ============================================================
// Inferred Types
// ============================================================

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreateAgentInput = z.infer<typeof createAgentSchema>
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
export type CreateMissionInput = z.infer<typeof createMissionSchema>
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>
export type CreateMissionTaskInput = z.infer<typeof createMissionTaskSchema>
export type UpdateMissionTaskInput = z.infer<typeof updateMissionTaskSchema>
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>
export type CreateApprovalDecisionInput = z.infer<typeof createApprovalDecisionSchema>
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>
export type ListQueryInput = z.infer<typeof listQuerySchema>
