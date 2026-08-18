// ============================================================
// MIANX.AI V3 — Verification Engine
// 10 verification-type executors for mission task output validation
// ============================================================

import { db } from '@/lib/db'
import { parseJsonField, toJsonField } from '@/lib/types'
import type { Verification, VerificationType } from '@prisma/client'

// ============================================================
// Types
// ============================================================

export interface VerificationResult {
  passed: boolean
  evidence: string[]
}

/** Config shape for each verification type */
interface SchemaValidationConfig {
  type?: string
  keys: string[]
}

interface TestConfig {
  type?: string
}

interface TypecheckConfig {
  type?: string
}

interface LintConfig {
  type?: string
  /** Maximum allowed warnings (default: Infinity, i.e. no limit) */
  maxWarnings?: number
}

interface BuildConfig {
  type?: string
}

interface SecurityConfig {
  type?: string
}

interface AccessibilityConfig {
  type?: string
}

interface BusinessRuleConfig {
  type?: string
  /** Optional: specific rules to check (checks all if omitted) */
  requiredRules?: string[]
}

interface ArtifactCheckConfig {
  type?: string
  /** Optional: minimum artifact count (default: 1) */
  minArtifacts?: number
  /** Optional: file extensions to require */
  extensions?: string[]
}

interface MetricThresholdConfig {
  type?: string
}

type VerificationConfig =
  | SchemaValidationConfig
  | TestConfig
  | TypecheckConfig
  | LintConfig
  | BuildConfig
  | SecurityConfig
  | AccessibilityConfig
  | BusinessRuleConfig
  | ArtifactCheckConfig
  | MetricThresholdConfig

/** Dispatch map: verification type → executor function */
const EXECUTORS: Record<
  VerificationType,
  (output: Record<string, unknown>, config: Record<string, unknown>) => VerificationResult
> = {
  schema_validation: (output, config) =>
    verifySchemaValidation(output, config as unknown as SchemaValidationConfig),
  test: (output, config) =>
    verifyTest(output, config as unknown as TestConfig),
  typecheck: (output, config) =>
    verifyTypecheck(output, config as unknown as TypecheckConfig),
  lint: (output, config) =>
    verifyLint(output, config as unknown as LintConfig),
  build: (output, config) =>
    verifyBuild(output, config as unknown as BuildConfig),
  security: (output, config) =>
    verifySecurity(output, config as unknown as SecurityConfig),
  accessibility: (output, config) =>
    verifyAccessibility(output, config as unknown as AccessibilityConfig),
  business_rule: (output, config) =>
    verifyBusinessRule(output, config as unknown as BusinessRuleConfig),
  artifact_check: (output, config) =>
    verifyArtifactCheck(output, config as unknown as ArtifactCheckConfig),
  metric_threshold: (output, config) =>
    verifyMetricThreshold(output, config as unknown as MetricThresholdConfig),
}

// ============================================================
// Main Executor
// ============================================================

/**
 * Run verification for a mission task.
 *
 * 1. Fetches the MissionTask from the database
 * 2. Parses verificationConfig and output JSON fields
 * 3. Dispatches to the appropriate type executor
 * 4. Persists a Verification record
 * 5. Returns the created Verification
 */
