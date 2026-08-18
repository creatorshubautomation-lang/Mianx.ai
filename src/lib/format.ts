import { formatDistanceToNow, format } from 'date-fns'

/**
 * Format a date string as a human-readable relative time.
 * e.g. "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

/**
 * Format a cost in cents to a dollar string.
 * e.g. 1250 → "$12.50"
 */
export function formatCost(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toFixed(2)}`
}

/**
 * Format a date string to a readable date.
 * e.g. "Aug 18, 2026"
 */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy')
}

/**
 * Format a number with locale-aware thousands separators.
 * e.g. 1234 → "1,234"
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

/**
 * Truncate text to a maximum length, appending "…" if truncated.
 */
export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}
