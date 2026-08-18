'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bot,
  Plus,
  Eye,
  Pencil,
  Play,
  Trash2,
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useStore, useActiveOrg } from '@/lib/store'
import { cn } from '@/lib/utils'
import { parseJsonField, slugify, type AgentDto, type AgentStatus } from '@/lib/types'
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
// Status / Type Configs
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Draft',      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  testing:    { label: 'Testing',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  active:     { label: 'Active',     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  paused:     { label: 'Paused',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  deprecated: { label: 'Deprecated', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  retired:    { label: 'Retired',    color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

const TYPE_COLORS: Record<string, string> = {
  assistant:   '#6366f1',
  analyst:     '#22d3ee',
  workflow:    '#a78bfa',
  monitoring:  '#34d399',
  specialist:  '#f59e0b',
  automation:  '#ec4899',
}

const AVATAR_GRADIENTS = [
  'from-[#6366f1] to-[#8b5cf6]',
  'from-[#22d3ee] to-[#06b6d4]',
  'from-[#a78bfa] to-[#c084fc]',
  'from-[#34d399] to-[#10b981]',
  'from-[#f59e0b] to-[#d97706]',
  'from-[#ec4899] to-[#f43f5e]',
]

const AGENT_TYPES = ['assistant', 'analyst', 'workflow', 'monitoring', 'specialist', 'automation'] as const
const AGENT_STATUSES = ['draft', 'testing', 'active', 'paused', 'deprecated', 'retired'] as const

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

