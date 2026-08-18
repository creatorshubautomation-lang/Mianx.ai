'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Target,
  Bot,
  DollarSign,
  Clock,
  Rocket,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { cn } from '@/lib/utils'
import { useStore, useActiveOrg, useUserMode, useMissions, useUser } from '@/lib/store'
import { navigate } from '@/lib/router'
import type { MissionStatus, ApiResponseEnvelope } from '@/lib/types'

// ============================================================
// Types for API response with extra fields from include
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

interface MissionListItem {
  id: string
  organizationId: string
  userId: string | null
  title: string
  goal: string
  objective: string | null
  constraints: string
  budget: number
  estimatedCost: number
  actualCost: number
  deadline: string | null
  successCriteria: string
  plan: string
  status: MissionStatus
  userMode: 'simple' | 'pro' | 'expert'
  correlationId: string | null
  createdAt: string
  updatedAt: string
  agents: MissionAgentItem[]
  _count: { tasks: number; outcomes: number; verifications: number }
  _completedTasks: number
}

// ============================================================
// Constants
// ============================================================

const FILTER_OPTIONS: { label: string; value: MissionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Planning', value: 'planning' },
  { label: 'Executing', value: 'executing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
]

const STATUS_COLORS: Record<MissionStatus, { bg: string; text: string; dot: string }> = {
  draft:     { bg: 'bg-[rgba(148,163,184,0.15)]', text: 'text-[#94a3b8]', dot: 'bg-[#94a3b8]' },
  planning:  { bg: 'bg-[rgba(245,158,11,0.15)]', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  approved:  { bg: 'bg-[rgba(167,139,250,0.15)]', text: 'text-[#a78bfa]', dot: 'bg-[#a78bfa]' },
  executing: { bg: 'bg-[rgba(34,211,238,0.15)]', text: 'text-[#22d3ee]', dot: 'bg-[#22d3ee]' },
  verifying: { bg: 'bg-[rgba(99,102,241,0.15)]', text: 'text-[#6366f1]', dot: 'bg-[#6366f1]' },
  completed: { bg: 'bg-[rgba(52,211,153,0.15)]', text: 'text-[#34d399]', dot: 'bg-[#34d399]' },
  failed:    { bg: 'bg-[rgba(239,68,68,0.15)]', text: 'text-[#ef4444]', dot: 'bg-[#ef4444]' },
  cancelled: { bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-[#64748b]', dot: 'bg-[#64748b]' },
}

const PROGRESS_COLORS: Record<string, string> = {
  draft: '#64748b',
  planning: '#f59e0b',
  approved: '#a78bfa',
  executing: '#22d3ee',
  verifying: '#6366f1',
  completed: '#34d399',
  failed: '#ef4444',
  cancelled: '#64748b',
}

// ============================================================
// Helpers
// ============================================================

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function formatCost(amount: number): string {
  if (amount === 0) return '$0'
  if (amount < 0.01) return '<$0.01'
  return `$${amount.toFixed(2)}`
}

// ============================================================
// Mission Card Component
// ============================================================

function MissionCard({
  mission,
  onClick,
}: {
  mission: MissionListItem
  onClick: () => void
}) {
  const totalTasks = mission._count?.tasks ?? 0
  const completedTasks = mission._completedTasks ?? 0
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const agentCount = mission.agents?.length ?? 0
  const colors = STATUS_COLORS[mission.status] ?? STATUS_COLORS.draft
  const progressColor = PROGRESS_COLORS[mission.status] ?? '#64748b'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="glass-card card-hover p-5 cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-label={`View mission: ${mission.title}`}
    >
      {/* Header: title + status badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-[#e2e8f0] text-sm leading-snug line-clamp-1 group-hover:text-white transition-colors">
          {mission.title}
        </h3>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px] px-2 py-0.5 rounded-full border-0 font-medium',
            colors.bg,
            colors.text,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', colors.dot)} />
          {mission.status}
        </Badge>
      </div>

      {/* Goal (truncated 2 lines) */}
      <p className="text-xs text-[#94a3b8] line-clamp-2 mb-4 leading-relaxed">
        {mission.goal}
      </p>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[#64748b] uppercase tracking-wider font-medium">
              Progress
            </span>
            <span className="text-[10px] text-[#94a3b8] font-medium">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          <div className="h-1.5 bg-[rgba(99,102,241,0.08)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: progressColor }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            />
          </div>
        </div>
      )}

      {/* Footer: agents, cost, date */}
      <div className="flex items-center gap-4 text-[11px] text-[#64748b]">
        {agentCount > 0 && (
          <div className="flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" />
            <span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        {mission.budget > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>{formatCost(mission.actualCost)}/{formatCost(mission.budget)}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          <span>{relativeTime(mission.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================
// Skeleton Loader
// ============================================================

function MissionCardSkeleton() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Skeleton className="h-4 w-3/5 rounded bg-[rgba(99,102,241,0.08)]" />
        <Skeleton className="h-5 w-16 rounded-full bg-[rgba(99,102,241,0.08)]" />
      </div>
      <Skeleton className="h-3 w-full rounded bg-[rgba(99,102,241,0.06)] mb-2" />
      <Skeleton className="h-3 w-4/5 rounded bg-[rgba(99,102,241,0.06)] mb-4" />
      <Skeleton className="h-1.5 w-full rounded-full bg-[rgba(99,102,241,0.08)] mb-4" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-16 rounded bg-[rgba(99,102,241,0.06)]" />
        <Skeleton className="h-3 w-20 rounded bg-[rgba(99,102,241,0.06)]" />
        <Skeleton className="h-3 w-14 rounded bg-[rgba(99,102,241,0.06)] ml-auto" />
      </div>
    </div>
  )
}

// ============================================================
// Create Mission Dialog
// ============================================================

function CreateMissionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (mission: MissionListItem) => void
}) {
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const activeOrg = useActiveOrg()
  const addMission = useStore((s) => s.addMission)
  const addToast = useStore((s) => s.addToast)

  const resetForm = useCallback(() => {
    setTitle('')
    setGoal('')
    setBudget('')
    setDeadline('')
    setError('')
  }, [])

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!goal.trim()) {
      setError('Goal is required')
      return
    }
    if (!activeOrg?.id) {
      setError('No organization selected')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(
        `/api/missions?organizationId=${activeOrg.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            goal: goal.trim(),
            budget: budget ? parseFloat(budget) : undefined,
            deadline: deadline || undefined,
          }),
        },
      )

      const json: ApiResponseEnvelope<MissionListItem> = await res.json()

      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'Failed to create mission')
        return
      }

      const createdMission = json.data
      addMission(createdMission as never)
      addToast({ title: 'Mission created', description: createdMission.title, variant: 'success' })
      onCreated(createdMission)
      resetForm()
      onOpenChange(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="glass-strong border-[rgba(99,102,241,0.18)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#e2e8f0]">Create New Mission</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="mission-title" className="text-[#94a3b8] text-sm">Title</Label>
            <Input
              id="mission-title"
              placeholder="e.g., Deploy v2.0 to production"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569] focus-visible:ring-[#6366f1]/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mission-goal" className="text-[#94a3b8] text-sm">
              Goal <span className="text-[#ef4444]">*</span>
            </Label>
            <Textarea
              id="mission-goal"
              placeholder="Describe the mission goal..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569] focus-visible:ring-[#6366f1]/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mission-budget" className="text-[#94a3b8] text-sm">Budget ($)</Label>
              <Input
                id="mission-budget"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569] focus-visible:ring-[#6366f1]/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mission-deadline" className="text-[#94a3b8] text-sm">Deadline</Label>
              <Input
                id="mission-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#475569] focus-visible:ring-[#6366f1]/50 [color-scheme:dark]"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs text-[#ef4444] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => { resetForm(); onOpenChange(false) }}
              className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-gradient text-white border-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Create Mission
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Empty State
// ============================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-card p-12 flex flex-col items-center justify-center text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.12)] flex items-center justify-center mb-6">
        <Target className="w-10 h-10 text-[#6366f1] opacity-60" />
      </div>
      <h3 className="text-lg font-semibold text-[#e2e8f0] mb-2">No missions yet</h3>
      <p className="text-sm text-[#64748b] max-w-sm mb-6">
        Create your first mission to start delegating tasks to your AI agent workforce.
        Missions orchestrate complex multi-step objectives.
      </p>
      <Button
        onClick={onCreateClick}
        className="btn-gradient text-white border-0"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create First Mission
      </Button>
    </motion.div>
  )
}

// ============================================================
// Main Missions View
// ============================================================

export default function MissionsView() {
  const activeOrg = useActiveOrg()
  const setMissions = useStore((s) => s.setMissions)
  const setActiveMissionId = useStore((s) => s.setActiveMissionId)
  const storeMissions = useMissions()
  const user = useUser()
  const userMode = useUserMode()

  const [missions, setLocalMissions] = useState<MissionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [activeFilter, setActiveFilter] = useState<MissionStatus | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Fetch missions from API
  const fetchMissions = useCallback(async () => {
    if (!activeOrg?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setFetchError('')

    try {
      const params = new URLSearchParams({ organizationId: activeOrg.id })
      const res = await fetch(`/api/missions?${params}`)
      const json: ApiResponseEnvelope<MissionListItem[]> = await res.json()

      if (!res.ok || json.error) {
        setFetchError(json.error?.message ?? 'Failed to load missions')
        return
      }

      const items = json.data ?? []
      setLocalMissions(items)
      // Sync to store (stripped of extra fields)
      setMissions(
        items.map((m) => ({
          id: m.id,
          organizationId: m.organizationId,
          userId: m.userId,
          title: m.title,
          goal: m.goal,
          objective: m.objective,
          constraints: m.constraints,
          budget: m.budget,
          estimatedCost: m.estimatedCost,
          actualCost: m.actualCost,
          deadline: m.deadline,
          successCriteria: m.successCriteria,
          plan: m.plan,
          status: m.status,
          userMode: m.userMode,
          correlationId: m.correlationId,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })) as never,
      )
    } catch {
      setFetchError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id, setMissions])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  // Filter missions by status
  const filteredMissions =
    activeFilter === 'all'
      ? missions
      : missions.filter((m) => m.status === activeFilter)

  // Handle card click — navigate to detail
  const handleCardClick = (mission: MissionListItem) => {
    setActiveMissionId(mission.id)
    navigate('mission-detail', { missionId: mission.id })
  }

  // Handle mission created — refresh list
  const handleMissionCreated = (mission: MissionListItem) => {
    setLocalMissions((prev) => [mission, ...prev])
    fetchMissions()
  }

  // Count by status for filter badges
  const statusCounts = missions.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Missions</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Orchestrate complex objectives with your AI workforce
          </p>
        </div>
        <CreateMissionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={handleMissionCreated}
        />
        <Button
          onClick={() => setDialogOpen(true)}
          className="btn-gradient text-white border-0 sm:hidden"
          size="sm"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* ── Filter Chips ── */}
      {!loading && !fetchError && missions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilter === filter.value
            const count = filter.value === 'all'
              ? missions.length
              : statusCounts[filter.value] ?? 0

            return (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50',
                  isActive
                    ? 'bg-[rgba(99,102,241,0.2)] text-[#a5b4fc] border border-[rgba(99,102,241,0.3)] shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                    : 'bg-[rgba(15,16,28,0.4)] text-[#64748b] border border-transparent hover:text-[#94a3b8] hover:border-[rgba(99,102,241,0.1)]',
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    'text-[10px] min-w-[18px] text-center rounded-full px-1.5 py-0.5',
                    isActive
                      ? 'bg-[rgba(99,102,241,0.25)] text-[#c7d2fe]'
                      : 'bg-[rgba(100,116,139,0.15)] text-[#64748b]',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MissionCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && fetchError && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 flex flex-col items-center text-center"
        >
          <AlertCircle className="w-10 h-10 text-[#ef4444] mb-3 opacity-70" />
          <p className="text-sm text-[#e2e8f0] font-medium mb-1">Failed to load missions</p>
          <p className="text-xs text-[#64748b] mb-4">{fetchError}</p>
          <Button
            variant="outline"
            onClick={fetchMissions}
            className="border-[rgba(99,102,241,0.2)] text-[#a5b4fc] hover:bg-[rgba(99,102,241,0.08)]"
          >
            Retry
          </Button>
        </motion.div>
      )}

      {/* ── Empty State ── */}
      {!loading && !fetchError && missions.length === 0 && (
        <EmptyState onCreateClick={() => setDialogOpen(true)} />
      )}

      {/* ── Filtered Empty State ── */}
      {!loading && !fetchError && missions.length > 0 && filteredMissions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-8 flex flex-col items-center text-center"
        >
          <Target className="w-8 h-8 text-[#6366f1] opacity-40 mb-3" />
          <p className="text-sm text-[#94a3b8]">No missions with status &ldquo;{activeFilter}&rdquo;</p>
          <button
            onClick={() => setActiveFilter('all')}
            className="text-xs text-[#6366f1] hover:text-[#818cf8] mt-2 transition-colors"
          >
            Show all missions
          </button>
        </motion.div>
      )}

      {/* ── Missions Grid ── */}
      {!loading && !fetchError && filteredMissions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onClick={() => handleCardClick(mission)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
