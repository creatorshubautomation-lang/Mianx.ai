'use client'

import { type ReactNode, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Bell,
  Menu,
  Settings,
  LogOut,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  useStore,
  useUser,
  useActiveOrg,
  useUserMode,
  useSidebarOpen,
} from '@/lib/store'
import { navigate } from '@/lib/router'
import type { UserMode } from '@/lib/types'
import Sidebar from './Sidebar'

const MODE_OPTIONS: { value: UserMode; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'pro', label: 'Pro' },
  { value: 'expert', label: 'Expert' },
]

function UserModeSwitcher() {
  const userMode = useUserMode()
  const setUserMode = useStore((s) => s.setUserMode)

  const handleModeChange = useCallback(
    (mode: UserMode) => {
      setUserMode(mode)
    },
    [setUserMode]
  )

  return (
    <div className="hidden sm:flex items-center gap-0.5 p-1 rounded-lg bg-[rgba(15,16,28,0.6)] border border-[rgba(99,102,241,0.12)]">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleModeChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50',
            userMode === opt.value
              ? 'bg-accent text-accent-foreground shadow-sm'
              : 'text-[#64748b] hover:text-[#94a3b8]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function UserAvatarDropdown() {
  const user = useUser()
  const logout = useStore((s) => s.logout)

  const initials = useMemo(() => {
    if (!user) return '?'
    return user.displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [user])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-[rgba(99,102,241,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.displayName ?? 'User'} />
            <AvatarFallback className="text-xs bg-[rgba(99,102,241,0.2)] text-[#a5b4fc]">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 glass-strong rounded-lg p-1">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-[#e2e8f0] truncate">{user?.displayName ?? 'Demo User'}</p>
          <p className="text-xs text-[#64748b] truncate">{user?.email ?? 'demo@mianx.ai'}</p>
        </div>
        <DropdownMenuSeparator className="bg-[rgba(99,102,241,0.12)]" />
        <DropdownMenuItem
          onClick={() => navigate('settings')}
          className="rounded-md px-3 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)] cursor-pointer"
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[rgba(99,102,241,0.12)]" />
        <DropdownMenuItem
          onClick={logout}
          className="rounded-md px-3 py-2 text-sm text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileMenuButton() {
  return (
    <button
      className="md:hidden p-2 rounded-lg text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50"
      aria-label="Toggle navigation menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}

function Header() {
  const activeOrg = useActiveOrg()

  return (
    <header className="sticky top-0 z-30 glass-strong">
      <div className="flex items-center justify-between h-14 px-4 md:px-6">
        {/* Left side: mobile menu + org name */}
        <div className="flex items-center gap-3 min-w-0">
          <MobileMenuButton />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#e2e8f0] truncate">
              {activeOrg?.name ?? 'Mianx'}
            </p>
          </div>
        </div>

        {/* Center: search (hidden on mobile) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input
              type="text"
              placeholder="Search missions, agents, workflows..."
              className="w-full h-9 pl-9 pr-4 text-sm rounded-lg bg-[rgba(15,16,28,0.6)] border border-[rgba(99,102,241,0.12)] text-[#e2e8f0] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 focus:border-[rgba(99,102,241,0.3)] transition-colors"
            />
          </div>
        </div>

        {/* Right side: mode switcher + notifications + avatar */}
        <div className="flex items-center gap-2">
          <UserModeSwitcher />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="relative p-2 rounded-lg text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#22d3ee]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass-strong text-[#e2e8f0]">
              Notifications
            </TooltipContent>
          </Tooltip>

          <UserAvatarDropdown />
        </div>
      </div>
    </header>
  )
}

interface DashboardShellProps {
  children: ReactNode
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const sidebarOpen = useSidebarOpen()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mesh gradient background */}
      <div className="mesh-bg" aria-hidden="true" />

      <div className="flex flex-1 relative z-10">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-4 md:p-6">
            <motion.div
              key={useStore((s) => s.currentView)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}