export async function runVerification(params: {
  missionTaskId: string
  missionId: string
  organizationId: string
}): Promise<Verification> {
  const { missionTaskId, missionId, organizationId } = params

  // 1. Fetch the task
  const task = await db.missionTask.findUnique({ where: { id: missionTaskId } })
  if (!task) {
    throw new Error(`MissionTask ${missionTaskId} not found`)
  }
  if (task.missionId !== missionId) {
    throw new Error(`MissionTask ${missionTaskId} does not belong to mission ${missionId}`)
  }

  // 2. Parse config and output
  const config = parseJsonField<Record<string, unknown>>(task.verificationConfig, {})
  const output = parseJsonField<Record<string, unknown>>(task.output, {})

  // 3. Determine verification type (default: schema_validation)
  const vType = (config.type as VerificationType) ?? 'schema_validation'

  // 4. Call the appropriate executor
  const executor = EXECUTORS[vType]
  if (!executor) {
    // Unknown type — fail verification with evidence
    const evidence = [`Unknown verification type: ${vType}`]
    return db.verification.create({
      data: {
        missionId,
        missionTaskId,
        type: vType,
        config: toJsonField(config),
        result: toJsonField({ passed: false, error: `Unknown verification type: ${vType}` }),
        evidence: toJsonField(evidence),
        passed: false,
        verifiedAt: new Date(),
      },
    })
  }

  const result = executor(output, config)

  // 5. Persist the Verification record
  return db.verification.create({
    data: {
      missionId,
      missionTaskId,
      type: vType,
      config: toJsonField(config),
      result: toJsonField({ passed: result.passed, checkedAt: new Date().toISOString() }),
      evidence: toJsonField(result.evidence),
      passed: result.passed,
      verifiedAt: new Date(),
    },
  })
}

// ============================================================
// 1. schema_validation
// ============================================================

/**
 * Verify that output contains all expected keys from config.keys.
 * Passes when every key in the config.keys array exists as a property on the output object.
 */
export function verifySchemaValidation(
  output: Record<string, unknown>,
  config: SchemaValidationConfig,
): VerificationResult {
  const evidence: string[] = []
  const keys: string[] = Array.isArray(config.keys) ? config.keys : []

  if (keys.length === 0) {
    evidence.push('No keys specified in verification config — nothing to validate')
    return { passed: false, evidence }
  }

  if (typeof output !== 'object' || output === null) {
    evidence.push('Output is not a valid object')
    return { passed: false, evidence }
  }

  const missingKeys: string[] = []
  const presentKeys: string[] = []

  for (const key of keys) {
    if (key in output) {
      presentKeys.push(key)
    } else {
      missingKeys.push(key)
    }
  }

  evidence.push(`Expected ${keys.length} keys, found ${presentKeys.length}`)

  if (presentKeys.length > 0) {
    evidence.push(`Present keys: ${presentKeys.join(', ')}`)
  }
  if (missingKeys.length > 0) {
    evidence.push(`Missing keys: ${missingKeys.join(', ')}`)
  }

  const passed = missingKeys.length === 0
  evidence.push(`Schema validation: ${passed ? 'PASSED' : 'FAILED'}`)

  return { passed, evidence }
}

// ============================================================
// 2. test
// ============================================================

/**
 * Verify that output has { tests: { total, passed, failed } } and all tests pass.
 * Passes when failed === 0 and passed === total (all tests green).
 */
export function verifyTest(
  output: Record<string, unknown>,
  _config: TestConfig,
): VerificationResult {
  const evidence: string[] = []

  const tests = output.tests
  if (typeof tests !== 'object' || tests === null) {
    evidence.push('Output missing "tests" field or it is not an object')
    return { passed: false, evidence }
  }

  const total = Number((tests as Record<string, unknown>).total)
  const passed = Number((tests as Record<string, unknown>).passed)
  const failed = Number((tests as Record<string, unknown>).failed)

  if (Number.isNaN(total) || Number.isNaN(passed) || Number.isNaN(failed)) {
    evidence.push('Output tests field must contain numeric total, passed, and failed')
    return { passed: false, evidence }
  }

  evidence.push(`Tests: ${passed} passed, ${failed} failed, ${total} total`)

  const allPassed = failed === 0 && passed === total && total > 0

  if (!allPassed && failed > 0) {
    evidence.push(`${failed} test(s) failed — verification FAILED`)
  } else if (total === 0) {
    evidence.push('No tests were run — verification FAILED')
  } else {
    evidence.push('All tests passed — verification PASSED')
  }

  return { passed: allPassed, evidence }
}

// ============================================================
// 3. typecheck
// ============================================================

/**
 * Verify that output has { typecheck: 'passed' | 'failed' }.
 * Passes when typecheck === 'passed'.
 */
