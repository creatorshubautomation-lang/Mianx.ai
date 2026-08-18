import { db } from '@/lib/db'
import {
  withErrorHandler,
  success,
  getOrgIdParam,
  ValidationError,
} from '@/lib/api-response'
import { getUserIdFromRequest, requireOrgMember, requirePermission, Permissions } from '@/lib/authorization'
import type { BillingOverview, UsageSummary, PlanVersionDto, SubscriptionDto, InvoiceDto } from '@/lib/types'

function safeParse<T>(field: string, fallback: T): T {
  try { return JSON.parse(field) as T } catch { return fallback }
}

function formatPlanVersion(pv: {
  id: string; planId: string; version: string
  includedFeatures: string; includedDomains: string; limits: string
  usageAllowances: string; seatAllowances: string | null; aiAllowance: string | null
  createdAt: Date
}): PlanVersionDto {
  return {
    id: pv.id,
    planId: pv.planId,
    version: pv.version,
    includedFeatures: pv.includedFeatures,
    includedDomains: pv.includedDomains,
    limits: pv.limits,
    usageAllowances: pv.usageAllowances,
    seatAllowances: pv.seatAllowances,
    aiAllowance: pv.aiAllowance,
    createdAt: String(pv.createdAt),
  }
}

function formatSubscription(s: {
  id: string; organizationId: string; planVersionId: string
  status: string; currentPeriodStart: Date; currentPeriodEnd: Date | null
  createdAt: Date; updatedAt: Date
}): SubscriptionDto {
  return {
    id: s.id,
    organizationId: s.organizationId,
    planVersionId: s.planVersionId,
    status: s.status as SubscriptionDto['status'],
    currentPeriodStart: String(s.currentPeriodStart),
    currentPeriodEnd: s.currentPeriodEnd ? String(s.currentPeriodEnd) : null,
    createdAt: String(s.createdAt),
    updatedAt: String(s.updatedAt),
  }
}

function formatInvoice(inv: {
  id: string; organizationId: string; subscriptionId: string
  periodStart: Date; periodEnd: Date | null; lineItems: string
  subtotal: number; discount: number; tax: number; total: number
  currency: string; status: string; issuedAt: Date; dueAt: Date | null; paidAt: Date | null
}): InvoiceDto {
  return {
    id: inv.id,
    organizationId: inv.organizationId,
    subscriptionId: inv.subscriptionId,
    periodStart: String(inv.periodStart),
    periodEnd: inv.periodEnd ? String(inv.periodEnd) : null,
    lineItems: inv.lineItems,
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax: inv.tax,
    total: inv.total,
    currency: inv.currency,
    status: inv.status,
    issuedAt: String(inv.issuedAt),
    dueAt: inv.dueAt ? String(inv.dueAt) : null,
    paidAt: inv.paidAt ? String(inv.paidAt) : null,
  }
}

// GET /api/billing/overview
export async function GET(request: Request) {
  return withErrorHandler(async () => {
    const userId = getUserIdFromRequest(request)
    const { searchParams } = new URL(request.url)
    const organizationId = getOrgIdParam(searchParams)
    if (!organizationId) throw new ValidationError('organizationId query parameter is required')

    await requireOrgMember(userId, organizationId)
    await requirePermission(userId, organizationId, [Permissions.BILLING_VIEW])

    const [subscription, invoices, trial] = await Promise.all([
      db.subscription.findFirst({
        where: { organizationId },
        include: { planVersion: { include: { plan: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.invoice.findMany({
        where: { organizationId },
        orderBy: { issuedAt: 'desc' },
        take: 5,
      }),
      db.trial.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const plan = subscription?.planVersion?.plan

    // Build usage summary from usage meters and records
    const meters = await db.usageMeter.findMany()
    const currentPeriod = subscription?.currentPeriodStart
      ? new Date(subscription.currentPeriodStart)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const usageRecords = await db.usageRecord.findMany({
      where: {
        organizationId,
        occurredAt: { gte: currentPeriod },
      },
    })

    // Aggregate usage by meter key
    const aggregated = new Map<string, number>()
    for (const record of usageRecords) {
      aggregated.set(record.meterKey, (aggregated.get(record.meterKey) ?? 0) + record.quantity)
    }

    // Get limits from plan version if available
    let limits: Record<string, number | null> = {}
    if (subscription?.planVersion) {
      limits = safeParse(subscription.planVersion.limits, {})
    }

    const usage: UsageSummary[] = meters.map((meter) => ({
      meterKey: meter.key,
      meterName: meter.name,
      unit: meter.unit,
      current: aggregated.get(meter.key) ?? 0,
      limit: limits[meter.key] ?? null,
      period: meter.period,
    }))

    const overview: BillingOverview = {
      subscription: subscription ? formatSubscription(subscription) : null,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            billingModel: plan.billingModel,
            currentVersion: subscription?.planVersion
              ? formatPlanVersion(subscription.planVersion)
              : null,
            createdAt: String(plan.createdAt),
            updatedAt: String(plan.updatedAt),
          }
        : null,
      invoices: invoices.map(formatInvoice),
      usage,
      trial: trial
        ? {
            status: trial.status,
            startsAt: String(trial.startsAt),
            endsAt: trial.endsAt ? String(trial.endsAt) : null,
            durationDays: trial.durationDays,
          }
        : null,
    }

    return success(overview)
  })
}