function getAvatarGradient(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function parseCapabilities(capabilitiesStr: string): string[] {
  return parseJsonField<string[]>(capabilitiesStr, [])
}

function parseConfiguration(configStr: string): Record<string, unknown> {
  return parseJsonField<Record<string, unknown>>(configStr, {})
}

// ============================================================
// Sub-Components
// ============================================================

function StatsRow({
  total,
  active,
  runs,
  loading,
}: {
  total: number
  active: number
  runs: number
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const stats = [
    {
      icon: Bot,
      label: 'Total Agents',
      value: total,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.12)',
    },
    {
      icon: CheckCircle2,
      label: 'Active Agents',
      value: active,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.12)',
    },
    {
      icon: Activity,
      label: 'Total Runs',
      value: runs,
      color: '#22d3ee',
      bg: 'rgba(34,211,238,0.12)',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <motion.div
            key={s.label}
            variants={itemVariants}
            className="glass-card p-4 rounded-xl flex items-center gap-4"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: s.bg }}
            >
              <Icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#e2e8f0]">{s.value}</p>
              <p className="text-xs text-[#94a3b8]">{s.label}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function AgentCard({
  agent,
  index,
  onSelect,
  onRun,
}: {
  agent: AgentDto
  index: number
  onSelect: () => void
  onRun: () => void
}) {
  const capabilities = parseCapabilities(agent.capabilities)
  const typeColor = TYPE_COLORS[agent.type] ?? '#94a3b8'
  const gradient = getAvatarGradient(index)

  return (
    <motion.div
      variants={itemVariants}
      className="glass-card card-hover p-5 rounded-xl cursor-pointer"
      onClick={onSelect}
    >
      {/* Avatar + Name Row */}
      <div className="flex items-start gap-3.5 mb-3">
        <div className="relative flex-shrink-0">
          <Avatar className="w-11 h-11">
            <AvatarFallback
              className={cn(
                'bg-gradient-to-br text-white text-base font-bold',
                gradient
              )}
            >
              {agent.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-[#0f10c0] border-2 border-[#0f10c0]"
          >
            <Bot className="w-3 h-3" style={{ color: typeColor }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#e2e8f0] truncate">
              {agent.name}
            </h3>
            <Badge
              variant="secondary"
              className="text-[9px] font-medium border-0"
              style={{
                color: typeColor,
                backgroundColor: `${typeColor}18`,
              }}
            >
              {agent.type}
            </Badge>
            {getStatusBadge(agent.status)}
          </div>
          {agent.description && (
            <p className="text-xs text-[#94a3b8] mt-0.5 line-clamp-2">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {capabilities.slice(0, 4).map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="text-[9px] font-normal border-[rgba(99,102,241,0.15)] text-[#94a3b8] bg-transparent"
            >
              {cap}
            </Badge>
          ))}
          {capabilities.length > 4 && (
            <Badge
              variant="outline"
              className="text-[9px] font-normal border-[rgba(99,102,241,0.15)] text-[#64748b] bg-transparent"
            >
              +{capabilities.length - 4}
            </Badge>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[rgba(99,102,241,0.08)]">
        <div className="flex items-center gap-3 text-[10px] text-[#64748b]">
          <span>v{agent.version}</span>
          <span>·</span>
          <span>{formatDate(agent.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)]"
            onClick={onSelect}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)]"
            onClick={onRun}
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

function CreateAgentDialog({
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
  const [description, setDescription] = useState('')
  const [type, setType] = useState('assistant')
  const [status, setStatus] = useState<AgentStatus>('draft')
  const [capabilities, setCapabilities] = useState('')
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
      const caps = capabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      const res = await fetch(`/api/agents?organizationId=${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          type,
          status,
          capabilities: caps.length > 0 ? caps : undefined,
        }),
      })
      if (res.ok) {
        toast({ title: 'Agent created', description: `${name} has been created successfully.` })
        setName('')
        setSlug('')
        setDescription('')
        setType('assistant')
        setStatus('draft')
        setCapabilities('')
        onOpenChange(false)
        onCreated()
      } else {
        const json = await res.json().catch(() => ({}))
        toast({
          title: 'Failed to create agent',
          description: json?.error?.message ?? 'An unexpected error occurred.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-[rgba(99,102,241,0.18)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#e2e8f0]">Create Agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Name</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Data Analyst Pro"
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="data-analyst-pro"
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#94a3b8]">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong border-[rgba(99,102,241,0.18)]">
                  {AGENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-[#e2e8f0] focus:bg-[rgba(99,102,241,0.12)] focus:text-white">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#94a3b8]">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus)}>
                <SelectTrigger className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong border-[rgba(99,102,241,0.18)]">
                  {AGENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-[#e2e8f0] focus:bg-[rgba(99,102,241,0.12)] focus:text-white">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Capabilities</Label>
            <Input
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              placeholder="code-review, data-analysis, report-generation (comma-separated)"
              className="bg-[rgba(99,102,241,0.06)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
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
              {submitting ? 'Creating...' : 'Create Agent'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AgentDetailPanel({
  agent,
  open,
  onOpenChange,
  onDeleted,
  orgId,
}: {
  agent: AgentDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
  orgId: string
}) {
  const capabilities = agent ? parseCapabilities(agent.capabilities) : []
  const configuration = agent ? parseConfiguration(agent.configuration) : {}
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!agent) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}?organizationId=${orgId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({ title: 'Agent deleted', description: `${agent.name} has been removed.` })
        onOpenChange(false)
        onDeleted()
      } else {
        toast({ title: 'Delete failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (!agent) return null

  const configJson = JSON.stringify(configuration, null, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-[rgba(99,102,241,0.18)] max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-[#e2e8f0] flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              {agent.name}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              {getStatusBadge(agent.status)}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-5 pb-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Type</p>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium border-0"
                  style={{
                    color: TYPE_COLORS[agent.type] ?? '#94a3b8',
                    backgroundColor: `${TYPE_COLORS[agent.type] ?? '#94a3b8'}18`,
                  }}
                >
                  {agent.type}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Version</p>
                <p className="text-sm text-[#e2e8f0]">{agent.version}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Slug</p>
                <p className="text-sm text-[#94a3b8] font-mono">{agent.slug}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm text-[#94a3b8]">{formatDate(agent.createdAt)}</p>
              </div>
            </div>

            {agent.description && (
              <div>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-sm text-[#e2e8f0] leading-relaxed">
                  {agent.description}
                </p>
              </div>
            )}

            <Separator className="bg-[rgba(99,102,241,0.1)]" />

            {/* Tools */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-3.5 h-3.5 text-[#64748b]" />
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Tools</p>
              </div>
              <p className="text-sm text-[#64748b] italic">No tools configured</p>
            </div>

            <Separator className="bg-[rgba(99,102,241,0.1)]" />

            {/* Skills / Capabilities */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="w-3.5 h-3.5 text-[#64748b]" />
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider">
                  Capabilities
                </p>
              </div>
              {capabilities.length === 0 ? (
                <p className="text-sm text-[#64748b] italic">No capabilities defined</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap) => (
                    <Badge
                      key={cap}
                      variant="outline"
                      className="text-[10px] font-normal border-[rgba(99,102,241,0.15)] text-[#a78bfa] bg-[rgba(99,102,241,0.06)]"
                    >
                      {cap}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-[rgba(99,102,241,0.1)]" />

            {/* Configuration JSON */}
            <div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">
                Configuration
              </p>
              <pre className="bg-[rgba(0,0,0,0.3)] border border-[rgba(99,102,241,0.1)] rounded-lg p-4 text-xs text-[#94a3b8] font-mono overflow-x-auto max-h-48">
                <code>{configJson}</code>
              </pre>
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-[rgba(99,102,241,0.08)]">
          <Button
            variant="outline"
            className="border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#ef4444]"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button
            variant="outline"
            className="border-[rgba(99,102,241,0.15)] text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Main AgentsView
// ============================================================

export default function AgentsView() {
  const activeOrg = useActiveOrg()
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  const [agents, setAgents] = useState<AgentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailAgent, setDetailAgent] = useState<AgentDto | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchAgents = useCallback(async () => {
    if (!activeOrg?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/agents?organizationId=${activeOrg.id}&limit=50`
      )
      if (res.ok) {
        const json = await res.json()
        setAgents(json.data ?? [])
      } else {
        setError('Failed to load agents')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [activeOrg?.id])

  useEffect(() => {
    if (activeOrg?.id) fetchAgents()
  }, [activeOrg?.id, fetchAgents])

  const handleSelectAgent = (agent: AgentDto) => {
    setDetailAgent(agent)
    setDetailOpen(true)
  }

  const handleRunAgent = (agent: AgentDto) => {
    toast({
      title: 'Agent run triggered',
      description: `${agent.name} is now running.`,
    })
  }

  const handleDelete = () => {
    fetchAgents()
  }

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Agents</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <AlertCircle className="w-10 h-10 text-[#f59e0b] mb-3 opacity-60" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Sign in to manage your agents
          </p>
        </motion.div>
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Agents</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <Bot className="w-10 h-10 text-[#6366f1] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">
            Select an organization to manage agents
          </p>
        </motion.div>
      </div>
    )
  }

  const totalAgents = agents.length
  const activeAgents = agents.filter((a) => a.status === 'active').length

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
          <h1 className="text-2xl font-bold gradient-text">Agents</h1>
          <Button
            className="btn-gradient text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Agent
          </Button>
        </motion.div>

        {/* Stats Row */}
        <StatsRow
          total={totalAgents}
          active={activeAgents}
          runs={0}
          loading={loading}
        />

        {/* Agents Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-8 rounded-xl text-center"
          >
            <AlertCircle className="w-10 h-10 text-[#ef4444] mx-auto mb-3 opacity-60" />
            <p className="text-sm font-medium text-[#e2e8f0]">Failed to load agents</p>
            <p className="text-xs text-[#94a3b8] mt-1">{error}</p>
            <Button
              variant="outline"
              className="mt-4 border-[rgba(99,102,241,0.15)] text-[#94a3b8] hover:text-[#e2e8f0]"
              onClick={fetchAgents}
            >
              Try Again
            </Button>
          </motion.div>
        ) : agents.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[35vh]"
          >
            <Bot className="w-12 h-12 text-[#6366f1] mb-3 opacity-40" />
            <h3 className="text-base font-semibold text-[#e2e8f0]">
              No agents yet
            </h3>
            <p className="text-sm text-[#94a3b8] mt-1.5 max-w-md text-center">
              Create your first AI agent to automate tasks and workflows within
              your organization.
            </p>
            <Button
              className="btn-gradient mt-5 text-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Agent
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                onSelect={() => handleSelectAgent(agent)}
                onRun={() => handleRunAgent(agent)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Dialog */}
      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchAgents}
        orgId={activeOrg.id}
      />

      {/* Detail Panel */}
      <AgentDetailPanel
        agent={detailAgent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDeleted={handleDelete}
        orgId={activeOrg.id}
      />
    </>
  )
}
