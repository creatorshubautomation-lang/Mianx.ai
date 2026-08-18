'use client'

import { useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Target,
  Bot,
  GitBranch,
  CreditCard,
  ShieldCheck,
  Terminal,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Sparkles,
  ChevronDown,
  Menu,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useStore, useUser, useActiveOrg, useCurrentView, useSidebarOpen } from '@/lib/store'
import { navigate, getViewLabel } from '@/lib/router'
import type { ViewName } from '@/lib/types'

// Navigation items — skip 'home', 'mission-detail', 'organizations', 'org-settings'
const SIDEBAR_VIEWS: ViewName[] = [
  'dashboard',
  'missions',
  'agents',
  'workflows',
  'integrations',
  'billing',
  'trust-center',
  'command-center',
  'settings',
]

const NAV_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  missions: Target,
  'mission-detail': Target,
  agents: Bot,
  workflows: GitBranch,
  billing: CreditCard,
  organizations: Building2,
  'org-settings': Building2,
  integrations: GitBranch,
  'trust-center': ShieldCheck,
  'command-center': Terminal,
  settings: Settings,
}

// Shared nav item renderer
function NavItem({ view, collapsed, onClick }: { view: ViewName; collapsed: boolean; onClick?: () => void }) {
  const currentView = useCurrentView()
  const isActive = currentView === view
  const Icon = NAV_ICONS[view] ?? Settings
  const label = getViewLabel(view)

  const handleClick = useCallback(() => {
    navigate(view)
    onClick?.()
  }, [view, onClick])

  const content = (
    <button
      onClick={handleClick}
      className={cn(
        'group relative flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-[#94a3b8] hover:bg-[rgba(99,102,241,0.08)] hover:text-[#e2e8f0]'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#6366f1]"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
      <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-[#a5b4fc]' : 'text-[#64748b] group-hover:text-[#e2e8f0]')} />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="truncate whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="glass-strong text-[#e2e8f0]">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

// Organization switcher
function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const organizations = useStore((s) => s.organizations)
  const activeOrgId = useStore((s) => s.activeOrgId)
  const setActiveOrgId = useStore((s) => s.setActiveOrgId)
  const activeOrg = useActiveOrg()

  const handleSelect = useCallback(
    (orgId: string) => {
      setActiveOrgId(orgId)
    },
    [setActiveOrgId]
  )

  if (organizations.length === 0) {
    return null
  }

  const triggerContent = (
    <div
      className={cn(
        'flex items-center gap-2 w-full rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(99,102,241,0.08)] cursor-pointer',
        collapsed && 'justify-center px-2'
      )}
    >
      <Building2 className="w-4 h-4 text-[#64748b] shrink-0" />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 truncate min-w-0 overflow-hidden"
          >
            <span className="text-sm font-medium text-[#e2e8f0] truncate">
              {activeOrg?.name ?? 'Select Org'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748b] shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="w-56 glass-strong rounded-lg p-1"
      >
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSelect(org.id)}
            className={cn(
              'rounded-md px-3 py-2 text-sm cursor-pointer transition-colors',
              org.id === activeOrgId
                ? 'bg-accent text-accent-foreground'
                : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)]'
            )}
          >
            <Building2 className="w-4 h-4 mr-2" />
            {org.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-[rgba(99,102,241,0.12)]" />
        <DropdownMenuItem
          onClick={() => navigate('organizations')}
          className="rounded-md px-3 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)] cursor-pointer"
        >
          Manage Organizations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// User section at bottom
function UserSection({ collapsed }: { collapsed: boolean }) {
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

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return (
    <div className="mt-auto pt-2">
      <Separator className="bg-[rgba(99,102,241,0.12)] mb-2" />
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(99,102,241,0.08)]',
          collapsed && 'justify-center px-2'
        )}
      >
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.displayName ?? 'User'} />
          <AvatarFallback className="text-xs bg-[rgba(99,102,241,0.2)] text-[#a5b4fc]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 truncate min-w-0 flex-1 overflow-hidden"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#e2e8f0] truncate">{user?.displayName ?? 'Demo User'}</p>
                <p className="text-xs text-[#64748b] truncate">{user?.email ?? 'demo@mianx.ai'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="shrink-0 p-1.5 rounded-md text-[#64748b] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Sidebar toggle button
function ToggleButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center w-full rounded-lg py-1.5 text-[#64748b] hover:text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50',
        collapsed && 'px-2'
      )}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? (
        <ChevronRight className="w-4 h-4" />
      ) : (
        <div className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs">Collapse</span>
        </div>
      )}
    </button>
  )
}
// Full sidebar content (shared between desktop and mobile)
function SidebarContent({
  collapsed,
  onClose,
}: {
  collapsed: boolean
  onClose?: () => void
}) {
  const toggleSidebar = useStore((s) => s.toggleSidebar)

  const handleToggle = useCallback(() => {
    toggleSidebar()
  }, [toggleSidebar])

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 h-14 shrink-0',
          collapsed && 'justify-center px-2'
        )}
      >
        <Sparkles className="w-6 h-6 text-[#22d3ee] shrink-0" />
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.h1
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xl font-bold gradient-text truncate whitespace-nowrap overflow-hidden"
            >
              Mianx
            </motion.h1>
          )}
        </AnimatePresence>
      </div>

      <Separator className="bg-[rgba(99,102,241,0.12)]" />

      {/* Org Switcher */}
      <div className="px-2 py-2">
        <OrgSwitcher collapsed={collapsed} />
      </div>

      <Separator className="bg-[rgba(99,102,241,0.12)]" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-1" role="navigation" aria-label="Main navigation">
          {SIDEBAR_VIEWS.map((view) => (
            <NavItem key={view} view={view} collapsed={collapsed} onClick={onClose} />
          ))}
        </nav>
      </ScrollArea>

      {/* Toggle + User */}
      <div className="px-2 pb-3">
        <ToggleButton collapsed={collapsed} onClick={handleToggle} />
        <UserSection collapsed={collapsed} />
      </div>
    </div>
  )
}
// Desktop sidebar
function DesktopSidebar() {
  const sidebarOpen = useSidebarOpen()

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 256 : 68 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden md:flex flex-col h-screen sticky top-0 glass-strong overflow-hidden shrink-0 z-20"
    >
      <SidebarContent collapsed={!sidebarOpen} />
    </motion.aside>
  )
}

// Mobile sidebar (Sheet)
function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-lg glass text-[#94a3b8] hover:text-[#e2e8f0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/50"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 glass-strong border-r border-[rgba(99,102,241,0.12)]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContent collapsed={false} />
      </SheetContent>
    </Sheet>
  )
}

// Exported sidebar that renders appropriate variant
export default function Sidebar() {
  return (
    <>
      <MobileSidebar />
      <DesktopSidebar />
    </>
  )
}