export function verifyTypecheck(
  output: Record<string, unknown>,
  _config: TypecheckConfig,
): VerificationResult {
  const evidence: string[] = []

  if (!('typecheck' in output)) {
    evidence.push('Output missing "typecheck" field')
    return { passed: false, evidence }
  }

  const status = String(output.typecheck)
  evidence.push(`Typecheck status: ${status}`)

  const passed = status === 'passed'
  evidence.push(
    passed ? 'Typecheck passed — verification PASSED' : 'Typecheck failed — verification FAILED',
  )

  return { passed, evidence }
}

// ============================================================
// 4. lint
// ============================================================

/**
 * Verify that output has { lint: { total, errors, warnings } } and errors === 0.
 * Passes when there are zero lint errors (warnings are informational only).
 */
export function verifyLint(
  output: Record<string, unknown>,
  config: LintConfig,
): VerificationResult {
  const evidence: string[] = []
  const maxWarnings = config.maxWarnings ?? Infinity

  const lint = output.lint
  if (typeof lint !== 'object' || lint === null) {
    evidence.push('Output missing "lint" field or it is not an object')
    return { passed: false, evidence }
  }

  const total = Number((lint as Record<string, unknown>).total)
  const errors = Number((lint as Record<string, unknown>).errors)
  const warnings = Number((lint as Record<string, unknown>).warnings)

  if (Number.isNaN(total) || Number.isNaN(errors) || Number.isNaN(warnings)) {
    evidence.push('Output lint field must contain numeric total, errors, and warnings')
    return { passed: false, evidence }
  }

  evidence.push(`Lint: ${errors} errors, ${warnings} warnings, ${total} total issues`)

  const noErrors = errors === 0
  const warningsOk = warnings <= maxWarnings

  if (!noErrors) {
    evidence.push(`${errors} lint error(s) found — verification FAILED`)
  } else if (!warningsOk) {
    evidence.push(
      `${warnings} warnings exceed maxWarnings threshold of ${maxWarnings} — verification FAILED`,
    )
  } else {
    evidence.push(
      warnings > 0
        ? `No errors, ${warnings} warning(s) within limit — verification PASSED`
        : 'No errors, no warnings — verification PASSED',
    )
  }

  return { passed: noErrors && warningsOk, evidence }
}

// ============================================================
// 5. build
// ============================================================

/**
 * Verify that output has { build: 'success' | 'failed' } or { build: { status: 'success' } }.
 * Passes when the build status is 'success'.
 */
export function verifyBuild(
  output: Record<string, unknown>,
  _config: BuildConfig,
): VerificationResult {
  const evidence: string[] = []

  if (!('build' in output)) {
    evidence.push('Output missing "build" field')
    return { passed: false, evidence }
  }

  const build = output.build

  // Handle both string form and object form
  let status: string
  if (typeof build === 'string') {
    status = build
  } else if (typeof build === 'object' && build !== null && 'status' in build) {
    status = String((build as Record<string, unknown>).status)
  } else {
    evidence.push('Output build field must be a string or an object with "status" property')
    return { passed: false, evidence }
  }

  evidence.push(`Build status: ${status}`)

  const passed = status === 'success'
  evidence.push(
    passed ? 'Build succeeded — verification PASSED' : 'Build failed — verification FAILED',
  )

  return { passed, evidence }
}

// ============================================================
// 6. security
// ============================================================

/**
 * Verify that output has { security: { vulnerabilities: number } } and vulnerabilities === 0.
 * Passes when there are zero security vulnerabilities.
 */
export function verifySecurity(
  output: Record<string, unknown>,
  _config: SecurityConfig,
): VerificationResult {
  const evidence: string[] = []

  const security = output.security
  if (typeof security !== 'object' || security === null) {
    evidence.push('Output missing "security" field or it is not an object')
    return { passed: false, evidence }
  }

  const vulnerabilities = Number((security as Record<string, unknown>).vulnerabilities)

  if (Number.isNaN(vulnerabilities)) {
    evidence.push('Output security.vulnerabilities must be a number')
    return { passed: false, evidence }
  }

  evidence.push(`Security vulnerabilities found: ${vulnerabilities}`)

  const passed = vulnerabilities === 0
  evidence.push(
    passed
      ? 'No security vulnerabilities — verification PASSED'
      : `${vulnerabilities} vulnerability(ies) found — verification FAILED`,
  )

  return { passed, evidence }
}

