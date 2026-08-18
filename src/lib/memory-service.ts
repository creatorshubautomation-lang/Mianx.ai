// ============================================================
// MIANX.AI V3 — Memory Service Layer
// 7-scope memory system: session, conversation, user, organization,
// domain, agent, operational
// ============================================================

import type { MemoryScope } from '@prisma/client'
import { db } from '@/lib/db'
import { parseJsonField, toJsonField } from '@/lib/types'

// ============================================================
// Types
// ============================================================

export interface MemoryMetadata {
  [key: string]: unknown
}

export interface MemoryRecord {
  id: string
  organizationId: string
  agentId: string | null
  scope: MemoryScope
  content: string
  metadata: MemoryMetadata
  source: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ScoredMemory extends MemoryRecord {
  score: number
}

export interface CreateMemoryParams {
  organizationId: string
  agentId?: string
  scope: MemoryScope
  content: string
  metadata?: MemoryMetadata
  source?: string
}

export interface GetMemoriesParams {
  organizationId: string
  agentId?: string
  scope?: MemoryScope
  limit?: number
  cursor?: string
}

export interface UpdateMemoryParams {
  content?: string
  metadata?: MemoryMetadata
}

export interface QueryRelevantMemoriesParams {
  organizationId: string
  agentId?: string
  query: string
  scopes?: MemoryScope[]
  limit?: number
}

export interface KnowledgeSourceConfiguration {
  [key: string]: unknown
}

export interface KnowledgeSourceRecord {
  id: string
  organizationId: string
  domainId: string | null
  sourceType: string
  name: string
  status: string
  configuration: KnowledgeSourceConfiguration
  createdAt: Date
  updatedAt: Date
}

export interface CreateKnowledgeSourceParams {
  organizationId: string
  domainId?: string
  sourceType: string
  name: string
  configuration?: KnowledgeSourceConfiguration
}

const DEFAULT_LIMIT = 20

// ============================================================
// Helpers
// ============================================================

/** Deserialize a raw AgentMemory row from Prisma into a MemoryRecord */
function toMemoryRecord(row: {
  id: string
  organizationId: string
  agentId: string | null
  scope: MemoryScope
  content: string
  metadata: string
  source: string | null
  createdAt: Date
  updatedAt: Date
}): MemoryRecord {
  return {
    ...row,
    metadata: parseJsonField<MemoryMetadata>(row.metadata, {}),
  }
}

/** Deserialize a raw KnowledgeSource row from Prisma */
function toKnowledgeSourceRecord(row: {
  id: string
  organizationId: string
  domainId: string | null
  sourceType: string
  name: string
  status: string
  configuration: string
  createdAt: Date
  updatedAt: Date
}): KnowledgeSourceRecord {
  return {
    ...row,
    configuration: parseJsonField<KnowledgeSourceConfiguration>(row.configuration, {}),
  }
}

// ============================================================
// Memory CRUD
// ============================================================

/**
 * Create a new AgentMemory record.
 * Supports all 7 memory scopes: session, conversation, user,
 * organization, domain, agent, operational.
 */
export async function createMemory(params: CreateMemoryParams): Promise<MemoryRecord> {
  const row = await db.agentMemory.create({
    data: {
      organizationId: params.organizationId,
      agentId: params.agentId ?? null,
      scope: params.scope,
      content: params.content,
      metadata: toJsonField(params.metadata ?? {}),
      source: params.source ?? null,
    },
  })
  return toMemoryRecord(row)
}

/**
 * Query memories with optional filters (agent, scope, cursor pagination).
 */
export async function getMemories(params: GetMemoriesParams): Promise<MemoryRecord[]> {
  const limit = params.limit ?? DEFAULT_LIMIT

  const rows = await db.agentMemory.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.agentId !== undefined && { agentId: params.agentId }),
      ...(params.scope !== undefined && { scope: params.scope }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(params.cursor
      ? { cursor: { id: params.cursor }, skip: 1 }
      : {}),
  })

  return rows.map(toMemoryRecord)
}

