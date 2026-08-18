// POST /api/agents/[id]/execute — Execute an agent (simulated AI run)

import { db } from '@/lib/db'
import {
  withErrorHandler,
  created,
  NotFoundError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import { toJsonField } from '@/lib/types'


type RouteContext = { params: Promise<{ id: string }> }

// Simulated token counts for a typical short interaction
const SIMULATED_INPUT_TOKENS = 156
const SIMULATED_OUTPUT_TOKENS = 312
const SIMULATED_TOTAL_TOKENS = SIMULATED_INPUT_TOKENS + SIMULATED_OUTPUT_TOKENS
// gpt-4o pricing: $2.50/1M input, $10.00/1M output
const SIMULATED_COST =
  (SIMULATED_INPUT_TOKENS * 2.5) / 1_000_000 +
  (SIMULATED_OUTPUT_TOKENS * 10.0) / 1_000_000

export async function POST(request: Request, context: RouteContext) {
  return withErrorHandler(async () => {
    const { id } = await context.params
    const userId = getUserIdFromRequest(request)

    // Verify agent exists and belongs to user's org
    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) throw new NotFoundError('Agent')

    await requireOrgMember(userId, agent.organizationId)
    await requirePermission(userId, agent.organizationId, [Permissions.AGENT_RUN])

    const now = new Date()
    const correlationId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Create the AiRun record
    const aiRun = await db.aiRun.create({
      data: {
        organizationId: agent.organizationId,
        agentId: agent.id,
        userId,
        model: 'gpt-4o',
        provider: 'openai',
        status: 'completed',
        inputTokens: SIMULATED_INPUT_TOKENS,
        outputTokens: SIMULATED_OUTPUT_TOKENS,
        totalTokens: SIMULATED_TOTAL_TOKENS,
        cost: SIMULATED_COST,
        durationMs: 1847,
        correlationId,
        completedAt: now,
      },
    })

    // Create system message
    await db.aiMessage.create({
      data: {
        aiRunId: aiRun.id,
        role: 'system',
        content: `You are ${agent.name}. ${agent.description ?? 'A helpful AI assistant.'}`,
      },
    })

    // Create assistant message with simulated response
    const assistantMessage = await db.aiMessage.create({
      data: {
        aiRunId: aiRun.id,
        role: 'assistant',
        content:
          'I have processed your request. Based on my analysis, here are the key findings and recommendations for the task at hand.',
      },
    })

    // Create a simulated tool call (web_search)
    await db.aiToolCall.create({
      data: {
        aiRunId: aiRun.id,
        aiMessageId: assistantMessage.id,
        toolKey: 'web_search',
        input: toJsonField({
          query: `${agent.name} task execution context`,
          max_results: 5,
        }),
        output: toJsonField({
          results: [
            {
              title: 'Relevant result 1',
              snippet: 'Information relevant to the agent task execution.',
              url: 'https://example.com/result1',
            },
            {
              title: 'Relevant result 2',
              snippet: 'Additional context for the task.',
              url: 'https://example.com/result2',
            },
          ],
        }),
        status: 'completed',
        completedAt: now,
      },
    })

    // Create cost record
    await db.aiCostRecord.create({
      data: {
        organizationId: agent.organizationId,
        aiRunId: aiRun.id,
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: SIMULATED_INPUT_TOKENS,
        outputTokens: SIMULATED_OUTPUT_TOKENS,
        totalTokens: SIMULATED_TOTAL_TOKENS,
        estimatedCost: SIMULATED_COST,
        occurredAt: now,
      },
    })

    // Create event record
    await db.event.create({
      data: {
        eventType: 'agent.executed',
        eventVersion: '1.0',
        organizationId: agent.organizationId,
        sourceType: 'ai_agent',
        sourceId: agent.id,
        actorType: 'ai_agent',
        actorId: agent.id,
        correlationId,
        payload: toJsonField({
          agentId: agent.id,
          agentName: agent.name,
          aiRunId: aiRun.id,
          model: 'gpt-4o',
          provider: 'openai',
          totalTokens: SIMULATED_TOTAL_TOKENS,
          cost: SIMULATED_COST,
          durationMs: 1847,
        }),
      },
    })

    // Fetch messages for the response
    const messages = await db.aiMessage.findMany({
      where: { aiRunId: aiRun.id },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch tool calls for the response
    const toolCalls = await db.aiToolCall.findMany({
      where: { aiRunId: aiRun.id },
    })

    return created({
      ...aiRun,
      createdAt: String(aiRun.createdAt),
      completedAt: aiRun.completedAt ? String(aiRun.completedAt) : null,
      messages: messages.map((m) => ({
        ...m,
        createdAt: String(m.createdAt),
      })),
      toolCalls: toolCalls.map((t) => ({
        ...t,
        startedAt: String(t.startedAt),
        completedAt: t.completedAt ? String(t.completedAt) : null,
      })),
    })
  })
}
