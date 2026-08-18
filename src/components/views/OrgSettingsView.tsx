'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings2,
  Users,
  Globe,
  Shield,
  AlertTriangle,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Save,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useStore, useActiveOrg } from '@/lib/store'
import { navigate } from '@/lib/router'
import { slugify } from '@/lib/types'
import type { ApiResponseEnvelope, MembershipStatus, AutonomyLevel } from '@/lib/types'

// ============================================================
// Types
// ============================================================

interface MemberUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
}

interface MemberRole {
  id: string
  name: string
  slug: string
  description?: string | null
  isSystem: boolean
}

interface MemberItem {
  id: string
  organizationId: string
  userId: string
  status: MembershipStatus
  joinedAt: string | null
  createdAt: string
  updatedAt: string
  user: MemberUser
  roles: MemberRole[]
}

interface OrgDomain {
  id: string
  organizationId: string
  domainId: string
  status: string
  configuration: string
  activatedAt: string | null
  createdAt: string
  updatedAt: string
  domain: {
    id: string
    name: string
    slug: string
    description: string | null
    status: string
    createdAt: string
    updatedAt: string
  }
}

interface AutonomyPolicy {
  id: string
  organizationId: string
  level: AutonomyLevel
  config: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// Constants
// ============================================================

const MEMBER_STATUS_CFG: Record<MembershipStatus, { label: string; bg: string; text: string }> = {
  active:    { label: 'Active',    bg: 'bg-[rgba(52,211,153,0.15)]',   text: 'text-[#34d399]' },
  invited:   { label: 'Invited',   bg: 'bg-[rgba(245,158,11,0.15)]',  text: 'text-[#f59e0b]' },
  suspended: { label: 'Suspended', bg: 'bg-[rgba(239,68,68,0.15)]',   text: 'text-[#ef4444]' },
  removed:   { label: 'Removed',   bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-[#94a3b8]' },
}

const ROLE_COLORS: Record<string, string> = {
  owner:  'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.25)]',
  admin:  'bg-[rgba(99,102,241,0.15)] text-[#a78bfa] border-[rgba(99,102,241,0.25)]',
  member: 'bg-[rgba(34,211,238,0.15)] text-[#22d3ee] border-[rgba(34,211,238,0.25)]',
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
]

const LOCALES = [
  { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' }, { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' }, { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' }, { value: 'hi', label: 'Hindi' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' }, { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' }, { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CNY', label: 'CNY (¥)' }, { value: 'INR', label: 'INR (₹)' },
  { value: 'BRL', label: 'BRL (R$)' }, { value: 'AUD', label: 'AUD (A$)' },
]

const AUTONOMY_LEVELS: Record<AutonomyLevel, {
  label: string; description: string; color: string; icon: string
}> = {
  conservative: {
    label: 'Conservative',
    description: 'All agent actions require human approval. Maximum safety, minimum autonomy. Agents will never execute without explicit confirmation.',
    color: 'border-[#f59e0b]',
    icon: '🛡️',
  },
  balanced: {
    label: 'Balanced',
    description: 'Agents can execute low-risk tasks autonomously, but high-risk actions require approval. Recommended for most teams.',
    color: 'border-[#6366f1]',
    icon: '⚖️',
  },
  autonomous: {
    label: 'Autonomous',
    description: 'Agents operate independently with minimal human oversight. Best for mature teams with established trust frameworks.',
    color: 'border-[#22d3ee]',
    icon: '🚀',
  },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ============================================================
// Component
// ============================================================

export default function OrgSettingsView() {
  const activeOrg = useActiveOrg()
  const { setOrganizations } = useStore()

  // No org selected
  if (!activeOrg) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">
          Organization Settings
        </h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[40vh] text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[rgba(99,102,241,0.15)] flex items-center justify-center mb-5">
            <Settings2 className="w-8 h-8 text-[#94a3b8]" />
          </div>
          <h3 className="text-lg font-semibold text-[#e2e8f0] mb-2">
            No organization selected
          </h3>
          <p className="text-[#94a3b8] text-sm max-w-sm mb-6">
            Select an organization from the sidebar or go to Organizations to create or switch.
          </p>
          <Button
            onClick={() => navigate('organizations')}
            className="btn-gradient text-white border-0 gap-2"
          >
            <Settings2 className="w-4 h-4" />
            Go to Organizations
          </Button>
        </motion.div>
      </div>
    )
  }

  return <OrgSettingsTabs orgId={activeOrg.id} setOrganizations={setOrganizations} />
}

// ============================================================
// Tabbed Settings Container
// ============================================================

function OrgSettingsTabs({
  orgId,
  setOrganizations,
}: {
  orgId: string
  setOrganizations: (orgs: import('@/lib/types').OrganizationDto[]) => void
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">
          Organization Settings
        </h1>
        <p className="text-[#94a3b8] text-sm mt-1">
          Manage configuration, members, domains, and policies
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="glass-strong border-[rgba(99,102,241,0.15)] bg-transparent h-auto p-1 flex flex-wrap gap-1">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#e2e8f0] text-[#94a3b8] gap-2 px-4 h-9 text-sm rounded-lg"
          >
            <Settings2 className="w-3.5 h-3.5" /> General
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#e2e8f0] text-[#94a3b8] gap-2 px-4 h-9 text-sm rounded-lg"
          >
            <Users className="w-3.5 h-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger
            value="domains"
            className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#e2e8f0] text-[#94a3b8] gap-2 px-4 h-9 text-sm rounded-lg"
          >
            <Globe className="w-3.5 h-3.5" /> Domains
          </TabsTrigger>
          <TabsTrigger
            value="autonomy"
            className="data-[state=active]:bg-[rgba(99,102,241,0.2)] data-[state=active]:text-[#e2e8f0] text-[#94a3b8] gap-2 px-4 h-9 text-sm rounded-lg"
          >
            <Shield className="w-3.5 h-3.5" /> Autonomy
          </TabsTrigger>
          <TabsTrigger
            value="danger"
            className="data-[state=active]:bg-[rgba(239,68,68,0.2)] data-[state=active]:text-[#ef4444] text-[#94a3b8] gap-2 px-4 h-9 text-sm rounded-lg"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="general">
            <GeneralTab orgId={orgId} setOrganizations={setOrganizations} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="domains">
            <DomainsTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="autonomy">
            <AutonomyTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="danger">
            <DangerZoneTab orgId={orgId} setOrganizations={setOrganizations} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ============================================================
// General Tab
// ============================================================

function GeneralTab({
  orgId,
  setOrganizations,
}: {
  orgId: string
  setOrganizations: (orgs: import('@/lib/types').OrganizationDto[]) => void
}) {
  const [form, setForm] = useState({
    name: '', slug: '', timezone: 'UTC', locale: 'en', currency: 'USD',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/organizations/${orgId}`)
        const json: ApiResponseEnvelope<Record<string, string>> = await res.json()
        if (json.error) throw new Error(json.error.message)
        const d = json.data
        setForm({
          name: d.name ?? '',
          slug: d.slug ?? '',
          timezone: d.timezone ?? 'UTC',
          locale: d.locale ?? 'en',
          currency: d.currency ?? 'USD',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [orgId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json: ApiResponseEnvelope<Record<string, string>> = await res.json()
      if (json.error) throw new Error(json.error.message)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Refresh store
      const listRes = await fetch('/api/organizations')
      const listJson: ApiResponseEnvelope<import('@/lib/types').OrganizationDto[]> = await listRes.json()
      if (!listJson.error && Array.isArray(listJson.data)) {
        setOrganizations(listJson.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 rounded-xl space-y-5"
    >
      <h2 className="text-lg font-semibold text-[#e2e8f0]">General Settings</h2>
      <Separator className="bg-[rgba(99,102,241,0.12)]" />

      {/* Name */}
      <div className="space-y-2">
        <Label className="text-[#94a3b8] text-sm">Organization Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] max-w-md"
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label className="text-[#94a3b8] text-sm">Slug</Label>
        <Input
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
          className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] max-w-md"
        />
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label className="text-[#94a3b8] text-sm">Timezone</Label>
        <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
          <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz} className="text-[#e2e8f0]">{tz}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Locale & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <div className="space-y-2">
          <Label className="text-[#94a3b8] text-sm">Locale</Label>
          <Select value={form.locale} onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}>
            <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
              {LOCALES.map((l) => (
                <SelectItem key={l.value} value={l.value} className="text-[#e2e8f0]">{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[#94a3b8] text-sm">Currency</Label>
          <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
            <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-[#e2e8f0]">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] p-3 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'gap-2 text-white border-0 transition-all',
            saved ? 'bg-[#34d399] hover:bg-[#34d399]' : 'btn-gradient',
          )}
        >
          {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </motion.div>
  )
}

// ============================================================
// Members Tab
// ============================================================

function MembersTab({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<MemberItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`)
      const json: ApiResponseEnvelope<MemberItem[]> = await res.json()
      if (json.error) throw new Error(json.error.message)
      setMembers(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), roleSlug: inviteRole }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  const handleChangeRole = async (memberId: string, roleSlug: string) => {
    setChangingRole(memberId)
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleSlug }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed')
    } finally {
      setChangingRole(null)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the organization?')) return
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' })
      if (res.status === 204) {
        setMembers((m) => m.filter((x) => x.id !== memberId))
      } else {
        const json = await res.json()
        if (json.error) throw new Error(json.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#e2e8f0]">Members</h2>
          <p className="text-[#94a3b8] text-sm">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient text-white border-0 gap-2">
              <Plus className="w-4 h-4" /> Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-[rgba(99,102,241,0.2)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#e2e8f0]">Invite Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-[#94a3b8] text-sm">Email Address</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0] placeholder:text-[#64748b]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#94a3b8] text-sm">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
                    <SelectItem value="owner" className="text-[#e2e8f0]">Owner</SelectItem>
                    <SelectItem value="admin" className="text-[#e2e8f0]">Admin</SelectItem>
                    <SelectItem value="member" className="text-[#e2e8f0]">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] p-3 rounded-lg"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setInviteOpen(false)} className="text-[#94a3b8]">Cancel</Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                  className="btn-gradient text-white border-0 gap-2"
                >
                  {inviting && <Loader2 className="w-4 h-4 animate-spin" />} Invite
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(99,102,241,0.1)] hover:bg-transparent">
                <TableHead className="text-[#94a3b8]">Name</TableHead>
                <TableHead className="text-[#94a3b8] hidden sm:table-cell">Email</TableHead>
                <TableHead className="text-[#94a3b8]">Status</TableHead>
                <TableHead className="text-[#94a3b8]">Roles</TableHead>
                <TableHead className="text-[#94a3b8] hidden md:table-cell">Joined</TableHead>
                <TableHead className="text-[#94a3b8] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 && (
                <TableRow className="border-[rgba(99,102,241,0.1)] hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center text-[#94a3b8] py-8">
                    No members found
                  </TableCell>
                </TableRow>
              )}
              {members.map((m) => {
                const stCfg = MEMBER_STATUS_CFG[m.status] ?? MEMBER_STATUS_CFG.active
                const currentRole = m.roles[0]?.slug ?? 'member'
                return (
                  <TableRow key={m.id} className="border-[rgba(99,102,241,0.08)] hover:bg-[rgba(99,102,241,0.05)]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 h-8 bg-[rgba(99,102,241,0.15)]">
                          <AvatarFallback className="text-xs text-[#a78bfa]">
                            {getInitials(m.user.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[#e2e8f0] font-medium text-sm">
                          {m.user.displayName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-[#94a3b8] text-sm">{m.user.email}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs border-0 font-medium', stCfg.bg, stCfg.text)}>
                        {stCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Badge
                            key={r.id}
                            className={cn('text-xs border', ROLE_COLORS[r.slug] ?? ROLE_COLORS.member)}
                          >
                            {r.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-[#94a3b8] text-sm">{formatDate(m.joinedAt)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={currentRole}
                          onValueChange={(v) => handleChangeRole(m.id, v)}
                          disabled={changingRole === m.id}
                        >
                          <SelectTrigger className="w-24 h-7 text-xs bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.15)] text-[#e2e8f0]">
                            {changingRole === m.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent className="glass-strong border-[rgba(99,102,241,0.2)]">
                            <SelectItem value="owner" className="text-[#e2e8f0]">Owner</SelectItem>
                            <SelectItem value="admin" className="text-[#e2e8f0]">Admin</SelectItem>
                            <SelectItem value="member" className="text-[#e2e8f0]">Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
                              onClick={() => handleRemove(m.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="glass-strong border-[rgba(99,102,241,0.2)] text-[#e2e8f0]">
                            Remove member
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </motion.div>
  )
}

// ============================================================
// Domains Tab
// ============================================================

function DomainsTab({ orgId }: { orgId: string }) {
  const [domains, setDomains] = useState<OrgDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDomains = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}/domains`)
      const json: ApiResponseEnvelope<OrgDomain[]> = await res.json()
      if (json.error) throw new Error(json.error.message)
      setDomains(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchDomains() }, [fetchDomains])

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#e2e8f0]">Domains</h2>
          <p className="text-[#94a3b8] text-sm">Activated domains for this organization</p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] p-3 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {domains.length === 0 ? (
        <div className="glass-card p-8 rounded-xl flex flex-col items-center justify-center text-center">
          <Globe className="w-10 h-10 text-[#94a3b8] mb-3 opacity-50" />
          <h3 className="text-sm font-medium text-[#e2e8f0] mb-1">No domains activated</h3>
          <p className="text-xs text-[#94a3b8] max-w-sm">
            Domains provide specialized capabilities and modules for your agents.
            Activate a domain to unlock its features.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((od, i) => (
            <motion.div
              key={od.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 rounded-xl flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-[rgba(34,211,238,0.12)] flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-[#22d3ee]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-[#e2e8f0] text-sm truncate">{od.domain.name}</h4>
                  <Badge className="text-xs border-0 bg-[rgba(52,211,153,0.15)] text-[#34d399]">
                    {od.status}
                  </Badge>
                </div>
                <p className="text-xs text-[#94a3b8] truncate">{od.domain.description ?? od.domain.slug}</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-[#64748b]">Activated</p>
                <p className="text-xs text-[#94a3b8]">{formatDate(od.activatedAt)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ============================================================
// Autonomy Tab
// ============================================================

function AutonomyTab({ orgId }: { orgId: string }) {
  const [policy, setPolicy] = useState<AutonomyPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPolicy = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/autonomy?organizationId=${orgId}`)
      const json: ApiResponseEnvelope<AutonomyPolicy> = await res.json()
      if (json.error) throw new Error(json.error.message)
      setPolicy(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchPolicy() }, [fetchPolicy])

  const handleLevelChange = async (level: AutonomyLevel) => {
    if (!policy || level === policy.level) return
    setSaving(true)
    try {
      const res = await fetch(`/api/autonomy?organizationId=${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      setPolicy(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl space-y-4">
        <Skeleton className="h-6 w-48 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const currentLevel = policy?.level ?? 'balanced'

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#e2e8f0]">Autonomy Policy</h2>
        <p className="text-[#94a3b8] text-sm">
          Control how independently agents can operate within this organization
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] p-3 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(AUTONOMY_LEVELS) as [AutonomyLevel, typeof AUTONOMY_LEVELS[AutonomyLevel]][]).map(
          ([level, cfg]) => {
            const isActive = currentLevel === level
            return (
              <motion.button
                key={level}
                onClick={() => handleLevelChange(level)}
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'glass-card p-5 rounded-xl text-left transition-all cursor-pointer',
                  isActive ? `ring-2 ${cfg.color}` : 'hover:border-[rgba(99,102,241,0.2)]',
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{cfg.icon}</span>
                  <h3 className={cn(
                    'font-semibold text-sm',
                    isActive ? 'text-[#e2e8f0]' : 'text-[#94a3b8]',
                  )}>
                    {cfg.label}
                  </h3>
                  {isActive && saving && <Loader2 className="w-4 h-4 animate-spin text-[#6366f1]" />}
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">{cfg.description}</p>
              </motion.button>
            )
          },
        )}
      </div>
    </motion.div>
  )
}

// ============================================================
// Danger Zone Tab
// ============================================================

function DangerZoneTab({
  orgId,
  setOrganizations,
}: {
  orgId: string
  setOrganizations: (orgs: import('@/lib/types').OrganizationDto[]) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const activeOrg = useActiveOrg()

  const handleDelete = async () => {
    if (confirmText !== activeOrg?.name) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}`, { method: 'DELETE' })
      if (res.status !== 204) {
        const json = await res.json()
        if (json.error) throw new Error(json.error.message)
      }
      setDeleteOpen(false)
      setOrganizations([])
      useStore.getState().setActiveOrgId(null)
      navigate('organizations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-xl border-2 border-[rgba(239,68,68,0.25)] p-6 bg-[rgba(239,68,68,0.03)]">
        <h2 className="text-lg font-semibold text-[#ef4444] flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5" /> Danger Zone
        </h2>
        <p className="text-[#94a3b8] text-sm mb-6 max-w-lg">
          Irreversible and destructive actions. Once you delete an organization,
          there is no going back. All data, agents, missions, and configurations
          will be permanently removed.
        </p>

        <div className="glass-card p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-[#e2e8f0]">Delete this organization</h3>
            <p className="text-xs text-[#94a3b8] mt-1">
              Permanently remove {activeOrg?.name ?? 'this organization'} and all of its resources.
            </p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); setConfirmText(''); setError(null) }}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2 bg-[#ef4444] hover:bg-[#dc2626] text-white border-0 shrink-0">
                <Trash2 className="w-4 h-4" /> Delete Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-[rgba(239,68,68,0.3)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#ef4444]">Delete Organization</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-[#94a3b8]">
                  This will permanently delete <strong className="text-[#e2e8f0]">{activeOrg?.name}</strong> and all
                  associated data including agents, missions, and configurations.
                </p>
                <div className="space-y-2">
                  <Label className="text-[#94a3b8] text-sm">
                    Type <span className="text-[#ef4444] font-mono font-bold">{activeOrg?.name}</span> to confirm
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={activeOrg?.name}
                    className="bg-[rgba(15,16,28,0.6)] border-[rgba(239,68,68,0.25)] text-[#e2e8f0] placeholder:text-[#64748b] focus:border-[#ef4444]"
                  />
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] p-3 rounded-lg"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="text-[#94a3b8]">Cancel</Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleting || confirmText !== activeOrg?.name}
                    className="gap-2 bg-[#ef4444] hover:bg-[#dc2626] text-white border-0"
                  >
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Delete Permanently
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </motion.div>
  )
}
