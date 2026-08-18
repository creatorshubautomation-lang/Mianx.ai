'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  AlertCircle,
  Crown,
  Zap,
  ArrowUpRight,
  FileText,
  Calendar,
  TrendingUp,
  Infinity,
  Check,
  Sparkles,
  Receipt,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { useStore, useActiveOrg } from '@/lib/store'
import { cn } from '@/lib/utils'
import { parseJsonField, type BillingOverview, type InvoiceDto } from '@/lib/types'

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] },
  },
}

// ============================================================
// Configs
// ============================================================

const SUBSCRIPTION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  trialing:  { label: 'Trial',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  active:    { label: 'Active',     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  past_due:  { label: 'Past Due',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  canceled:  { label: 'Canceled',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  unpaid:    { label: 'Unpaid',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  open:      { label: 'Open',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  paid:      { label: 'Paid',      color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  void:      { label: 'Void',      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  uncollectible: { label: 'Uncollectible', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

// ============================================================
// Helpers
// ============================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function getUsageColor(current: number, limit: number | null): string {
  if (limit === null) return '#34d399'
  const pct = (current / limit) * 100
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#34d399'
}

function getUsageProgress(current: number, limit: number | null): number {
  if (limit === null) return 0
  return Math.min(Math.round((current / limit) * 100), 100)
}

function getDaysRemaining(endsAt: string | null): number | null {
  if (!endsAt) return null
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 0
  return Math.ceil(diff / 86400000)
}

function parseFeatures(featuresStr: string): string[] {
  return parseJsonField<string[]>(featuresStr, [])
}

// ============================================================
// Sub-Components
// ============================================================

function OverviewCard({
  overview,
  loading,
}: {
  overview: BillingOverview | null
  loading: boolean
}) {
  if (loading) {
    return (
      <motion.div variants={itemVariants} className="glass-strong rounded-xl p-6">
        <Skeleton className="h-6 w-48 mb-5" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </motion.div>
    )
  }

  const sub = overview?.subscription
  const plan = overview?.plan
  const trial = overview?.trial

  const subStatus = sub
    ? SUBSCRIPTION_STATUS_CONFIG[sub.status] ?? {
        label: sub.status,
        color: '#94a3b8',
        bg: 'rgba(148,163,184,0.12)',
      }
    : null

  const daysRemaining = trial?.endsAt ? getDaysRemaining(trial.endsAt) : null

  return (
    <motion.div variants={itemVariants} className="glass-strong rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ec4899] flex items-center justify-center">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-base font-semibold text-[#e2e8f0]">
          Current Plan
        </h2>
      </div>

      {plan && sub ? (
        <div className="space-y-4">
          {/* Plan Name + Status */}
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-[#e2e8f0]">{plan.name}</h3>
            {plan.currentVersion && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium border-[rgba(99,102,241,0.2)] text-[#a78bfa] bg-[rgba(99,102,241,0.06)]"
              >
                v{plan.currentVersion.version}
              </Badge>
            )}
            {subStatus && (
              <Badge
                variant="secondary"
                className="text-[10px] font-medium border-0"
                style={{ color: subStatus.color, backgroundColor: subStatus.bg }}
              >
                {subStatus.label}
              </Badge>
            )}
          </div>

          {plan.description && (
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              {plan.description}
            </p>
          )}

          {/* Trial Info */}
          {trial && (
            <div className="bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] rounded-lg p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                  <span className="text-sm font-medium text-[#f59e0b]">Trial Period</span>
                </div>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium border-0"
                    style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' }}
                  >
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-[#94a3b8]">
                <span>Status: <span className="text-[#f59e0b] capitalize">{trial.status}</span></span>
                <span>Duration: {trial.durationDays} days</span>
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-[#94a3b8]">
                <span>Start: {formatDate(trial.startsAt)}</span>
                {trial.endsAt && <span>End: {formatDate(trial.endsAt)}</span>}
              </div>
            </div>
          )}

          {/* Billing Period */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-[#64748b]" />
            <span className="text-[#94a3b8]">Current period:</span>
            <span className="text-[#e2e8f0] font-medium">
              {formatDate(sub.currentPeriodStart)}
            </span>
            <span className="text-[#64748b]">→</span>
            <span className="text-[#e2e8f0] font-medium">
              {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'Ongoing'}
            </span>
          </div>

          {/* Included Features */}
          {plan.currentVersion?.includedFeatures &&
            parseFeatures(plan.currentVersion.includedFeatures).length > 0 && (
              <div>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">
                  Included Features
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parseFeatures(plan.currentVersion.includedFeatures).map((f) => (
                    <Badge
                      key={f}
                      variant="outline"
                      className="text-[10px] font-normal border-[rgba(52,211,153,0.2)] text-[#34d399] bg-[rgba(52,211,153,0.06)] gap-1"
                    >
                      <Check className="w-2.5 h-2.5" />
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
            <h3 className="text-base font-medium text-[#e2e8f0]">
              No active subscription
            </h3>
          </div>
          <p className="text-sm text-[#94a3b8] leading-relaxed">
            You don&apos;t have an active plan yet. Start with a free trial to
            explore all features.
          </p>
        </div>
      )}
    </motion.div>
  )
}

function UsageCard({
  meter,
  index,
}: {
  meter: { meterKey: string; meterName: string; unit: string; current: number; limit: number | null; period: string }
  index: number
}) {
  const color = getUsageColor(meter.current, meter.limit)
  const progress = getUsageProgress(meter.current, meter.limit)
  const isUnlimited = meter.limit === null

  const icons = [Zap, Activity, TrendingUp, CreditCard]
  const Icon = icons[index % icons.length]

  return (
    <motion.div variants={itemVariants} className="glass-card p-5 rounded-xl">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        {isUnlimited ? (
          <Badge
            variant="outline"
            className="text-[9px] font-medium border-[rgba(99,102,241,0.15)] text-[#6366f1] bg-[rgba(99,102,241,0.06)] gap-1"
          >
            <Infinity className="w-3 h-3" />
            Unlimited
          </Badge>
        ) : (
          <span
            className="text-xs font-semibold"
            style={{ color }}
          >
            {progress}%
          </span>
        )}
      </div>

      <p className="text-xs text-[#94a3b8] mb-1">{meter.meterName}</p>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-xl font-bold text-[#e2e8f0]">
          {meter.current.toLocaleString()}
        </span>
        <span className="text-xs text-[#64748b]">
          / {isUnlimited ? '∞' : meter.limit?.toLocaleString()} {meter.unit}
        </span>
      </div>

      {!isUnlimited && (
        <div className="space-y-1.5">
          <Progress
            value={progress}
            className="h-1.5"
          />
          <p className="text-[10px] text-[#64748b]">
            {meter.limit !== null && meter.limit - meter.current > 0
              ? `${(meter.limit - meter.current).toLocaleString()} ${meter.unit} remaining this ${meter.period}`
              : `Limit reached`}
          </p>
        </div>
      )}
    </motion.div>
  )
}

function UsageSection({
  usage,
  loading,
}: {
  usage: NonNullable<BillingOverview['usage']>
  loading: boolean
}) {
  if (loading) {
    return (
      <motion.div variants={itemVariants}>
        <h2 className="text-base font-semibold text-[#e2e8f0] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#22d3ee]" />
          Usage
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </motion.div>
    )
  }

  if (usage.length === 0) {
    return (
      <motion.div variants={itemVariants}>
        <h2 className="text-base font-semibold text-[#e2e8f0] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#22d3ee]" />
          Usage
        </h2>
        <div className="glass-card p-6 rounded-xl text-center">
          <Activity className="w-8 h-8 text-[#6366f1] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[#94a3b8]">No usage data available yet.</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={itemVariants}>
      <h2 className="text-base font-semibold text-[#e2e8f0] mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#22d3ee]" />
        Usage
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {usage.map((meter, i) => (
          <UsageCard key={meter.meterKey} meter={meter} index={i} />
        ))}
      </div>
    </motion.div>
  )
}

function InvoicesTable({
  invoices,
  loading,
}: {
  invoices: InvoiceDto[]
  loading: boolean
}) {
  if (loading) {
    return (
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h2 className="text-base font-semibold text-[#e2e8f0] mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#a78bfa]" />
          Invoices
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={itemVariants} className="glass-card rounded-xl overflow-hidden">
      <div className="p-5 pb-3">
        <h2 className="text-base font-semibold text-[#e2e8f0] flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#a78bfa]" />
          Invoices
        </h2>
      </div>

      {invoices.length === 0 ? (
        <div className="p-6 text-center">
          <FileText className="w-8 h-8 text-[#6366f1] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[#94a3b8]">No invoices yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-[rgba(99,102,241,0.08)] hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Invoice</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Period</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Total</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Issued</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const statusCfg = INVOICE_STATUS_CONFIG[inv.status] ?? {
                    label: inv.status,
                    color: '#94a3b8',
                    bg: 'rgba(148,163,184,0.12)',
                  }
                  return (
                    <TableRow
                      key={inv.id}
                      className="border-[rgba(99,102,241,0.06)] hover:bg-[rgba(99,102,241,0.04)]"
                    >
                      <TableCell>
                        <span className="text-xs text-[#94a3b8] font-mono">
                          {inv.id.slice(0, 8)}…
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-[#94a3b8]">
                          {formatDate(inv.periodStart)}
                          {inv.periodEnd ? ` — ${formatDate(inv.periodEnd)}` : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-[#e2e8f0]">
                          {formatCurrency(inv.total, inv.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-medium border-0"
                          style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
                        >
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-[#64748b]">
                          {formatDate(inv.issuedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-[#64748b]">
                          {inv.paidAt ? formatDate(inv.paidAt) : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden p-4 space-y-3">
            {invoices.map((inv) => {
              const statusCfg = INVOICE_STATUS_CONFIG[inv.status] ?? {
                label: inv.status,
                color: '#94a3b8',
                bg: 'rgba(148,163,184,0.12)',
              }
              return (
                <div key={inv.id} className="glass-card p-3.5 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-[#94a3b8]">
                      {inv.id.slice(0, 8)}…
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium border-0"
                      style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
                    >
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#e2e8f0]">
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                    <span className="text-[10px] text-[#64748b]">
                      {formatDate(inv.issuedAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </motion.div>
  )
}

// ============================================================
// Main BillingView
// ============================================================

export default function BillingView() {
  const activeOrg = useActiveOrg()
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [invoices, setInvoices] = useState<InvoiceDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBilling = useCallback(async () => {
    if (!activeOrg?.id) return
    setLoading(true)
    setError(null)
    try {
      const [overviewRes, invoicesRes] = await Promise.all([
        fetch(`/api/billing/overview?organizationId=${activeOrg.id}`),
        fetch(`/api/billing/invoices?organizationId=${activeOrg.id}&limit=20`),
      ])

      if (overviewRes.ok) {
        const json = await overviewRes.json()
        setOverview(json.data ?? null)
      }

      if (invoicesRes.ok) {
        const json = await invoicesRes.json()
        setInvoices(json.data ?? [])
      }

      if (!overviewRes.ok && !invoicesRes.ok) {
        setError('Failed to load billing data')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    if (activeOrg?.id) fetchBilling()
  }, [activeOrg?.id, fetchBilling])

  const showUpgrade =
    !overview?.subscription ||
    overview.subscription.status === 'trialing' ||
    overview.subscription.status === 'past_due'

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Billing & Subscription</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <AlertCircle className="w-10 h-10 text-[#f59e0b] mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Sign in to view billing
          </p>
        </motion.div>
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Billing & Subscription</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <CreditCard className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Select an organization to view billing
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6 animate-fade-in"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold gradient-text">Billing & Subscription</h1>
        <Badge
          variant="outline"
          className="text-[10px] border-[rgba(99,102,241,0.2)] text-[#a78bfa] bg-[rgba(99,102,241,0.06)]"
        >
          <CreditCard className="w-3 h-3 mr-1" />
          Manage
        </Badge>
      </motion.div>

      {/* Error State */}
      {error && !loading && (
        <motion.div
          variants={itemVariants}
          className="glass-card p-8 rounded-xl text-center"
        >
          <AlertCircle className="w-10 h-10 text-[#ef4444] mx-auto mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#e2e8f0]">Failed to load billing data</p>
          <p className="text-xs text-[#94a3b8] mt-1">{error}</p>
          <Button
            variant="outline"
            className="mt-4 border-[rgba(99,102,241,0.15)] text-[#94a3b8] hover:text-[#e2e8f0]"
            onClick={fetchBilling}
          >
            Try Again
          </Button>
        </motion.div>
      )}

      {/* Overview */}
      <OverviewCard overview={overview} loading={loading} />

      {/* Upgrade CTA */}
      {showUpgrade && !loading && (
        <motion.div
          variants={itemVariants}
          className="glass-strong rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#a78bfa] flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#e2e8f0]">
                Upgrade Your Plan
              </h3>
              <p className="text-sm text-[#94a3b8] mt-0.5">
                Unlock advanced features, higher limits, and priority support.
              </p>
            </div>
          </div>
          <Button className="btn-gradient text-white flex-shrink-0">
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            Upgrade Plan
          </Button>
        </motion.div>
      )}

      {/* Usage */}
      <UsageSection
        usage={overview?.usage ?? []}
        loading={loading}
      />

      {/* Invoices */}
      <InvoicesTable invoices={invoices} loading={loading} />
    </motion.div>
  )
}