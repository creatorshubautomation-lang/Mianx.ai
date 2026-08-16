// Mianx.ai — Mission Engine: Core Types
//
// Type definitions for the Agentic AI Mission system.
// A Mission is a first-class concept representing a high-level
// objective that the AI system autonomously plans and executes
// through a dependency-aware task graph.

// ─────────────────────────────────────────────
//  Mission Status Machine
// ─────────────────────────────────────────────

export type MissionStatus =
  | "DRAFT"
  | "PLANNING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "PAUSED"
  | "VERIFYING"
  | "REPAIRING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type MissionTaskStatus =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "CANCELLED";

export type MissionEventType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "PLAN_GENERATED"
  | "PLAN_APPROVED"
  | "PLAN_REJECTED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "TASK_RETRIED"
  | "VERIFICATION_PASSED"
  | "VERIFICATION_FAILED"
  | "REPAIR_STARTED"
  | "REPAIR_COMPLETED"
  | "BUDGET_WARNING"
  | "BUDGET_EXCEEDED"
  | "HUMAN_APPROVAL_REQUESTED"
  | "HUMAN_APPROVED"
  | "HUMAN_REJECTED"
  | "MISSION_COMPLETED"
  | "MISSION_FAILED"
  | "MISSION_CANCELLED"
  | "ERROR";

export type ApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ToolCategory =
  | "FILE"
  | "CODE"
  | "GIT"
  | "DATABASE"
  | "WEB"
  | "DEPLOY"
  | "AI"
  | "SYSTEM";

// ─────────────────────────────────────────────
//  Valid Status Transitions
// ─────────────────────────────────────────────

/** Defines which status transitions are legal */
export const VALID_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["AWAITING_APPROVAL", "APPROVED", "FAILED", "CANCELLED"],
  AWAITING_APPROVAL: ["APPROVED", "PLANNING", "CANCELLED"],
  APPROVED: ["EXECUTING", "PAUSED", "CANCELLED"],
  EXECUTING: ["PAUSED", "VERIFYING", "REPAIRING", "COMPLETED", "FAILED", "CANCELLED"],
  PAUSED: ["EXECUTING", "CANCELLED"],
  VERIFYING: ["EXECUTING", "REPAIRING", "COMPLETED", "FAILED"],
  REPAIRING: ["EXECUTING", "VERIFYING", "FAILED"],
  COMPLETED: [], // terminal state
  FAILED: [], // terminal state (can be retried via new mission)
  CANCELLED: [], // terminal state
};

/**
 * Check if a status transition is valid.
 * Returns true if the transition is allowed.
 */