/**
 * Get a single memory by ID.
 */
export async function getMemory(id: string): Promise<MemoryRecord | null> {
  const row = await db.agentMemory.findUnique({
    where: { id },
  })
  return row ? toMemoryRecord(row) : null
}

/**
 * Update an existing memory's content and/or metadata.
 */
export async function updateMemory(
  id: string,
  data: UpdateMemoryParams,
): Promise<MemoryRecord> {
  const row = await db.agentMemory.update({
    where: { id },
    data: {
      ...(data.content !== undefined && { content: data.content }),
      ...(data.metadata !== undefined && { metadata: toJsonField(data.metadata) }),
    },
  })
  return toMemoryRecord(row)
}

/**
 * Delete a memory by ID.
 */
export async function deleteMemory(id: string): Promise<MemoryRecord> {
  const row = await db.agentMemory.delete({
    where: { id },
  })
  return toMemoryRecord(row)
}

// ============================================================
// Memory Query (for agent use)
// ============================================================

/**
 * Simple keyword-based relevance search.
 * Splits the query into terms, finds memories whose content contains
 * any term, and scores by the count of matching terms.
 *
 * This is a lightweight in-process search suitable for moderate
 * data volumes. For production-scale use, consider integrating
 * a vector DB or full-text search index.
 */
export async function queryRelevantMemories(
  params: QueryRelevantMemoriesParams,
): Promise<ScoredMemory[]> {
  const limit = params.limit ?? DEFAULT_LIMIT

  // Normalize and extract search terms
  const terms = params.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1) // skip single-char terms

  if (terms.length === 0) {
    return []
  }

  // Build the where clause
  const where: Record<string, unknown> = {
    organizationId: params.organizationId,
  }

  if (params.agentId !== undefined) {
    where.agentId = params.agentId
  }

  if (params.scopes && params.scopes.length > 0) {
    where.scope = { in: params.scopes }
  }

  // Fetch candidate memories — pull a generous batch so scoring
  // can trim it down to `limit`
  const candidates = await db.agentMemory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Score each candidate by counting how many query terms
  // appear in the lowercased content
  const scored: ScoredMemory[] = []

  for (const row of candidates) {
    const lowerContent = row.content.toLowerCase()
    let matchCount = 0

    for (const term of terms) {
      if (lowerContent.includes(term)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      scored.push({
        ...toMemoryRecord(row),
        score: matchCount,
      })
    }
  }

  // Sort by score descending, then by recency descending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return scored.slice(0, limit)
}

/**
 * Get all organization-scoped memories for an organization.
 */
export async function getOrganizationMemory(
  organizationId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<MemoryRecord[]> {
  const rows = await db.agentMemory.findMany({
    where: {
      organizationId,
      scope: 'organization',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map(toMemoryRecord)
}

/**
 * Get all agent-scoped memories for a specific agent.
 */
export async function getAgentMemory(
  agentId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<MemoryRecord[]> {
  const rows = await db.agentMemory.findMany({
    where: {
      agentId,
      scope: 'agent',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map(toMemoryRecord)
}

// ============================================================
// Knowledge Source Management
// ============================================================

/**
 * Create a new knowledge source for an organization.
 */
export async function createKnowledgeSource(
  params: CreateKnowledgeSourceParams,
): Promise<KnowledgeSourceRecord> {
  const row = await db.knowledgeSource.create({
    data: {
      organizationId: params.organizationId,
      domainId: params.domainId ?? null,
      sourceType: params.sourceType,
      name: params.name,
      configuration: toJsonField(params.configuration ?? {}),
    },
  })
  return toKnowledgeSourceRecord(row)
}

/**
 * List all knowledge sources for an organization.
 */
export async function getKnowledgeSources(
  organizationId: string,
): Promise<KnowledgeSourceRecord[]> {
  const rows = await db.knowledgeSource.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toKnowledgeSourceRecord)
}
