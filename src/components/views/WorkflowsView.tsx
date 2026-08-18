'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Workflow,
  Plus,
  Pencil,
  Trash2,
  Play,
  Clock,
  AlertCircle,
  Zap,
  Webhook,
  CalendarClock,
  Globe,
  History,
  Timer,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStore, useActiveOrg } from '@/lib/store'
import { cn } from '@/lib/utils'
import { parseJsonField, slugify, type WorkflowDto, type WorkflowRunDto } from '@/lib/types'
import { toast } from '@/hooks/use-toast'

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  active:    { label: 'Active',    color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  paused:    { label: 'Paused',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  deprecated:{ label: 'Deprecated',color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  archived:  { label: 'Archived',  color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Loader2 }> = {
  queued:     { label: 'Queued',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Clock },
  running:    { label: 'Running',   color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  icon: Loader2 },
  completed:  { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: CheckCircle2 },
  failed:     { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle },
  cancelled:  { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: XCircle },
}

const TRIGGER_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  manual:   { label: 'Manual',   icon: Zap,           color: '#6366f1' },
  event:    { label: 'Event',    icon: Webhook,       color: '#a78bfa' },
  schedule: { label: 'Schedule', icon: CalendarClock, color: '#f59e0b' },
  api:      { label: 'API',      icon: Globe,         color: '#22d3ee' },
  webhook:  { label: 'Webhook',  icon: Webhook,       color: '#34d399' },
}

const TRIGGER_TYPES = ['manual', 'event', 'schedule', 'api', 'webhook'] as const

// ============================================================
// Helpers
// ============================================================

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
  }
  return (
    <Badge
      variant="secondary"
      className="text-[10px] font-medium border-0"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </Badge>
  )
}

function getRunStatusBadge(status: string) {
  const config = RUN_STATUS_CONFIG[status] ?? {
    label: status,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    icon: Clock,
  }
  const Icon = config.icon
  return (
    <Badge
      variant="secondary"
      className="text-[10px] font-medium border-0 gap-1"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {status === 'running' && <Icon className="w-3 h-3 animate-spin" />}
      {config.label}
    </Badge>
  )
}

