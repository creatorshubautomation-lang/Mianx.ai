import { describe, it, expect } from 'vitest'
import {
  getToolRegistry,
  getTool,
  validateToolInput,
  requiresApproval,
  sanitizeToolOutput,
} from '@/lib/tool-registry'
import type { ToolDefinition } from '@/lib/tool-registry'

// ============================================================
// getToolRegistry
// ============================================================

describe('getToolRegistry', () => {
  it('returns an array', () => {
    const tools = getToolRegistry()
    expect(Array.isArray(tools)).toBe(true)
  })

  it('returns only enabled tools', () => {
    const tools = getToolRegistry()
    for (const tool of tools) {
      expect(tool.enabled).toBe(true)
    }
  })

  it('includes web_search tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'web_search')).toBe(true)
  })

  it('includes code_execute tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'code_execute')).toBe(true)
  })

  it('includes file_read tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'file_read')).toBe(true)
  })

  it('includes file_write tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'file_write')).toBe(true)
  })

  it('includes database_query tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'database_query')).toBe(true)
  })

  it('includes api_call tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'api_call')).toBe(true)
  })

  it('includes deploy_service tool', () => {
    const tools = getToolRegistry()
    expect(tools.some((t) => t.key === 'deploy_service')).toBe(true)
  })

  it('returns at least 10 tools', () => {
    const tools = getToolRegistry()
    expect(tools.length).toBeGreaterThanOrEqual(10)
  })

  it('each tool has required fields', () => {
    const tools = getToolRegistry()
    for (const tool of tools) {
      expect(tool).toHaveProperty('key')
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('inputSchema')
      expect(tool).toHaveProperty('outputSchema')
      expect(tool).toHaveProperty('riskLevel')
      expect(tool).toHaveProperty('timeout')
    }
  })
})

// ============================================================
// getTool
// ============================================================

describe('getTool', () => {
  it('returns the web_search tool', () => {
    const tool = getTool('web_search')
    expect(tool).toBeDefined()
    expect(tool!.key).toBe('web_search')
  })

  it('returns the deploy_service tool', () => {
    const tool = getTool('deploy_service')
    expect(tool).toBeDefined()
    expect(tool!.riskLevel).toBe('CRITICAL')
  })

  it('returns undefined for unknown tool', () => {
    const tool = getTool('nonexistent_tool')
    expect(tool).toBeUndefined()
  })

  it('returns tool with correct name', () => {
    const tool = getTool('code_execute')
    expect(tool!.name).toBe('Code Execution')
  })

  it('returned tool has inputSchema', () => {
    const tool = getTool('web_search')
    expect(tool!.inputSchema).toBeDefined()
    expect(tool!.inputSchema.type).toBe('object')
  })

  it('returned tool has timeout', () => {
    const tool = getTool('web_search')
    expect(typeof tool!.timeout).toBe('number')
    expect(tool!.timeout).toBeGreaterThan(0)
  })

  it('returned tool has retryPolicy', () => {
    const tool = getTool('web_search')
    expect(tool!.retryPolicy).toBeDefined()
    expect(typeof tool!.retryPolicy.maxRetries).toBe('number')
  })

  it('returns undefined for empty string key', () => {
    const tool = getTool('')
    expect(tool).toBeUndefined()
  })
})

// ============================================================
// validateToolInput
// ============================================================

describe('validateToolInput', () => {
  let tool: ToolDefinition

  beforeEach(() => {
    tool = getTool('web_search')!
  })

  it('returns valid for correct input', () => {
    const result = validateToolInput(tool, { query: 'test search' })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns invalid when required field is missing', () => {
    const result = validateToolInput(tool, {})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required field: query')
  })

  it('returns invalid when required field is null', () => {
    const result = validateToolInput(tool, { query: null })
    expect(result.valid).toBe(false)
  })

  it('returns invalid when required field is undefined', () => {
    const result = validateToolInput(tool, { query: undefined })
    expect(result.valid).toBe(false)
  })

  it('reports unexpected fields', () => {
    const result = validateToolInput(tool, { query: 'test', extra: true })
    expect(result.errors).toContain('Unexpected field: extra')
 })

  it('reports type mismatch', () => {
    const result = validateToolInput(tool, { query: 123 })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('expected type string'))).toBe(true)
  })

  it('validates code_execute with correct input', () => {
    const codeTool = getTool('code_execute')!
    const result = validateToolInput(codeTool, { language: 'python', code: 'print(1)' })
    expect(result.valid).toBe(true)
  })

  it('code_execute requires both language and code', () => {
    const codeTool = getTool('code_execute')!
    const result = validateToolInput(codeTool, { language: 'python' })
    expect(result.valid).toBe(false)
  })

  it('validates file_write requires path and content', () => {
    const fwTool = getTool('file_write')!
    const result = validateToolInput(fwTool, { path: '/tmp/test.txt' })
    expect(result.valid).toBe(false)
  })

  it('file_write valid with all required fields', () => {
    const fwTool = getTool('file_write')!
    const result = validateToolInput(fwTool, { path: '/tmp/test.txt', content: 'hello' })
    expect(result.valid).toBe(true)
  })

  it('validates deploy_service requires service and environment', () => {
    const deployTool = getTool('deploy_service')!
    const result = validateToolInput(deployTool, { service: 'api' })
    expect(result.valid).toBe(false)
  })
})

