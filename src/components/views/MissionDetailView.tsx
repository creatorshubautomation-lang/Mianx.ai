'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Pause,
  Pencil,
  Trash2,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Target,
  ShieldCheck,
  ShieldX,
  FileText,
  Zap,
  Ban,
  RotateCcw,
  ChevronRight,
  LayoutGrid,
  List,
  GitBranch,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useStore, useUserMode } from '@/lib/store'
import { navigate } from '@/lib/router'
import type {
  MissionStatus,
  TaskStatus,
  OutcomeStatus,
  ApiResponseEnvelope,
  MissionDto,
  MissionTaskDto,
  OutcomeDto,
} from '@/lib/types'

// ============================================================
// Extended types for API responses with includes
// ============================================================

interface MissionAgentItem {
  id: string
  missionId: string
  agentId: string
  role: string
  capabilitiesUsed: string
  costIncurred: number
  createdAt: string
  agent: { id: string; name: string; slug: string }
}

interface MissionDetailResponse extends MissionDto {
  agents: MissionAgentItem[]
  _count: { tasks: number; outcomes: number; verifications: number }
}

interface TaskWithAgent extends MissionTaskDto {
  agent?: { id: string; name: string; slug: string } | null
  _count?: { children: number; verifications: number }
}

interface VerificationItem {
  id: string
  missionId: string
  missionTaskId: string | null
  type: string
  config: string
  result: string | null
  evidence: string
  passed: boolean | null
  verifiedAt: string | null
  createdAt: string
  task?: { id: string; title: string } | null
}

// ============================================================
// Constants
// ============================================================

const MISSION_STATUS_COLORS: Record<MissionStatus, { bg: string; text: string; dot: string }> = {
  draft:     { bg: 'bg-[rgba(148,163,184,0.15)]', text: 'text-[#94a3b8]', dot: 'bg-[#94a3b8]' },
  planning:  { bg: 'bg-[rgba(245,158,11,0.15)]',  text: 'text-[#f59e0b]',  dot: 'bg-[#f59e0b]' },
  approved:  { bg: 'bg-[rgba(167,139,250,0.15)]',  text: 'text-[#a78bfa]',  dot: 'bg-[#a78bfa]' },
  executing: { bg: 'bg-[rgba(34,211,238,0.15)]',   text: 'text-[#22d3ee]',  dot: 'bg-[#22d3ee]' },
  verifying: { bg: 'bg-[rgba(99,102,241,0.15)]',   text: 'text-[#6366f1]',  dot: 'bg-[#6366f1]' },
  completed: { bg: 'bg-[rgba(52,211,153,0.15)]',   text: 'text-[#34d399]',  dot: 'bg-[#34d399]' },
  failed:    { bg: 'bg-[rgba(239,68,68,0.15)]',    text: 'text-[#ef4444]',  dot: 'bg-[#ef4444]' },
  cancelled: { bg: 'bg-[rgba(100,116,139,0.15)]',  text: 'text-[#64748b]',  dot: 'bg-[#64748b]' },
}

