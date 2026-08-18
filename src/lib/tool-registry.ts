// ============================================================
// MIANX.AI V3 — Tool Registry
// Centralized tool definitions, validation, and risk management
// ============================================================

import type { ToolRiskLevel, AutonomyLevel } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/** Complete definition of a tool available to agents */
export interface ToolDefinition {
  key: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  requiredPermissions: string[]
  riskLevel: ToolRiskLevel
  timeout: number
  retryPolicy: { maxRetries: number; backoffMs: number }
  enabled: boolean
  auditBehavior: 'always' | 'on_error' | 'never'
}

// ============================================================
// Predefined Tool Catalog
// ============================================================

const TOOLS: ToolDefinition[] = [
  {
    key: 'web_search',
    name: 'Web Search',
    description: 'Search the web for information, news, and documentation.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    outputSchema: { type: 'object', properties: { results: { type: 'array' }, totalFound: { type: 'number' } } },
    requiredPermissions: [],
    riskLevel: 'READ',
    timeout: 15000,
    retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    enabled: true,
    auditBehavior: 'on_error',
  },
  {
    key: 'code_execute',
    name: 'Code Execution',
    description: 'Execute code snippets in a sandboxed environment.',
    inputSchema: {
      type: 'object',
      properties: { language: { type: 'string' }, code: { type: 'string' }, timeout: { type: 'number' } },
      required: ['language', 'code'],
    },
    outputSchema: { type: 'object', properties: { stdout: { type: 'string' }, stderr: { type: 'string' }, exitCode: { type: 'number' } } },
    requiredPermissions: ['agent:run'],
    riskLevel: 'MEDIUM_WRITE',
    timeout: 30000,
    retryPolicy: { maxRetries: 1, backoffMs: 2000 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'file_read',
    name: 'File Read',
    description: 'Read file contents from the workspace or specified path.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, encoding: { type: 'string' } }, required: ['path'] },
    outputSchema: { type: 'object', properties: { content: { type: 'string' }, size: { type: 'number' } } },
    requiredPermissions: [],
    riskLevel: 'READ',
    timeout: 10000,
    retryPolicy: { maxRetries: 3, backoffMs: 500 },
    enabled: true,
    auditBehavior: 'never',
  },
  {
    key: 'file_write',
    name: 'File Write',
    description: 'Write or overwrite file contents in the workspace.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    outputSchema: { type: 'object', properties: { path: { type: 'string' }, size: { type: 'number' } } },
    requiredPermissions: ['agent:run'],
    riskLevel: 'LOW_WRITE',
    timeout: 10000,
    retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'database_query',
    name: 'Database Query',
    description: 'Execute read-only SQL queries against the organization database.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, params: { type: 'array' } }, required: ['query'] },
    outputSchema: { type: 'object', properties: { rows: { type: 'array' }, rowCount: { type: 'number' } } },
    requiredPermissions: ['agent:run'],
    riskLevel: 'READ',
    timeout: 20000,
    retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'api_call',
    name: 'External API Call',
    description: 'Make HTTP requests to external APIs and services.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' }, method: { type: 'string' }, headers: { type: 'object' }, body: { type: 'object' } },
      required: ['url', 'method'],
    },
    outputSchema: { type: 'object', properties: { status: { type: 'number' }, body: { type: 'object' } } },
    requiredPermissions: ['agent:run'],
    riskLevel: 'MEDIUM_WRITE',
    timeout: 30000,
    retryPolicy: { maxRetries: 2, backoffMs: 2000 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'send_notification',
    name: 'Send Notification',
    description: 'Send notifications to users via email, Slack, or in-app channels.',
    inputSchema: {
      type: 'object',
      properties: { userId: { type: 'string' }, channel: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } },
      required: ['channel', 'title', 'body'],
    },
    outputSchema: { type: 'object', properties: { notificationId: { type: 'string' }, delivered: { type: 'boolean' } } },
    requiredPermissions: [],
    riskLevel: 'LOW_WRITE',
    timeout: 10000,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'create_task',
    name: 'Create Task',
    description: 'Dynamically create a new task within the current mission.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, description: { type: 'string' }, parentTaskId: { type: 'string' } },
      required: ['title'],
    },
    outputSchema: { type: 'object', properties: { taskId: { type: 'string' }, status: { type: 'string' } } },
    requiredPermissions: ['mission:update'],
    riskLevel: 'LOW_WRITE',
    timeout: 5000,
    retryPolicy: { maxRetries: 2, backoffMs: 500 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'security_scan',
    name: 'Security Scan',
    description: 'Run security analysis on code, configurations, or deployments.',
    inputSchema: { type: 'object', properties: { target: { type: 'string' }, scanType: { type: 'string' } }, required: ['target'] },
    outputSchema: { type: 'object', properties: { vulnerabilities: { type: 'array' }, severity: { type: 'string' } } },
    requiredPermissions: ['agent:run'],
    riskLevel: 'READ',
    timeout: 60000,
    retryPolicy: { maxRetries: 1, backoffMs: 5000 },
    enabled: true,
    auditBehavior: 'always',
  },
  {
    key: 'deploy_service',
    name: 'Deploy Service',
    description: 'Deploy or update a service to staging or production environments.',
    inputSchema: {
      type: 'object',
      properties: { service: { type: 'string' }, environment: { type: 'string' }, version: { type: 'string' } },
      required: ['service', 'environment'],
    },
    outputSchema: { type: 'object', properties: { deploymentId: { type: 'string' }, status: { type: 'string' } } },
    requiredPermissions: ['mission:execute'],
    riskLevel: 'CRITICAL',
    timeout: 120000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    enabled: true,
    auditBehavior: 'always',
  },
]

