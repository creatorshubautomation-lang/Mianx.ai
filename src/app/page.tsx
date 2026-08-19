'use client'

import { lazy, useEffect, useCallback, useState, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useStore, useCurrentView, useToasts, useUser } from '@/lib/store'
import { initRouter, navigate } from '@/lib/router'
import type { ViewName, OrganizationDto, ProfileDto, UiToast } from '@/lib/types'
import DashboardShell from '@/components/mianx/DashboardShell'

/**
 * Fetch the NextAuth session and restore user state.
 * Called on mount to handle page refreshes.
 */
async function restoreSessionFromServer(setUser: (user: ProfileDto | null) => void): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session')
    const session = await res.json()
    if (session?.user) {
      setUser({
        id: (session.user as Record<string, unknown>).id as string,
        email: session.user.email ?? '',
        displayName: (session.user as Record<string, unknown>).displayName as string || session.user.name || '',
        avatarUrl: session.user.image ?? null,
        locale: 'en',
        timezone: 'UTC',
        createdAt: new Date().toISOString(),
      })
      return true
    }
  } catch {
    // Session fetch failed — user is not authenticated
  }
  return false
}

// Lazy-loaded view components
const LandingView = lazy(() => import('@/components/views/LandingView'))
const LoginView = lazy(() => import('@/components/views/LoginView'))
const RegisterView = lazy(() => import('@/components/views/RegisterView'))
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

// Public views (no auth required)
const PUBLIC_VIEWS: ViewName[] = ['landing', 'login', 'register']

// View name to lazy component mapping
const VIEW_COMPONENTS: Record<ViewName, ReturnType<typeof lazy>> = {
  landing: LandingView,
  login: LoginView,
  register: RegisterView,
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

// View router for authenticated views (inside DashboardShell)
function AuthViewRouter() {
  const currentView = useCurrentView()
  const Component = VIEW_COMPONENTS[currentView]

  return (
    <Suspense fallback={<ViewLoadingFallback />}>
      <Component />
    </Suspense>
  )
}

// View router for public views (no shell)
function PublicViewRouter() {
  const currentView = useCurrentView()
  const Component = VIEW_COMPONENTS[currentView]

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
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
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const currentView = useCurrentView()
  const setUser = useStore((s) => s.setUser)
  const setOrganizations = useStore((s) => s.setOrganizations)
  const [sessionChecked, setSessionChecked] = useState(false)

  const isPublicView = PUBLIC_VIEWS.includes(currentView)

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const json = await res.json()
        const orgs: OrganizationDto[] = json.data ?? json ?? []
        setOrganizations(orgs)
      }
    } catch {
      // Organizations fetch failed — will retry on next auth state change
    }
  }, [setOrganizations])

  useEffect(() => {
    // Initialize hash-based router
    const cleanupRouter = initRouter()

    // On mount, check for existing session (handles page refresh)
    let cancelled = false
    ;(async () => {
      const hasSession = await restoreSessionFromServer(setUser)
      if (!cancelled) {
        setSessionChecked(true)
        if (hasSession) {
          fetchOrganizations()
        }
      }
    })()

    return () => {
      cancelled = true
      cleanupRouter()
    }
  }, [setUser, fetchOrganizations])

  // If user is authenticated but on a public view, redirect to dashboard
  useEffect(() => {
    if (sessionChecked && isAuthenticated && isPublicView) {
      navigate('dashboard')
    }
  }, [sessionChecked, isAuthenticated, isPublicView])

  // If user is NOT authenticated and on a protected view, redirect to login
  useEffect(() => {
    if (sessionChecked && !isAuthenticated && !isPublicView) {
      navigate('login')
    }
  }, [sessionChecked, isAuthenticated, isPublicView])

  // Fetch organizations when auth state changes to authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrganizations()
    }
  }, [isAuthenticated, fetchOrganizations])

  // Don't render auth-gated content until session check completes
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Render public views without DashboardShell
  if (isPublicView) {
    return (
      <>
        <PublicViewRouter />
        <ToastContainer />
      </>
    )
  }

  // Render authenticated views inside DashboardShell
  return (
    <DashboardShell>
      <AuthViewRouter />
      <ToastContainer />
    </DashboardShell>
  )
}
