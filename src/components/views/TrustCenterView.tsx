'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  ShieldCheck,
  CheckCircle,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  FileText,
  ChevronDown,
  ChevronRight,
  Activity,
  BarChart3,
} from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useActiveOrg, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ============================================================
// Types (matching the /api/trust response shape)
// ============================================================

interface ExecutionItem {
  id: string
  workflowId: string
  workflowName: string
  status: string
  currentStep: string | null
  error: string | null
  stepCount: number
  approvalCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

interface VerificationItem {
  id: string
  missionId: string
  missionTitle: string
  taskId: string | null
  taskTitle: string | null
  type: string
  passed: boolean | null
  verifiedAt: string | null
  createdAt: string
}

interface ApprovalItem {
  id: string
  requestedAction: string
  riskLevel: string
  decision: string | null
  requestedBy: string | null
  approvedBy: string | null
  reason: string | null
  expiresAt: string | null
  createdAt: string
  decidedAt: string | null
}

interface AgentActionSummary {
  totalRuns: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalEstimatedCost: number
}

interface TrustData {
  recentExecutions: ExecutionItem[]
  recentVerifications: VerificationItem[]
  recentApprovals: ApprovalItem[]
  agentActionSummary: AgentActionSummary
}

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] },
  },
}

// ============================================================
// Helpers
// ============================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCost(cents: number): string {
  if (cents < 100) return `$${cents.toFixed(2)}`
  return `$${(cents / 100).toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getExecutionStatusBadge(status: string) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    running: { label: 'Running', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
    failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    queued: { label: 'Queued', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    cancelled: { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    paused: { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  pending: { label: 'Pending', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  succeeded: { label: 'Succeeded', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  error: { label: 'Error', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  timeout: { label: 'Timeout', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  partial_failure: { label: 'Partial', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approval_required: { label: 'Needs Approval', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  approval_timeout: { label: 'Approval Timeout', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  policy_violation: { label: 'Policy Violation', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  verification_failed: { label: 'Verification Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  budget_exceeded: { label: 'Budget Exceeded', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  rate_limited: { label: 'Rate Limited', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  transient_external_error: { label: 'Transient Error', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  permanent_external_error: { label: 'Ext. Error', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  ai_error: { label: 'AI Error', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  unknown: { label: 'Unknown', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  }
  const c = config[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <Badge variant="secondary" className="text-[10px] font-medium border-0" style={{ color: c.color, backgroundColor: c.bg }}>
      {c.label}
    </Badge>
  )
}

function getRiskBadge(level: string) {
  const config: Record<string, { label: string; color: string; bg: string; glow?: boolean }> = {
    low: { label: 'Low', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    high: { label: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.2)', glow: true },
  }
  const c = config[level] ?? config.medium
  return (
    <Badge
      variant="secondary"
      className="text-[10px] font-medium border-0"
      style={{
        color: c.color,
        backgroundColor: c.bg,
        boxShadow: c.glow ? '0 0 12px rgba(239,68,68,0.3)' : undefined,
      }}
    >
      {c.label}
    </Badge>
  )
}

function getDecisionBadge(decision: string | null) {
  if (!decision) {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium border-0" style={{ color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.12)' }}>
        Pending
      </Badge>
    )
  }
  if (decision === 'approved') {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium border-0" style={{ color: '#34d399', backgroundColor: 'rgba(52,211,153,0.12)' }}>
        Approved
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-medium border-0" style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)' }}>
      Rejected
    </Badge>
  )
}

function getVerificationTypeLabel(type: string): string {
  const map: Record<string, string> = {
    automated_test: 'Auto Test',
    manual_review: 'Manual',
    output_check: 'Output',
    constraint_check: 'Constraint',
    agent_result: 'Agent',
    task_result: 'Task',
    milestone: 'Milestone',
    final: 'Final',
    budget: 'Budget',
  }
  return map[type] ?? type
}

// ============================================================
// Sub-Components
// ============================================================

function StatsRow({ data, loading }: { data: TrustData | null; loading: boolean }) {
  const cards = [
    {
      icon: Bot,
      label: 'Total Executions',
      value: data?.agentActionSummary?.totalRuns ?? 0,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.12)',
    },
    {
      icon: ShieldCheck,
      label: 'Verifications Passed',
      value: data?.recentVerifications?.filter((v) => v.passed === true).length ?? 0,
      sub: `of ${data?.recentVerifications?.length ?? 0} recent`,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.12)',
    },
    {
      icon: CheckCircle,
      label: 'Approvals Decided',
      value: data?.recentApprovals?.filter((a) => a.decision !== null).length ?? 0,
      sub: `of ${data?.recentApprovals?.length ?? 0} recent`,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)',
    },
    {
      icon: DollarSign,
      label: 'Total AI Cost',
      value: formatCost(data?.agentActionSummary?.totalEstimatedCost ?? 0),
      sub: `${formatTokens(data?.agentActionSummary?.totalTokens ?? 0)} tokens`,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <motion.div
            key={card.label}
            variants={itemVariants}
            className="glass-card card-hover p-5 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.bg }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: card.color }} />
              </div>
              <span className="text-xs text-[#94a3b8] font-medium">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-[#e2e8f0]">{card.value}</p>
            {card.sub && <p className="text-[10px] text-[#64748b] mt-1">{card.sub}</p>}
          </motion.div>
        )
      })}
    </div>
  )
}

function ExecutionsTable({ executions, loading }: { executions: ExecutionItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <Skeleton className="h-5 w-48 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-[#6366f1]" />
        <h3 className="text-base font-semibold text-[#e2e8f0]">Recent Executions</h3>
      </div>
      {executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Bot className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">No executions yet</p>
          <p className="text-xs text-[#64748b] mt-1">Workflow runs will appear here.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(99,102,241,0.08)] hover:bg-transparent">
                <TableHead className="text-[11px] text-[#94a3b8] font-medium">Workflow</TableHead>
                <TableHead className="text-[11px] text-[#94a3b8] font-medium">Status</TableHead>
                <TableHead className="text-[11px] text-[#94a3b8] font-medium hidden md:table-cell">Steps</TableHead>
                <TableHead className="text-[11px] text-[#94a3b8] font-medium hidden lg:table-cell">Approvals</TableHead>
                <TableHead className="text-[11px] text-[#94a3b8] font-medium hidden xl:table-cell">Error</TableHead>
                <TableHead className="text-[11px] text-[#94a3b8] font-medium text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((exec) => {
                const duration =
                  exec.startedAt && exec.completedAt
                    ? `${Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)}s`
                    : exec.startedAt
                      ? 'Running…'
                      : '—'
                return (
                  <TableRow
                    key={exec.id}
                    className="border-b border-[rgba(99,102,241,0.05)] hover:bg-[rgba(99,102,241,0.04)]"
                  >
                    <TableCell className="text-sm text-[#e2e8f0] font-medium">{exec.workflowName}</TableCell>
                    <TableCell>{getExecutionStatusBadge(exec.status)}</TableCell>
                    <TableCell className="text-sm text-[#94a3b8] hidden md:table-cell">{exec.stepCount}</TableCell>
                    <TableCell className="text-sm text-[#94a3b8] hidden lg:table-cell">{exec.approvalCount}</TableCell>
                    <TableCell className="text-sm text-[#94a3b8] hidden xl:table-cell max-w-[160px] truncate">
                      {exec.error ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-[#64748b] text-right whitespace-nowrap">
                      {duration !== '—' ? `${duration} · ` : ''}{formatRelativeTime(exec.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  )
}

function VerificationList({ verifications, loading }: { verifications: VerificationItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <Skeleton className="h-5 w-48 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-5">
        <ShieldCheck className="w-4 h-4 text-[#34d399]" />
        <h3 className="text-base font-semibold text-[#e2e8f0]">Verification Results</h3>
      </div>
      {verifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <ShieldCheck className="w-10 h-10 text-[#34d399] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">No verifications yet</p>
          <p className="text-xs text-[#64748b] mt-1">Verification results will appear as missions progress.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {verifications.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[rgba(99,102,241,0.04)] transition-colors"
              >
                {v.passed === true ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#34d399] flex-shrink-0" />
                ) : v.passed === false ? (
                  <XCircle className="w-4.5 h-4.5 text-[#ef4444] flex-shrink-0" />
                ) : (
                  <Clock className="w-4.5 h-4.5 text-[#a78bfa] flex-shrink-0" />
                )}
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium border-0 flex-shrink-0"
                  style={{ color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.12)' }}
                >
                  {getVerificationTypeLabel(v.type)}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#e2e8f0] truncate">
                    {v.taskTitle ?? v.missionTitle}
                  </p>
                </div>
                <span className="text-[10px] text-[#64748b] whitespace-nowrap">
                  {formatRelativeTime(v.verifiedAt ?? v.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function ApprovalHistory({ approvals, loading }: { approvals: ApprovalItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <Skeleton className="h-5 w-40 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-4 h-4 text-[#a78bfa]" />
        <h3 className="text-base font-semibold text-[#e2e8f0]">Approval History</h3>
      </div>
      {approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <FileText className="w-10 h-10 text-[#a78bfa] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">No approvals yet</p>
          <p className="text-xs text-[#64748b] mt-1">Approval requests will be tracked here.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[rgba(99,102,241,0.04)] transition-colors"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {getRiskBadge(a.riskLevel)}
                  <p className="text-sm text-[#e2e8f0] truncate max-w-[320px]">
                    {a.requestedAction.length > 80
                      ? a.requestedAction.slice(0, 80) + '…'
                      : a.requestedAction}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getDecisionBadge(a.decision)}
                  <span className="text-[10px] text-[#64748b] whitespace-nowrap">
                    {formatRelativeTime(a.decidedAt ?? a.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function CostBreakdown({ data, loading }: { data: TrustData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <Skeleton className="h-5 w-40 mb-5" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const summary = data?.agentActionSummary
  if (!summary || summary.totalEstimatedCost === 0) {
    return null
  }

  const inputPct = summary.totalTokens > 0 ? Math.round((summary.totalInputTokens / summary.totalTokens) * 100) : 0
  const outputPct = 100 - inputPct

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-4 h-4 text-[#f59e0b]" />
        <h3 className="text-base font-semibold text-[#e2e8f0]">Cost Breakdown</h3>
      </div>
      <div className="mb-6">
        <p className="text-3xl font-bold text-[#e2e8f0]">{formatCost(summary.totalEstimatedCost)}</p>
        <p className="text-xs text-[#94a3b8] mt-1">Total estimated AI spend</p>
      </div>
      <Separator className="bg-[rgba(99,102,241,0.08)] mb-5" />
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-[#e2e8f0]">Input Tokens</span>
            <span className="text-xs text-[#94a3b8]">{formatTokens(summary.totalInputTokens)} ({inputPct}%)</span>
          </div>
          <div className="h-2 bg-[rgba(99,102,241,0.08)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#6366f1' }}
              initial={{ width: 0 }}
              animate={{ width: `${inputPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-[#e2e8f0]">Output Tokens</span>
            <span className="text-xs text-[#94a3b8]">{formatTokens(summary.totalOutputTokens)} ({outputPct}%)</span>
          </div>
          <div className="h-2 bg-[rgba(99,102,241,0.08)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#22d3ee' }}
              initial={{ width: 0 }}
              animate={{ width: `${outputPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-[#e2e8f0]">Total Tokens</span>
            <span className="text-xs text-[#94a3b8]">{formatTokens(summary.totalTokens)}</span>
          </div>
          <div className="h-2 bg-[rgba(99,102,241,0.08)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#a78bfa' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
    >
      <div className="w-16 h-16 rounded-2xl bg-[rgba(52,211,153,0.1)] flex items-center justify-center mb-4">
        <ShieldCheck className="w-8 h-8 text-[#34d399] opacity-60" />
      </div>
      <h3 className="text-lg font-semibold text-[#e2e8f0]">No Trust Data Yet</h3>
      <p className="text-sm text-[#94a3b8] mt-2 max-w-md text-center">
        Once your team runs missions, executes workflows, and verifies outcomes, all activity
        will be tracked transparently here.
      </p>
    </motion.div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function TrustCenterView() {
  const activeOrg = useActiveOrg()
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const [trustData, setTrustData] = useState<TrustData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const fetchTrustData = useCallback(async () => {
    if (!activeOrg?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/trust?organizationId=${activeOrg.id}`)
      if (res.ok) {
        const json = await res.json()
        setTrustData(json.data ?? null)
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    if (!activeOrg?.id) return
    fetchTrustData()
  }, [activeOrg?.id, fetchTrustData])

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Trust Center</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <AlertTriangle className="w-10 h-10 text-[#f59e0b] mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#94a3b8]">Sign in to access the Trust Center</p>
        </motion.div>
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Trust Center</h1>
        <EmptyState />
      </div>
    )
  }

  const hasData = trustData && (
    (trustData.recentExecutions?.length ?? 0) > 0 ||
    (trustData.recentVerifications?.length ?? 0) > 0 ||
    (trustData.recentApprovals?.length ?? 0) > 0 ||
    (trustData.agentActionSummary?.totalRuns ?? 0) > 0
  )

  return (
    <motion.div
      className="space-y-6 animate-fade-in"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold gradient-text">Trust Center</h1>
        <p className="text-sm text-[#94a3b8] mt-1.5 max-w-2xl">
          See exactly what Mianx did, which agents acted, and what was verified.
        </p>
      </motion.div>

      {/* Stats Row */}
      <StatsRow data={trustData} loading={loading} />

      {/* Tab Filters */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[rgba(15,16,28,0.6)] border border-[rgba(99,102,241,0.1)]">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-[rgba(99,102,241,0.15)] data-[state=active]:text-[#e2e8f0]">
              All
            </TabsTrigger>
            <TabsTrigger value="executions" className="text-xs data-[state=active]:bg-[rgba(99,102,241,0.15)] data-[state=active]:text-[#e2e8f0]">
              Executions
            </TabsTrigger>
            <TabsTrigger value="verifications" className="text-xs data-[state=active]:bg-[rgba(99,102,241,0.15)] data-[state=active]:text-[#e2e8f0]">
              Verifications
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs data-[state=active]:bg-[rgba(99,102,241,0.15)] data-[state=active]:text-[#e2e8f0]">
              Approvals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6 space-y-6">
            {!hasData && !loading ? (
              <EmptyState />
            ) : (
              <>
                <ExecutionsTable executions={trustData?.recentExecutions ?? []} loading={loading} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <VerificationList verifications={trustData?.recentVerifications ?? []} loading={loading} />
                  <ApprovalHistory approvals={trustData?.recentApprovals ?? []} loading={loading} />
                </div>
                <CostBreakdown data={trustData} loading={loading} />
              </>
            )}
          </TabsContent>

          <TabsContent value="executions" className="mt-6">
            <ExecutionsTable executions={trustData?.recentExecutions ?? []} loading={loading} />
          </TabsContent>

          <TabsContent value="verifications" className="mt-6">
            <VerificationList verifications={trustData?.recentVerifications ?? []} loading={loading} />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            <ApprovalHistory approvals={trustData?.recentApprovals ?? []} loading={loading} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
