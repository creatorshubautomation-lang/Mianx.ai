// ============================================================
// MIANX.AI V3 — Hash-Based SPA Router
// Uses window.location.hash for client-side routing within
// a single Next.js page.tsx entry point.
// ============================================================

import { useStore } from './store'
import type { ViewName } from './types'

/** Parse the current hash into a view name and params */
export function parseHash(): { view: ViewName; params: Record<string, string> } {
  const hash = typeof window !== 'undefined' ? window.location.hash : ''

  if (!hash || hash === '#' || hash === '#/') {
    return { view: 'landing', params: {} }
  }

  const path = hash.startsWith('#') ? hash.slice(1) : hash
  const segments = path.split('/').filter(Boolean)

  if (segments.length === 0) {
    return { view: 'landing', params: {} }
  }

  const viewSegment = segments[0]

  // Check parameterized routes first
  if (viewSegment === 'missions' && segments.length === 2) {
    return {
      view: 'mission-detail',
      params: { missionId: segments[1] },
    }
  }

  // Static view mapping
  const viewMap: Record<string, ViewName> = {
    landing: 'landing',
    login: 'login',
    dashboard: 'dashboard',
    missions: 'missions',
    agents: 'agents',
    workflows: 'workflows',
    billing: 'billing',
    organizations: 'organizations',
    'org-settings': 'org-settings',
    integrations: 'integrations',
    'trust-center': 'trust-center',
    'command-center': 'command-center',
    settings: 'settings',
  }

  const matchedView = viewMap[viewSegment] ?? 'home'
  return { view: matchedView, params: {} }
}

/**
 * Navigate to a view, updating the URL hash and the Zustand store.
 *
 * @example
 * navigate('dashboard')
 * navigate('mission-detail', { missionId: 'abc123' })
 */
export function navigate(
  view: ViewName,
  params: Record<string, string> = {},
): void {
  if (typeof window === 'undefined') return

  let hash = '#/'
  if (view === 'mission-detail' && params.missionId) {
    hash = `#/missions/${params.missionId}`
  } else if (view !== 'landing') {
    hash = `#/${view}`
  }

  window.location.hash = hash
}

/**
 * Get the current view and params from the hash.
 * Useful for initial render.
 */
export function getCurrentRoute(): { view: ViewName; params: Record<string, string> } {
  return parseHash()
}

/**
 * Initialize the hash router listener.
 * Call this once in the app root component's useEffect.
 *
 * @returns A cleanup function to remove the listener.
 */
export function initRouter(): () => void {
  // Sync initial state
  const { view, params } = parseHash()
  useStore.getState().setCurrentView(view, params)

  const handleHashChange = () => {
    const route = parseHash()
    const store = useStore.getState()
    store.setCurrentView(route.view, route.params)

    // If navigating to mission-detail, set the active mission ID
    if (route.view === 'mission-detail' && route.params.missionId) {
      store.setActiveMissionId(route.params.missionId)
    }
  }

  window.addEventListener('hashchange', handleHashChange)

  // Return cleanup function
  return () => {
    window.removeEventListener('hashchange', handleHashChange)
  }
}

/**
 * Get a human-readable label for a view name.
 */
export function getViewLabel(view: ViewName): string {
  const labels: Record<ViewName, string> = {
    landing: 'Landing',
    login: 'Login',
    home: 'Home',
    dashboard: 'Dashboard',
    missions: 'Missions',
    'mission-detail': 'Mission Detail',
    agents: 'Agents',
    workflows: 'Workflows',
    billing: 'Billing',
    organizations: 'Organizations',
    'org-settings': 'Organization Settings',
    integrations: 'Integrations',
    'trust-center': 'Trust Center',
    'command-center': 'Command Center',
    settings: 'Settings',
  }
  return labels[view] ?? view
}

/** All available view names for navigation menus */
export const ALL_VIEWS: ViewName[] = [
  'landing',
  'login',
  'home',
  'dashboard',
  'missions',
  'agents',
  'workflows',
  'billing',
  'organizations',
  'org-settings',
  'integrations',
  'trust-center',
  'command-center',
  'settings',
]
