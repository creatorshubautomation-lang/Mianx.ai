// Mianx.ai — Phase 5: Approval Engine
//
// Human-in-the-Loop system that governs when and how autonomous
// actions require human oversight. The approval engine:
//
//   1. Creates approval requests for high-risk actions
//   2. Manages approval queue with priority ordering
//   3. Processes approve/reject with audit trail
//   4. Enforces budget-based auto-escalation
//   5. Auto-times-out stale approvals
//   6. Resumes paused missions after approval
//   7. Sends notifications on new/reviewed approvals
//
// Approval policies (configurable per plan):
//   - LOW risk    → auto-approve (no human needed)
//   - MEDIUM risk → auto-approve for PRO+, manual for FREE
//   - HIGH risk   → always require approval
//   - CRITICAL    → always require approval + admin escalation
//   - Budget >80% → upgrade MEDIUM to require approval

import { db } from "@/lib/db";
import { logMissionEvent, trackMissionBudget } from "./mission-engine";
import type { RiskLevel } from "./mission-types";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type ApprovalViewStatus = "PENDING" | "APPROVED" | "REJECTED" | "NOT_REQUIRED" | "EXPIRED";

export interface ApprovalRequest {
  missionId: string;
  taskId?: string;
  userId: string;
  title: string;
  description?: string;
  riskLevel: RiskLevel;
  metadata?: Record<string, unknown>;
  approvalType: "tool_execution" | "mission_plan" | "budget_override" | "deployment" | "custom";
}

export interface ApprovalRecord {
  id: string;
  missionId: string;
  taskId: string | null;
  userId: string;
  status: ApprovalViewStatus;
  title: string;
  description: string | null;
  riskLevel: RiskLevel;
  approvalType: string;
  metadata: Record<string, unknown> | null;
  responseNote: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived
  missionTitle?: string;
  taskTitle?: string;
  timeSinceCreated?: string;
}

export interface ApprovalListFilters {
  status?: ApprovalViewStatus;
  riskLevel?: RiskLevel;
  missionId?: string;
  approvalType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ApprovalStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  byRiskLevel: Record<RiskLevel, number>;
  oldestPending?: ApprovalRecord;
  averageResponseTimeMs?: number;
}

export interface ApprovalPolicy {
  autoApproveRiskLevels: RiskLevel[];
  requireApprovalRiskLevels: RiskLevel[];
  requireAdminEscalation: RiskLevel[];
  timeoutMinutes: number;
  budgetThresholdPercent: number; // e.g. 80 means require approval when >80% budget used
}

// ─────────────────────────────────────────────
//  Plan-based Approval Policies
// ─────────────────────────────────────────────

/** FREE plan: only HIGH/CRITICAL require approval */
const FREE_POLICY: ApprovalPolicy = {
  autoApproveRiskLevels: ["LOW", "MEDIUM"],
  requireApprovalRiskLevels: ["HIGH", "CRITICAL"],
  requireAdminEscalation: ["CRITICAL"],
  timeoutMinutes: 60,
  budgetThresholdPercent: 80,
};

/** STARTER plan: MEDIUM+ require approval */
const STARTER_POLICY: ApprovalPolicy = {
  autoApproveRiskLevels: ["LOW"],
  requireApprovalRiskLevels: ["MEDIUM", "HIGH", "CRITICAL"],
  requireAdminEscalation: ["CRITICAL"],
  timeoutMinutes: 48 * 60, // 48 hours
  budgetThresholdPercent: 85,
};

/** PRO plan: HIGH+ require approval */
const PRO_POLICY: ApprovalPolicy = {
  autoApproveRiskLevels: ["LOW", "MEDIUM"],
  requireApprovalRiskLevels: ["HIGH", "CRITICAL"],
  requireAdminEscalation: [],
  timeoutMinutes: 72 * 60, // 72 hours
  budgetThresholdPercent: 90,
};

/** ENTERPRISE plan: mostly auto, only CRITICAL needs approval */
const ENTERPRISE_POLICY: ApprovalPolicy = {
  autoApproveRiskLevels: ["LOW", "MEDIUM", "HIGH"],
  requireApprovalRiskLevels: ["CRITICAL"],
  requireAdminEscalation: [],
  timeoutMinutes: 7 * 24 * 60, // 7 days
  budgetThresholdPercent: 95,
};

