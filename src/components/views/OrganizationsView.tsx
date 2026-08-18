'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Building2,
  Users,
  Calendar,
  Settings,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Globe,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useStore, useActiveOrg } from '@/lib/store'
import { navigate } from '@/lib/router'
import { slugify } from '@/lib/types'
import type { OrganizationDto, OrganizationStatus, ApiResponseEnvelope } from '@/lib/types'

// ============================================================
// Types
// ============================================================

interface OrgCard extends OrganizationDto {
  _count?: { memberships: number }
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<OrganizationStatus, { label: string; bg: string; text: string; dot: string }> = {
  active:    { label: 'Active',    bg: 'bg-[rgba(52,211,153,0.15)]',   text: 'text-[#34d399]', dot: 'bg-[#34d399]' },
  suspended: { label: 'Suspended', bg: 'bg-[rgba(239,68,68,0.15)]',   text: 'text-[#ef4444]', dot: 'bg-[#ef4444]' },
  archived:  { label: 'Archived',  bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-[#94a3b8]', dot: 'bg-[#94a3b8]' },
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
]

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'BRL', label: 'BRL (R$)' },
  { value: 'AUD', label: 'AUD (A$)' },
]

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

// ============================================================
// Helper
// ============================================================

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

export default function OrganizationsView() {
  const { setOrganizations, setActiveOrgId } = useStore()
  const activeOrg = useActiveOrg()

  // Data state
  const [organizations, setLocalOrgs] = useState<OrgCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    timezone: 'UTC',
    locale: 'en',
    currency: 'USD',
  })

  // Fetch organizations
  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/organizations')
      const json: ApiResponseEnvelope<OrgCard[]> = await res.json()
      if (json.error) throw new Error(json.error.message)
      const items = Array.isArray(json.data) ? json.data : []
      setLocalOrgs(items)
      setOrganizations(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [setOrganizations])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: slugify(name) }))
  }

  // Create organization
  const handleCreate = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json: ApiResponseEnvelope<OrgCard> = await res.json()
      if (json.error) throw new Error(json.error.message)
      setCreateOpen(false)
      setForm({ name: '', slug: '', timezone: 'UTC', locale: 'en', currency: 'USD' })
      await fetchOrgs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  // Switch to org
  const handleSwitch = (org: OrgCard) => {
    setActiveOrgId(org.id)
    navigate('dashboard')
  }

  // Manage org
  const handleManage = (org: OrgCard) => {
    setActiveOrgId(org.id)
    navigate('org-settings')
  }

  // ============================================================
  // Render: Loading
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-6 rounded-xl space-y-4">
              <Skeleton className="h-6 w-36 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-32 rounded" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ============================================================
  // Render: Main
  // ============================================================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">Organizations</h1>
          <p className="text-[#94a3b8] text-sm mt-1">
            Manage your teams, domains, and members
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient text-white border-0 gap-2">
              <Plus className="w-4 h-4" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-[rgba(99,102,241,0.2)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#e2e8f0] text-lg">
                Create New Organization
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="org-name" className="text-[#94a3b8] text-sm">
                  Organization Name
                </Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Acme Corp"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <Label htmlFor="org-slug" className="text-[#94a3b8] text-sm">
                  Slug
                </Label>
                <Input
                  id="org-slug"
                  placeholder="auto-generated-from-name"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
                />
                <p className="text-xs text-[#64748b]">
                  Auto-generated from name. Used in URLs and API references.
                </p>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label className="text-[#94a3b8] text-sm">Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
                >
                  <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz} className="text-[#e2e8f0]">
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Locale & Currency row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#94a3b8] text-sm">Locale</Label>
                  <Select
                    value={form.locale}
                    onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}
                  >
                    <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
                      {LOCALES.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-[#e2e8f0]">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#94a3b8] text-sm">Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  >
                    <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-[#e2e8f0]">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  onClick={() => setCreateOpen(false)}
                  className="text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !form.name.trim()}
                  className="btn-gradient text-white border-0 gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Organization
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && !createOpen && (
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
              onClick={fetchOrgs}
              className="text-[#ef4444] hover:text-[#f87171] hover:bg-[rgba(239,68,68,0.1)]"
            >
              Retry
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!loading && organizations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[40vh] text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[rgba(99,102,241,0.15)] flex items-center justify-center mb-5">
            <Building2 className="w-8 h-8 text-[#a78bfa]" />
          </div>
          <h3 className="text-lg font-semibold text-[#e2e8f0] mb-2">
            No organizations yet
          </h3>
          <p className="text-[#94a3b8] text-sm max-w-sm mb-6">
            Create your first organization to start building with Mianx.ai.
            You can manage teams, domains, and agents within each organization.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="btn-gradient text-white border-0 gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Organization
          </Button>
        </motion.div>
      )}

      {/* Organizations Grid */}
      {!loading && organizations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {organizations.map((org, i) => {
              const statusCfg = STATUS_CONFIG[org.status] ?? STATUS_CONFIG.active
              const isActive = activeOrg?.id === org.id
              return (
                <motion.div
                  key={org.id}
                  custom={i}
                  variants={CARD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className={cn(
                    'glass-card card-hover p-5 rounded-xl relative overflow-hidden',
                    isActive && 'ring-1 ring-[#6366f1] border-[rgba(99,102,241,0.3)]',
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#6366f1] via-[#a78bfa] to-[#22d3ee]" />
                  )}

                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[rgba(99,102,241,0.12)] flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-[#a78bfa]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#e2e8f0] truncate">{org.name}</h3>
                        <p className="text-xs text-[#64748b] truncate">@{org.slug}</p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 text-xs border-0 font-medium',
                        statusCfg.bg, statusCfg.text,
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', statusCfg.dot)} />
                      {statusCfg.label}
                    </Badge>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-[#94a3b8] mb-4 pl-[52px]">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(org.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {org._count?.memberships ?? '—'} members
                    </span>
                  </div>

                  {/* Locale & timezone tags */}
                  <div className="flex items-center gap-2 mb-4 pl-[52px]">
                    <span className="inline-flex items-center gap-1 text-xs text-[#64748b] bg-[rgba(30,32,55,0.6)] px-2 py-0.5 rounded">
                      <Globe className="w-3 h-3" />
                      {org.timezone}
                    </span>
                    <span className="text-xs text-[#64748b] bg-[rgba(30,32,55,0.6)] px-2 py-0.5 rounded">
                      {org.currency}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pl-[52px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleManage(org)}
                      className="text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.1)] gap-1.5 h-8 text-xs"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Manage
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSwitch(org)}
                      disabled={isActive}
                      className={cn(
                        'gap-1.5 h-8 text-xs',
                        isActive
                          ? 'text-[#6366f1] cursor-default'
                          : 'text-[#22d3ee] hover:text-[#22d3ee] hover:bg-[rgba(34,211,238,0.1)]',
                      )}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      {isActive ? 'Active' : 'Switch'}
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