// ============================================================
// 7. accessibility
// ============================================================

/**
 * Verify that output has { a11y: { violations: number } } and violations === 0.
 * Passes when there are zero accessibility violations.
 */
export function verifyAccessibility(
  output: Record<string, unknown>,
  _config: AccessibilityConfig,
): VerificationResult {
  const evidence: string[] = []

  const a11y = output.a11y
  if (typeof a11y !== 'object' || a11y === null) {
    evidence.push('Output missing "a11y" field or it is not an object')
    return { passed: false, evidence }
  }

  const violations = Number((a11y as Record<string, unknown>).violations)

  if (Number.isNaN(violations)) {
    evidence.push('Output a11y.violations must be a number')
    return { passed: false, evidence }
  }

  evidence.push(`Accessibility violations found: ${violations}`)

  const passed = violations === 0
  evidence.push(
    passed
      ? 'No accessibility violations — verification PASSED'
      : `${violations} violation(s) found — verification FAILED`,
  )

  return { passed, evidence }
}

// ============================================================
// 8. business_rule
// ============================================================

/**
 * Verify that output has { rules: [{ name, passed }] } and all rules passed.
 * Passes when every rule in the array has passed === true.
 */
export function verifyBusinessRule(
  output: Record<string, unknown>,
  config: BusinessRuleConfig,
): VerificationResult {
  const evidence: string[] = []

  const rules = output.rules
  if (!Array.isArray(rules)) {
    evidence.push('Output missing "rules" field or it is not an array')
    return { passed: false, evidence }
  }

  if (rules.length === 0) {
    evidence.push('Rules array is empty — nothing to validate')
    return { passed: false, evidence }
  }

  const requiredRules = config.requiredRules
  const rulesToCheck = requiredRules && requiredRules.length > 0
    ? rules.filter((r) => requiredRules.includes(String((r as Record<string, unknown>).name)))
    : rules

  const passedRules: string[] = []
  const failedRules: string[] = []

  for (const rule of rulesToCheck) {
    const ruleObj = rule as Record<string, unknown>
    const name = String(ruleObj.name ?? 'unnamed')
    const rulePassed = ruleObj.passed === true

    if (rulePassed) {
      passedRules.push(name)
    } else {
      failedRules.push(name)
    }
  }

  evidence.push(`${rulesToCheck.length} rule(s) checked: ${passedRules.length} passed, ${failedRules.length} failed`)

  if (passedRules.length > 0) {
    evidence.push(`Passed rules: ${passedRules.join(', ')}`)
  }
  if (failedRules.length > 0) {
    evidence.push(`Failed rules: ${failedRules.join(', ')}`)
  }

  const passed = failedRules.length === 0
  evidence.push(
    passed
      ? 'All business rules passed — verification PASSED'
      : 'Some business rules failed — verification FAILED',
  )

  return { passed, evidence }
}

// ============================================================
// 9. artifact_check
// ============================================================

/**
 * Verify that output has { artifacts: string[] } and the array is non-empty.
 * Optionally checks minimum artifact count and file extensions.
 */