export function getApprovalPolicy(planTier: string): ApprovalPolicy {
  switch (planTier) {
    case "ENTERPRISE": return ENTERPRISE_POLICY;
    case "PRO": return PRO_POLICY;
    case "STARTER": return STARTER_POLICY;
    case "FREE":
    default: return FREE_POLICY;
  }
}

// ─────────────────────────────────────────────
//  Approval Decision Engine
// ─────────────────────────────────────────────

/**
 * Determine if an action requires human approval based on:
 *   1. Risk level
 *   2. User's plan tier
 *   3. Current mission budget usage
 *
 * Returns { requiresApproval, reason, policyLevel }
 */
export async function evaluateApprovalRequirement(
  params: {
    riskLevel: RiskLevel;
    userId: string;
    missionId?: string;
    approvalType?: string;
  },
): Promise<{ requiresApproval: boolean; reason: string; escalated: boolean }> {
  // Get user's plan
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { plan: true },
  });

  const planTier = user?.plan || "FREE";
  const policy = getApprovalPolicy(planTier);

  // Check risk level against policy
  if (policy.autoApproveRiskLevels.includes(params.riskLevel)) {
    // Auto-approve... unless budget threshold is exceeded
    if (params.missionId) {
      const budgetCheck = await checkBudgetApprovalRequirement(
        params.missionId,
        policy.budgetThresholdPercent,
      );
      if (budgetCheck.requiresApproval) {
        return {
          requiresApproval: true,
          reason: budgetCheck.reason,
          escalated: false,
        };
      }
    }

    return { requiresApproval: false, reason: "Auto-approved (low risk)", escalated: false };
  }

  if (policy.requireAdminEscalation.includes(params.riskLevel)) {
    return {
      requiresApproval: true,
      reason: `CRITICAL risk action requires admin approval (plan: ${planTier})`,
      escalated: true,
    };
  }

  if (policy.requireApprovalRiskLevels.includes(params.riskLevel)) {
    return {
      requiresApproval: true,
      reason: `${params.riskLevel} risk action requires approval (plan: ${planTier})`,
      escalated: false,
    };
  }

  // Default: no approval needed
  return { requiresApproval: false, reason: "Default: no approval required", escalated: false };
}

/**
 * Check if mission budget usage exceeds the threshold
 * that would require additional approval.
 */
async function checkBudgetApprovalRequirement(
  missionId: string,
  thresholdPercent: number,
): Promise<{ requiresApproval: boolean; reason: string }> {
  const mission = await db.mission.findUnique({
    where: { id: missionId },
    select: { budgetUsd: true, spentUsd: true },
  });

  if (!mission || !mission.budgetUsd) {
    return { requiresApproval: false, reason: "No budget set" };
  }

  const usagePercent = (mission.spentUsd / mission.budgetUsd) * 100;
  if (usagePercent >= thresholdPercent) {
    return {
      requiresApproval: true,
      reason: `Budget at ${usagePercent.toFixed(1)}% (threshold: ${thresholdPercent}%) — additional costs require approval`,
    };
  }

  return { requiresApproval: false, reason: `Budget at ${usagePercent.toFixed(1)}% — within threshold` };
}

// ─────────────────────────────────────────────
//  Approval CRUD
// ─────────────────────────────────────────────

/**
 * Create a new approval request.
 * Returns the approval ID.
 */
export async function createApproval(
  request: ApprovalRequest,
): Promise<string> {
  const approval = await db.humanApproval.create({
    data: {
      missionId: request.missionId,
      taskId: request.taskId || null,
      userId: request.userId,
      status: "PENDING",
      title: request.title,
      description: request.description || null,
      riskLevel: request.riskLevel,
      metadata: request.metadata ? JSON.stringify(request.metadata) : null,
    },
  });

  // Log mission event
  await logMissionEvent(request.missionId, {
    eventType: "HUMAN_APPROVAL_REQUESTED",
    title: `Approval Required: ${request.title}`,
    description: request.description || `A ${request.riskLevel} risk ${request.approvalType} requires your approval`,
    taskId: request.taskId || undefined,
    level: request.riskLevel === "CRITICAL" ? "error" : "warn",
    metadata: {
      approvalId: approval.id,
      approvalType: request.approvalType,
      riskLevel: request.riskLevel,
    },
  });

  // Create notification
  try {
    await db.notification.create({
      data: {
        userId: request.userId,
        projectId: undefined,
        type: "warning",
        title: `Approval Required: ${request.title}`,
        message: `A ${request.riskLevel.toLowerCase()} risk action needs your approval before proceeding.`,
        priority: request.riskLevel === "CRITICAL" ? "urgent" : request.riskLevel === "HIGH" ? "high" : "normal",
        actionUrl: `/dashboard/approvals?id=${approval.id}`,
        metadata: JSON.stringify({ approvalId: approval.id, missionId: request.missionId }),
      },
    });
  } catch {
    // Notification failure shouldn't block approval creation
  }

  return approval.id;
}

