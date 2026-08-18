// ============================================================
// MIANX.AI V3 — Tool Execution Runtime
// Executes tools with validation, approval gating, SSRF protection,
// path traversal prevention, and command injection blocking
// ============================================================

import type { AutonomyLevel, ToolRiskLevel } from '@prisma/client'
import { db } from '@/lib/db'
import { getTool, validateToolInput, requiresApproval, sanitizeToolOutput } from '@/lib/tool-registry'
import { toJsonField } from '@/lib/types'

// ============================================================
// Types
// ============================================================

export interface ExecuteToolParams {
  toolKey: string
  input: Record<string, unknown>
  organizationId: string
  agentId?: string
  userId?: string
  autonomyLevel?: AutonomyLevel
}

export interface ExecuteToolResult {
  output: unknown
  sanitized: string | null
  riskLevel: ToolRiskLevel | null
  approvalRequired: boolean
  error?: string
}

export interface CommandSafetyResult {
  safe: boolean
  blocked?: string
}

// ============================================================
// Simulated Tool Execution
// ============================================================

/**
 * Generate a simulated result for a tool call.
 * In production, this would dispatch to the actual tool implementation.
 */
function simulateToolExecution(
  toolKey: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const base = {
    _simulated: true,
    toolKey,
    executedAt: new Date().toISOString(),
  }

  switch (toolKey) {
    case 'web_search':
      return {
        ...base,
        results: [
          { title: 'Simulated Result 1', url: 'https://example.com/1', snippet: `Results for: ${input.query ?? ''}` },
          { title: 'Simulated Result 2', url: 'https://example.com/2', snippet: 'Additional context from the web.' },
        ],
        totalFound: 2,
      }
    case 'code_execute':
      return {
        ...base,
        stdout: `// Simulated output for ${input.language ?? 'unknown'} code`,
        stderr: '',
        exitCode: 0,
      }
    case 'file_read':
      return {
        ...base,
        content: `// Simulated file content from ${input.path ?? '/unknown'}`,
        size: 128,
      }
    case 'file_write':
      return {
        ...base,
        path: input.path ?? '/unknown',
        size: typeof input.content === 'string' ? input.content.length : 0,
      }
    case 'database_query':
      return {
        ...base,
        rows: [{ id: '1', value: 'simulated' }],
        rowCount: 1,
      }
    case 'api_call':
      return {
        ...base,
        status: 200,
        body: { message: 'Simulated API response' },
      }
    case 'send_notification':
      return {
        ...base,
        notificationId: `notif_sim_${Date.now()}`,
        delivered: true,
      }
    case 'create_task':
      return {
        ...base,
        taskId: `task_sim_${Date.now()}`,
        status: 'planned',
      }
    case 'security_scan':
      return {
        ...base,
        vulnerabilities: [],
        severity: 'low',
      }
    case 'deploy_service':
      return {
        ...base,
        deploymentId: `deploy_sim_${Date.now()}`,
        status: 'deployed',
      }
    default:
      return {
        ...base,
        message: `Simulated execution for unknown tool: ${toolKey}`,
      }
  }
}

// ============================================================
// Core Execution
// ============================================================

/**
 * Execute a tool call with full validation, approval gating, and audit logging.
 *
 * Steps:
 * 1. Resolve tool definition from registry
 * 2. Validate input against tool's input schema
 * 3. Check if approval is required based on risk level and autonomy
 * 4. If approval required, return early with approvalRequired: true
 * 5. Execute the tool (simulated for now)
 * 6. Sanitize output (redact secrets, truncate)
 * 7. Log the execution as an AiToolCall record
 * 8. Return the result
 */
export async function executeTool(params: ExecuteToolParams): Promise<ExecuteToolResult> {
  const { toolKey, input, organizationId, agentId, userId, autonomyLevel = 'balanced' } = params

  // 1. Get tool definition from registry
  const tool = getTool(toolKey)
  if (!tool) {
    return {
      output: null,
      sanitized: null,
      riskLevel: null,
      approvalRequired: false,
      error: `Tool not found or disabled: ${toolKey}`,
    }
  }

  // 2. Validate input against tool's schema
  const validation = validateToolInput(tool, input)
  if (!validation.valid) {
    return {
      output: null,
      sanitized: null,
      riskLevel: tool.riskLevel,
      approvalRequired: false,
      error: `Input validation failed: ${validation.errors.join('; ')}`,
    }
  }

  // 3. Check if approval is required
  const approvalRequired = requiresApproval(tool, autonomyLevel)

  // 4. If approval required, return early
  if (approvalRequired) {
    return {
      output: null,
      sanitized: null,
      riskLevel: tool.riskLevel,
      approvalRequired: true,
    }
  }

  // 5. Execute the tool (simulated)
  let output: Record<string, unknown>
  let executionError: string | undefined

  try {
    output = simulateToolExecution(toolKey, input)
  } catch (err) {
    executionError = err instanceof Error ? err.message : 'Unknown execution error'
    output = { error: executionError }
  }

  // 6. Sanitize output
  const sanitized = sanitizeToolOutput(output)

  // 7. Log the execution (best-effort)
  try {
    await logToolExecution({
      toolKey,
      input,
      output,
      sanitized,
      organizationId,
      agentId,
      userId,
      status: executionError ? 'failed' : 'completed',
      error: executionError,
    })
  } catch {
    // Logging failure should not break the execution flow
  }

  // 8. Return the result
  return {
    output,
    sanitized,
    riskLevel: tool.riskLevel,
    approvalRequired: false,
    error: executionError,
  }
}

