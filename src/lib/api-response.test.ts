import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  success,
  created,
  noContent,
  error,
  errors,
  getPaginationParams,
  buildPaginationMeta,
  parseBody,
  requireBody,
  withErrorHandler,
  ApiError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/api-response'

// Mock NextResponse.json to inspect calls
const mockJson = vi.fn()
const mockNextResponse = {
  json: mockJson,
}

vi.mock('next/server', () => {
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return mockJson(body, init)
    }
  }
  return { NextResponse: MockNextResponse }
})

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper to extract body from a NextResponse-like return
function getBody(resp: unknown): unknown {
  // mockJson returns whatever was passed to it, so the first arg is the envelope
  return mockJson.mock.calls[mockJson.mock.calls.length - 1]?.[0]
}

function getStatus(resp: unknown): number {
  return mockJson.mock.calls[mockJson.mock.calls.length - 1]?.[1]?.status ?? 200
}

// ============================================================
// success()
// ============================================================

describe('success', () => {
  it('returns envelope with data', () => {
    success({ items: [1, 2] })
    const body = getBody() as Record<string, unknown>
    expect(body.data).toEqual({ items: [1, 2] })
  })

  it('includes request_id in envelope', () => {
    success({})
    const body = getBody() as Record<string, unknown>
    expect(body.request_id).toBeDefined()
    expect(typeof body.request_id).toBe('string')
  })

  it('uses provided request_id', () => {
    success({}, undefined, 'custom_id')
    const body = getBody() as Record<string, unknown>
    expect(body.request_id).toBe('custom_id')
  })

  it('includes meta when provided', () => {
    success({}, { total: 50 })
    const body = getBody() as Record<string, unknown>
    expect(body.meta).toEqual({ total: 50 })
  })

  it('omits meta when not provided', () => {
    success({})
    const body = getBody() as Record<string, unknown>
    expect(body.meta).toBeUndefined()
  })

  it('returns 200 status by default', () => {
    success({})
    expect(getStatus()).toBe(200)
  })

  it('returns custom status when provided', () => {
    success({}, undefined, undefined, 202)
    expect(getStatus()).toBe(202)
  })

  it('handles null data', () => {
    success(null)
    const body = getBody() as Record<string, unknown>
    expect(body.data).toBeNull()
  })

  it('handles array data', () => {
    success([1, 2, 3])
    const body = getBody() as Record<string, unknown>
    expect(body.data).toEqual([1, 2, 3])
  })
})

// ============================================================
// created()
// ============================================================

describe('created', () => {
  it('returns 201 status', () => {
    created({ id: '1' })
    expect(getStatus()).toBe(201)
  })

  it('includes data in envelope', () => {
    created({ id: 'abc' })
    const body = getBody() as Record<string, unknown>
    expect(body.data).toEqual({ id: 'abc' })
  })

  it('uses provided request_id', () => {
    created({}, 'my_req_id')
    const body = getBody() as Record<string, unknown>
    expect(body.request_id).toBe('my_req_id')
  })
})

// ============================================================
// noContent()
// ============================================================

describe('noContent', () => {
  it('returns a NextResponse with 204 status', () => {
    const resp = noContent()
    expect(resp).toBeDefined()
    // noContent uses `new NextResponse(null, { status: 204 })`
    // Check the prototype is a Response
    expect(resp).toBeInstanceOf(Response)
  })
})

// ============================================================
// error()
// ============================================================

describe('error', () => {
  it('returns error envelope with code and message', () => {
    error('TEST', 'test message')
    const body = getBody() as Record<string, unknown>
    expect(body.error).toEqual({ code: 'TEST', message: 'test message' })
  })

  it('returns 400 status by default', () => {
    error('TEST', 'msg')
    expect(getStatus()).toBe(400)
  })

  it('returns custom status', () => {
    error('NOT_FOUND', 'not found', 404)
    expect(getStatus()).toBe(404)
  })

  it('includes details when provided', () => {
    error('VALIDATION', 'invalid', 422, { field: 'name' })
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).details).toEqual({ field: 'name' })
  })

  it('omits details when not provided', () => {
    error('TEST', 'msg')
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).details).toBeUndefined()
  })

  it('data is null', () => {
    error('TEST', 'msg')
    const body = getBody() as Record<string, unknown>
    expect(body.data).toBeNull()
  })

  it('includes request_id', () => {
    error('TEST', 'msg')
    const body = getBody() as Record<string, unknown>
    expect(body.request_id).toBeDefined()
  })
})

// ============================================================
// errors factory
// ============================================================

