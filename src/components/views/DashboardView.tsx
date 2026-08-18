'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bot,
  Rocket,
  Workflow,
  CheckCircle,
  Users,
  DollarSign,
  Plus,
  Cpu,
  BarChart3,
  ArrowRight,
  AlertCircle,
  Building2,
  Clock,
  Zap,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useStore, useActiveOrg } from '@/lib/store'
import { navigate } from '@/lib/router'
import type { MissionStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface StatsData {
  agentCount: number
  missionCount: number
  workflowCount: number
  activeMemberCount: number
  integrationCount: number
  domainCount: number
  missionByStatus: Record<string, number>
  taskByStatus: Record<string, number>
  taskSummary: {
    total: number
    completed: number
    failed: number
    successRate: number
  }
  aiCostSummary: {
    totalRuns: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    estimatedCost: number
    actualCost: number
  }
  recentMissions: Array<{
    id: string
    title: string
    status: MissionStatus
    updatedAt: string
  }>
}

interface MissionItem {
  id: string
  title: string
  status: MissionStatus
  goal: string
  createdAt: string
  updatedAt: string
  _count?: { tasks: number; outcomes: number }
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

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
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
// Helpers
// ============================================================

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: 'Draft', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  planning: { label: 'Planning', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  planned: { label: 'Planned', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  running: { label: 'Running', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  completed: { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  paused: { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
}

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

function getMissionProgress(status: string): number {
  switch (status) {
    case 'completed':
      return 100
    case 'running':
      return 60
    case 'paused':
      return 35
    case 'planning':
    case 'planned':
      return 20
    case 'failed':
      return 0
    default:
      return 10
  }
}

function formatCurrency(cents: number): string {
  if (cents < 100) return `$${cents.toFixed(2)}`
  return `$${(cents / 100).toFixed(2)}`
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

function formatEventDescription(eventType: string, payload: string): string {
  const typeMap: Record<string, string> = {
    'mission.created': 'Created a new mission',
    'mission.started': 'Started mission execution',
    'mission.completed': 'Mission completed successfully',
    'mission.failed': 'Mission encountered an error',
    'task.created': 'Created a new task',
    'task.started': 'Started working on a task',
    'task.completed': 'Completed a task',
    'task.failed': 'Task failed — retrying',
    'agent.activated': 'Activated an agent',
    'agent.deactivated': 'Deactivated an agent',
    'workflow.triggered': 'Triggered a workflow',
    'workflow.completed': 'Workflow run completed',
    'approval.requested': 'Requested approval for an action',
    'approval.granted': 'Granted approval',
    'approval.rejected': 'Rejected an approval request',
    'outcome.verified': 'Verified a mission outcome',
  }
  return typeMap[eventType] ?? eventType.replace(/\./g, ' ')
}

function getEventBadgeColor(eventType: string): string {
  if (eventType.includes('fail')) return '#ef4444'
  if (eventType.includes('complet') || eventType.includes('verif')) return '#34d399'
  if (eventType.includes('start') || eventType.includes('trigger')) return '#22d3ee'
  if (eventType.includes('creat') || eventType.includes('approv')) return '#a78bfa'
  return '#94a3b8'
}

// ============================================================
// Sub-Components
// ============================================================

function OrgBanner({ org }: { org: NonNullable<ReturnType<typeof useActiveOrg>> }) {
  const statusConfig = STATUS_CONFIG[org.status] ?? {
    label: org.status,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
  }

  return (
    <motion.div
      className="glass-strong rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      variants={itemVariants}
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#e2e8f0]">{org.name}</h2>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Created {new Date(org.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className="text-xs font-medium border-0"
          style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
        >
          {statusConfig.label}
        </Badge>
        <div className="flex items-center gap-1.5 text-sm text-[#94a3b8]">
          <Users className="w-3.5 h-3.5" />
          <span>Members loaded</span>
        </div>
      </div>
    </motion.div>
  )
}

function NoOrgBanner() {
  return (
    <motion.div
      className="glass-strong rounded-xl p-8 text-center"
      variants={itemVariants}
    >
      <Building2 className="w-10 h-10 text-[#6366f1] mx-auto mb-3 opacity-60" />
      <h3 className="text-lg font-semibold text-[#e2e8f0]">
        Select or Create an Organization
      </h3>
      <p className="text-sm text-[#94a3b8] mt-1.5 max-w-md mx-auto">
        Organizations are workspaces where your team collaborates on missions,
        agents, and workflows. Create one to get started.
      </p>
      <Button
        className="btn-gradient mt-5 text-white"
        onClick={() => navigate('organizations')}
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Create Organization
      </Button>
    </motion.div>
  )
}

function StatsGrid({ stats, loading }: { stats: StatsData | null; loading: boolean }) {
  const cards = [
    {
      icon: Bot,
      label: 'Active Agents',
      value: stats?.agentCount ?? 0,
      color: '#22d3ee',
      bg: 'rgba(34,211,238,0.12)',
      trend: { value: '+2 this week', positive: true },
    },
    {
      icon: Rocket,
      label: 'Active Missions',
      value: stats?.missionCount ?? 0,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.12)',
      trend: { value: '+1 today', positive: true },
    },
    {
      icon: Workflow,
      label: 'Running Workflows',
      value: stats?.workflowCount ?? 0,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)',
      trend: { value: '0 active', positive: false },
    },
    {
      icon: CheckCircle,
      label: 'Tasks Completed',
      value: stats?.taskSummary?.completed ?? 0,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.12)',
      trend: {
        value: `${stats?.taskSummary?.successRate ?? 0}% success`,
        positive: (stats?.taskSummary?.successRate ?? 0) >= 80,
      },
    },
    {
      icon: Users,
      label: 'Team Members',
      value: stats?.activeMemberCount ?? 0,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
      trend: { value: 'All active', positive: true },
    },
    {
      icon: DollarSign,
      label: 'AI Cost This Month',
      value: formatCurrency(stats?.aiCostSummary?.actualCost ?? 0),
      rawNumber: true,
      color: '#ec4899',
      bg: 'rgba(236,72,153,0.12)',
      trend: {
        value: `${stats?.aiCostSummary?.totalRuns ?? 0} runs`,
        positive: true,
      },
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <motion.div
            key={card.label}
            variants={itemVariants}
            className="glass-card card-hover p-5 rounded-xl"
          >
            <div className="flex items-start justify-between">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.bg }}
              >
                <Icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <div
                className="flex items-center gap-0.5 text-[10px] font-medium"
                style={{ color: card.trend.positive ? '#34d399' : '#94a3b8' }}
              >
                {card.trend.positive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {card.trend.value}
              </div>
            </div>
            <div className="mt-3">
              <p
                className={`font-bold ${card.rawNumber ? 'text-xl' : 'text-2xl'} text-[#e2e8f0]`}
              >
                {card.value}
              </p>
              <p className="text-xs text-[#94a3b8] mt-0.5">{card.label}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function QuickActions() {
  const actions = [
    {
      label: 'New Mission',
      icon: Rocket,
      view: 'missions' as const,
      primary: true,
    },
    {
      label: 'Create Agent',
      icon: Bot,
      view: 'agents' as const,
      primary: false,
    },
    {
      label: 'Build Workflow',
      icon: Workflow,
      view: 'workflows' as const,
      primary: false,
    },
    {
      label: 'View Reports',
      icon: BarChart3,
      view: 'billing' as const,
      primary: false,
    },
  ]

  return (
    <motion.div className="glass-card p-4 rounded-xl" variants={itemVariants}>
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.label}
              variant={action.primary ? 'default' : 'outline'}
              className={
                action.primary
                  ? 'btn-gradient text-white rounded-lg'
                  : 'rounded-lg border-[rgba(99,102,241,0.15)] text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)]'
              }
              onClick={() => navigate(action.view)}
            >
              <Icon className="w-4 h-4 mr-1.5" />
              {action.label}
            </Button>
          )
        })}
      </div>
    </motion.div>
  )
}

function RecentMissions({
  missions,
  loading,
}: {
  missions: MissionItem[]
  loading: boolean
}) {
  if (loading) {
    return (
      <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
        <Skeleton className="h-5 w-40 mb-5" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-[#e2e8f0]">
          Recent Missions
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#94a3b8] hover:text-[#e2e8f0]"
          onClick={() => navigate('missions')}
        >
          View All
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Rocket className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">
            No missions yet
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Create your first mission to get started!
          </p>
          <Button
            className="btn-gradient mt-4 text-white text-sm"
            onClick={() => navigate('missions')}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Mission
          </Button>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {missions.map((mission) => (
            <div
              key={mission.id}
              className="flex items-center gap-4 py-2 group cursor-pointer hover:bg-[rgba(99,102,241,0.04)] rounded-lg px-2 -mx-2 transition-colors"
              onClick={() =>
                navigate('mission-detail', { missionId: mission.id })
              }
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e2e8f0] truncate group-hover:text-white transition-colors">
                  {mission.title}
                </p>
              </div>
              {getStatusBadge(mission.status)}
              <div className="w-20 hidden sm:block">
                <Progress
                  value={getMissionProgress(mission.status)}
                  className="h-1.5"
                />
              </div>
              <span className="text-[10px] text-[#64748b] whitespace-nowrap w-14 text-right">
                {formatRelativeTime(mission.updatedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function ActivityFeed({
  events,
  loading,
}: {
  events: EventItem[]
  loading: boolean
}) {
  if (loading) {
    return (
      <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
        <Skeleton className="h-5 w-36 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-[#e2e8f0]">
          Activity Feed
        </h3>
        <Activity className="w-4 h-4 text-[#64748b]" />
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <Clock className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">
            No activity yet
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Events will appear here as your team works.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 py-1.5"
            >
              <Avatar className="w-6 h-6 mt-0.5 flex-shrink-0">
                <AvatarFallback
                  className="text-[8px] font-bold"
                  style={{
                    backgroundColor: `${getEventBadgeColor(event.eventType)}18`,
                    color: getEventBadgeColor(event.eventType),
                  }}
                >
                  <Zap className="w-3 h-3" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#e2e8f0] leading-snug">
                  <span className="font-medium text-[#94a3b8]">
                    {event.actorType === 'system'
                      ? 'System'
                      : event.actorType === 'agent'
                        ? 'Agent'
                        : 'User'}
                  </span>{' '}
                  {formatEventDescription(event.eventType, event.payload)}
                </p>
              </div>
              <span className="text-[10px] text-[#64748b] whitespace-nowrap mt-0.5">
                {formatRelativeTime(event.occurredAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ============================================================
// Main DashboardView Component
// ============================================================

export default function DashboardView() {
  const activeOrg = useActiveOrg()
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  const [stats, setStats] = useState<StatsData | null>(null)
  const [missions, setMissions] = useState<MissionItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [missionsLoading, setMissionsLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!activeOrg?.id) return
    setStatsLoading(true)
    try {
      const res = await fetch(
        `/api/stats?organizationId=${activeOrg.id}`
      )
      if (res.ok) {
        const json = await res.json()
        setStats(json.data ?? null)
      }
    } catch {
      // Silently handle — stats will remain null
    } finally {
      setStatsLoading(false)
    }
  }, [activeOrg?.id])

  const fetchMissions = useCallback(async () => {
    if (!activeOrg?.id) return
    setMissionsLoading(true)
    try {
      const res = await fetch(
        `/api/missions?organizationId=${activeOrg.id}&limit=8`
      )
      if (res.ok) {
        const json = await res.json()
        setMissions(json.data ?? [])
      }
    } catch {
      // Silently handle
    } finally {
      setMissionsLoading(false)
    }
  }, [activeOrg?.id])

  const fetchEvents = useCallback(async () => {
    if (!activeOrg?.id) return
    setEventsLoading(true)
    try {
      const res = await fetch(
        `/api/events?organizationId=${activeOrg.id}&limit=10`
      )
      if (res.ok) {
        const json = await res.json()
        setEvents(json.data ?? [])
      }
    } catch {
      // Silently handle
    } finally {
      setEventsLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    if (!activeOrg?.id) return
    fetchStats()
    fetchMissions()
    fetchEvents()
  }, [activeOrg?.id, fetchStats, fetchMissions, fetchEvents])

  // Show a pre-auth prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Dashboard</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <AlertCircle className="w-10 h-10 text-[#f59e0b] mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Sign in to access your dashboard
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
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Dashboard</h1>
        <Badge
          variant="outline"
          className="text-[10px] border-[rgba(99,102,241,0.2)] text-[#a78bfa] bg-[rgba(99,102,241,0.06)]"
        >
          <TrendingUp className="w-3 h-3 mr-1" />
          Overview
        </Badge>
      </motion.div>

      {/* Organization Banner */}
      {activeOrg ? (
        <OrgBanner org={activeOrg} />
      ) : (
        <NoOrgBanner />
      )}

      {/* Stats Grid — only when org is active */}
      {activeOrg && (
        <StatsGrid stats={stats} loading={statsLoading} />
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Two-column layout: Recent Missions + Activity Feed */}
      {activeOrg && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentMissions missions={missions} loading={missionsLoading} />
          <ActivityFeed events={events} loading={eventsLoading} />
        </div>
      )}
    </motion.div>
  )
}
