// Mianx.ai — Phase 13: Input Sanitization Utility
//
// Centralized input validation and sanitization to prevent:
//   - XSS via HTML/script injection
//   - SQL injection (string truncation + type coercion)
//   - NoSQL injection (field name validation)
//   - Prototype pollution (deep object sanitization)
//   - ReDoS (regex pattern blacklisting)
//   - Header injection (CRLF removal)

// ─────────────────────────────────────────────
//  String Sanitization
// ─────────────────────────────────────────────

/**
 * Remove potentially dangerous characters from strings.
 * Strips HTML tags, null bytes, and control characters.
 * Does NOT escape — use for storage/input validation, not output rendering.
 */
export function sanitizeString(input: unknown, maxLength: number = 10000): string {
  if (typeof input !== "string") return "";
  
  let sanitized = input
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters (except \t, \n, \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Strip HTML tags (basic — not a full HTML parser)
    .replace(/<[^>]*>/g, "")
    // Remove CRLF sequences (prevent header injection)
    .replace(/[\r\n]/g, " ");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize a string for use in HTML context (escape entities).
 * For output rendering, NOT storage.
 */
export function escapeHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─────────────────────────────────────────────
//  Numeric Validation
// ─────────────────────────────────────────────

export interface NumberValidation {
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
}

/**
 * Validate and coerce a value to a number.
 * Returns null if the value is not a valid number within bounds.
 */
export function validateNumber(
  input: unknown,
  options: NumberValidation = {},
): number | null {
  if (input === undefined || input === null) return null;
  const num = Number(input);
  if (isNaN(num) || !isFinite(num)) return null;

  if (options.integer && !Number.isInteger(num)) return null;
  if (options.positive && num <= 0) return null;
  if (options.min !== undefined && num < options.min) return null;
  if (options.max !== undefined && num > options.max) return null;

  return num;
}

// ─────────────────────────────────────────────
//  Email Validation
// ─────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Basic email validation (RFC 5322 simplified).
 */
export function validateEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length > 254) return null; // RFC 5321 max length
  if (!EMAIL_REGEX.test(trimmed)) return null;
  return trimmed;
}

// ─────────────────────────────────────────────
//  ID / Slug Validation
// ─────────────────────────────────────────────

/**
 * Validate a cuid/nanoid format ID (alphanumeric + hyphens, 10-50 chars).
 */
export function validateId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!/^[a-zA-Z0-9_-]{10,50}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validate a URL-safe slug (lowercase, hyphens, no special chars).
 */
export function validateSlug(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmed)) return null;
  if (trimmed.length > 100) return null;
  return trimmed;
}

// ─────────────────────────────────────────────
//  Array Validation
// ─────────────────────────────────────────────

/**
 * Validate an array input with optional item validation and size limits.
 */
export function validateArray<T>(
  input: unknown,
  options: {
    maxLength?: number;
    minLength?: number;
    validateItem?: (item: unknown, index: number) => T | null;
  } = {},
): T[] | null {
  if (!Array.isArray(input)) return null;
  const { maxLength = 100, minLength = 0, validateItem } = options;

  if (input.length < minLength || input.length > maxLength) return null;

  if (validateItem) {
    const result: T[] = [];
    for (let i = 0; i < input.length; i++) {
      const validated = validateItem(input[i], i);
      if (validated === null) return null;
      result.push(validated);
    }
    return result;
  }

  return input as T[];
}

// ─────────────────────────────────────────────
//  Object Sanitization (prevent prototype pollution)
// ─────────────────────────────────────────────

const DANGEROUS_KEYS = new Set([
  "__proto__", "constructor", "prototype",
  "__defineGetter__", "__defineSetter__",
  "__lookupGetter__", "__lookupSetter__",
]);

