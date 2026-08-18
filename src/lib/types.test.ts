import { describe, it, expect } from 'vitest'
import {
  parseJsonField,
  toJsonField,
  generateRequestId,
  slugify,
  safeParseInt,
} from '@/lib/types'

// ============================================================
// parseJsonField
// ============================================================

describe('parseJsonField', () => {
  it('parses a valid JSON object string', () => {
    const result = parseJsonField('{"a": 1}', { fallback: true })
    expect(result).toEqual({ a: 1 })
  })

  it('parses a valid JSON array string', () => {
    const result = parseJsonField('[1, 2, 3]', [] as number[])
    expect(result).toEqual([1, 2, 3])
  })

  it('parses a valid JSON string (primitive)', () => {
    const result = parseJsonField('"hello"', 'fallback')
    expect(result).toBe('hello')
  })

  it('parses a valid JSON number', () => {
    const result = parseJsonField('42', 0)
    expect(result).toBe(42)
  })

  it('parses a valid JSON boolean true', () => {
    const result = parseJsonField('true', false)
    expect(result).toBe(true)
  })

  it('parses a valid JSON boolean false', () => {
    const result = parseJsonField('false', true)
    expect(result).toBe(false)
  })

  it('returns fallback for string "null" (source treats it as null-ish)', () => {
    const result = parseJsonField('null', 'fallback')
    // The source treats the literal string 'null' as a null-ish value, returning fallback
    expect(result).toBe('fallback')
  })

  it('returns fallback for invalid JSON', () => {
    const result = parseJsonField('{not json}', { fallback: true })
    expect(result).toEqual({ fallback: true })
  })

  it('returns fallback for truncated JSON', () => {
    const result = parseJsonField('{"a":', 'fb')
    expect(result).toBe('fb')
  })

  it('returns fallback for empty string', () => {
    const result = parseJsonField('', 'fb')
    expect(result).toBe('fb')
  })

  it('returns fallback for null input', () => {
    const result = parseJsonField(null as unknown as string, 'fb')
    expect(result).toBe('fb')
  })

  it('returns fallback for undefined input', () => {
    const result = parseJsonField(undefined as unknown as string, 'fb')
    expect(result).toBe('fb')
  })

  it('returns fallback for string "undefined"', () => {
    const result = parseJsonField('undefined', 'fb')
    expect(result).toBe('fb')
  })

  it('returns fallback for string "null"', () => {
    const result = parseJsonField('null', 'fb')
    // The source treats the literal string 'null' as null-ish, returning fallback
    expect(result).toBe('fb')
  })

  it('returns fallback for whitespace-only string', () => {
    const result = parseJsonField('   ', 'fb')
    expect(result).toBe('fb')
  })

  it('parses nested objects', () => {
    const result = parseJsonField('{"a": {"b": 2}}', {})
    expect(result).toEqual({ a: { b: 2 } })
  })

  it('parses arrays of objects', () => {
    const result = parseJsonField('[{"id": 1}]', [])
    expect(result).toEqual([{ id: 1 }])
  })

  it('returns fallback for empty object JSON with wrong fallback type hint', () => {
    const result = parseJsonField('{}', 'fallback')
    // {} is valid JSON, returns empty object
    expect(result).toEqual({})
  })

  it('preserves number types from JSON', () => {
    const result = parseJsonField('{"x": 3.14, "y": -10}', { x: 0, y: 0 })
    expect(result).toEqual({ x: 3.14, y: -10 })
  })
})

// ============================================================
// toJsonField
// ============================================================

describe('toJsonField', () => {
  it('serializes a simple object', () => {
    const result = toJsonField({ a: 1 })
    expect(result).toBe('{"a":1}')
  })

  it('serializes a nested object', () => {
    const result = toJsonField({ a: { b: 2 } })
    expect(result).toBe('{"a":{"b":2}}')
  })

  it('serializes an array', () => {
    const result = toJsonField([1, 2, 3])
    expect(result).toBe('[1,2,3]')
  })

  it('serializes an empty object for null input', () => {
    const result = toJsonField(null)
    expect(result).toBe('{}')
  })

  it('serializes an empty object for undefined input', () => {
    const result = toJsonField(undefined)
    expect(result).toBe('{}')
  })

  it('serializes a string value', () => {
    const result = toJsonField('hello')
    expect(result).toBe('"hello"')
  })

  it('serializes a number value', () => {
    const result = toJsonField(42)
    expect(result).toBe('42')
  })

  it('serializes a boolean value', () => {
    const result = toJsonField(true)
    expect(result).toBe('true')
  })

  it('serializes an empty array', () => {
    const result = toJsonField([])
    expect(result).toBe('[]')
  })

  it('serializes an empty object', () => {
    const result = toJsonField({})
    expect(result).toBe('{}')
  })

  it('serializes objects with special characters in values', () => {
    const result = toJsonField({ msg: 'hello "world"' })
    const parsed = JSON.parse(result)
    expect(parsed).toEqual({ msg: 'hello "world"' })
  })

  it('serializes objects with unicode', () => {
    const result = toJsonField({ name: '日本語' })
    const parsed = JSON.parse(result)
    expect(parsed).toEqual({ name: '日本語' })
  })

  it('round-trips with parseJsonField', () => {
    const original = { a: 1, b: ['x', 'y'] }
    const json = toJsonField(original)
    const restored = parseJsonField(json, {})
    expect(restored).toEqual(original)
  })

  it('produces a string return type', () => {
    const result = toJsonField({})
    expect(typeof result).toBe('string')
  })
})