// ============================================================
// Execution Logging
// ============================================================

interface LogToolExecutionParams {
  toolKey: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  sanitized: string
  organizationId: string
  agentId?: string
  userId?: string
  status: string
  error?: string
}

/**
 * Persist a tool execution as an AiRun + AiToolCall record pair.
 * Creates a lightweight AiRun as a parent if needed.
 */
async function logToolExecution(params: LogToolExecutionParams): Promise<void> {
  const { toolKey, input, output, sanitized, organizationId, agentId, userId, status, error } = params

  // AiRun requires an agentId — create a synthetic run if available
  if (!agentId) return

  const run = await db.aiRun.create({
    data: {
      organizationId,
      agentId,
      userId: userId ?? null,
      model: 'system',
      provider: 'internal',
      status: status === 'failed' ? 'failed' : 'completed',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs: 0,
    },
  })

  await db.aiToolCall.create({
    data: {
      aiRunId: run.id,
      toolKey,
      input: toJsonField(input),
      output: sanitized,
      status,
      error: error ?? null,
      completedAt: new Date(),
    },
  })
}

// ============================================================
// SSRF Protection — URL Safety
// ============================================================

/**
 * Check if a URL is safe to fetch (SSRF protection).
 * Blocks private IPs, cloud metadata endpoints, non-HTTP protocols, and localhost.
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe for external fetch
 */
export function isUrlSafe(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  // Only allow http and https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  ) {
    return false
  }

  // Block cloud metadata endpoint
  if (hostname === '169.254.169.254') {
    return false
  }

  // Block IPv6 private ranges (fd00::/8 — unique local addresses)
  if (hostname.startsWith('fd00:') || hostname.startsWith('fd')) {
    return false
  }

  // Block private IPv4 ranges
  // 10.0.0.0/8
  if (hostname.startsWith('10.')) {
    return false
  }

  // 172.16.0.0/12 — 172.16.x.x through 172.31.x.x
  if (hostname.startsWith('172.')) {
    const secondOctet = parseInt(hostname.split('.')[1], 10)
    if (!isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
      return false
    }
  }

  // 192.168.0.0/16
  if (hostname.startsWith('192.168.')) {
    return false
  }

  return true
}

// ============================================================
// Path Traversal Prevention
// ============================================================

/**
 * Check if a file path is safe (path traversal prevention).
 * Ensures the resolved path stays within the allowed base directory.
 *
 * @param path - The path to validate
 * @param basePath - The allowed root directory (default: /tmp/mianx)
 * @returns true if the path is within the base directory
 */
export function isPathSafe(path: string, basePath: string = '/tmp/mianx'): boolean {
  // Block explicit traversal sequences
  if (path.includes('..')) {
    return false
  }

  // Resolve both paths to their canonical forms
  // Using simple string normalization (no fs.access in serverless contexts)
  const normalizePath = (p: string): string => {
    // Remove duplicate slashes
    let normalized = p.replace(/\/+/g, '/')
    // Remove trailing slash (unless root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    // Ensure leading slash
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized
    }
    return normalized
  }

  const normalizedBase = normalizePath(basePath)
  const normalizedPath = normalizePath(path)

  // If path doesn't start with base, it escapes
  if (!normalizedPath.startsWith(normalizedBase)) {
    return false
  }

  // Ensure the path either equals base or has a path separator after base
  const remainder = normalizedPath.slice(normalizedBase.length)
  if (remainder.length > 0 && !remainder.startsWith('/')) {
    return false
  }

  return true
}

// ============================================================
// Command Injection Prevention
// ============================================================

/** Whitelist of allowed command prefixes */
const COMMAND_WHITELIST = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find',
  'echo', 'pwd', 'date', 'node', 'npx', 'bun', 'git', 'npm',
])

/** Dangerous command patterns to block */
const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\s+-rf\b/, reason: 'Dangerous command: rm -rf is not allowed' },
  { pattern: /\bsudo\b/, reason: 'Privilege escalation: sudo is not allowed' },
  { pattern: /\bchmod\b/, reason: 'Permission modification: chmod is not allowed' },
  { pattern: /\bchown\b/, reason: 'Ownership modification: chown is not allowed' },
  { pattern: /\bcurl\b/, reason: 'Network access: curl is not allowed' },
  { pattern: /\bwget\b/, reason: 'Network access: wget is not allowed' },
  { pattern: /\b(nc|netcat)\b/, reason: 'Network tool: netcat is not allowed' },
  { pattern: /\bpython\s+-c\b/, reason: 'Arbitrary code execution: python -c is not allowed' },
  { pattern: /\bbash\s+-c\b/, reason: 'Shell injection: bash -c is not allowed' },
  { pattern: /\bsh\s+-c\b/, reason: 'Shell injection: sh -c is not allowed' },
]

/**
 * Check if a shell command is safe to execute.
 * Uses a whitelist of allowed base commands and blocks known dangerous patterns.
 *
 * @param command - The command string to validate
 * @returns { safe: true } if safe, or { safe: false, blocked: reason } if not
 */
export function isCommandSafe(command: string): CommandSafetyResult {
  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return { safe: false, blocked: 'Empty command' }
  }

  const trimmed = command.trim()

  // Check for dangerous patterns first (these override the whitelist)
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, blocked: reason }
    }
  }

  // Extract the first word (the base command)
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase()

  // Check against whitelist
  if (!COMMAND_WHITELIST.has(firstWord)) {
    return {
      safe: false,
      blocked: `Command not in whitelist: ${firstWord}`,
    }
  }

  return { safe: true }
}