export function isValidTransition(
  from: MissionStatus,
  to: MissionStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─────────────────────────────────────────────
//  Mission Task Types
// ─────────────────────────────────────────────

export interface MissionTaskInput {
  title: string;
  description?: string;
  priority?: number;
  dependencies?: string[]; // task IDs this depends on
  assignedAgent?: string;
  agentTeam?: string;
  agentRole?: string;
  requiredTools?: string[];
  riskLevel?: RiskLevel;
  input?: string; // JSON context
  approvalRequired?: boolean;
}

export interface MissionTaskOutput {
  id: string;
  title: string;
  description: string | null;
  status: MissionTaskStatus;
  priority: number;
  dependencies: string[];
  dependents: string[];
  assignedAgent: string | null;
  agentTeam: string | null;
  agentRole: string | null;
  requiredTools: string[];
  riskLevel: RiskLevel;
  input: string | null;
  output: string | null;
  outputType: string | null;
  verificationStatus: string | null;
  verificationResult: string | null;
  retryCount: number;
  maxRetries: number;
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  order: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
//  Mission Plan Types (structured JSON output)
// ─────────────────────────────────────────────

export interface MissionPlan {
  summary: string;
  reasoning: string;
  estimatedSteps: number;
  estimatedCostUsd: number;
  riskAssessment: RiskLevel;
  tasks: MissionPlanTask[];
  tools: MissionPlanTool[];
  agents: MissionPlanAgent[];
}

export interface MissionPlanTask {
  id: string;
  title: string;
  description: string;
  priority: number;
  dependencies: string[]; // other task IDs this depends on
  assignedAgent: string;
  agentTeam: string;
  agentRole: string;
  requiredTools: string[];
  riskLevel: RiskLevel;
  verificationCriteria: string;
  outputType: string;
  approvalRequired: boolean;
}

export interface MissionPlanTool {
  name: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  purpose: string;
}

export interface MissionPlanAgent {
  name: string;
  team: string;
  role: string;
  tasks: string[]; // task IDs
}

// ─────────────────────────────────────────────
//  Mission Output Types (API responses)
// ─────────────────────────────────────────────

export interface MissionListItem {
  id: string;
  title: string;
  description: string;
  status: MissionStatus;
  priority: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  budgetUsd: number | null;
  spentUsd: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MissionDetail extends MissionListItem {
  userId: string;
  projectId: string | null;
  planJson: string | null;
  planSummary: string | null;
  planReasoning: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  deadline: string | null;
  updatedAt: string;
  tasks: MissionTaskOutput[];
}

// ─────────────────────────────────────────────
//  Mission Event Types
// ─────────────────────────────────────────────

export interface MissionEventOutput {
  id: string;
  missionId: string;
  taskId: string | null;
  eventType: MissionEventType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  level: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
//  Tool Definition Types
// ─────────────────────────────────────────────

export interface ToolDefinitionInput {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  riskLevel?: RiskLevel;
  inputSchema?: string;
  outputSchema?: string;
  handler: string;
  timeoutMs?: number;
  retryable?: boolean;
  maxRetries?: number;
  requireApproval?: boolean;
  allowedAgents?: string[];
  allowedPlans?: string[];
  costPerCall?: number;
}

// ─────────────────────────────────────────────
//  Status display helpers
// ─────────────────────────────────────────────

export const MISSION_STATUS_CONFIG: Record<
  MissionStatus,
  { label: string; color: string; bgColor: string; icon: string; description: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    icon: "FileEdit",
    description: "Mission created, not yet submitted for planning",
  },
  PLANNING: {
    label: "Planning",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    icon: "Brain",
    description: "AI Planner is generating the execution plan",
  },
  AWAITING_APPROVAL: {
    label: "Awaiting Approval",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    icon: "Clock",
    description: "Plan ready, waiting for your review and approval",
  },
  APPROVED: {
    label: "Approved",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    icon: "CheckCircle",
    description: "Plan approved, ready to execute",
  },
  EXECUTING: {
    label: "Executing",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    icon: "Play",
    description: "Agent loop is actively running tasks",
  },
  PAUSED: {
    label: "Paused",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    icon: "Pause",
    description: "Execution paused by user or system",
  },
  VERIFYING: {
    label: "Verifying",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    icon: "ShieldCheck",
    description: "Verification engine checking task outputs",
  },
  REPAIRING: {
    label: "Repairing",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    icon: "Wrench",
    description: "Auto-repair loop fixing failed verifications",
  },
  COMPLETED: {
    label: "Completed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    icon: "Trophy",
    description: "All tasks completed and verified successfully",
  },
  FAILED: {
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    icon: "AlertTriangle",
    description: "Mission failed after max retries exceeded",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-gray-500",
    bgColor: "bg-gray-500/20",
    icon: "XCircle",
    description: "Mission was cancelled by user",
  },
};

export const TASK_STATUS_CONFIG: Record<
  MissionTaskStatus,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: { label: "Pending", color: "text-gray-400", bgColor: "bg-gray-500/20" },
  READY: { label: "Ready", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  RUNNING: { label: "Running", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  COMPLETED: { label: "Completed", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
  FAILED: { label: "Failed", color: "text-red-400", bgColor: "bg-red-500/20" },
  SKIPPED: { label: "Skipped", color: "text-gray-500", bgColor: "bg-gray-500/20" },
  CANCELLED: { label: "Cancelled", color: "text-gray-500", bgColor: "bg-gray-500/20" },
};

export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  LOW: { label: "Low Risk", color: "text-green-400", bgColor: "bg-green-500/20", dotColor: "bg-green-400" },
  MEDIUM: { label: "Medium Risk", color: "text-amber-400", bgColor: "bg-amber-500/20", dotColor: "bg-amber-400" },
  HIGH: { label: "High Risk", color: "text-orange-400", bgColor: "bg-orange-500/20", dotColor: "bg-orange-400" },
  CRITICAL: { label: "Critical Risk", color: "text-red-400", bgColor: "bg-red-500/20", dotColor: "bg-red-400" },
};