// ============================================================
// generateRequestId
// ============================================================

describe('generateRequestId', () => {
  it('returns a string', () => {
    const id = generateRequestId()
    expect(typeof id).toBe('string')
  })

  it('starts with "req_" prefix', () => {
    const id = generateRequestId()
    expect(id.startsWith('req_')).toBe(true)
  })

  it('contains a timestamp component', () => {
    const id = generateRequestId()
    const parts = id.split('_')
    // req_<timestamp>_<random>
    expect(parts.length).toBe(3)
    expect(Number(parts[1])).toBeGreaterThan(0)
  })

  it('contains a random component', () => {
    const id = generateRequestId()
    const randomPart = id.split('_')[2]
    expect(randomPart.length).toBeGreaterThan(0)
  })

  it('generates unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()))
    // With 100 calls, at least 99 should be unique (statistically all will be)
    expect(ids.size).toBeGreaterThanOrEqual(99)
  })

  it('has reasonable length', () => {
    const id = generateRequestId()
    expect(id.length).toBeGreaterThan(10)
    expect(id.length).toBeLessThan(60)
  })

  it('only contains safe URL characters', () => {
    const id = generateRequestId()
    expect(id).toMatch(/^req_[\d]+_[\w]+$/)
  })
})

// ============================================================
// slugify
// ============================================================

describe('slugify', () => {
  it('converts simple text to slug', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('trims leading/trailing spaces', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })

  it('replaces multiple spaces with single dash', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })

  it('removes leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('hello@world!')).toBe('helloworld')
  })

  it('removes punctuation', () => {
    expect(slugify('hello, world. test!')).toBe('hello-world-test')
  })

  it('handles underscores by replacing with dashes', () => {
    expect(slugify('hello_world_test')).toBe('hello-world-test')
  })

  it('collapses multiple dashes into one', () => {
    expect(slugify('hello - world')).toBe('hello-world')
  })

  it('handles mixed spaces and underscores', () => {
    expect(slugify('hello _ world')).toBe('hello-world')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('returns empty string for only special characters', () => {
    expect(slugify('!!!@@@###')).toBe('')
  })

  it('returns empty string for whitespace only', () => {
    expect(slugify('   ')).toBe('')
  })

  it('preserves numbers', () => {
    expect(slugify('version 2.0 release')).toBe('version-20-release')
  })

  it('handles unicode characters by removing them', () => {
    expect(slugify('café résumé')).toBe('caf-rsum')
  })

  it('handles emojis by removing them', () => {
    expect(slugify('hello 🌍 world')).toBe('hello-world')
  })

  it('handles single word', () => {
    expect(slugify('hello')).toBe('hello')
  })

  it('handles already-slugified text', () => {
    expect(slugify('already-slugified')).toBe('already-slugified')
  })

  it('handles leading/trailing special characters', () => {
    expect(slugify('!!!hello!!!')).toBe('hello')
  })

  it('handles newline and tab characters as whitespace', () => {
    // \t and \n are whitespace, replaced by dash
    expect(slugify('hello\tworld\n')).toBe('hello-world')
  })

  it('handles mixed case with special chars', () => {
    expect(slugify('My Cool Project (v2)')).toBe('my-cool-project-v2')
  })
})

// ============================================================
// safeParseInt
// ============================================================

describe('safeParseInt', () => {
  it('parses a valid integer string', () => {
    expect(safeParseInt('10')).toBe(10)
  })

  it('parses a string "1"', () => {
    expect(safeParseInt('1')).toBe(1)
  })

  it('parses a string "100"', () => {
    expect(safeParseInt('100')).toBe(100)
  })

  it('returns default fallback for undefined', () => {
    expect(safeParseInt(undefined)).toBe(20)
  })

  it('returns default fallback for null', () => {
    expect(safeParseInt(null)).toBe(20)
  })

  it('returns default fallback for empty string', () => {
    expect(safeParseInt('')).toBe(20)
  })

  it('returns default fallback for non-numeric string', () => {
    expect(safeParseInt('abc')).toBe(20)
  })

  it('returns default fallback for "NaN" string', () => {
    expect(safeParseInt('NaN')).toBe(20)
  })

  it('uses custom fallback when provided', () => {
    expect(safeParseInt(undefined, 50)).toBe(50)
  })

  it('clamps to minimum of 1', () => {
    expect(safeParseInt('0')).toBe(1)
  })

  it('clamps negative numbers to 1', () => {
    expect(safeParseInt('-5')).toBe(1)
  })

  it('clamps to maximum of 100', () => {
    expect(safeParseInt('200')).toBe(100)
  })

  it('clamps large numbers to 100', () => {
    expect(safeParseInt('999')).toBe(100)
  })

  it('handles boundary value 1', () => {
    expect(safeParseInt('1')).toBe(1)
  })

  it('handles boundary value 100', () => {
    expect(safeParseInt('100')).toBe(100)
  })

  it('truncates decimal strings', () => {
    expect(safeParseInt('10.9')).toBe(10)
  })

  it('handles whitespace in string', () => {
    expect(safeParseInt('  10  ')).toBe(10)
  })

  it('returns fallback for string with only spaces', () => {
    expect(safeParseInt('   ')).toBe(20)
  })

  it('returns 1 for string "0" with default fallback', () => {
    expect(safeParseInt('0')).toBe(1)
  })

  it('handles very long number strings', () => {
    expect(safeParseInt('999999999')).toBe(100)
  })
})