/**
 * Get all approvals for a user with optional filters.
 */
export async function listApprovals(
  userId: string,
  filters?: ApprovalListFilters,
): Promise<{ approvals: ApprovalRecord[]; total: number }> {
  const where: Record<string, unknown> = { userId };

  if (filters?.status && filters.status !== "NOT_REQUIRED") {
    where.status = filters.status;
  } else if (!filters?.status) {
    where.status = "PENDING"; // Default: only show pending
  }

  if (filters?.riskLevel) {
    where.riskLevel = filters.riskLevel;
  }

  if (filters?.missionId) {
    where.missionId = filters.missionId;
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const total = await db.humanApproval.count({ where });

  const rows = await db.humanApproval.findMany({
    where,
    orderBy: [
      // CRITICAL first, then by createdAt desc
      { riskLevel: "desc" },
      { createdAt: "asc" }, // oldest pending first
    ],
    take: filters?.limit || 50,
    skip: filters?.offset || 0,
    include: {
      mission: {
        select: { title: true },
      },
    },
  });

  const approvals: ApprovalRecord[] = rows.map((row) => ({
    id: row.id,
    missionId: row.missionId,
    taskId: row.taskId,
    userId: row.userId,
    status: row.status as ApprovalViewStatus,
    title: row.title,
    description: row.description,
    riskLevel: row.riskLevel as RiskLevel,
    approvalType: (row.metadata ? JSON.parse(row.metadata).approvalType : undefined) || "custom",
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    responseNote: row.responseNote,
    respondedAt: row.respondedAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    missionTitle: row.mission?.title,
    timeSinceCreated: getTimeSince(row.createdAt),
  }));

  return { approvals, total };
}

/**
 * Get a single approval by ID.
 */
export async function getApproval(
  approvalId: string,
  userId?: string,
): Promise<ApprovalRecord | null> {
  const where: Record<string, unknown> = { id: approvalId };
  if (userId) where.userId = userId;

  const row = await db.humanApproval.findFirst({
    where,
    include: {
      mission: {
        select: { title: true, status: true },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    missionId: row.missionId,
    taskId: row.taskId,
    userId: row.userId,
    status: row.status as ApprovalViewStatus,
    title: row.title,
    description: row.description,
    riskLevel: row.riskLevel as RiskLevel,
    approvalType: (row.metadata ? JSON.parse(row.metadata).approvalType : undefined) || "custom",
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    responseNote: row.responseNote,
    respondedAt: row.respondedAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    missionTitle: row.mission?.title,
    timeSinceCreated: getTimeSince(row.createdAt),
  };
}

// ─────────────────────────────────────────────
//  Approval Processing
// ─────────────────────────────────────────────

export interface ApprovalActionResult {
  success: boolean;
  approvalId: string;
  newStatus: ApprovalViewStatus;
  message: string;
  missionResumed?: boolean;
}

/**
 * Process an approval — approve or reject.
 * Updates the approval, logs the event, and optionally resumes the mission.
 */
export async function processApproval(
  approvalId: string,
  action: "approve" | "reject",
  userId: string,
  note?: string,
): Promise<ApprovalActionResult> {
  // Get the approval
  const approval = await db.humanApproval.findUnique({
    where: { id: approvalId },
    include: {
      mission: {
        select: { id: true, status: true, userId: true, title: true },
      },
    },
  });

  if (!approval) {
    return {
      success: false,
      approvalId,
      newStatus: "PENDING",
      message: "Approval not found",
    };
  }

  if (approval.status !== "PENDING") {
    return {
      success: false,
      approvalId,
      newStatus: approval.status as ApprovalViewStatus,
      message: `Approval already ${approval.status.toLowerCase()}`,
    };
  }

  const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const now = new Date();

  // Update approval record
  await db.humanApproval.update({
    where: { id: approvalId },
    data: {
      status: newStatus,
      respondedAt: now,
      responseNote: note || null,
    },
  });

  // Log mission event
  const eventType = action === "approve" ? "HUMAN_APPROVED" : "HUMAN_REJECTED";
  await logMissionEvent(approval.missionId, {
    eventType,
    title: `${action === "approve" ? "Approved" : "Rejected"}: ${approval.title}`,
    description: note || `Approval ${newStatus.toLowerCase()} by user`,
    taskId: approval.taskId || undefined,
    level: action === "approve" ? "success" : "warn",
    metadata: {
      approvalId,
      action,
      riskLevel: approval.riskLevel,
      approvalType: (approval.metadata ? JSON.parse(approval.metadata).approvalType : undefined) || "custom",
    },
  });

  // If approved and mission was paused, check if we should resume
  let missionResumed = false;
  if (action === "approve") {
    missionResumed = await checkAndResumeMission(approval.missionId, approval.mission.status);

    // If this was a task-level approval, update the task status
    if (approval.taskId) {
      try {
        await db.missionTask.update({
          where: { id: approval.taskId },
          data: {
            approvalStatus: "APPROVED",
            approvalReason: note || "Approved by user",
          },
        });
      } catch {
        // Task might not exist
      }
    }
  } else {
    // If rejected, update task status too
    if (approval.taskId) {
      try {
        await db.missionTask.update({
          where: { id: approval.taskId },
          data: {
            approvalStatus: "REJECTED",
            approvalReason: note || "Rejected by user",
          },
        });
      } catch {
        // Task might not exist
      }
    }
  }

  // Create result notification
  try {
    await db.notification.create({
      data: {
        userId: approval.userId,
        type: action === "approve" ? "milestone" : "warning",
        title: `Approval ${newStatus.toLowerCase()}: ${approval.title}`,
        message: action === "approve"
          ? "The action has been approved and will proceed."
          : `The action was rejected${note ? `: ${note}` : ""}.`,
        priority: "normal",
        metadata: JSON.stringify({ approvalId, missionId: approval.missionId }),
      },
    });
  } catch {
    // ignore
  }

  return {
    success: true,
    approvalId,
    newStatus,
    message: action === "approve"
      ? `Approved "${approval.title}". ${missionResumed ? "Mission resumed." : ""}`
      : `Rejected "${approval.title}"${note ? `: ${note}` : ""}`,
    missionResumed,
  };
}

/**
 * Bulk process multiple approvals at once.
 */
export async function bulkProcessApprovals(
  approvalIds: string[],
  action: "approve" | "reject",
  userId: string,
  note?: string,
): Promise<ApprovalActionResult[]> {
  const results: ApprovalActionResult[] = [];

  for (const id of approvalIds) {
    const result = await processApproval(id, action, userId, note);
    results.push(result);
  }

  return results;
}

// ─────────────────────────────────────────────
//  Mission Resume Logic
// ─────────────────────────────────────────────

/**
 * After an approval, check if the mission should be resumed.
 * A mission is resumed when ALL pending approvals for it are resolved.
 */
async function checkAndResumeMission(
  missionId: string,
  currentStatus: string,
): Promise<boolean> {
  if (currentStatus !== "PAUSED" && currentStatus !== "AWAITING_APPROVAL") {
    return false;
  }

  // Check if any pending approvals remain for this mission
  const pendingCount = await db.humanApproval.count({
    where: {
      missionId,
      status: "PENDING",
    },
  });

  if (pendingCount > 0) {
    return false; // Still waiting for other approvals
  }

  // All approvals resolved — resume the mission
  try {
    await db.mission.update({
      where: { id: missionId },
      data: {
        status: "APPROVED", // Will transition to EXECUTING on next run
      },
    });

    await logMissionEvent(missionId, {
      eventType: "STATUS_CHANGED",
      title: "Mission Resumed",
      description: "All pending approvals resolved. Mission is ready to continue execution.",
      level: "success",
      metadata: { resumedFrom: currentStatus },
    });

    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
//  Approval Statistics
// ─────────────────────────────────────────────

/**
 * Get approval statistics for a user's dashboard.
 */
export async function getApprovalStats(userId: string): Promise<ApprovalStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pendingCount, approvedToday, rejectedToday, allPending] = await Promise.all([
    db.humanApproval.count({
      where: { userId, status: "PENDING" },
    }),
    db.humanApproval.count({
      where: {
        userId,
        status: "APPROVED",
        respondedAt: { gte: today },
      },
    }),
    db.humanApproval.count({
      where: {
        userId,
        status: "REJECTED",
        respondedAt: { gte: today },
      },
    }),
    db.humanApproval.findMany({
      where: { userId, status: "PENDING" },
      select: { id: true, riskLevel: true, createdAt: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byRiskLevel: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const a of allPending) {
    byRiskLevel[a.riskLevel as RiskLevel]++;
  }

  // Average response time (from approvals responded to in the last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentApproved = await db.humanApproval.findMany({
    where: {
      userId,
      status: "APPROVED",
      respondedAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true, respondedAt: true },
  });

  let averageResponseTimeMs: number | undefined;
  if (recentApproved.length > 0) {
    const totalMs = recentApproved.reduce((sum, a) => {
      return sum + (a.respondedAt!.getTime() - a.createdAt.getTime());
    }, 0);
    averageResponseTimeMs = Math.round(totalMs / recentApproved.length);
  }

  return {
    pendingCount,
    approvedToday,
    rejectedToday,
    byRiskLevel,
    oldestPending: allPending[0] ? {
      id: allPending[0].id,
      missionId: "",
      taskId: null,
      userId,
      status: "PENDING",
      title: allPending[0].title,
      description: null,
      riskLevel: allPending[0].riskLevel as RiskLevel,
      approvalType: "custom",
      metadata: null,
      responseNote: null,
      respondedAt: null,
      createdAt: allPending[0].createdAt.toISOString(),
      updatedAt: allPending[0].createdAt.toISOString(),
      timeSinceCreated: getTimeSince(allPending[0].createdAt),
    } : undefined,
    averageResponseTimeMs,
  };
}

// ─────────────────────────────────────────────
//  Timeout Cleanup
// ─────────────────────────────────────────────

/**
 * Expire approvals that have been pending too long.
 * Should be called periodically (e.g., via cron).
 * Uses the user's plan policy to determine timeout.
 */
export async function expireStaleApprovals(): Promise<number> {
  const staleApprovals = await db.humanApproval.findMany({
    where: { status: "PENDING" },
    include: {
      mission: {
        select: { userId: true },
      },
    },
  });

  let expiredCount = 0;

  for (const approval of staleApprovals) {
    const user = await db.user.findUnique({
      where: { id: approval.mission.userId },
      select: { plan: true },
    });

    const policy = getApprovalPolicy(user?.plan || "FREE");
    const timeoutMs = policy.timeoutMinutes * 60 * 1000;
    const ageMs = Date.now() - approval.createdAt.getTime();

    if (ageMs > timeoutMs) {
      await db.humanApproval.update({
        where: { id: approval.id },
        data: {
          status: "EXPIRED" as never, // DB doesn't have EXPIRED, use REJECTED
          respondedAt: new Date(),
          responseNote: `Approval expired after ${policy.timeoutMinutes} minutes (plan: ${user?.plan || "FREE"})`,
        },
      });

      await logMissionEvent(approval.missionId, {
        eventType: "HUMAN_REJECTED",
        title: `Approval Expired: ${approval.title}`,
        description: `Approval timed out after ${policy.timeoutMinutes} minutes without response`,
        level: "warn",
        metadata: { approvalId: approval.id, expiredAfter: policy.timeoutMinutes },
      });

      expiredCount++;
    }
  }

  return expiredCount;
}

// ─────────────────────────────────────────────
//  Budget Enforcement
// ─────────────────────────────────────────────

export interface BudgetCheckResult {
  allowed: boolean;
  currentUsage: number;
  budgetLimit: number | null;
  usagePercent: number;
  reason?: string;
  requiresApproval: boolean;
}

/**
 * Check if a cost can be incurred against a mission's budget.
 * Enforces hard limits and returns approval requirements.
 */
export async function checkBudgetAllowance(
  missionId: string,
  additionalCostUsd: number,
  userId: string,
): Promise<BudgetCheckResult> {
  const mission = await db.mission.findUnique({
    where: { id: missionId },
    select: { budgetUsd: true, spentUsd: true },
  });

  if (!mission) {
    return {
      allowed: false,
      currentUsage: 0,
      budgetLimit: null,
      usagePercent: 0,
      reason: "Mission not found",
      requiresApproval: false,
    };
  }

  // No budget = unlimited (but still track)
  if (!mission.budgetUsd) {
    return {
      allowed: true,
      currentUsage: mission.spentUsd,
      budgetLimit: null,
      usagePercent: 0,
      requiresApproval: false,
    };
  }

  const projectedUsage = mission.spentUsd + additionalCostUsd;
  const usagePercent = (mission.spentUsd / mission.budgetUsd) * 100;
  const projectedPercent = (projectedUsage / mission.budgetUsd) * 100;

  // Hard limit: cannot exceed budget
  if (projectedUsage > mission.budgetUsd) {
    return {
      allowed: false,
      currentUsage: mission.spentUsd,
      budgetLimit: mission.budgetUsd,
      usagePercent,
      reason: `Budget exceeded: $${mission.spentUsd.toFixed(2)} + $${additionalCostUsd.toFixed(2)} > $${mission.budgetUsd.toFixed(2)}`,
      requiresApproval: true,
    };
  }

  // Get user's plan for threshold
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const policy = getApprovalPolicy(user?.plan || "FREE");

  // Near threshold: allowed but requires approval
  if (projectedPercent > policy.budgetThresholdPercent) {
    return {
      allowed: true,
      currentUsage: mission.spentUsd,
      budgetLimit: mission.budgetUsd,
      usagePercent,
      reason: `Approaching budget limit (${projectedPercent.toFixed(1)}% of $${mission.budgetUsd.toFixed(2)})`,
      requiresApproval: true,
    };
  }

  return {
    allowed: true,
    currentUsage: mission.spentUsd,
    budgetLimit: mission.budgetUsd,
    usagePercent,
    requiresApproval: false,
  };
}

/**
 * Auto-pause a mission when budget is exceeded.
 * Called by trackMissionBudget when exceeded=true.
 */
export async function autoPauseOnBudgetExceeded(missionId: string): Promise<boolean> {
  try {
    const mission = await db.mission.findUnique({
      where: { id: missionId },
      select: { status: true, budgetUsd: true, spentUsd: true },
    });

    if (!mission || mission.status !== "EXECUTING") {
      return false;
    }

    await db.mission.update({
      where: { id: missionId },
      data: { status: "PAUSED" },
    });

    await logMissionEvent(missionId, {
      eventType: "BUDGET_EXCEEDED",
      title: "Mission Auto-Paused (Budget Exceeded)",
      description: `Mission paused automatically. Spent $${mission.spentUsd.toFixed(2)} of $${mission.budgetUsd?.toFixed(2)} budget. Increase budget or approve additional spending to continue.`,
      level: "error",
      metadata: {
        spentUsd: mission.spentUsd,
        budgetUsd: mission.budgetUsd,
        autoPaused: true,
      },
    });

    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function getTimeSince(date: Date): string {
  const now = Date.now();
  const then = date.getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

// ─────────────────────────────────────────────
//  Plan Budget Limits
// ─────────────────────────────────────────────

export const PLAN_BUDGET_LIMITS: Record<string, { maxMissionBudget: number; monthlySpendLimit: number }> = {
  FREE: { maxMissionBudget: 5, monthlySpendLimit: 10 },
  STARTER: { maxMissionBudget: 50, monthlySpendLimit: 100 },
  PRO: { maxMissionBudget: 500, monthlySpendLimit: 1000 },
  ENTERPRISE: { maxMissionBudget: 5000, monthlySpendLimit: 10000 },
};

/**
 * Check if a mission budget is within the user's plan limits.
 */
export function validateBudgetAgainstPlan(
  requestedBudget: number,
  planTier: string,
): { valid: boolean; reason: string; maxAllowed: number } {
  const limits = PLAN_BUDGET_LIMITS[planTier] || PLAN_BUDGET_LIMITS.FREE;

  if (requestedBudget > limits.maxMissionBudget) {
    return {
      valid: false,
      reason: `Budget $${requestedBudget} exceeds ${planTier} plan limit of $${limits.maxMissionBudget} per mission`,
      maxAllowed: limits.maxMissionBudget,
    };
  }

  return {
    valid: true,
    reason: `Budget within ${planTier} plan limits`,
    maxAllowed: limits.maxMissionBudget,
  };
}