describe('errors factory', () => {
  it('errors.badRequest returns 400', () => {
    errors.badRequest('bad')
    expect(getStatus()).toBe(400)
  })

  it('errors.badRequest uses default message', () => {
    errors.badRequest()
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).message).toBe('Bad request')
  })

  it('errors.unauthorized returns 401', () => {
    errors.unauthorized()
    expect(getStatus()).toBe(401)
  })

  it('errors.unauthorized uses code UNAUTHORIZED', () => {
    errors.unauthorized()
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('UNAUTHORIZED')
  })

  it('errors.forbidden returns 403', () => {
    errors.forbidden()
    expect(getStatus()).toBe(403)
  })

  it('errors.notFound returns 404', () => {
    errors.notFound('Mission')
    expect(getStatus()).toBe(404)
  })

  it('errors.notFound includes resource name in message', () => {
    errors.notFound('Mission')
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).message).toBe('Mission not found')
  })

  it('errors.conflict returns 409', () => {
    errors.conflict()
    expect(getStatus()).toBe(409)
  })

  it('errors.validation returns 422', () => {
    errors.validation('invalid field')
    expect(getStatus()).toBe(422)
  })

  it('errors.validation uses code VALIDATION_ERROR', () => {
    errors.validation('test')
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('VALIDATION_ERROR')
  })

  it('errors.rateLimited returns 429', () => {
    errors.rateLimited()
    expect(getStatus()).toBe(429)
  })

  it('errors.internal returns 500', () => {
    errors.internal()
    expect(getStatus()).toBe(500)
  })
})

// ============================================================
// getPaginationParams
// ============================================================

describe('getPaginationParams', () => {
  it('returns default limit when no params', () => {
    const params = new URLSearchParams()
    expect(getPaginationParams(params)).toEqual({ cursor: undefined, limit: 20 })
  })

  it('parses cursor param', () => {
    const params = new URLSearchParams('cursor=abc123')
    expect(getPaginationParams(params).cursor).toBe('abc123')
  })

  it('parses limit param', () => {
    const params = new URLSearchParams('limit=50')
    expect(getPaginationParams(params).limit).toBe(50)
  })

  it('clamps limit to max 100', () => {
    const params = new URLSearchParams('limit=200')
    expect(getPaginationParams(params).limit).toBe(100)
  })

  it('clamps limit to min 1', () => {
    const params = new URLSearchParams('limit=0')
    expect(getPaginationParams(params).limit).toBe(1)
  })

  it('handles negative limit', () => {
    const params = new URLSearchParams('limit=-5')
    expect(getPaginationParams(params).limit).toBe(1)
  })

  it('ignores non-numeric limit', () => {
    const params = new URLSearchParams('limit=abc')
    expect(getPaginationParams(params).limit).toBe(20)
  })

  it('handles both cursor and limit', () => {
    const params = new URLSearchParams('cursor=xyz&limit=30')
    const result = getPaginationParams(params)
    expect(result.cursor).toBe('xyz')
    expect(result.limit).toBe(30)
  })
})

// ============================================================
// buildPaginationMeta
// ============================================================

describe('buildPaginationMeta', () => {
  it('returns correct total', () => {
    const meta = buildPaginationMeta(50, 20, Array(20).fill(null), 'cursor1')
    expect(meta.total).toBe(50)
  })

  it('returns correct limit', () => {
    const meta = buildPaginationMeta(50, 20, Array(20).fill(null), null)
    expect(meta.limit).toBe(20)
  })

  it('hasMore is true when items count equals limit', () => {
    const meta = buildPaginationMeta(100, 20, Array(20).fill(null), 'next')
    expect(meta.hasMore).toBe(true)
  })

  it('hasMore is false when items count less than limit', () => {
    const meta = buildPaginationMeta(15, 20, Array(15).fill(null), null)
    expect(meta.hasMore).toBe(false)
  })

  it('returns cursor from nextCursor', () => {
    const meta = buildPaginationMeta(100, 20, Array(20).fill(null), 'abc')
    expect(meta.cursor).toBe('abc')
  })

  it('returns null cursor when no nextCursor', () => {
    const meta = buildPaginationMeta(10, 20, Array(10).fill(null), null)
    expect(meta.cursor).toBeNull()
  })
})

// ============================================================
// parseBody
// ============================================================

describe('parseBody', () => {
  it('parses valid JSON body', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
      headers: { 'content-type': 'application/json' },
    })
    const result = await parseBody(req)
    expect(result).toEqual({ name: 'test' })
  })

  it('returns null for empty body', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '' })
    expect(await parseBody(req)).toBeNull()
  })

  it('returns null for invalid JSON', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: 'not json' })
    expect(await parseBody(req)).toBeNull()
  })

  it('parses array body', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '[1, 2, 3]',
    })
    expect(await parseBody<number[]>(req)).toEqual([1, 2, 3])
  })
})

