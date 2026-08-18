'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket,
  Send,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertCircle,
  DollarSign,
  Users,
  ArrowRight,
  Eye,
  Code2,
  ChevronDown,
  ChevronRight,
  Zap,
  Activity,
  Bot,
  Wrench,
  ShieldCheck,
  RotateCcw,
  Tag,
  CalendarDays,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { useActiveOrg, useStore, useUserMode, useMissions } from "@/lib/store"
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import type { UserMode, MissionStatus } from '@prisma/client'
import { parseJsonField } from '@/lib/types'

// ============================================================
// Types
// ============================================================

interface MissionWithMeta {
  id: string
  title: string
  goal: string
  status: MissionStatus
  budget: number
  estimatedCost: number
  actualCost: number
  deadline: string | null
  userMode: UserMode
  createdAt: string
  updatedAt: string
  _count: { tasks: number; outcomes: number; verifications: number }
  _completedTasks: number
  agents?: Array<{ id: string; agent: { id: string; name: string; slug: string } }>
  tasks?: MissionTaskItem[]
}

interface MissionTaskItem {
  id: string
  missionId: string
  title: string
  status: string
  agentId: string | null
  assignedTools: string
  dependencies: string
  verificationConfig: string
  retryCount: number
  maxRetries: number
  error: string | null
  output: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  agent?: { id: string; name: string }
}

interface EventItem {
  id: string
  eventType: string
  actorType: string
  actorId: string | null
  missionId: string | null
  payload: string
  occurredAt: string
}

interface AgentOption {
  id: string
  name: string
  slug: string
  status: string
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  planning: { label: 'Planning', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  approved: { label: 'Approved', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  executing: { label: 'Executing', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  verifying: { label: 'Verifying', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function getStatusBadge(status: string) {
  const c = STATUS_CONFIG[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <Badge variant="secondary" className="text-[10px] font-medium border-0" style={{ color: c.color, backgroundColor: c.bg }}>
      {c.label}
    </Badge>
  )
}

function getTaskStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
    case 'running':
    case 'waiting_tool':
    case 'waiting_approval':
    case 'verifying':
    case 'retrying':
      return <Loader2 className="w-3.5 h-3.5 text-[#22d3ee] animate-spin" />
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />
    case 'blocked':
      return <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b]" />
    default:
      return <Circle className="w-3.5 h-3.5 text-[#64748b]" />
  }
}

function getMissionProgress(mission: MissionWithMeta): number {
  const total = mission._count.tasks
  if (total === 0) {
    if (mission.status === 'completed') return 100
    if (mission.status === 'executing') return 10
    return 0
  }
  return Math.round((mission._completedTasks / total) * 100)
}

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

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ============================================================
// Mode Indicator
// ============================================================

function ModeIndicator() {
  const userMode = useUserMode()
  const modeConfig = {
    simple: { label: 'Simple', color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: Sparkles },
    pro: { label: 'Pro', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: Zap },
    expert: { label: 'Expert', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Code2 },
  }
  const config = modeConfig[userMode]
  const Icon = config.icon
  return (
    <Badge
      variant="secondary"
      className="text-[10px] font-medium border-0 gap-1"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <Icon className="w-3 h-3" />
      {config.label} Mode
    </Badge>
  )
}

// ============================================================
// Mission Input (Simple / Pro)
// ============================================================

function MissionInput({
  onSubmit,
  submitting,
}: {
  onSubmit: (data: { goal: string; budget?: string; deadline?: string; agentIds?: string[] }) => void
  submitting: boolean
}) {
  const userMode = useUserMode()
  const [goal, setGoal] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [agentsLoaded, setAgentsLoaded] = useState(false)
  const activeOrg = useActiveOrg()

  useEffect(() => {
    if (!activeOrg?.id) return
    fetch(`/api/agents?organizationId=${activeOrg.id}&limit=50`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) {
          setAgents(json.data.filter((a: AgentOption) => a.status === 'active').slice(0, 12))
          setAgentsLoaded(true)
        }
      })
      .catch(() => {})
  }, [activeOrg?.id])

