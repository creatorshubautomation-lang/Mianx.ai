'use client'

import { lazy, useEffect, useCallback, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useStore, useCurrentView, useToasts } from '@/lib/store'
import { initRouter, navigate } from '@/lib/router'
import type { ViewName, OrganizationDto, ProfileDto, UiToast } from '@/lib/types'
import DashboardShell from '@/components/mianx/DashboardShell'

// Lazy-loaded view components
const HomeView = lazy(() => import('@/components/views/HomeView'))
const DashboardView = lazy(() => import('@/components/views/DashboardView'))
const MissionsView = lazy(() => import('@/components/views/MissionsView'))
const MissionDetailView = lazy(() => import('@/components/views/MissionDetailView'))
const AgentsView = lazy(() => import('@/components/views/AgentsView'))
const WorkflowsView = lazy(() => import('@/components/views/WorkflowsView'))
const BillingView = lazy(() => import('@/components/views/BillingView'))
const OrganizationsView = lazy(() => import('@/components/views/OrganizationsView'))
const OrgSettingsView = lazy(() => import('@/components/views/OrgSettingsView'))
const IntegrationsView = lazy(() => import('@/components/views/IntegrationsView'))
const TrustCenterView = lazy(() => import('@/components/views/TrustCenterView'))
const CommandCenterView = lazy(() => import('@/components/views/CommandCenterView'))
const SettingsView = lazy(() => import('@/components/views/SettingsView'))

// View name to lazy component mapping
const VIEW_COMPONENTS: Record<ViewName, ReturnType<typeof lazy>> = {
  home: HomeView,
  dashboard: DashboardView,
  missions: MissionsView,
  'mission-detail': MissionDetailView,
  agents: AgentsView,
  workflows: WorkflowsView,
  billing: BillingView,
  organizations: OrganizationsView,
  'org-settings': OrgSettingsView,
  integrations: IntegrationsView,
  'trust-center': TrustCenterView,
  'command-center': CommandCenterView,
  settings: SettingsView,
}

// Loading skeleton for Suspense fallback
function ViewLoadingFallback() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-8 w-48 rounded-lg bg-[rgba(99,102,241,0.08)]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl bg-[rgba(99,102,241,0.06)]" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl bg-[rgba(99,102,241,0.06)]" />
    </div>
  )
}

// View router that renders the correct lazy component based on current view
function ViewRouter() {
  const currentView = useCurrentView()
  const Component = VIEW_COMPONENTS[currentView]

  return (
    <Suspense fallback={<ViewLoadingFallback />}>
      <Component />
    </Suspense>
  )
}

// Toast notification container
function ToastContainer() {
  const toasts = useToasts()
  const removeToast = useStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast: UiToast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'pointer-events-auto glass-strong rounded-lg px-4 py-3 max-w-sm shadow-lg flex items-start gap-3',
              toast.variant === 'destructive' && 'border-[#ef4444]/30',
              toast.variant === 'success' && 'border-[#34d399]/30'
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#e2e8f0]">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-[#94a3b8] mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 rounded text-[#64748b] hover:text-[#e2e8f0] transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default function AppPage() {
  const setUser = useStore((s) => s.setUser)
  const setOrganizations = useStore((s) => s.setOrganizations)

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const json = await res.json()
        const orgs: OrganizationDto[] = json.data ?? json ?? []
        setOrganizations(orgs)
      }
    } catch {
      // Organizations fetch failed — non-critical, app still works
    }
  }, [setOrganizations])

  useEffect(() => {
    // Initialize hash-based router
    const cleanupRouter = initRouter()

    // Set demo user if not authenticated
    const store = useStore.getState()
    if (!store.isAuthenticated) {
      const demoUser: ProfileDto = {
        id: 'demo-user-001',
        email: 'demo@mianx.ai',
        displayName: 'Alex Chen',
        avatarUrl: null,
        locale: 'en',
        timezone: 'UTC',
        createdAt: new Date().toISOString(),
      }
      setUser(demoUser)
    }

    // Fetch organizations
    fetchOrganizations()

    // Navigate to dashboard on first load if at home
    if (store.currentView === 'home') {
      navigate('dashboard')
    }

    return () => {
      cleanupRouter()
    }
  }, [setUser, fetchOrganizations])

  return (
    <DashboardShell>
      <ViewRouter />
      <ToastContainer />
    </DashboardShell>
  )
}