// ============================================================
// requireBody
// ============================================================

describe('requireBody', () => {
  it('returns parsed body for valid JSON', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    })
    expect(await requireBody(req)).toEqual({ name: 'test' })
  })

  it('throws ValidationError for empty body', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '' })
    await expect(requireBody(req)).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for invalid JSON', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: 'bad' })
    await expect(requireBody(req)).rejects.toThrow(ValidationError)
  })
})

// ============================================================
// withErrorHandler
// ============================================================

describe('withErrorHandler', () => {
  it('returns handler result on success', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true })
    const result = await withErrorHandler(handler)
    expect(result).toEqual({ ok: true })
  })

  it('catches ApiError and returns error response', async () => {
    const handler = vi.fn().mockRejectedValue(new ApiError('TEST', 'test error', 400))
    const result = await withErrorHandler(handler)
    const body = getBody() as Record<string, unknown>
    expect(getStatus()).toBe(400)
    expect((body.error as Record<string, unknown>).code).toBe('TEST')
  })

  it('catches unknown errors and returns 500', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'))
    const result = await withErrorHandler(handler)
    expect(getStatus()).toBe(500)
    const body = getBody() as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR')
  })
})

// ============================================================
// Custom Error Classes
// ============================================================

describe('ApiError', () => {
  it('has correct name', () => {
    const err = new ApiError('CODE', 'msg')
    expect(err.name).toBe('ApiError')
  })

  it('has correct message', () => {
    const err = new ApiError('CODE', 'custom message')
    expect(err.message).toBe('custom message')
  })

  it('has correct code', () => {
    const err = new ApiError('MY_CODE', 'msg')
    expect(err.code).toBe('MY_CODE')
  })

  it('defaults to status 400', () => {
    const err = new ApiError('CODE', 'msg')
    expect(err.status).toBe(400)
  })

  it('accepts custom status', () => {
    const err = new ApiError('CODE', 'msg', 502)
    expect(err.status).toBe(502)
  })

  it('is instance of Error', () => {
    const err = new ApiError('CODE', 'msg')
    expect(err).toBeInstanceOf(Error)
  })

  it('is instance of ApiError', () => {
    const err = new ApiError('CODE', 'msg')
    expect(err).toBeInstanceOf(ApiError)
  })
})

describe('ValidationError', () => {
  it('has status 422', () => {
    const err = new ValidationError('bad')
    expect(err.status).toBe(422)
  })

  it('has code VALIDATION_ERROR', () => {
    const err = new ValidationError('bad')
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('has name ValidationError', () => {
    const err = new ValidationError('bad')
    expect(err.name).toBe('ValidationError')
  })

  it('is instance of ApiError', () => {
    const err = new ValidationError('bad')
    expect(err).toBeInstanceOf(ApiError)
  })
})

describe('NotFoundError', () => {
  it('has status 404', () => {
    const err = new NotFoundError()
    expect(err.status).toBe(404)
  })

  it('has code NOT_FOUND', () => {
    const err = new NotFoundError()
    expect(err.code).toBe('NOT_FOUND')
  })

  it('includes resource in message', () => {
    const err = new NotFoundError('Mission')
    expect(err.message).toBe('Mission not found')
  })

  it('has name NotFoundError', () => {
    const err = new NotFoundError()
    expect(err.name).toBe('NotFoundError')
  })

  it('is instance of ApiError', () => {
    const err = new NotFoundError()
    expect(err).toBeInstanceOf(ApiError)
  })
})

describe('ForbiddenError', () => {
  it('has status 403', () => {
    const err = new ForbiddenError()
    expect(err.status).toBe(403)
  })

  it('has code FORBIDDEN', () => {
    const err = new ForbiddenError()
    expect(err.code).toBe('FORBIDDEN')
  })

  it('has name ForbiddenError', () => {
    const err = new ForbiddenError()
    expect(err.name).toBe('ForbiddenError')
  })

  it('uses default message', () => {
    const err = new ForbiddenError()
    expect(err.message).toBe('Insufficient permissions')
  })

  it('accepts custom message', () => {
    const err = new ForbiddenError('custom msg')
    expect(err.message).toBe('custom msg')
  })

  it('is instance of ApiError', () => {
    const err = new ForbiddenError()
    expect(err).toBeInstanceOf(ApiError)
  })
})
