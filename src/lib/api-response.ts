// ============================================================
// MIANX.AI V3 — Standard API Response Helper
// All API routes use this envelope for consistent responses
// ============================================================

import { NextResponse } from 'next/server'
import type { ApiResponseEnvelope, ApiResponseMeta, ApiError, generateRequestId } from './types'

type Envelope<T = unknown> = ApiResponseEnvelope<T>

/**
 * Create a successful API response with standard envelope.
 *
 * @example
 * return success({ items: [...] }, { total: 50, hasMore: true })
 */
export function success<T>(
  data: T,
  meta?: ApiResponseMeta,
  requestId?: string,
  status: number = 200,
): NextResponse<Envelope<T>> {
  const envelope: Envelope<T> = {
    data,
    request_id: requestId ?? generateReqId(),
  }
  if (meta) {
    envelope.meta = meta
  }
  return NextResponse.json(envelope, { status })
}

/**
 * Create a successful response for resource creation (201).
 */
export function created<T>(data: T, requestId?: string): NextResponse<Envelope<T>> {
  return success(data, undefined, requestId, 201)
}

/**
 * Create a successful response with no content (204).
 */
export function noContent(): NextResponse<null> {
  return new NextResponse(null, { status: 204 })
}

/**
 * Create an error API response.
 *
 * @example
 * return error('NOT_FOUND', 'Mission not found', 404)
 */
export function error(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown,
  requestId?: string,
): NextResponse<Envelope<null>> {
  const apiError: ApiError = { code, message }
  if (details !== undefined) {
    apiError.details = details
  }
  const envelope: Envelope<null> = {
    data: null,
    error: apiError,
    request_id: requestId ?? generateReqId(),
  }
  return NextResponse.json(envelope, { status })
}

/**
 * Common error factories for quick use.
 */
export const errors = {
  badRequest: (message = 'Bad request', details?: unknown) =>
    error('BAD_REQUEST', message, 400, details),

  unauthorized: (message = 'Authentication required') =>
    error('UNAUTHORIZED', message, 401),

  forbidden: (message = 'Insufficient permissions') =>
    error('FORBIDDEN', message, 403),

  notFound: (resource = 'Resource', details?: unknown) =>
    error('NOT_FOUND', `${resource} not found`, 404, details),

  conflict: (message = 'Resource already exists') =>
    error('CONFLICT', message, 409),

  validation: (message: string, details?: unknown) =>
    error('VALIDATION_ERROR', message, 422, details),

  rateLimited: (message = 'Too many requests') =>
    error('RATE_LIMITED', message, 429),

  internal: (message = 'Internal server error', details?: unknown) =>
    error('INTERNAL_ERROR', message, 500, details),
}

/**
 * Extract pagination parameters from a URL's search params.
 * Returns cursor and limit (clamped to 1-100, default 20).
 */
export function getPaginationParams(searchParams: URLSearchParams): {
  cursor: string | undefined
  limit: number
} {
  const cursor = searchParams.get('cursor') ?? undefined
  const rawLimit = searchParams.get('limit')
  let limit = 20
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10)
    if (!Number.isNaN(parsed)) {
      limit = Math.min(Math.max(parsed, 1), 100)
    }
  }
  return { cursor, limit }
}

/**
 * Build a pagination meta object for list responses.
 */
export function buildPaginationMeta(
  total: number,
  limit: number,
  items: unknown[],
  nextCursor: string | null,
): ApiResponseMeta {
  return {
    total,
    limit,
    hasMore: items.length === limit,
    cursor: nextCursor,
  }
}

/**
 * Extract the organizationId from query params.
 * Returns undefined if not provided.
 */
export function getOrgIdParam(searchParams: URLSearchParams): string | undefined {
  return searchParams.get('organizationId') ?? undefined
}

/**
 * Safely extract and parse the JSON body from a Request.
 * Returns null if the body is empty or invalid.
 */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    const text = await request.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * Safely extract and parse the JSON body from a Request.
 * Throws a validation error if body is empty or invalid.
 */
export async function requireBody<T>(request: Request): Promise<T> {
  const body = await parseBody<T>(request)
  if (body === null) {
    throw new ValidationError('Request body is required')
  }
  return body
}

/**
 * Custom error class that API routes can throw to be caught by the handler wrapper.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * Wrap an async API handler with standard error handling.
 * Catches ApiError instances and returns proper error responses.
 * Catches unexpected errors and returns 500.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withErrorHandler(async () => {
 *     const orgs = await db.organization.findMany(...)
 *     return success(orgs)
 *   })
 * }
 */
export async function withErrorHandler(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler()
  } catch (err) {
    if (err instanceof ApiError) {
      return error(err.code, err.message, err.status, err.details)
    }
    console.error('[API] Unhandled error:', err)
    return errors.internal()
  }
}

// Internal request ID generator
function generateReqId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
