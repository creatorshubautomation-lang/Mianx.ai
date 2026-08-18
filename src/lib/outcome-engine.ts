// ============================================================
// MIANX.AI V3 — Outcome Engine
// Outcome tracking, progress assessment, and mission success evaluation
// ============================================================

import { db } from '@/lib/db'
import { toJsonField, parseJsonField } from '@/lib/types'
import type { Outcome, OutcomeStatus } from '@prisma/client'

// ============================================================
// Public API
// ============================================================

/**
 * Create or update an outcome for a mission objective.
 * If an outcome with the same missionId and objective already exists,
 * its baseline and target are updated. Otherwise a new Outcome is created.
 */
export async function trackOutcome(params: {
  missionId: string
  organizationId: string
  objective: string
  baseline?: Record<string, unknown>
  target?: Record<string, unknown>
}): Promise<Outcome> {
  const existing = await db.outcome.findFirst({
    where: { missionId: params.missionId, objective: params.objective },
  })

  if (existing) {
    return db.outcome.update({
      where: { id: existing.id },
      data: {
        baseline: toJsonField(params.baseline ?? parseJsonField(existing.baseline, {})),
        target: toJsonField(params.target ?? parseJsonField(existing.target, {})),
        status: 'in_progress',
      },
    })
  }

  return db.outcome.create({
    data: {
      organizationId: params.organizationId,
      missionId: params.missionId,
      objective: params.objective,
      baseline: toJsonField(params.baseline ?? {}),
      target: toJsonField(params.target ?? {}),
      currentResult: toJsonField({}),
      progress: 0,
      confidence: 0,
      status: 'not_started',
    },
  })
}

/**
 * Update the current result of an outcome and recompute progress and status.
 */
export async function updateOutcomeProgress(
  outcomeId: string,
  currentResult: Record<string, unknown>,
): Promise<Outcome> {
  const outcome = await db.outcome.findUnique({ where: { id: outcomeId } })
  if (!outcome) throw new Error(`Outcome ${outcomeId} not found`)

  const baseline = parseJsonField<Record<string, number>>(outcome.baseline, {})
  const target = parseJsonField<Record<string, number>>(outcome.target, {})
  const numericCurrent: Record<string, number> = {}

  // Extract numeric values from currentResult
  for (const [key, value] of Object.entries(currentResult)) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      numericCurrent[key] = value
    }
  }

  const assessment = assessOutcomeStatus({
    baseline,
    target,
    current: numericCurrent,
  })

  return db.outcome.update({
    where: { id: outcomeId },
    data: {
      currentResult: toJsonField(currentResult),
      progress: assessment.progress,
      confidence: assessment.confidence,
      status: assessment.status,
      verifiedAt: assessment.status === 'achieved' ? new Date() : null,
    },
  })
}

/**
 * Assess outcome status by comparing current metrics against baseline and target.
 *
 * Progress is the average fraction of distance traveled from baseline to target.
 * Confidence reflects how many metrics have data (more data = higher confidence).
 * Status is determined by progress thresholds:
 *   - 0% → not_started
 *   - 1-49% → in_progress
 *   - 50-89% → near_target
 *   - 90%+ → achieved
 *
 * If any metric regressed below baseline, status becomes 'missed'.
 */
export function assessOutcomeStatus(params: {
  baseline: Record<string, number>
  target: Record<string, number>
  current: Record<string, number>
}): { status: OutcomeStatus; progress: number; confidence: number } {
  const { baseline, target, current } = params
  const metricKeys = [...new Set([...Object.keys(baseline), ...Object.keys(target)])]

  if (metricKeys.length === 0) {
    return { status: 'not_started', progress: 0, confidence: 0 }
  }

  let totalProgress = 0
  let metricsWithData = 0
  let regressed = false

  for (const key of metricKeys) {
    const base = baseline[key] ?? 0
    const tgt = target[key] ?? base
    const cur = current[key]

    // Skip metrics without current data
    if (cur === undefined) continue

    metricsWithData++

    const range = tgt - base
    if (Math.abs(range) < 0.001) {
      // Target equals baseline — if current matches, it's achieved
      totalProgress += Math.abs(cur - base) < 0.001 ? 1 : 0
    } else {
      const fraction = (cur - base) / range
      totalProgress += Math.min(Math.max(fraction, 0), 1)
    }

    // Check for regression below baseline
    if (range > 0 && cur < base) regressed = true
    if (range < 0 && cur > base) regressed = true
  }

  const progress = metricsWithData > 0
    ? Math.round((totalProgress / metricKeys.length) * 100)
    : 0

  // Confidence: ratio of metrics that have current data
  const confidence = metricsWithData / metricKeys.length

  // Determine status
  let status: OutcomeStatus
  if (regressed) {
    status = 'missed'
  } else if (metricsWithData === 0) {
    status = 'not_started'
  } else if (progress >= 90) {
    status = 'achieved'
  } else if (progress >= 50) {
    status = 'near_target'
  } else {
    status = 'in_progress'
  }

  return { status, progress, confidence }
}

/**
 * Get all outcomes for a mission, ordered by creation date.
 */
export async function getMissionOutcomes(missionId: string): Promise<Outcome[]> {
  return db.outcome.findMany({
    where: { missionId },
    orderBy: { createdAt: 'asc' },
  })
}
