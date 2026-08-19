// ============================================================
// MIANX.AI V3 — Authentication Error Constants
// Standardized error messages for authentication flows
// ============================================================

/**
 * Authentication error messages.
 * Use these constants instead of inline strings to ensure consistent,
 * non-information-leaking error responses.
 */
export const AuthErrors = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_NOT_FOUND: 'Invalid email or password',
  ACCOUNT_DISABLED: 'Account is disabled. Contact support.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  INVALID_EMAIL: 'Please provide a valid email address',
  SESSION_EXPIRED: 'Session expired. Please sign in again.',
  SESSION_INVALID: 'Invalid session. Please sign in again.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  REGISTRATION_DISABLED: 'Registration is currently disabled.',
  INVITATION_REQUIRED: 'Registration requires an invitation.',
  ORG_CREATION_FAILED: 'Failed to create workspace. Please try again.',
} as const

export type AuthErrorKey = keyof typeof AuthErrors