  const handleSubmit = () => {
    if (!goal.trim()) return
    onSubmit({
      goal: goal.trim(),
      budget: budget || undefined,
      deadline: deadline || undefined,
      agentIds: selectedAgents.length > 0 ? selectedAgents : undefined,
    })
    setGoal('')
    setBudget('')
    setDeadline('')
    setSelectedAgents([])
  }

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    )
  }

  return (
    <motion.div variants={itemVariants} className="glass-card p-6 sm:p-8 rounded-xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#e2e8f0]">Start a New Mission</h2>
          <p className="text-xs text-[#94a3b8]">Describe what you want to accomplish</p>
        </div>
      </div>

      <Textarea
        placeholder="What do you want to accomplish?"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        className={cn(
          'min-h-[100px] sm:min-h-[120px] resize-none text-[#e2e8f0] placeholder:text-[#64748b]',
          'bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.12)] focus:border-[#6366f1]',
          userMode === 'simple' ? 'text-base' : 'text-sm',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
        }}
      />

      {/* Pro options */}
      {userMode !== 'simple' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" /> Budget (USD)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 10.00"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.12)] text-[#e2e8f0] placeholder:text-[#64748b]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Deadline
              </Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.12)] text-[#e2e8f0] placeholder:text-[#64748b]"
              />
            </div>
          </div>

          {/* Agent Selection */}
          {agentsLoaded && agents.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
                <Bot className="w-3 h-3" /> Agent Selection
              </Label>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => {
                  const isSelected = selectedAgents.includes(agent.id)
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                        isSelected
                          ? 'bg-[rgba(99,102,241,0.2)] border-[#6366f1] text-[#e2e8f0]'
                          : 'bg-[rgba(15,16,28,0.4)] border-[rgba(99,102,241,0.1)] text-[#94a3b8] hover:border-[rgba(99,102,241,0.25)] hover:text-[#e2e8f0]',
                      )}
                    >
                      <Bot className="w-3 h-3 inline mr-1" />
                      {agent.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex items-center justify-between mt-5">
        <p className="text-[10px] text-[#64748b]">
          {userMode === 'simple' ? '' : 'Ctrl+Enter to submit'}
        </p>
        <Button
          className={cn(
            'btn-gradient text-white gap-2',
            userMode === 'simple' ? 'px-8 py-5 text-base' : 'px-6 py-2.5 text-sm',
          )}
          disabled={!goal.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {userMode === 'simple' ? 'Start Mission' : 'Create & Start'}
        </Button>
      </div>
    </motion.div>
  )
}

// ============================================================
// Simple Mode Mission Card
// ============================================================

function SimpleMissionCard({ mission }: { mission: MissionWithMeta }) {
  const progress = getMissionProgress(mission)
  return (
    <motion.div
      className="glass-card card-hover p-5 rounded-xl cursor-pointer"
      onClick={() => navigate('mission-detail', { missionId: mission.id })}
      variants={itemVariants}
      whileHover={{ scale: 1.005 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#e2e8f0] truncate">{mission.title}</h3>
          <p className="text-xs text-[#94a3b8] mt-0.5 line-clamp-1">{mission.goal}</p>
        </div>
        {getStatusBadge(mission.status)}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#94a3b8]">Progress</span>
          <span className="text-[10px] font-medium text-[#e2e8f0]">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#64748b]">
          {mission._completedTasks}/{mission._count.tasks} tasks
        </span>
        <span className="text-[10px] text-[#6366f1] font-medium flex items-center gap-1 hover:underline">
          View Details <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  )
}

// ============================================================
// Pro Mode Mission Card
// ============================================================

function ProMissionCard({ mission }: { mission: MissionWithMeta }) {
  const progress = getMissionProgress(mission)
  return (
    <motion.div
      className="glass-card card-hover p-5 rounded-xl cursor-pointer"
      onClick={() => navigate('mission-detail', { missionId: mission.id })}
      variants={itemVariants}
      whileHover={{ scale: 1.005 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#e2e8f0] truncate">{mission.title}</h3>
          <p className="text-xs text-[#94a3b8] mt-0.5 line-clamp-1">{mission.goal}</p>
        </div>
        {getStatusBadge(mission.status)}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#94a3b8]">Progress</span>
          <span className="text-[10px] font-medium text-[#e2e8f0]">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {mission.agents && mission.agents.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Bot className="w-3 h-3 text-[#6366f1]" />
            <span className="text-[10px] text-[#94a3b8]">
              {mission.agents.map((a) => a.agent.name).join(', ')}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3 h-3 text-[#f59e0b]" />
          <span className="text-[10px] text-[#94a3b8]">
            Est: {formatCurrency(mission.estimatedCost)}
            {mission.actualCost > 0 && ` · Actual: ${formatCurrency(mission.actualCost)}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[#94a3b8]" />
          <span className="text-[10px] text-[#64748b]">{formatRelativeTime(mission.updatedAt)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(99,102,241,0.06)]">
        <span className="text-[10px] text-[#64748b]">
          {mission._completedTasks}/{mission._count.tasks} tasks
        </span>
        <span className="text-[10px] text-[#6366f1] font-medium flex items-center gap-1 hover:underline">
          View Details <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  )
}

// ============================================================
// Expert Mode — Task Graph
// ============================================================

function ExpertTaskGraph({
  mission,
  loading,
}: {
  mission: MissionWithMeta
  loading: boolean
}) {
  const [tasks, setTasks] = useState<MissionTaskItem[]>([])
  const [tasksLoading, setTasksLoading] = useState(loading)
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    fetch(`/api/missions/${mission.id}/tasks?organizationId=${mission.id.includes('_') ? '' : ''}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) {
          setTasks(json.data)
        }
        setTasksLoading(false)
      })
      .catch(() => setTasksLoading(false))
  }, [mission.id])

  // If tasks are passed in via mission prop, use those
  const displayTasks = mission.tasks && mission.tasks.length > 0 ? mission.tasks : tasks

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#f59e0b]" />
          <h3 className="text-base font-semibold text-[#e2e8f0]">Task Graph</h3>
          <span className="text-[10px] text-[#64748b]">{displayTasks.length} tasks</span>
        </div>
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-1 text-xs text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
        >
          {showJson ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Raw Plan
        </button>
      </div>

      <AnimatePresence>
        {showJson && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="text-[10px] text-[#94a3b8] bg-[rgba(0,0,0,0.3)] rounded-lg p-4 mb-4 overflow-x-auto max-h-48">
              {JSON.stringify({
                title: mission.title,
                goal: mission.goal,
                status: mission.status,
                tasks: displayTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  dependencies: parseJsonField<string[]>(t.dependencies, []),
                })),
              }, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {tasksLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Code2 className="w-8 h-8 text-[#f59e0b] mb-2 opacity-40" />
          <p className="text-sm text-[#94a3b8]">No tasks yet</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-1">
            {displayTasks.map((task, idx) => {
              const deps = parseJsonField<string[]>(task.dependencies, [])
              const tools = parseJsonField<string[]>(task.assignedTools, [])
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="py-2.5 px-3 rounded-lg hover:bg-[rgba(99,102,241,0.04)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Dependency indicator */}
                    <div className="flex flex-col items-center pt-0.5 w-5">
                      {idx > 0 && <div className="w-px h-2 bg-[rgba(99,102,241,0.2)]" />}
                      {getTaskStatusIcon(task.status)}
                      {idx < displayTasks.length - 1 && <div className="w-px h-2 bg-[rgba(99,102,241,0.2)]" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-[#e2e8f0] font-medium">{task.title}</span>
                        {getStatusBadge(task.status)}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {task.agent && (
                          <span className="text-[10px] text-[#94a3b8] flex items-center gap-1">
                            <Bot className="w-3 h-3" /> {task.agent.name}
                          </span>
                        )}
                        {tools.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-[10px] text-[#a78bfa] flex items-center gap-1">
                                <Wrench className="w-3 h-3" /> {tools.length} tools
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="glass-strong">
                              <p className="text-xs text-[#e2e8f0]">{tools.join(', ')}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {task.retryCount > 0 && (
                          <span className="text-[10px] text-[#f59e0b] flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> {task.retryCount}/{task.maxRetries} retries
                          </span>
                        )}
                        {task.error && (
                          <span className="text-[10px] text-[#ef4444] flex items-center gap-1 max-w-[200px] truncate">
                            <XCircle className="w-3 h-3 flex-shrink-0" /> {task.error}
                          </span>
                        )}
                      </div>
                      {deps.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] text-[#64748b]">deps:</span>
                          {deps.slice(0, 3).map((d) => (
                            <Badge key={d} variant="outline" className="text-[9px] h-4 px-1.5 border-[rgba(99,102,241,0.15)] text-[#94a3b8]">
                              {d.slice(0, 8)}
                            </Badge>
                          ))}
                          {deps.length > 3 && (
                            <span className="text-[9px] text-[#64748b]">+{deps.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  )
}

// ============================================================
// Expert Mode — Event Log
// ============================================================

function ExpertEventLog({
  events,
  loading,
}: {
  events: EventItem[]
  loading: boolean
}) {
  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-[#22d3ee]" />
        <h3 className="text-base font-semibold text-[#e2e8f0]">Event Log</h3>
        <span className="text-[10px] text-[#64748b]">real-time</span>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Activity className="w-8 h-8 text-[#22d3ee] mb-2 opacity-40" />
          <p className="text-sm text-[#94a3b8]">No events yet</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[320px]">
          <div className="space-y-1.5">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-[rgba(99,102,241,0.03)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#e2e8f0]">
                    <span className="text-[#94a3b8] font-medium">{event.actorType}</span>{' '}
                    <span className="text-[#64748b]">{event.eventType}</span>
                  </p>
                </div>
                <span className="text-[10px] text-[#64748b] whitespace-nowrap">
                  {formatRelativeTime(event.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  )
}

// ============================================================
// Expert Mode Mission Card
// ============================================================

function ExpertMissionCard({ mission }: { mission: MissionWithMeta }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const activeOrg = useActiveOrg()

  useEffect(() => {
    if (!activeOrg?.id) return
    fetch(`/api/events?organizationId=${activeOrg.id}&missionId=${mission.id}&limit=20`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) setEvents(json.data)
        setEventsLoading(false)
      })
      .catch(() => setEventsLoading(false))
  }, [activeOrg?.id, mission.id])

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#e2e8f0]">{mission.title}</h3>
            {getStatusBadge(mission.status)}
          </div>
          <p className="text-xs text-[#94a3b8] mt-0.5">{mission.goal}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#6366f1] hover:text-[#e2e8f0]"
          onClick={() => navigate('mission-detail', { missionId: mission.id })}
        >
          <Eye className="w-3 h-3 mr-1" /> Details
        </Button>
      </div>

      <ExpertTaskGraph mission={mission} loading={false} />
      <div className="mt-4">
        <ExpertEventLog events={events} loading={eventsLoading} />
      </div>
    </motion.div>
  )
}

// ============================================================
// Active Missions Section
// ============================================================

function ActiveMissions({
  missions,
  loading,
}: {
  missions: MissionWithMeta[]
  loading: boolean
}) {
  const userMode = useUserMode()

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const activeMissions = missions.filter(
    (m) => m.status !== 'cancelled' && m.status !== 'draft',
  )

  if (activeMissions.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4 text-[#6366f1]" />
        <h3 className="text-base font-semibold text-[#e2e8f0]">Active Missions</h3>
        <Badge
          variant="secondary"
          className="text-[10px] font-medium border-0"
          style={{ color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)' }}
        >
          {activeMissions.length}
        </Badge>
      </div>

      {userMode === 'simple' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeMissions.map((m) => (
            <SimpleMissionCard key={m.id} mission={m} />
          ))}
        </div>
      ) : userMode === 'pro' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeMissions.map((m) => (
            <ProMissionCard key={m.id} mission={m} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {activeMissions.map((m) => (
            <ExpertMissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function CommandCenterView() {
  const activeOrg = useActiveOrg()
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const userMode = useUserMode()
  const [missions, setMissions] = useState<MissionWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchMissions = useCallback(async () => {
    if (!activeOrg?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/missions?organizationId=${activeOrg.id}&limit=20`)
      if (res.ok) {
        const json = await res.json()
        setMissions(json.data ?? [])
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    if (!activeOrg?.id) return
    fetchMissions()
  }, [activeOrg?.id, fetchMissions])

  const handleMissionSubmit = async (data: {
    goal: string
    budget?: string
    deadline?: string
    agentIds?: string[]
  }) => {
    if (!activeOrg?.id) return
    setSubmitting(true)
    try {
      const title = data.goal.length > 80 ? data.goal.slice(0, 80) + '…' : data.goal
      const res = await fetch(`/api/missions?organizationId=${activeOrg.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          goal: data.goal,
          budget: data.budget ? parseFloat(data.budget) * 100 : undefined,
          deadline: data.deadline || undefined,
          agentIds: data.agentIds,
          userMode,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const newMission = json.data
        if (newMission?.id) {
          navigate('mission-detail', { missionId: newMission.id })
        }
        fetchMissions()
      }
    } catch {
      // silently handle
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Command Center</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <AlertCircle className="w-10 h-10 text-[#f59e0b] mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#94a3b8]">Sign in to access the Command Center</p>
        </motion.div>
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Command Center</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <Briefcase className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">Select an organization to start</p>
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
        <div>
          <h1 className="text-2xl font-bold gradient-text">Command Center</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Plan, launch, and monitor missions</p>
        </div>
        <ModeIndicator />
      </motion.div>

      {/* Mission Input */}
      <MissionInput onSubmit={handleMissionSubmit} submitting={submitting} />

      {/* Active Missions */}
      <ActiveMissions missions={missions} loading={loading} />

      {/* Empty state for no missions */}
      {!loading && missions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 rounded-xl flex flex-col items-center justify-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[rgba(99,102,241,0.1)] flex items-center justify-center mb-4">
            <Rocket className="w-8 h-8 text-[#6366f1] opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-[#e2e8f0]">No Missions Yet</h3>
          <p className="text-sm text-[#94a3b8] mt-2 max-w-md text-center">
            Describe your goal above and hit Start Mission. Mianx will plan the tasks,
            assign agents, and execute — all tracked transparently.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