export function verifyArtifactCheck(
  output: Record<string, unknown>,
  config: ArtifactCheckConfig,
): VerificationResult {
  const evidence: string[] = []
  const minArtifacts = config.minArtifacts ?? 1
  const requiredExtensions = config.extensions ?? []

  const artifacts = output.artifacts
  if (!Array.isArray(artifacts)) {
    evidence.push('Output missing "artifacts" field or it is not an array')
    return { passed: false, evidence }
  }

  evidence.push(`Artifact count: ${artifacts.length} (minimum required: ${minArtifacts})`)

  const countPassed = artifacts.length >= minArtifacts

  if (!countPassed) {
    evidence.push(`Expected at least ${minArtifacts} artifact(s), found ${artifacts.length} — FAILED`)
    return { passed: false, evidence }
  }

  // Check extensions if specified
  let extensionsOk = true
  if (requiredExtensions.length > 0) {
    const normalizedExts = requiredExtensions.map((e) => e.startsWith('.') ? e : `.${e}`)
    const artifactsWithoutMatch: string[] = []

    for (const artifact of artifacts) {
      const name = String(artifact)
      const hasMatchingExt = normalizedExts.some((ext) => name.endsWith(ext))
      if (!hasMatchingExt) {
        artifactsWithoutMatch.push(name)
      }
    }

    if (artifactsWithoutMatch.length > 0) {
      extensionsOk = false
      evidence.push(
        `Required extensions: ${normalizedExts.join(', ')}. Artifacts without matching extension: ${artifactsWithoutMatch.join(', ')}`,
      )
    } else {
      evidence.push(`All artifacts match required extensions: ${normalizedExts.join(', ')}`)
    }
  }

  const passed = countPassed && extensionsOk
  evidence.push(
    passed
      ? `Artifact check passed (${artifacts.length} artifact(s)) — PASSED`
      : 'Artifact check failed — FAILED',
  )

  return { passed, evidence }
}

// ============================================================
// 10. metric_threshold
// ============================================================

interface MetricEntry {
  value: number
  threshold: number
  operator?: 'gte' | 'lte' | 'eq'
}

/**
 * Verify that output has { metrics: Record<string, { value, threshold, operator? }> }
 * and all metrics meet their threshold.
 *
 * Operators:
 *  - 'gte' (default): value >= threshold
 *  - 'lte':           value <= threshold
 *  - 'eq':            value === threshold
 */
export function verifyMetricThreshold(
  output: Record<string, unknown>,
  _config: MetricThresholdConfig,
): VerificationResult {
  const evidence: string[] = []

  const metrics = output.metrics
  if (typeof metrics !== 'object' || metrics === null) {
    evidence.push('Output missing "metrics" field or it is not an object')
    return { passed: false, evidence }
  }

  const metricEntries = Object.entries(metrics as Record<string, MetricEntry>)

  if (metricEntries.length === 0) {
    evidence.push('Metrics object is empty — nothing to validate')
    return { passed: false, evidence }
  }

  const passedMetrics: string[] = []
  const failedMetrics: string[] = []

  for (const [name, entry] of metricEntries) {
    const value = Number(entry.value)
    const threshold = Number(entry.threshold)
    const operator = (entry.operator as 'gte' | 'lte' | 'eq') ?? 'gte'

    if (Number.isNaN(value) || Number.isNaN(threshold)) {
      failedMetrics.push(`${name} (invalid numeric value/threshold)`)
      evidence.push(`Metric "${name}": value=${entry.value}, threshold=${entry.threshold} — invalid number(s)`)
      continue
    }

    let met = false
    switch (operator) {
      case 'lte':
        met = value <= threshold
        break
      case 'eq':
        met = value === threshold
        break
      case 'gte':
      default:
        met = value >= threshold
        break
    }

    const comparison = operator === 'gte' ? '>=' : operator === 'lte' ? '<=' : '==='
    evidence.push(
      `Metric "${name}": ${value} ${comparison} ${threshold} — ${met ? 'MET' : 'NOT MET'}`,
    )

    if (met) {
      passedMetrics.push(name)
    } else {
      failedMetrics.push(name)
    }
  }

  evidence.push(
    `${metricEntries.length} metric(s) checked: ${passedMetrics.length} met, ${failedMetrics.length} not met`,
  )

  const passed = failedMetrics.length === 0
  evidence.push(
    passed
      ? 'All metrics meet their thresholds — verification PASSED'
      : 'Some metrics did not meet thresholds — verification FAILED',
  )

  return { passed, evidence }
}