function getTriggerBadge(triggerType: string) {
  const config = TRIGGER_CONFIG[triggerType] ?? {
    label: triggerType,
    icon: Zap,
    color: '#94a3b8',
  }
  const Icon = config.icon
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-medium gap-1"
      style={{
        color: config.color,
        borderColor: `${config.color}30`,
        backgroundColor: `${config.color}10`,
      }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStepCount(definition: string): number {
  const parsed = parseJsonField<Record<string, unknown>>(definition, {})
  const steps = parsed?.steps as unknown[] | undefined
  if (Array.isArray(steps)) return steps.length
  return 0
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const diffMs = end - start
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  const remainingSec = diffSec % 60
  if (diffMin < 60) return `${diffMin}m ${remainingSec}s`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ${diffMin % 60}m`
}

const WORKFLOW_DEFINITION_PLACEHOLDER = `{
  "steps": [
    {
      "id": "step_1",
      "name": "Gather Data",
      "agentId": "agent_xxx",
      "type": "task"
    },
    {
      "id": "step_2",
      "name": "Process Results",
      "agentId": "agent_yyy",
      "type": "task",
      "dependsOn": ["step_1"]
    }
  ]
}`

// ============================================================
// Sub-Components
// ============================================================

function CreateWorkflowDialog({
  open,
  onOpenChange,
  onCreated,
  orgId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  orgId: string
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [definition, setDefinition] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleNameChange = (val: string) => {
    setName(val)
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(val))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) return
    setSubmitting(true)
    try {
      let parsedDef: Record<string, unknown> = {}
      if (definition.trim()) {
        try {
          parsedDef = JSON.parse(definition)
        } catch {
          toast({
            title: 'Invalid JSON',
            description: 'Please check your workflow definition JSON.',
            variant: 'destructive',
          })
          setSubmitting(false)
          return
        }
      }

      const res = await fetch(`/api/workflows?organizationId=${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          triggerType,
          definition: Object.keys(parsedDef).length > 0 ? parsedDef : undefined,
        }),
      })
      if (res.ok) {
        toast({ title: 'Workflow created', description: `${name} has been created.` })
        setName('')
        setSlug('')
        setTriggerType('manual')
        setDefinition('')
        onOpenChange(false)
        onCreated()
      } else {
        const json = await res.json().catch(() => ({}))
        toast({
          title: 'Failed to create workflow',
          description: json?.error?.message ?? 'An error occurred.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-[rgba(99,102,241,0.18)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#e2e8f0]">Create Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Name</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Daily Report Generator"
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="daily-report-generator"
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Trigger Type</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong border-[rgba(99,102,241,0.18)]">
                {TRIGGER_TYPES.map((t) => {
                  const cfg = TRIGGER_CONFIG[t]
                  return (
                    <SelectItem
                      key={t}
                      value={t}
                      className="text-[#e2e8f0] focus:bg-[rgba(99,102,241,0.12)] focus:text-white"
                    >
                      {cfg.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Definition (JSON)</Label>
            <Textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={WORKFLOW_DEFINITION_PLACEHOLDER}
              rows={8}
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b] font-mono text-xs resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              className="border-[rgba(99,102,241,0.15)] text-[#94a3b8] hover:text-[#e2e8f0]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="btn-gradient text-white"
              onClick={handleSubmit}
              disabled={!name.trim() || !slug.trim() || submitting}
            >
              {submitting ? 'Creating...' : 'Create Workflow'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowRunsDialog({
  workflow,
  open,
  onOpenChange,
  runs,
  loading,
}: {
  workflow: WorkflowDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  runs: WorkflowRunDto[]
  loading: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-[rgba(99,102,241,0.18)] max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-[#e2e8f0] flex items-center gap-2">
            <History className="w-5 h-5 text-[#a78bfa]" />
            Recent Runs — {workflow?.name ?? 'Workflow'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Timer className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
            <p className="text-sm font-medium text-[#94a3b8]">No runs yet</p>
            <p className="text-xs text-[#64748b] mt-1">
              Trigger this workflow to see run history.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh] mt-2">
            <div className="space-y-2 pr-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="glass-card p-3.5 rounded-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {getRunStatusBadge(run.status)}
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[#64748b] truncate">
                          {run.id.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-[#94a3b8] flex-shrink-0">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(run.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {formatDuration(run.startedAt, run.completedAt)}
                      </span>
                    </div>
                  </div>
                  {run.error && (
                    <p className="text-[11px] text-[#ef4444] mt-2 bg-[rgba(239,68,68,0.06)] rounded px-2.5 py-1.5 font-mono truncate">
                      {run.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Main WorkflowsView
// ============================================================

export default function WorkflowsView() {
  const activeOrg = useActiveOrg()
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  const [workflows, setWorkflows] = useState<WorkflowDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [runsWorkflow, setRunsWorkflow] = useState<WorkflowDto | null>(null)
  const [runsOpen, setRunsOpen] = useState(false)
  const [runsData, setRunsData] = useState<WorkflowRunDto[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  const fetchWorkflows = useCallback(async () => {
    if (!activeOrg?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/workflows?organizationId=${activeOrg.id}&limit=50`
      )
      if (res.ok) {
        const json = await res.json()
        setWorkflows(json.data ?? [])
      } else {
        setError('Failed to load workflows')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    if (activeOrg?.id) fetchWorkflows()
  }, [activeOrg?.id, fetchWorkflows])

  const handleRun = async (wf: WorkflowDto) => {
    setRunningIds((prev) => new Set(prev).add(wf.id))
    try {
      const res = await fetch(`/api/workflows/${wf.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast({
          title: 'Workflow triggered',
          description: `${wf.name} has been queued for execution.`,
        })
      } else {
        toast({
          title: 'Failed to trigger workflow',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' })
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(wf.id)
        return next
      })
    }
  }

  const handleViewRuns = async (wf: WorkflowDto) => {
    setRunsWorkflow(wf)
    setRunsData([])
    setRunsLoading(true)
    setRunsOpen(true)
    try {
      const res = await fetch(`/api/workflows/${wf.id}/runs?limit=20`)
      if (res.ok) {
        const json = await res.json()
        setRunsData(json.data ?? [])
      }
    } catch {
      setRunsData([])
    } finally {
      setRunsLoading(false)
    }
  }

  const handleDelete = async (wf: WorkflowDto) => {
    try {
      const res = await fetch(
        `/api/workflows/${wf.id}?organizationId=${activeOrg!.id}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast({ title: 'Workflow deleted', description: `${wf.name} has been removed.` })
        fetchWorkflows()
      } else {
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' })
    }
  }

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Workflows</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <AlertCircle className="w-10 h-10 text-[#f59e0b] mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Sign in to manage workflows
          </p>
        </motion.div>
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Workflows</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <Workflow className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Select an organization to manage workflows
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <motion.div
        className="space-y-6 animate-fade-in"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between"
        >
          <h1 className="text-2xl font-bold gradient-text">Workflows</h1>
          <Button
            className="btn-gradient text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Workflow
          </Button>
        </motion.div>

        {/* Table */}
        {loading ? (
          <motion.div className="glass-card rounded-xl p-6" variants={itemVariants}>
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-8 rounded-xl text-center"
          >
            <AlertCircle className="w-10 h-10 text-[#ef4444] mx-auto mb-3 opacity-60" />
            <p className="text-sm font-medium text-[#e2e8f0]">Failed to load workflows</p>
            <p className="text-xs text-[#94a3b8] mt-1">{error}</p>
            <Button
              variant="outline"
              className="mt-4 border-[rgba(99,102,241,0.15)] text-[#94a3b8] hover:text-[#e2e8f0]"
              onClick={fetchWorkflows}
            >
              Try Again
            </Button>
          </motion.div>
        ) : workflows.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[35vh]"
          >
            <Workflow className="w-12 h-12 text-[#6366f1] mb-3 opacity-40" />
            <h3 className="text-base font-semibold text-[#e2e8f0]">
              No workflows yet
            </h3>
            <p className="text-sm text-[#94a3b8] mt-1.5 max-w-md text-center">
              Create your first workflow to orchestrate multi-step automations
              and connect your agents.
            </p>
            <Button
              className="btn-gradient mt-5 text-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Workflow
            </Button>
          </motion.div>
        ) : (
          <motion.div
            className="glass-card rounded-xl overflow-hidden"
            variants={itemVariants}
          >
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-[rgba(99,102,241,0.08)] hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Name</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Trigger</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Steps</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b]">Created</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-[#64748b] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((wf) => {
                    const steps = getStepCount(wf.definition)
                    const isRunning = runningIds.has(wf.id)
                    return (
                      <TableRow
                        key={wf.id}
                        className="border-[rgba(99,102,241,0.06)] hover:bg-[rgba(99,102,241,0.04)] group"
                      >
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-[#e2e8f0] group-hover:text-white transition-colors">
                              {wf.name}
                            </p>
                            <p className="text-[10px] text-[#64748b] font-mono mt-0.5">
                              {wf.slug}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(wf.status)}</TableCell>
                        <TableCell>{getTriggerBadge(wf.triggerType)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-[#94a3b8]">
                            {steps > 0 ? `${steps} step${steps !== 1 ? 's' : ''}` : '—'}
                            </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-[#64748b]">
                            {formatDate(wf.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#94a3b8] hover:text-[#22d3ee] hover:bg-[rgba(34,211,238,0.08)]"
                              onClick={() => handleViewRuns(wf)}
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-7 w-7 p-0',
                                isRunning
                                  ? 'text-[#22d3ee] animate-pulse'
                                  : 'text-[#94a3b8] hover:text-[#34d399] hover:bg-[rgba(52,211,153,0.08)]'
                              )}
                              onClick={() => handleRun(wf)}
                              disabled={isRunning}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)]"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)]"
                              onClick={() => handleDelete(wf)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {workflows.map((wf) => {
                const steps = getStepCount(wf.definition)
                const isRunning = runningIds.has(wf.id)
                return (
                  <div
                    key={wf.id}
                    className="glass-card p-4 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-[#e2e8f0]">
                          {wf.name}
                        </p>
                        <p className="text-[10px] text-[#64748b] font-mono mt-0.5">
                          {wf.slug}
                        </p>
                      </div>
                      {getStatusBadge(wf.status)}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {getTriggerBadge(wf.triggerType)}
                      <span className="text-[10px] text-[#64748b]">
                        {steps > 0 ? `${steps} steps` : 'No steps'}
                      </span>
                      <span className="text-[10px] text-[#64748b]">
                        {formatDate(wf.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-[rgba(99,102,241,0.08)]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#94a3b8] hover:text-[#22d3ee]"
                        onClick={() => handleViewRuns(wf)}
                      >
                        <History className="w-3 h-3 mr-1" />
                        Runs
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#94a3b8] hover:text-[#34d399]"
                        onClick={() => handleRun(wf)}
                        disabled={isRunning}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {isRunning ? 'Running...' : 'Run'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#94a3b8] hover:text-[#e2e8f0]"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#94a3b8] hover:text-[#ef4444]"
                        onClick={() => handleDelete(wf)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Create Dialog */}
      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchWorkflows}
        orgId={activeOrg.id}
      />

      {/* Runs Dialog */}
      <WorkflowRunsDialog
        workflow={runsWorkflow}
        open={runsOpen}
        onOpenChange={setRunsOpen}
        runs={runsData}
        loading={runsLoading}
      />
    </>
  )
}