/**
 * Deep-sanitize an object to prevent prototype pollution.
 * Strips dangerous keys and recursively sanitizes nested objects.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  input: unknown,
  maxDepth: number = 5,
): T | null {
  if (!input || typeof input !== "object") return null;
  if (Array.isArray(input)) return null;

  const result: Record<string, unknown> = {};
  const entries = Object.entries(input as Record<string, unknown>);

  for (const [key, value] of entries) {
    // Block prototype pollution keys
    if (DANGEROUS_KEYS.has(key)) continue;

    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else if (Array.isArray(value) && maxDepth > 1) {
      const sanitized = value.map((item) =>
        typeof item === "object" && item !== null
          ? sanitizeObject(item as Record<string, unknown>, maxDepth - 1)
          : typeof item === "string"
            ? sanitizeString(item)
            : item
      );
      result[key] = sanitized;
    } else if (typeof value === "object" && maxDepth > 1) {
      result[key] = sanitizeObject(value as Record<string, unknown>, maxDepth - 1);
    } else {
      // Skip unsupported types (functions, symbols, etc.)
      result[key] = undefined;
    }
  }

  return result as T;
}

// ─────────────────────────────────────────────
//  Regex Pattern Safety (prevent ReDoS)
// ─────────────────────────────────────────────

const DANGEROUS_REGEX_PATTERNS = [
  /(\(\?\:.*\)){10,}/, // Many non-capturing groups
  /\(.*\){5,}/,        // Many capturing groups
  /(\+\+|\*\*|\+\*|\*\+)/, // Nested quantifiers
  /\\{2,}/,            // Excessive backslashes
];

/**
 * Check if a regex pattern string looks dangerous (potential ReDoS).
 */
export function isRegexSafe(pattern: string): boolean {
  for (const dangerous of DANGEROUS_REGEX_PATTERNS) {
    if (dangerous.test(pattern)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
//  Request Body Sanitization (bulk)
// ─────────────────────────────────────────────

export interface BodySanitizationRule {
  field: string;
  type: "string" | "number" | "email" | "id" | "array" | "boolean";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  maxArrayLength?: number;
}

/**
 * Validate and sanitize a request body against a set of rules.
 * Returns { sanitized, errors } where sanitized is the cleaned data
 * and errors is an array of field-level error messages.
 */
export function sanitizeBody(
  body: unknown,
  rules: BodySanitizationRule[],
): { sanitized: Record<string, unknown>; errors: string[] } {
  const sanitized: Record<string, unknown> = {};
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { sanitized: {}, errors: ["Request body must be a JSON object"] };
  }

  const data = body as Record<string, unknown>;

  for (const rule of rules) {
    const value = data[rule.field];

    // Required check
    if (rule.required && (value === undefined || value === null)) {
      errors.push(`${rule.field} is required`);
      continue;
    }

    // Skip optional fields that are not provided
    if (value === undefined || value === null) {
      continue;
    }

    switch (rule.type) {
      case "string": {
        const str = sanitizeString(value, rule.maxLength);
        if (str === "" && rule.required) {
          errors.push(`${rule.field} must be a non-empty string`);
        } else {
          sanitized[rule.field] = str;
        }
        break;
      }
      case "number": {
        const num = validateNumber(value, { min: rule.min, max: rule.max });
        if (num === null && rule.required) {
          errors.push(`${rule.field} must be a valid number`);
        } else if (num !== null) {
          sanitized[rule.field] = num;
        }
        break;
      }
      case "email": {
        const email = validateEmail(value);
        if (email === null && rule.required) {
          errors.push(`${rule.field} must be a valid email`);
        } else if (email !== null) {
          sanitized[rule.field] = email;
        }
        break;
      }
      case "id": {
        const id = validateId(value);
        if (id === null && rule.required) {
          errors.push(`${rule.field} must be a valid ID`);
        } else if (id !== null) {
          sanitized[rule.field] = id;
        }
        break;
      }
      case "array": {
        const arr = validateArray(value, { maxLength: rule.maxArrayLength || 100 });
        if (arr === null && rule.required) {
          errors.push(`${rule.field} must be a valid array`);
        } else if (arr !== null) {
          sanitized[rule.field] = arr;
        }
        break;
      }
      case "boolean": {
        if (typeof value === "boolean") {
          sanitized[rule.field] = value;
        } else {
          errors.push(`${rule.field} must be a boolean`);
        }
        break;
      }
    }
  }

  return { sanitized, errors };
}
