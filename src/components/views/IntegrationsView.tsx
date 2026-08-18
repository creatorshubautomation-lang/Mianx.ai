'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Webhook,
  Mail,
  MessageSquare,
  CreditCard,
  Code2,
  Zap,
  Globe,
  Settings,
  Unplug,
  Loader2,
  AlertCircle,
  Puzzle,
  Link2,
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useActiveOrg } from '@/lib/store'
import type { ApiResponseEnvelope } from '@/lib/types'

// ============================================================
// Types
// ============================================================

interface IntegrationItem {
  id: string
  organizationId: string
  provider: string
  name: string
  status: string
  configuration: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// Constants
// ============================================================

const PROVIDERS = [
  { value: 'slack', label: 'Slack', icon: MessageSquare, color: '#e01e5a' },
  { value: 'stripe', label: 'Stripe', icon: CreditCard, color: '#635bff' },
  { value: 'github', label: 'GitHub', icon: Code2, color: '#f0f6fc' },
  { value: 'openai', label: 'OpenAI', icon: Zap, color: '#10a37f' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: '#25d366' },
  { value: 'email', label: 'Email', icon: Mail, color: '#f59e0b' },
  { value: 'webhook', label: 'Webhook', icon: Webhook, color: '#22d3ee' },
  { value: 'custom', label: 'Custom', icon: Globe, color: '#a78bfa' },
] as const

const PROVIDER_ICON_MAP: Record<string, { icon: typeof Webhook; color: string }> = {}
PROVIDERS.forEach((p) => {
  PROVIDER_ICON_MAP[p.value] = { icon: p.icon, color: p.color }
})

// Fallback icon for unknown providers
const DEFAULT_PROVIDER: { icon: typeof Globe; color: string } = {
  icon: Globe,
  color: '#94a3b8',
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  connected:    { label: 'Connected',    bg: 'bg-[rgba(52,211,153,0.15)]',   text: 'text-[#34d399]', dot: 'bg-[#34d399]' },
  disconnected: { label: 'Disconnected', bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-[#94a3b8]', dot: 'bg-[#94a3b8]' },
  error:        { label: 'Error',        bg: 'bg-[rgba(239,68,68,0.15)]',   text: 'text-[#ef4444]', dot: 'bg-[#ef4444]' },
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, y: -10, scale: 0.95 },
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch {
    return 'Unknown'
  }
}

// ============================================================
// Component
// ============================================================

export default function IntegrationsView() {
  const activeOrg = useActiveOrg()

  const [integrations, setIntegrations] = useState<IntegrationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Connect dialog state
  const [connectOpen, setConnectOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectForm, setConnectForm] = useState({
    name: '',
    provider: 'webhook',
    configuration: '{\n  "key": "value"\n}',
  })

  // Disconnect confirm
  const [disconnectId, setDisconnectId] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Fetch integrations
  const fetchIntegrations = useCallback(async () => {
    if (!activeOrg) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/integrations?organizationId=${activeOrg.id}`)
      const json: ApiResponseEnvelope<IntegrationItem[]> = await res.json()
      if (json.error) throw new Error(json.error.message)
      setIntegrations(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [activeOrg])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  // Connect
  const handleConnect = async () => {
    if (!activeOrg || !connectForm.name.trim()) return
    setConnecting(true)
    setError(null)
    try {
      let config: Record<string, unknown> = {}
      try {
        config = JSON.parse(connectForm.configuration)
      } catch {
        // If JSON is invalid, send as empty
      }
      const res = await fetch(`/api/integrations?organizationId=${activeOrg.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: connectForm.name.trim(),
          provider: connectForm.provider,
          configuration: config,
          status: 'connected',
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      setConnectOpen(false)
      setConnectForm({ name: '', provider: 'webhook', configuration: '{\n  "key": "value"\n}' })
      await fetchIntegrations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect integration')
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect
  const handleDisconnect = async () => {
    if (!disconnectId) return
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/integrations/${disconnectId}`, { method: 'DELETE' })
      if (res.status !== 204) {
        const json = await res.json()
        if (json.error) throw new Error(json.error.message)
      }
      setDisconnectId(null)
      await fetchIntegrations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  // ============================================================
  // No org selected
  // ============================================================

  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">Integrations</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[40vh] text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[rgba(34,211,238,0.15)] flex items-center justify-center mb-5">
            <Puzzle className="w-8 h-8 text-[#94a3b8]" />
          </div>
          <h3 className="text-lg font-semibold text-[#e2e8f0] mb-2">No organization selected</h3>
          <p className="text-[#94a3b8] text-sm max-w-sm">
            Select an organization to manage its integrations.
          </p>
        </motion.div>
      </div>
    )
  }

  // ============================================================
  // Loading
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-4 w-48 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">Integrations</h1>
          <p className="text-[#94a3b8] text-sm mt-1">
            Connect external services and tools to your organization
          </p>
        </div>

        <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient text-white border-0 gap-2">
              <Plus className="w-4 h-4" />
              Connect Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-[rgba(99,102,241,0.2)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#e2e8f0] text-lg">
                Connect Integration
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="int-name" className="text-[#94a3b8] text-sm">
                  Integration Name
                </Label>
                <Input
                  id="int-name"
                  placeholder="e.g. Production Slack"
                  value={connectForm.name}
                  onChange={(e) =>
                    setConnectForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
                />
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <Label className="text-[#94a3b8] text-sm">Provider</Label>
                <Select
                  value={connectForm.provider}
                  onValueChange={(v) =>
                    setConnectForm((f) => ({ ...f, provider: v }))
                  }
                >
                  <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
                    {PROVIDERS.map((p) => {
                      const PIcon = p.icon
                      return (
                        <SelectItem key={p.value} value={p.value} className="text-[#e2e8f0]">
                          <div className="flex items-center gap-2">
                            <PIcon className="w-4 h-4" style={{ color: p.color }} />
                            {p.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Configuration */}
              <div className="space-y-2">
                <Label className="text-[#94a3b8] text-sm">
                  Configuration{' '}
                  <span className="text-[#64748b] font-normal">(JSON)</span>
                </Label>
                <Textarea
                  placeholder='{ "key": "value" }'
                  value={connectForm.configuration}
                  onChange={(e) =>
                    setConnectForm((f) => ({ ...f, configuration: e.target.value }))
                  }
                  rows={6}
                  className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b] font-mono text-xs resize-none"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] p-3 rounded-lg"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setConnectOpen(false)}
                  className="text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={connecting || !connectForm.name.trim()}
                  className="btn-gradient text-white border-0 gap-2"
                >
                  {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Link2 className="w-4 h-4" />
                  Connect
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && !connectOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]"
          >
            <AlertCircle className="w-5 h-5 text-[#ef4444] shrink-0" />
            <p className="text-[#ef4444] text-sm flex-1">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchIntegrations}
              className="text-[#ef4444] hover:text-[#f87171] hover:bg-[rgba(239,68,68,0.1)]"
            >
              Retry
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!loading && integrations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[40vh] text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-[rgba(34,211,238,0.1)] flex items-center justify-center mb-6 relative">
            <Puzzle className="w-10 h-10 text-[#22d3ee] opacity-60" />
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[rgba(99,102,241,0.2)] flex items-center justify-center">
              <Link2 className="w-3 h-3 text-[#a78bfa]" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-[#e2e8f0] mb-2">
            No integrations connected
          </h3>
          <p className="text-[#94a3b8] text-sm max-w-md mb-6 leading-relaxed">
            Connect external services like Slack, GitHub, Stripe, and more to
            extend your organization&apos;s capabilities and automate workflows.
          </p>
          <Button
            onClick={() => setConnectOpen(true)}
            className="btn-gradient text-white border-0 gap-2"
          >
            <Plus className="w-4 h-4" />
            Connect Your First Integration
          </Button>
        </motion.div>
      )}

      {/* Integrations Grid */}
      {!loading && integrations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {integrations.map((integration, i) => {
              const prov = PROVIDER_ICON_MAP[integration.provider] ?? DEFAULT_PROVIDER
              const PIcon = prov.icon
              const stCfg = STATUS_CFG[integration.status] ?? STATUS_CFG.disconnected

              return (
                <motion.div
                  key={integration.id}
                  custom={i}
                  variants={CARD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className="glass-card card-hover p-5 rounded-xl"
                >
                  {/* Top: icon + name + provider badge */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${prov.color}15` }}
                    >
                      <PIcon
                        className="w-6 h-6"
                        style={{ color: prov.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#e2e8f0] text-sm truncate">
                        {integration.name}
                      </h3>
                      <Badge
                        className="mt-1 text-xs border-0 font-normal bg-[rgba(30,32,55,0.6)] text-[#94a3b8]"
                      >
                        {integration.provider}
                      </Badge>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      className={cn(
                        'text-xs border-0 font-medium',
                        stCfg.bg, stCfg.text,
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full mr-1.5',
                          stCfg.dot,
                        )}
                      />
                      {stCfg.label}
                    </Badge>
                  </div>

                  {/* Connected date */}
                  <p className="text-xs text-[#64748b] mb-4">
                    Connected {formatDate(integration.createdAt)}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.1)] gap-1.5 h-8 text-xs"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Configure
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="glass-strong border-[rgba(99,102,241,0.2)] text-[#e2e8f0]">
                        Edit integration configuration
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDisconnectId(integration.id)}
                          className="text-[#94a3b8] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] gap-1.5 h-8 text-xs"
                        >
                          <Unplug className="w-3.5 h-3.5" />
                          Disconnect
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="glass-strong border-[rgba(99,102,241,0.2)] text-[#e2e8f0]">
                        Remove this integration
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Disconnect Confirm (inline) */}
                  <AnimatePresence>
                    {disconnectId === integration.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-3 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]"
                      >
                        <p className="text-xs text-[#94a3b8] mb-3">
                          Are you sure you want to disconnect{' '}
                          <span className="text-[#e2e8f0] font-medium">
                            {integration.name}
                          </span>
                          ? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDisconnectId(null)}
                            className="text-[#94a3b8] h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="h-7 text-xs gap-1 bg-[#ef4444] hover:bg-[#dc2626] text-white border-0"
                          >
                            {disconnecting && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            Disconnect
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