const TASK_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  planned:         { bg: 'bg-[rgba(148,163,184,0.12)]', text: 'text-[#94a3b8]', dot: 'bg-[#94a3b8]' },
  queued:          { bg: 'bg-[rgba(99,102,241,0.12)]', text: 'text-[#818cf8]', dot: 'bg-[#818cf8]' },
  running:         { bg: 'bg-[rgba(34,211,238,0.12)]', text: 'text-[#22d3ee]', dot: 'bg-[#22d3ee]' },
  waiting_tool:    { bg: 'bg-[rgba(245,158,11,0.12)]', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  waiting_approval:{ bg: 'bg-[rgba(167,139,250,0.12)]', text: 'text-[#a78bfa]', dot: 'bg-[#a78bfa]' },
  verifying:       { bg: 'bg-[rgba(99,102,241,0.12)]', text: 'text-[#6366f1]', dot: 'bg-[#6366f1]' },
  retrying:        { bg: 'bg-[rgba(245,158,11,0.12)]', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  failed:          { bg: 'bg-[rgba(239,68,68,0.12)]',  text: 'text-[#ef4444]', dot: 'bg-[#ef4444]' },
  completed:       { bg: 'bg-[rgba(52,211,153,0.12)]',  text: 'text-[#34d399]', dot: 'bg-[#34d399]' },
  cancelled:       { bg: 'bg-[rgba(100,116,139,0.12)]', text: 'text-[#64748b]', dot: 'bg-[#64748b]' },
  blocked:         { bg: 'bg-[rgba(239,68,68,0.12)]',  text: 'text-[#ef4444]', dot: 'bg-[#ef4444]' },
}

const OUTCOME_STATUS_COLORS: Record<OutcomeStatus, { bg: string; text: string }> = {
  not_started: { bg: 'bg-[rgba(148,163,184,0.12)]', text: 'text-[#94a3b8]' },
  in_progress: { bg: 'bg-[rgba(34,211,238,0.12)]',   text: 'text-[#22d3ee]' },
  near_target: { bg: 'bg-[rgba(245,158,11,0.12)]',  text: 'text-[#f59e0b]' },
  achieved:    { bg: 'bg-[rgba(52,211,153,0.12)]',   text: 'text-[#34d399]' },
  missed:      { bg: 'bg-[rgba(239,68,68,0.12)]',    text: 'text-[#ef4444]' },
  failed:      { bg: 'bg-[rgba(239,68,68,0.12)]',    text: 'text-[#ef4444]' },
}

const KANBAN_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'planned', label: 'Planned' },
  { status: 'running', label: 'Running' },
  { status: 'completed', label: 'Completed' },
  { status: 'failed', label: 'Failed' },
]

const MODE_COLORS: Record<string, string> = {
  simple: 'bg-[rgba(52,211,153,0.12)] text-[#34d399] border-[rgba(52,211,153,0.2)]',
  pro:    'bg-[rgba(99,102,241,0.12)] text-[#818cf8] border-[rgba(99,102,241,0.2)]',
  expert: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border-[rgba(245,158,11,0.2)]',
}

// ============================================================
// Helpers
// ============================================================

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCost(amount: number): string {
  if (amount === 0) return '$0.00'
  return `$${amount.toFixed(2)}`
}

function formatVerificationType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

// ============================================================
// Edit Mission Dialog
// ============================================================

function EditMissionDialog({
  mission,
  open,
  onOpenChange,
  onSaved,
}: {
  mission: MissionDetailResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: MissionDetailResponse) => void
}) {
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const addToast = useStore((s) => s.addToast)

  useEffect(() => {
    if (mission && open) {
      setTitle(mission.title)
      setGoal(mission.goal)
      setBudget(mission.budget > 0 ? String(mission.budget) : '')
      setDeadline(mission.deadline ? mission.deadline.slice(0, 10) : '')
      setError('')
    }
  }, [mission, open])

  const handleSave = async () => {
    if (!mission) return
    if (!title.trim() || !goal.trim()) {
      setError('Title and goal are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/missions/${mission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          goal: goal.trim(),
          budget: budget ? parseFloat(budget) : 0,
          deadline: deadline || null,
        }),
      })
      const json: ApiResponseEnvelope<MissionDetailResponse> = await res.json()
      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'Failed to update')
        return
      }
      addToast({ title: 'Mission updated', variant: 'success' })
      onSaved(json.data)
      onOpenChange(false)
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-[rgba(99,102,241,0.18)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#e2e8f0]">Edit Mission</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-[#94a3b8] text-sm">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569]" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94a3b8] text-sm">Goal</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3}
              className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#94a3b8] text-sm">Budget ($)</Label>
              <Input type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)}
                className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#94a3b8] text-sm">Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569] [color-scheme:dark]" />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-[#ef4444] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}
              className="text-[#94a3b8] hover:text-[#e2e8f0]">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="btn-gradient text-white border-0">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Delete Confirm Dialog
// ============================================================

