// Mianx.ai — Phase 4: Tool Registry
//
// Central registry for all executable tools in the platform.
// Tools are the building blocks that agents use during mission execution.
// Each tool has:
//   - A definition in the DB (ToolDefinition model)
//   - A handler function registered in tool-handlers.ts
//   - Permission rules (which agents, which plans, risk levels)
//   - Approval gates for high-risk operations
//   - Cost tracking per invocation
//
// The registry provides:
//   1. Tool resolution: name → definition (with caching)
//   2. Permission checks: agent + plan → allowed?
//   3. Input validation: JSON Schema validation before execution
//   4. Approval gating: HIGH/CRITICAL risk tools require approval
//   5. Usage statistics: call counts, costs, success rates

import { db } from "@/lib/db";
import type { ToolCategory, RiskLevel } from "./mission-types";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ToolDef {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  inputSchema: string; // JSON Schema string
  outputSchema: string | null;
  handler: string; // function name in tool-handlers.ts
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  requireApproval: boolean;
  allowedAgents: string[]; // JSON-parsed
  allowedPlans: string[]; // JSON-parsed
  costPerCall: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ToolExecuteRequest {
  toolName: string;
  input: Record<string, unknown>;
  agentName?: string;
  userPlan?: string;
  userId?: string;
  projectId?: string;
  missionId?: string;
  taskId?: string;
  skipApproval?: boolean; // for system-level calls
}

export interface ToolExecuteResult {
  success: boolean;
  output: unknown;
  toolName: string;
  durationMs: number;
  costUsd: number;
  approvalRequired: boolean;
  approvalId?: string;
  error?: string;
  riskLevel: RiskLevel;
}

export interface ToolListFilters {
  category?: ToolCategory;
  riskLevel?: RiskLevel;
  enabled?: boolean;
  search?: string;
  agentName?: string; // filter tools available to specific agent
}

export interface ToolStats {
  totalTools: number;
  enabledTools: number;
  byCategory: Record<ToolCategory, number>;
  byRiskLevel: Record<RiskLevel, number>;
  highRiskCount: number;
  approvalRequiredCount: number;
}

// ─────────────────────────────────────────────
//  In-memory cache
// ─────────────────────────────────────────────

/** Simple in-memory cache — tools don't change frequently */
const toolCache = new Map<string, { tool: ToolDef; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedTool(name: string): ToolDef | null {
  const cached = toolCache.get(name);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tool;
  }
  toolCache.delete(name);
  return null;
}

function setCachedTool(name: string, tool: ToolDef): void {
  toolCache.set(name, { tool, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateToolCache(name?: string): void {
  if (name) {
    toolCache.delete(name);
  } else {
    toolCache.clear();
  }
}

// ─────────────────────────────────────────────
//  Tool Resolution
// ─────────────────────────────────────────────

/**
 * Resolve a tool name to its full definition.
 * Checks cache first, then DB.
 * Returns null if tool not found or disabled.
 */
export async function resolveTool(name: string): Promise<ToolDef | null> {
  // Check cache
  const cached = getCachedTool(name);
  if (cached) return cached;

  // Query DB
  const tool = await db.toolDefinition.findUnique({
    where: { name },
  });

  if (!tool || !tool.enabled) return null;

  const toolDef = dbRowToToolDef(tool);
  setCachedTool(name, toolDef);
  return toolDef;
}

/**
 * Resolve multiple tools by names. Returns only found+enabled tools.
 */
export async function resolveTools(names: string[]): Promise<ToolDef[]> {
  const results: ToolDef[] = [];
  for (const name of names) {
    const tool = await resolveTool(name);
    if (tool) results.push(tool);
  }
  return results;
}

/**
 * Get all enabled tools with optional filters.
 */
export async function listTools(filters?: ToolListFilters): Promise<ToolDef[]> {
  const where: Record<string, unknown> = { enabled: true };

  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.riskLevel) {
    where.riskLevel = filters.riskLevel;
  }
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { displayName: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const rows = await db.toolDefinition.findMany({
    where,
    orderBy: { name: "asc" },
  });

  let tools = rows.map(dbRowToToolDef);

  // Post-filter by agent permission if specified
  if (filters?.agentName) {
    tools = tools.filter((t) => isAgentAllowed(t, filters.agentName!));
  }

  return tools;
}

// ─────────────────────────────────────────────
//  Permission Checks
// ─────────────────────────────────────────────

/**
 * Check if a specific agent is allowed to use a tool.
 * If allowedAgents is empty ([]), all agents are allowed.
 */
export function isAgentAllowed(tool: ToolDef, agentName: string): boolean {
  // Empty array = all agents allowed
  if (tool.allowedAgents.length === 0) return true;
  return tool.allowedAgents.includes(agentName);
}

/**
 * Check if a specific user plan is allowed to use a tool.
 * If allowedPlans is empty ([]), all plans are allowed.
 */
export function isPlanAllowed(tool: ToolDef, userPlan: string): boolean {
  // Empty array = all plans allowed
  if (tool.allowedPlans.length === 0) return true;
  return tool.allowedPlans.includes(userPlan);
}

/**
 * Full permission check for a tool execution request.
 * Returns an error message if NOT allowed, or null if allowed.
 */
export function checkToolPermissions(
  tool: ToolDef,
  req: ToolExecuteRequest,
): string | null {
  // Check agent permission
  if (req.agentName && !isAgentAllowed(tool, req.agentName)) {
    return `Agent "${req.agentName}" is not allowed to use tool "${tool.name}". Allowed agents: ${tool.allowedAgents.join(", ") || "all"}`;
  }

  // Check plan permission
  if (req.userPlan && !isPlanAllowed(tool, req.userPlan)) {
    return `Plan "${req.userPlan}" does not have access to tool "${tool.name}". Required plan: ${tool.allowedPlans.join(", ") || "any"}`;
  }

  // Check if approval is required
  if (tool.requireApproval && !req.skipApproval && tool.riskLevel !== "LOW") {
    // Will be handled by executor — just note it
  }

  return null; // allowed
}

// ─────────────────────────────────────────────
//  Input Validation
// ─────────────────────────────────────────────

/**
 * Validate tool input against its JSON Schema.
 * Uses a simple validation approach — checks required fields exist
 * and types match. Full JSON Schema validation would require a library.
 * Returns an array of validation error messages (empty = valid).
 */
export function validateToolInput(
  tool: ToolDef,
  input: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  try {
    const schema = JSON.parse(tool.inputSchema);
    const properties = schema.properties || {};
    const required = schema.required || [];

    // Check required fields
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        errors.push(`Missing required field: "${field}"`);
      }
    }

    // Check property types if defined
    for (const [field, value] of Object.entries(input)) {
      const propSchema = properties[field] as Record<string, unknown> | undefined;
      if (!propSchema) continue;

      const expectedType = propSchema.type as string | undefined;
      if (!expectedType) continue;

      // Simple type checking
      if (expectedType === "string" && typeof value !== "string") {
        errors.push(`Field "${field}" should be string, got ${typeof value}`);
      }
      if (expectedType === "number" && typeof value !== "number") {
        errors.push(`Field "${field}" should be number, got ${typeof value}`);
      }
      if (expectedType === "boolean" && typeof value !== "boolean") {
        errors.push(`Field "${field}" should be boolean, got ${typeof value}`);
      }
      if (expectedType === "array" && !Array.isArray(value)) {
        errors.push(`Field "${field}" should be array, got ${typeof value}`);
      }
      if (expectedType === "object" && (typeof value !== "object" || Array.isArray(value))) {
        errors.push(`Field "${field}" should be object, got ${typeof value}`);
      }
    }
  } catch {
    // Schema parse error — allow input (don't block on bad schema)
    console.warn(`[tool-registry] Could not parse input schema for tool "${tool.name}"`);
  }

  return errors;
}

// ─────────────────────────────────────────────
//  Approval Gating
// ─────────────────────────────────────────────

/**
 * Determine if a tool execution requires human approval.
 * HIGH/CRITICAL risk tools with requireApproval=true need approval.
 */
export function requiresApproval(tool: ToolDef, skipOverride?: boolean): boolean {
  if (skipOverride) return false;
  if (!tool.requireApproval) return false;
  return tool.riskLevel === "HIGH" || tool.riskLevel === "CRITICAL";
}

/**
 * Create a pending approval for a tool execution.
 * Returns the approval ID that can be used to track/respond.
 * Requires a missionId and userId.
 */
export async function createToolApproval(
  tool: ToolDef,
  req: ToolExecuteRequest,
): Promise<string> {
  if (!req.missionId || !req.userId) {
    throw new Error("Tool approval requires missionId and userId");
  }

  const approval = await db.humanApproval.create({
    data: {
      missionId: req.missionId,
      taskId: req.taskId || null,
      userId: req.userId,
      status: "PENDING",
      title: `Tool Execution: ${tool.displayName}`,
      description: `Agent "${req.agentName || "system"}" wants to execute tool "${tool.displayName}" (${tool.riskLevel} risk, ${tool.category} category). Cost: $${tool.costPerCall.toFixed(4)}/call.`,
      riskLevel: tool.riskLevel,
      metadata: JSON.stringify({
        toolName: tool.name,
        toolCategory: tool.category,
        agentName: req.agentName || null,
        input: sanitizeInputForMetadata(req.input),
      }),
    },
  });

  return approval.id;
}

// ─────────────────────────────────────────────
//  Tool Statistics
// ─────────────────────────────────────────────

/**
 * Get aggregate statistics about registered tools.
 */
export async function getToolStats(): Promise<ToolStats> {
  const allTools = await db.toolDefinition.findMany({
    select: {
      enabled: true,
      category: true,
      riskLevel: true,
      requireApproval: true,
    },
  });

  const stats: ToolStats = {
    totalTools: allTools.length,
    enabledTools: allTools.filter((t) => t.enabled).length,
    byCategory: { FILE: 0, CODE: 0, GIT: 0, DATABASE: 0, WEB: 0, DEPLOY: 0, AI: 0, SYSTEM: 0 },
    byRiskLevel: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    highRiskCount: 0,
    approvalRequiredCount: 0,
  };

  for (const tool of allTools) {
    if (tool.enabled) {
      stats.byCategory[tool.category as ToolCategory]++;
      stats.byRiskLevel[tool.riskLevel as RiskLevel]++;
      if (tool.riskLevel === "HIGH" || tool.riskLevel === "CRITICAL") {
        stats.highRiskCount++;
      }
      if (tool.requireApproval) {
        stats.approvalRequiredCount++;
      }
    }
  }

  return stats;
}

// ─────────────────────────────────────────────
//  Tool CRUD (for admin management)
// ─────────────────────────────────────────────

export async function createTool(data: {
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
}): Promise<ToolDef> {
  const row = await db.toolDefinition.create({
    data: {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      category: data.category,
      riskLevel: data.riskLevel || "MEDIUM",
      inputSchema: data.inputSchema || "{}",
      outputSchema: data.outputSchema || null,
      handler: data.handler,
      timeoutMs: data.timeoutMs || 30000,
      retryable: data.retryable ?? true,
      maxRetries: data.maxRetries ?? 2,
      requireApproval: data.requireApproval ?? false,
      allowedAgents: JSON.stringify(data.allowedAgents || []),
      allowedPlans: JSON.stringify(data.allowedPlans || []),
      costPerCall: data.costPerCall ?? 0,
      enabled: true,
    },
  });

  invalidateToolCache(data.name);
  return dbRowToToolDef(row);
}

export async function updateTool(
  name: string,
  data: Partial<{
    displayName: string;
    description: string;
    category: ToolCategory;
    riskLevel: RiskLevel;
    inputSchema: string;
    outputSchema: string;
    handler: string;
    timeoutMs: number;
    retryable: boolean;
    maxRetries: number;
    requireApproval: boolean;
    allowedAgents: string[];
    allowedPlans: string[];
    costPerCall: number;
    enabled: boolean;
  }>,
): Promise<ToolDef | null> {
  const updateData: Record<string, unknown> = {};

  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.riskLevel !== undefined) updateData.riskLevel = data.riskLevel;
  if (data.inputSchema !== undefined) updateData.inputSchema = data.inputSchema;
  if (data.outputSchema !== undefined) updateData.outputSchema = data.outputSchema;
  if (data.handler !== undefined) updateData.handler = data.handler;
  if (data.timeoutMs !== undefined) updateData.timeoutMs = data.timeoutMs;
  if (data.retryable !== undefined) updateData.retryable = data.retryable;
  if (data.maxRetries !== undefined) updateData.maxRetries = data.maxRetries;
  if (data.requireApproval !== undefined) updateData.requireApproval = data.requireApproval;
  if (data.allowedAgents !== undefined) updateData.allowedAgents = JSON.stringify(data.allowedAgents);
  if (data.allowedPlans !== undefined) updateData.allowedPlans = JSON.stringify(data.allowedPlans);
  if (data.costPerCall !== undefined) updateData.costPerCall = data.costPerCall;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;

  try {
    const row = await db.toolDefinition.update({
      where: { name },
      data: updateData,
    });

    invalidateToolCache(name);
    return dbRowToToolDef(row);
  } catch {
    return null;
  }
}

export async function deleteTool(name: string): Promise<boolean> {
  try {
    await db.toolDefinition.delete({ where: { name } });
    invalidateToolCache(name);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/** Convert a Prisma DB row to our ToolDef type */
function dbRowToToolDef(row: {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: string;
  inputSchema: string;
  outputSchema: string | null;
  handler: string;
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  requireApproval: boolean;
  allowedAgents: string;
  allowedPlans: string;
  costPerCall: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ToolDef {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    category: row.category as ToolCategory,
    riskLevel: row.riskLevel as RiskLevel,
    inputSchema: row.inputSchema,
    outputSchema: row.outputSchema,
    handler: row.handler,
    timeoutMs: row.timeoutMs,
    retryable: row.retryable,
    maxRetries: row.maxRetries,
    requireApproval: row.requireApproval,
    allowedAgents: safeJsonParse(row.allowedAgents, []),
    allowedPlans: safeJsonParse(row.allowedPlans, []),
    costPerCall: row.costPerCall,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/** Sanitize tool input for storage in metadata (remove large/unsafe values) */
function sanitizeInputForMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.length > 500) {
      sanitized[key] = value.slice(0, 500) + "... [truncated]";
    } else if (typeof value === "object" && value !== null) {
      try {
        sanitized[key] = JSON.stringify(value).slice(0, 500);
      } catch {
        sanitized[key] = "[complex value]";
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ─────────────────────────────────────────────
//  Category & Risk Level display configs
// ─────────────────────────────────────────────

export const TOOL_CATEGORY_CONFIG: Record<
  ToolCategory,
  { label: string; icon: string; color: string; bgColor: string; description: string }
> = {
  FILE: {
    label: "File Operations",
    icon: "FileText",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    description: "Read, write, and transform files",
  },
  CODE: {
    label: "Code Execution",
    icon: "Code2",
    color: "text-violet-400",
    bgColor: "bg-violet-500/20",
    description: "Execute, verify, and analyze code",
  },
  GIT: {
    label: "Git Operations",
    icon: "GitBranch",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    description: "Version control operations",
  },
  DATABASE: {
    label: "Database",
    icon: "Database",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    description: "Database queries and migrations",
  },
  WEB: {
    label: "Web & API",
    icon: "Globe",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    description: "Web searches, API calls, HTTP requests",
  },
  DEPLOY: {
    label: "Deployment",
    icon: "Rocket",
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    description: "Build, deploy, and manage infrastructure",
  },
  AI: {
    label: "AI & ML",
    icon: "Brain",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    description: "AI model calls, embeddings, generation",
  },
  SYSTEM: {
    label: "System",
    icon: "Settings",
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    description: "System utilities and platform operations",
  },
};