// ============================================================
// requiresApproval
// ============================================================

describe('requiresApproval', () => {
  const readTool = getTool('web_search')!
  const lowWriteTool = getTool('file_write')!
  const medWriteTool = getTool('code_execute')!
  const criticalTool = getTool('deploy_service')!

  it('conservative: READ tool does not require approval', () => {
    expect(requiresApproval(readTool, 'conservative')).toBe(false)
  })

  it('conservative: LOW_WRITE tool does not require approval', () => {
    expect(requiresApproval(lowWriteTool, 'conservative')).toBe(false)
  })

  it('conservative: MEDIUM_WRITE tool does NOT require approval', () => {
    expect(requiresApproval(medWriteTool, 'conservative')).toBe(false)
  })

  it('conservative: CRITICAL tool requires approval', () => {
    expect(requiresApproval(criticalTool, 'conservative')).toBe(true)
  })

  it('balanced: READ tool does not require approval', () => {
    expect(requiresApproval(readTool, 'balanced')).toBe(false)
  })

  it('balanced: MEDIUM_WRITE tool does not require approval', () => {
    expect(requiresApproval(medWriteTool, 'balanced')).toBe(false)
  })

  it('balanced: CRITICAL tool requires approval', () => {
    expect(requiresApproval(criticalTool, 'balanced')).toBe(true)
  })

  it('autonomous: never requires approval for any tool', () => {
    expect(requiresApproval(readTool, 'autonomous')).toBe(false)
    expect(requiresApproval(lowWriteTool, 'autonomous')).toBe(false)
    expect(requiresApproval(medWriteTool, 'autonomous')).toBe(false)
    expect(requiresApproval(criticalTool, 'autonomous')).toBe(false)
  })

  it('unknown autonomy level: never requires approval', () => {
    // @ts-expect-error testing unknown level
    expect(requiresApproval(criticalTool, 'unknown_level')).toBe(false)
  })
})

// ============================================================
// sanitizeToolOutput
// ============================================================

describe('sanitizeToolOutput', () => {
  it('returns string for string input', () => {
    const result = sanitizeToolOutput('hello world')
    expect(typeof result).toBe('string')
    expect(result).toBe('hello world')
  })

  it('stringifies object input', () => {
    const result = sanitizeToolOutput({ key: 'value' })
    expect(typeof result).toBe('string')
    expect(result).toContain('"key": "value"')
  })

  it('redacts API keys', () => {
    const result = sanitizeToolOutput('api_key=sk-FAKEKEY1234567890')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('sk-FAKEKEY1234567890')
  })

  it('redacts passwords', () => {
    const result = sanitizeToolOutput('password=testfakepassword')
    expect(result).toContain('[REDACTED]')
  })

  it('redacts Bearer tokens', () => {
    const result = sanitizeToolOutput('Bearer test.faketoken.notreal')
    expect(result).toContain('[REDACTED]')
  })

  it('redacts OpenAI-style keys', () => {
    const result = sanitizeToolOutput('OPENAI_KEY=sk-FAKEOPENAIKEYabcdefghij')
    expect(result).toContain('[REDACTED]')
  })

  it('does not redact normal text', () => {
    const result = sanitizeToolOutput('Hello, this is a normal message without secrets')
    expect(result).not.toContain('[REDACTED]')
  })

  it('truncates output exceeding 50KB', () => {
    const longOutput = 'x'.repeat(51_000)
    const result = sanitizeToolOutput(longOutput)
    expect(result.length).toBeLessThan(51_000)
    expect(result).toContain('[TRUNCATED')
  })

  it('does not truncate output under 50KB', () => {
    const output = 'x'.repeat(1_000)
    const result = sanitizeToolOutput(output)
    expect(result.length).toBe(1_000)
  })

  it('handles null input', () => {
    const result = sanitizeToolOutput(null)
    expect(typeof result).toBe('string')
  })

  it('throws on undefined input', () => {
    expect(() => sanitizeToolOutput(undefined)).toThrow()
  })

  it('handles array input', () => {
    const result = sanitizeToolOutput([1, 2, 3])
    expect(result).toContain('1')
    expect(result).toContain('2')
 expect(result).toContain('3')
  })

  it('handles objects by stringify fallback', () => {
    const obj = { a: 1 }
    const result = sanitizeToolOutput(obj)
    expect(result).toContain('"a": 1')
  })
})