// Build a lookup map for O(1) access
const TOOL_MAP = new Map<string, ToolDefinition>(TOOLS.map((t) => [t.key, t]))

// ============================================================
// Public API
// ============================================================

/**
 * Get all available tool definitions.
 * Returns only enabled tools.
 */
export function getToolRegistry(): ToolDefinition[] {
  return TOOLS.filter((t) => t.enabled)
}

/**
 * Get a specific tool definition by its key.
 * Returns undefined if the tool does not exist or is disabled.
 */
export function getTool(key: string): ToolDefinition | undefined {
  const tool = TOOL_MAP.get(key)
  return tool?.enabled ? tool : undefined
}

/**
 * Validate tool input against its declared input schema.
 * Performs basic structural checks: required fields present and correct types.
 */
export function validateToolInput(
  tool: ToolDefinition,
  input: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const schema = tool.inputSchema

  if (schema.type !== 'object' || !schema.properties) {
    return { valid: errors.length === 0, errors }
  }

  const props = schema.properties as Record<string, { type?: string; enum?: string[] }>
  const required: string[] = (schema.required as string[]) ?? []

  // Check required fields
  for (const field of required) {
    if (!(field in input) || input[field] === undefined || input[field] === null) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Check types of provided fields
  for (const [key, value] of Object.entries(input)) {
    const propDef = props[key]
    if (!propDef) {
      errors.push(`Unexpected field: ${key}`)
      continue
    }

    if (propDef.type && value !== null && value !== undefined) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== propDef.type) {
        errors.push(`Field "${key}" expected type ${propDef.type}, got ${actualType}`)
      }
    }

    if (propDef.enum && !propDef.enum.includes(String(value))) {
      errors.push(`Field "${key}" must be one of: ${propDef.enum.join(', ')}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Check if a tool call requires human approval based on risk level and org autonomy policy.
 *
 * - conservative: HIGH_WRITE and CRITICAL require approval
 * - balanced: CRITICAL requires approval
 * - autonomous: never requires approval (risk assumed by org)
 */
export function requiresApproval(
  tool: ToolDefinition,
  autonomyLevel: AutonomyLevel,
): boolean {
  switch (autonomyLevel) {
    case 'conservative':
      return tool.riskLevel === 'HIGH_WRITE' || tool.riskLevel === 'CRITICAL'
    case 'balanced':
      return tool.riskLevel === 'CRITICAL'
    case 'autonomous':
      return false
    default:
      return false
  }
}

// ============================================================
// Output Sanitization
// ============================================================

const SECRET_PATTERNS: RegExp[] = [
  new RegExp('(api[_-]?key|apikey)\\s*[=:]\\s*[\'"]?[\\w-]{20,}', 'gi'),
  new RegExp('(password|passwd|secret)\\s*[=:]\\s*[\'"]?[\\w-]{8,}', 'gi'),
  new RegExp('(bearer|token)\\s+[\'"]?[·\\w-._~+/=]{20,}', 'gi'),
  new RegExp('sk-[a-zA-Z0-9]{20,}', 'g'), // OpenAI-style keys
  new RegExp('ghp_[a-zA-Z0-9]{36,}', 'g'), // GitHub PATs
  new RegExp('xox[bpras]-[a-zA-Z0-9-]+', 'g'), // Slack tokens
]

const MAX_OUTPUT_LENGTH = 50_000 // 50KB character limit

/**
 * Sanitize tool output by redacting secrets and truncating large outputs.
 * Returns a JSON-safe string representation.
 */
export function sanitizeToolOutput(output: unknown): string {
  let raw: string

  if (typeof output === 'string') {
    raw = output
  } else {
    try {
      raw = JSON.stringify(output, null, 2)
    } catch {
      raw = String(output)
    }
  }

  // Redact secrets
  for (const pattern of SECRET_PATTERNS) {
    raw = raw.replace(pattern, '[REDACTED]')
  }

  // Truncate if needed
  if (raw.length > MAX_OUTPUT_LENGTH) {
    raw = raw.substring(0, MAX_OUTPUT_LENGTH) + '\n... [TRUNCATED: output exceeded 50KB limit]'
  }

  return raw
}