function DeleteConfirmDialog({
  mission,
  open,
  onOpenChange,
  onDeleted,
}: {
  mission: MissionDetailResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const removeMission = useStore((s) => s.removeMission)
  const addToast = useStore((s) => s.addToast)

  const handleDelete = async () => {
    if (!mission) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/missions/${mission.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        setError((json as { error?: { message?: string } })?.error?.message ?? 'Failed to delete')
        return
      }
      removeMission(mission.id)
      addToast({ title: 'Mission deleted', variant: 'success' })
      onDeleted()
      onOpenChange(false)
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-[rgba(239,68,68,0.2)] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#e2e8f0]">Delete Mission?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[#94a3b8]">
          This will permanently delete &ldquo;{mission?.title}&rdquo; and all its tasks, outcomes, and verifications. This action cannot be undone.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-xs text-[#ef4444] bg-[rgba(239,68,68,0.1)] rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}
            className="text-[#94a3b8] hover:text-[#e2e8f0]">Cancel</Button>
          <Button onClick={handleDelete} disabled={submitting}
            className="bg-[rgba(239,68,68,0.15)] text-[#ef4444] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.25)]">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Kanban Board Tab
// ============================================================

function BoardTab({ tasks }: { tasks: TaskWithAgent[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status)
        const colors = TASK_STATUS_COLORS[col.status] ?? TASK_STATUS_COLORS.planned
        return (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
              <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
                {col.label}
              </span>
              <span className="text-[10px] text-[#64748b] bg-[rgba(100,116,139,0.15)] rounded-full px-1.5 py-0.5">
                {colTasks.length}
              </span>
            </div>
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {colTasks.length === 0 && (
                    <div className="glass-card p-4 text-center">
                      <p className="text-[10px] text-[#475569]">No tasks</p>
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-3.5 space-y-2"
                    >
                      <p className="text-sm font-medium text-[#e2e8f0] leading-snug">{task.title}</p>
                      {task.description && (
                        <p className="text-[11px] text-[#64748b] line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        {task.agent ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback className="text-[8px] bg-[rgba(99,102,241,0.2)] text-[#a5b4fc]">
                                {task.agent.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] text-[#64748b] max-w-[80px] truncate">
                              {task.agent.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#475569]">Unassigned</span>
                        )}
                        {task.retryCount > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[rgba(245,158,11,0.3)] text-[#f59e0b] bg-transparent">
                            <RotateCcw className="w-2.5 h-2.5 mr-0.5" />{task.retryCount}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// List Tab
// ============================================================

function ListTab({ tasks }: { tasks: TaskWithAgent[] }) {
  return (
    <ScrollArea className="max-h-[480px]">
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {tasks.map((task, idx) => {
            const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.planned
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ delay: idx * 0.03 }}
                className="glass-card px-4 py-3 flex items-center gap-4"
              >
                <span className="text-xs text-[#475569] w-6 text-right font-mono">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e2e8f0] truncate">{task.title}</p>
                  {task.agent && (
                    <p className="text-[10px] text-[#64748b] mt-0.5">{task.agent.name}</p>
                  )}
                </div>
                <Badge variant="outline" className={cn('shrink-0 text-[10px] px-2 py-0.5 rounded-full border-0 font-medium', colors.bg, colors.text)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', colors.dot)} />
                  {task.status}
                </Badge>
                {task.retryCount > 0 && (
                  <span className="text-[10px] text-[#f59e0b] shrink-0">
                    <RotateCcw className="w-3 h-3 inline mr-0.5" />{task.retryCount}
                  </span>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
}

// ============================================================
// Timeline Tab
// ============================================================

function TimelineTab({ tasks }: { tasks: TaskWithAgent[] }) {
  const sorted = useMemo(() => [...tasks].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  ), [tasks])

  return (
    <ScrollArea className="max-h-[480px]">
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[rgba(99,102,241,0.15)]" />

        <div className="space-y-4">
          {sorted.map((task, idx) => {
            const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.planned
            const isCompleted = task.status === 'completed'
            const isFailed = task.status === 'failed'
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative flex gap-4"
              >
                {/* Dot on the line */}
                <div className={cn(
                  'absolute -left-6 top-1 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 z-10',
                  isCompleted
                    ? 'border-[#34d399] bg-[rgba(52,211,153,0.15)]'
                    : isFailed
                      ? 'border-[#ef4444] bg-[rgba(239,68,68,0.15)]'
                      : 'border-[rgba(99,102,241,0.3)] bg-[#0a0b14]',
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-[#34d399]" />
                  ) : isFailed ? (
                    <XCircle className="w-3 h-3 text-[#ef4444]" />
                  ) : (
                    <div className={cn('w-2 h-2 rounded-full', colors.dot)} />
                  )}
                </div>

                {/* Card */}
                <div className="glass-card p-3.5 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#e2e8f0]">{task.title}</p>
                      {task.description && (
                        <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px] px-2 py-0.5 rounded-full border-0 font-medium', colors.bg, colors.text)}>
                      {task.status}
                    </Badge>
                  </div>
                  {task.agent && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Bot className="w-3 h-3 text-[#64748b]" />
                      <span className="text-[10px] text-[#64748b]">{task.agent.name}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}

// ============================================================
// Main MissionDetailView
// ============================================================

export default function MissionDetailView() {
  const viewParams = useStore((s) => s.viewParams)
  const missionId = viewParams?.missionId
  const userMode = useUserMode()
  const addToast = useStore((s) => s.addToast)
  const updateMission = useStore((s) => s.updateMission)
  const removeMission = useStore((s) => s.removeMission)

  const [mission, setMission] = useState<MissionDetailResponse | null>(null)
  const [tasks, setTasks] = useState<TaskWithAgent[]>([])
  const [outcomes, setOutcomes] = useState<OutcomeDto[]>([])
  const [verifications, setVerifications] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    if (!missionId) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const [missionRes, tasksRes, outcomesRes, verifsRes] = await Promise.all([
        fetch(`/api/missions/${missionId}`),
        fetch(`/api/missions/${missionId}/tasks?limit=100`),
        fetch(`/api/outcomes?missionId=${missionId}&limit=50`),
        fetch(`/api/missions/${missionId}/verifications?limit=50`),
      ])

      const mJson: ApiResponseEnvelope<MissionDetailResponse> = await missionRes.json()
      if (!missionRes.ok || mJson.error) {
        setError(mJson.error?.message ?? 'Mission not found')
        setLoading(false)
        return
      }
      setMission(mJson.data)

      if (tasksRes.ok) {
        const tJson: ApiResponseEnvelope<TaskWithAgent[]> = await tasksRes.json()
        setTasks(tJson.data ?? [])
      }
      if (outcomesRes.ok) {
        const oJson: ApiResponseEnvelope<OutcomeDto[]> = await outcomesRes.json()
        setOutcomes(oJson.data ?? [])
      }
      if (verifsRes.ok) {
        const vJson: ApiResponseEnvelope<VerificationItem[]> = await verifsRes.json()
        setVerifications(vJson.data ?? [])
      }
    } catch {
      setError('Failed to load mission data')
    } finally {
      setLoading(false)
    }
  }, [missionId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Computed values ──
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'completed').length
  const runningTasks = tasks.filter((t) => t.status === 'running' || t.status === 'retrying').length
  const failedTasks = tasks.filter((t) => t.status === 'failed').length
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const statusColors = mission ? MISSION_STATUS_COLORS[mission.status] : MISSION_STATUS_COLORS.draft

  // ── Action handlers ──
  const handleExecute = async () => {
    if (!mission) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/missions/${mission.id}/execute`, { method: 'POST' })
      const json: ApiResponseEnvelope<MissionDetailResponse> = await res.json()
      if (!res.ok || json.error) {
        addToast({ title: 'Execution failed', description: json.error?.message ?? 'Unknown error', variant: 'destructive' })
        return
      }
      setMission(json.data)
      updateMission(mission.id, { status: json.data.status })
      addToast({ title: 'Mission executing', description: 'Tasks are now being processed', variant: 'success' })
      fetchAll()
    } catch {
      addToast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditSaved = (updated: MissionDetailResponse) => {
    setMission(updated)
    updateMission(updated.id, {
      title: updated.title,
      goal: updated.goal,
      budget: updated.budget,
      deadline: updated.deadline,
    })
  }

  const handleDeleted = () => {
    navigate('missions')
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32 rounded bg-[rgba(99,102,241,0.08)]" />
        </div>
        <Skeleton className="h-10 w-2/3 rounded-lg bg-[rgba(99,102,241,0.08)]" />
        <Skeleton className="h-4 w-full max-w-xl rounded bg-[rgba(99,102,241,0.06)]" />
        <Skeleton className="h-6 w-full max-w-md rounded-full bg-[rgba(99,102,241,0.08)]" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[rgba(99,102,241,0.06)]" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl bg-[rgba(99,102,241,0.06)]" />
      </div>
    )
  }

  // ── Error state ──
  if (error || !mission) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => navigate('missions')}
          className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Missions
        </button>
        <div className="glass-card p-8 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-[#ef4444] mb-3 opacity-70" />
          <p className="text-sm text-[#e2e8f0] font-medium">Failed to load mission</p>
          <p className="text-xs text-[#64748b] mt-1">{error || 'Mission not found'}</p>
          <Button variant="outline" onClick={fetchAll} className="mt-4 border-[rgba(99,102,241,0.2)] text-[#a5b4fc]">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back Button ── */}
      <button
        onClick={() => navigate('missions')}
        className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Missions
      </button>

      {/* ── Mission Header ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#e2e8f0] flex-1">{mission.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={cn('text-xs px-2.5 py-1 rounded-full border-0 font-medium', MODE_COLORS[mission.userMode] ?? MODE_COLORS.simple)}>
              <Zap className="w-3 h-3 mr-1" />{mission.userMode}
            </Badge>
            <Badge variant="outline" className={cn('text-xs px-2.5 py-1 rounded-full border-0 font-medium', statusColors.bg, statusColors.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', statusColors.dot)} />
              {mission.status}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-[#94a3b8] max-w-2xl leading-relaxed">{mission.goal}</p>
        <div className="flex items-center gap-4 text-xs text-[#64748b]">
          <span>Created {relativeTime(mission.createdAt)}</span>
          {mission.deadline && <span>· Deadline {formatDate(mission.deadline)}</span>}
        </div>
      </motion.div>

      <Separator className="bg-[rgba(99,102,241,0.08)]" />

      {/* ── Progress Section ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#e2e8f0]">Mission Progress</span>
          <span className="text-lg font-bold text-[#e2e8f0]">{progressPct}%</span>
        </div>
        <div className="h-2.5 bg-[rgba(99,102,241,0.08)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progressPct === 100
                ? 'linear-gradient(90deg, #34d399, #22d3ee)'
                : 'linear-gradient(90deg, #6366f1, #22d3ee)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Tasks', value: totalTasks, color: 'text-[#e2e8f0]', icon: FileText },
            { label: 'Completed', value: completedTasks, color: 'text-[#34d399]', icon: CheckCircle2 },
            { label: 'Running', value: runningTasks, color: 'text-[#22d3ee]', icon: Loader2 },
            { label: 'Failed', value: failedTasks, color: 'text-[#ef4444]', icon: XCircle },
          ].map((stat) => (
            <div key={stat.label} className="bg-[rgba(15,16,28,0.4)] rounded-lg p-3 text-center">
              <stat.icon className={cn('w-4 h-4 mx-auto mb-1', stat.color)} />
              <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Action Bar ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-2"
      >
        {mission.status === 'draft' && (
          <Button onClick={handleExecute} disabled={actionLoading} className="btn-gradient text-white border-0">
            {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Plan Mission
          </Button>
        )}
        {mission.status === 'approved' && (
          <Button onClick={handleExecute} disabled={actionLoading} className="btn-gradient text-white border-0">
            {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Start Execution
          </Button>
        )}
        {mission.status === 'executing' && (
          <Button variant="outline" disabled className="border-[rgba(34,211,238,0.3)] text-[#22d3ee]">
            <Pause className="w-4 h-4 mr-2" />Pause
          </Button>
        )}
        <Button variant="outline" onClick={() => setEditOpen(true)}
          className="border-[rgba(99,102,241,0.2)] text-[#a5b4fc] hover:bg-[rgba(99,102,241,0.08)]">
          <Pencil className="w-4 h-4 mr-2" />Edit Mission
        </Button>
        <Button variant="outline" onClick={() => setDeleteOpen(true)}
          className="border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)]">
          <Trash2 className="w-4 h-4 mr-2" />Delete
        </Button>
      </motion.div>

      {/* ── Task Graph (Tabs) ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Tabs defaultValue="board" className="space-y-4">
          <TabsList className="bg-[rgba(15,16,28,0.6)] border border-[rgba(99,102,241,0.12)]">
            <TabsTrigger value="board" className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#a5b4fc] text-[#64748b]">
              <LayoutGrid className="w-4 h-4 mr-1.5" />Board
            </TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#a5b4fc] text-[#64748b]">
              <List className="w-4 h-4 mr-1.5" />List
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#a5b4fc] text-[#64748b]">
              <GitBranch className="w-4 h-4 mr-1.5" />Timeline
            </TabsTrigger>
          </TabsList>
          <TabsContent value="board">
            {tasks.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <FileText className="w-8 h-8 text-[#6366f1] opacity-40 mx-auto mb-3" />
                <p className="text-sm text-[#64748b]">No tasks yet. Plan the mission to generate tasks.</p>
              </div>
            ) : (
              <BoardTab tasks={tasks} />
            )}
          </TabsContent>
          <TabsContent value="list">
            {tasks.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <List className="w-8 h-8 text-[#6366f1] opacity-40 mx-auto mb-3" />
                <p className="text-sm text-[#64748b]">No tasks yet.</p>
              </div>
            ) : (
              <ListTab tasks={tasks} />
            )}
          </TabsContent>
          <TabsContent value="timeline">
            {tasks.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <GitBranch className="w-8 h-8 text-[#6366f1] opacity-40 mx-auto mb-3" />
                <p className="text-sm text-[#64748b]">No tasks yet.</p>
              </div>
            ) : (
              <TimelineTab tasks={tasks} />
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ── Mission Agents ── */}
      {mission.agents && mission.agents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
          <h2 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#22d3ee]" />Mission Agents
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mission.agents.map((ma) => (
              <div key={ma.id} className="glass-card p-4 flex items-center gap-3">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className="text-xs bg-[rgba(34,211,238,0.15)] text-[#22d3ee]">
                    {ma.agent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e2e8f0] truncate">{ma.agent.name}</p>
                  <p className="text-[10px] text-[#64748b] capitalize">{ma.role}</p>
                </div>
                {ma.costIncurred > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-[#e2e8f0]">{formatCost(ma.costIncurred)}</p>
                    <p className="text-[10px] text-[#64748b]">cost</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Outcomes Section ── */}
      {outcomes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-3">
          <h2 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2">
            <Target className="w-4 h-4 text-[#34d399]" />Outcomes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outcomes.map((outcome) => {
              const oColors = OUTCOME_STATUS_COLORS[outcome.status] ?? OUTCOME_STATUS_COLORS.not_started
              return (
                <div key={outcome.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[#e2e8f0] leading-snug">{outcome.objective}</p>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px] px-2 py-0.5 rounded-full border-0 font-medium', oColors.bg, oColors.text)}>
                      {outcome.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#64748b]">Progress</span>
                      <span className="text-[10px] text-[#94a3b8] font-medium">{Math.round(outcome.progress * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-[rgba(99,102,241,0.08)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[#34d399]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(outcome.progress * 100)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748b]">
                    <span>Confidence: <span className="text-[#94a3b8] font-medium">{Math.round(outcome.confidence * 100)}%</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Verifications Section ── */}
      {verifications.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <h2 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#a78bfa]" />Verifications
          </h2>
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {verifications.map((v, idx) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="glass-card px-4 py-3 flex items-start gap-3"
                >
                  {v.passed === true ? (
                    <ShieldCheck className="w-4 h-4 text-[#34d399] shrink-0 mt-0.5" />
                  ) : v.passed === false ? (
                    <ShieldX className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#64748b] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[#e2e8f0]">
                        {formatVerificationType(v.type)}
                      </span>
                      <Badge variant="outline" className={cn(
                        'text-[9px] px-1.5 py-0 rounded-full border-0 font-medium',
                        v.passed === true
                          ? 'bg-[rgba(52,211,153,0.12)] text-[#34d399]'
                          : v.passed === false
                            ? 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'
                            : 'bg-[rgba(148,163,184,0.12)] text-[#94a3b8]',
                      )}>
                        {v.passed === true ? 'Passed' : v.passed === false ? 'Failed' : 'Pending'}
                      </Badge>
                    </div>
                    {v.task && (
                      <p className="text-[10px] text-[#64748b]">Task: {v.task.title}</p>
                    )}
                    {v.evidence && v.evidence !== '[]' && v.evidence !== '{}'
                      ? (
                        <p className="text-[10px] text-[#64748b] mt-0.5">
                          {truncate(v.evidence, 120)}
                        </p>
                      )
                      : null
                    }
                  </div>
                  <span className="text-[10px] text-[#475569] shrink-0">
                    {relativeTime(v.verifiedAt ?? v.createdAt)}
                  </span>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </motion.div>
      )}

      {/* ── Dialogs ── */}
      <EditMissionDialog mission={mission} open={editOpen} onOpenChange={setEditOpen} onSaved={handleEditSaved} />
      <DeleteConfirmDialog mission={mission} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={handleDeleted} />
    </div>
  )
}
