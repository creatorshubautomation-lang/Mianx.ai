'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Palette,
  Bell,
  Info,
  Save,
  Check,
  Loader2,
  ExternalLink,
  Sparkles,
  Zap,
  Code2,
  Shield,
  Globe,
  Clock,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useUser, useStore, useUserMode } from "@/lib/store"
import { cn } from '@/lib/utils'
import type { UserMode } from '@prisma/client'

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
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

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'pt', label: 'Português' },
  { value: 'ko', label: '한국어' },
]

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/Denver', label: 'Mountain (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Kolkata', label: 'Kolkata' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

const MODE_OPTIONS: Array<{
  value: UserMode
  label: string
  description: string
  color: string
  bg: string
  icon: typeof Sparkles
}> = [
  {
    value: 'simple',
    label: 'Simple',
    description: 'Clean interface focused on goals and progress.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    icon: Sparkles,
  },
  {
    value: 'pro',
    label: 'Pro',
    description: 'Budget, deadlines, agent selection, cost tracking.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    icon: Zap,
  },
  {
    value: 'expert',
    label: 'Expert',
    description: 'Full task graph, event logs, raw plan, verification.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    icon: Code2,
  },
]

// ============================================================
// Profile Section
// ============================================================

function ProfileSection() {
  const user = useUser()
  const [displayName, setDisplayName] = useState(() => user?.displayName ?? '')
  const [locale, setLocale] = useState(() => user?.locale ?? 'en')
  const [timezone, setTimezone] = useState(() => user?.timezone ?? 'UTC')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    // Simulate save — in production this calls PUT /api/profile
    await new Promise((r) => setTimeout(r, 800))
    useStore.getState().setUser({
      ...user!,
      displayName,
      locale,
      timezone,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const initials = user?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'U'

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center gap-2 mb-6">
        <User className="w-4 h-4 text-[#6366f1]" />
        <h2 className="text-base font-semibold text-[#e2e8f0]">Profile</h2>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Avatar className="w-14 h-14">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-full" />
          ) : (
            <AvatarFallback
              className="text-sm font-bold bg-gradient-to-br from-[#6366f1] to-[#22d3ee] text-white"
            >
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        <div>
          <p className="text-sm font-medium text-[#e2e8f0]">{displayName || 'Unnamed User'}</p>
          <p className="text-xs text-[#94a3b8]">{user?.email ?? 'No email'}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#94a3b8]">Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.12)] text-[#e2e8f0] placeholder:text-[#64748b]"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#94a3b8]">Email</Label>
          <Input
            value={user?.email ?? ''}
            disabled
            className="bg-[rgba(15,16,28,0.4)] border-[rgba(99,102,241,0.08)] text-[#64748b] cursor-not-allowed"
          />
          <p className="text-[10px] text-[#64748b]">Email cannot be changed here.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Locale
            </Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.12)] text-[#e2e8f0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[rgba(15,16,28,0.95)] border-[rgba(99,102,241,0.15)]">
                {LOCALE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[#e2e8f0] focus:bg-[rgba(99,102,241,0.1)] focus:text-[#e2e8f0]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#94a3b8] flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Timezone
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-[rgba(15,16,28,0.6)] border-[rgba(99,102,241,0.12)] text-[#e2e8f0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[rgba(15,16,28,0.95)] border-[rgba(99,102,241,0.15)]">
                {TIMEZONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[#e2e8f0] focus:bg-[rgba(99,102,241,0.1)] focus:text-[#e2e8f0]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          className={cn(
            'btn-gradient text-white gap-2 transition-all',
            saved && 'bg-[#34d399] hover:bg-[#34d399]',
          )}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </motion.div>
  )
}

// ============================================================
// Appearance Section
// ============================================================

function AppearanceSection() {
  const userMode = useUserMode()
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center gap-2 mb-6">
        <Palette className="w-4 h-4 text-[#a78bfa]" />
        <h2 className="text-base font-semibold text-[#e2e8f0]">Appearance</h2>
      </div>

      {/* User Mode */}
      <div className="space-y-3 mb-6">
        <Label className="text-xs text-[#94a3b8] font-medium">Interface Mode</Label>
        <p className="text-[11px] text-[#64748b] mb-3">Choose how much detail you see in the Command Center and other views.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODE_OPTIONS.map((mode) => {
            const Icon = mode.icon
            const isActive = userMode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => useStore.getState().setUserMode(mode.value)}
                className={cn(
                  'relative p-4 rounded-xl text-left transition-all border',
                  isActive
                    ? 'border-[rgba(99,102,241,0.4)] shadow-[0_0_16px_rgba(99,102,241,0.15)]'
                    : 'border-[rgba(99,102,241,0.08)] hover:border-[rgba(99,102,241,0.2)]',
                )}
                style={{ backgroundColor: isActive ? mode.bg : 'rgba(15,16,28,0.4)' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mode-indicator"
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: mode.color }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                )}
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${mode.color}18` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: mode.color }} />
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isActive ? mode.color : '#e2e8f0' }}
                  >
                    {mode.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#94a3b8] leading-relaxed">{mode.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <Separator className="bg-[rgba(99,102,241,0.08)] mb-6" />

      {/* Sidebar Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(99,102,241,0.08)] flex items-center justify-center">
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 text-[#6366f1]" />
            ) : (
              <PanelLeft className="w-4 h-4 text-[#6366f1]" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-[#e2e8f0]">Sidebar</p>
            <p className="text-[11px] text-[#64748b]">Show the navigation sidebar</p>
          </div>
        </div>
        <Switch
          checked={sidebarOpen}
          onCheckedChange={setSidebarOpen}
          className="data-[state=checked]:bg-[#6366f1]"
        />
      </div>
    </motion.div>
  )
}

// ============================================================
// Notifications Section
// ============================================================

function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    missionUpdates: true,
    approvalRequests: true,
    agentCompletions: false,
    billingAlerts: true,
  })

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const items = [
    {
      key: 'missionUpdates' as const,
      icon: Zap,
      label: 'Mission Updates',
      description: 'Get notified when missions change status or progress significantly.',
    },
    {
      key: 'approvalRequests' as const,
      icon: Shield,
      label: 'Approval Requests',
      description: 'Receive alerts when your approval is needed for agent actions.',
    },
    {
      key: 'agentCompletions' as const,
      icon: Check,
      label: 'Agent Completions',
      description: 'Notify when agents finish their assigned tasks.',
    },
    {
      key: 'billingAlerts' as const,
      icon: Bell,
      label: 'Billing Alerts',
      description: 'Warnings about usage limits, invoices, and billing events.',
    },
  ]

  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-4 h-4 text-[#f59e0b]" />
        <h2 className="text-base font-semibold text-[#e2e8f0]">Notifications</h2>
      </div>

      <div className="space-y-1">
        {items.map((item, idx) => {
          const Icon = item.icon
          return (
            <div key={item.key}>
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(245,158,11,0.08)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#f59e0b]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#e2e8f0]">{item.label}</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs[item.key]}
                  onCheckedChange={() => toggle(item.key)}
                  className="data-[state=checked]:bg-[#6366f1] flex-shrink-0"
                />
              </div>
              {idx < items.length - 1 && (
                <Separator className="bg-[rgba(99,102,241,0.06)]" />
              )}
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-[#64748b] mt-4">Notification preferences are saved locally.</p>
    </motion.div>
  )
}

// ============================================================
// About Section
// ============================================================

function AboutSection() {
  return (
    <motion.div className="glass-card p-6 rounded-xl" variants={itemVariants}>
      <div className="flex items-center gap-2 mb-5">
        <Info className="w-4 h-4 text-[#94a3b8]" />
        <h2 className="text-base font-semibold text-[#e2e8f0]">About Mianx</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94a3b8]">Version</span>
          <Badge
            variant="outline"
            className="text-[10px] border-[rgba(99,102,241,0.15)] text-[#a78bfa] bg-[rgba(99,102,241,0.06)]"
          >
            v3.0.0
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94a3b8]">Edition</span>
          <span className="text-sm text-[#e2e8f0]">Team</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#94a3b8]">Runtime</span>
          <span className="text-sm text-[#e2e8f0]">Next.js 16 + Bun</span>
        </div>
      </div>

      <Separator className="bg-[rgba(99,102,241,0.08)] my-5" />

      <div className="space-y-2.5">
        <a
          href="#"
          className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors group"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Documentation</span>
          <span className="ml-auto text-[10px] text-[#64748b] group-hover:text-[#94a3b8] transition-colors">docs.mianx.ai</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors group"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>API Reference</span>
          <span className="ml-auto text-[10px] text-[#64748b] group-hover:text-[#94a3b8] transition-colors">api.mianx.ai</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors group"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Changelog</span>
          <span className="ml-auto text-[10px] text-[#64748b] group-hover:text-[#94a3b8] transition-colors">v3.0.0</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors group"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Support</span>
          <span className="ml-auto text-[10px] text-[#64748b] group-hover:text-[#94a3b8] transition-colors">help.mianx.ai</span>
        </a>
      </div>

      <p className="text-[10px] text-[#64748b] mt-5">
        © {new Date().getFullYear()} Mianx.ai — The Agentic AI Operating System for Modern Teams.
      </p>
    </motion.div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function SettingsView() {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const user = useUser()

  if (!isAuthenticated || !user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-xl flex flex-col items-center justify-center min-h-[40vh]"
        >
          <User className="w-10 h-10 text-[#94a3b8] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#94a3b8]">Sign in to access settings</p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6 animate-fade-in max-w-3xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        <p className="text-sm text-[#94a3b8] mt-1.5">Manage your profile, appearance, and preferences.</p>
      </motion.div>

      {/* Profile */}
      <ProfileSection />

      {/* Appearance */}
      <AppearanceSection />

      {/* Notifications */}
      <NotificationsSection />

      {/* About */}
      <AboutSection />
    </motion.div>
  )
}
