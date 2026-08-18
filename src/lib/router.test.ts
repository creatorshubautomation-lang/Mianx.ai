import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseHash,
  navigate,
  getCurrentRoute,
  getViewLabel,
  ALL_VIEWS,
  initRouter,
} from '@/lib/router'

// ============================================================
// Mock window and store
// ============================================================

const mockSetCurrentView = vi.fn()
const mockSetActiveMissionId = vi.fn()
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

// Store location hash
let currentHash = ''

vi.mock('@/lib/store', () => ({
  useStore: {
    getState: () => ({
      setCurrentView: mockSetCurrentView,
      setActiveMissionId: mockSetActiveMissionId,
    }),
  },
}))

// Mock window.location
Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      get hash() { return currentHash },
      set hash(v) { currentHash = v },
    },
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
})

beforeEach(() => {
  vi.clearAllMocks()
  currentHash = ''
})

afterEach(() => {
  currentHash = ''
})

// ============================================================
// parseHash (via getCurrentRoute)
// ============================================================

describe('parseHash / getCurrentRoute', () => {
  it('returns landing for empty hash', () => {
    currentHash = ''
    const route = getCurrentRoute()
    expect(route.view).toBe('landing')
    expect(route.params).toEqual({})
  })

  it('returns landing for # alone', () => {
    currentHash = '#'
    const route = getCurrentRoute()
    expect(route.view).toBe('landing')
  })

  it('returns landing for #/ only', () => {
    currentHash = '#/'
    const route = getCurrentRoute()
    expect(route.view).toBe('landing')
  })

  it('returns login for #/login', () => {
    currentHash = '#/login'
    const route = getCurrentRoute()
    expect(route.view).toBe('login')
  })

  it('returns dashboard for #/dashboard', () => {
    currentHash = '#/dashboard'
    const route = getCurrentRoute()
    expect(route.view).toBe('dashboard')
  })

  it('returns missions for #/missions', () => {
    currentHash = '#/missions'
    const route = getCurrentRoute()
    expect(route.view).toBe('missions')
  })

  it('returns agents for #/agents', () => {
    currentHash = '#/agents'
    const route = getCurrentRoute()
    expect(route.view).toBe('agents')
  })

  it('returns workflows for #/workflows', () => {
    currentHash = '#/workflows'
    const route = getCurrentRoute()
    expect(route.view).toBe('workflows')
  })

  it('returns billing for #/billing', () => {
    currentHash = '#/billing'
    const route = getCurrentRoute()
    expect(route.view).toBe('billing')
  })

  it('returns organizations for #/organizations', () => {
    currentHash = '#/organizations'
    const route = getCurrentRoute()
    expect(route.view).toBe('organizations')
  })

  it('returns org-settings for #/org-settings', () => {
    currentHash = '#/org-settings'
    const route = getCurrentRoute()
    expect(route.view).toBe('org-settings')
  })

  it('returns integrations for #/integrations', () => {
    currentHash = '#/integrations'
    const route = getCurrentRoute()
    expect(route.view).toBe('integrations')
  })

  it('returns trust-center for #/trust-center', () => {
    currentHash = '#/trust-center'
    const route = getCurrentRoute()
    expect(route.view).toBe('trust-center')
  })

  it('returns command-center for #/command-center', () => {
    currentHash = '#/command-center'
    const route = getCurrentRoute()
    expect(route.view).toBe('command-center')
  })

  it('returns settings for #/settings', () => {
    currentHash = '#/settings'
    const route = getCurrentRoute()
    expect(route.view).toBe('settings')
  })

  it('returns mission-detail with missionId for #/missions/abc123', () => {
    currentHash = '#/missions/abc123'
    const route = getCurrentRoute()
    expect(route.view).toBe('mission-detail')
    expect(route.params.missionId).toBe('abc123')
  })

  it('returns home for unknown view', () => {
    currentHash = '#/unknown-view'
    const route = getCurrentRoute()
    expect(route.view).toBe('home')
  })

  it('returns landing for #/landing', () => {
    currentHash = '#/landing'
    const route = getCurrentRoute()
    expect(route.view).toBe('landing')
    expect(route.params).toEqual({})
  })
})

// ============================================================
// navigate
// ============================================================

describe('navigate', () => {
  it('sets empty hash for landing', () => {
    navigate('landing')
    expect(currentHash).toBe('#/')
  })

  it('sets hash to #/home for home', () => {
    navigate('home')
    expect(currentHash).toBe('#/home')
  })

  it('sets hash to #/dashboard', () => {
    navigate('dashboard')
    expect(currentHash).toBe('#/dashboard')
  })

  it('sets hash to #/missions/missionId for mission-detail', () => {
    navigate('mission-detail', { missionId: 'm1' })
    expect(currentHash).toBe('#/missions/m1')
  })

  it('navigates to agents', () => {
    navigate('agents')
    expect(currentHash).toBe('#/agents')
  })

  it('navigates to settings', () => {
    navigate('settings')
    expect(currentHash).toBe('#/settings')
  })
})

// ============================================================
// getViewLabel
// ============================================================

describe('getViewLabel', () => {
  it('returns Home for home', () => {
    expect(getViewLabel('home')).toBe('Home')
  })

  it('returns Dashboard for dashboard', () => {
    expect(getViewLabel('dashboard')).toBe('Dashboard')
  })

  it('returns Missions for missions', () => {
    expect(getViewLabel('missions')).toBe('Missions')
  })

  it('returns Mission Detail for mission-detail', () => {
    expect(getViewLabel('mission-detail')).toBe('Mission Detail')
  })

  it('returns Agents for agents', () => {
    expect(getViewLabel('agents')).toBe('Agents')
  })

  it('returns Workflows for workflows', () => {
    expect(getViewLabel('workflows')).toBe('Workflows')
  })

  it('returns Billing for billing', () => {
    expect(getViewLabel('billing')).toBe('Billing')
  })

  it('returns Organizations for organizations', () => {
    expect(getViewLabel('organizations')).toBe('Organizations')
  })

  it('returns Organization Settings for org-settings', () => {
    expect(getViewLabel('org-settings')).toBe('Organization Settings')
  })

  it('returns Integrations for integrations', () => {
    expect(getViewLabel('integrations')).toBe('Integrations')
  })

  it('returns Trust Center for trust-center', () => {
    expect(getViewLabel('trust-center')).toBe('Trust Center')
  })

  it('returns Command Center for command-center', () => {
    expect(getViewLabel('command-center')).toBe('Command Center')
  })

  it('returns Settings for settings', () => {
    expect(getViewLabel('settings')).toBe('Settings')
  })
})

// ============================================================
// ALL_VIEWS
// ============================================================

describe('ALL_VIEWS', () => {
  it('is an array', () => {
    expect(Array.isArray(ALL_VIEWS)).toBe(true)
  })

  it('contains landing', () => {
    expect(ALL_VIEWS).toContain('landing')
  })

  it('contains login', () => {
    expect(ALL_VIEWS).toContain('login')
  })

  it('contains home', () => {
    expect(ALL_VIEWS).toContain('home')
  })

  it('contains dashboard', () => {
    expect(ALL_VIEWS).toContain('dashboard')
  })

  it('contains missions', () => {
    expect(ALL_VIEWS).toContain('missions')
  })

  it('does NOT contain mission-detail (it is a sub-route of missions)', () => {
    expect(ALL_VIEWS).not.toContain('mission-detail')
  })

  it('contains agents', () => {
    expect(ALL_VIEWS).toContain('agents')
  })

  it('contains workflows', () => {
    expect(ALL_VIEWS).toContain('workflows')
  })

  it('contains billing', () => {
    expect(ALL_VIEWS).toContain('billing')
  })

  it('contains organizations', () => {
    expect(ALL_VIEWS).toContain('organizations')
  })

  it('contains org-settings', () => {
    expect(ALL_VIEWS).toContain('org-settings')
  })

  it('contains integrations', () => {
    expect(ALL_VIEWS).toContain('integrations')
  })

  it('contains trust-center', () => {
    expect(ALL_VIEWS).toContain('trust-center')
  })

  it('contains command-center', () => {
    expect(ALL_VIEWS).toContain('command-center')
  })

  it('contains settings', () => {
    expect(ALL_VIEWS).toContain('settings')
  })

  it('has 14 views total', () => {
    expect(ALL_VIEWS).toHaveLength(14)
  })
})

// ============================================================
// initRouter
// ============================================================

describe('initRouter', () => {
  it('sets up hashchange listener', () => {
    const cleanup = initRouter()
    expect(mockAddEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function))
    cleanup()
  })

  it('syncs initial route to store', () => {
    currentHash = '#/dashboard'
    const cleanup = initRouter()
    expect(mockSetCurrentView).toHaveBeenCalledWith('dashboard', {})
    cleanup()
  })

  it('syncs mission-detail initial route with params', () => {
    currentHash = '#/missions/m1'
    const cleanup = initRouter()
    expect(mockSetCurrentView).toHaveBeenCalledWith('mission-detail', { missionId: 'm1' })
    cleanup()
  })

  it('returns cleanup function that removes listener', () => {
    const cleanup = initRouter()
    cleanup()
    expect(mockRemoveEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function))
  })

  it('handles hashchange events', () => {
    currentHash = '#/home'
    const cleanup = initRouter()
    // Capture the handler before clearing mocks
    const handler = mockAddEventListener.mock.calls[0][1] as () => void
    vi.clearAllMocks()

    // Simulate hashchange
    currentHash = '#/agents'
    handler()

    expect(mockSetCurrentView).toHaveBeenCalledWith('agents', {})
    cleanup()
  })

  it('sets activeMissionId on mission-detail navigation', () => {
    currentHash = '#/home'
    const cleanup = initRouter()
    // Capture the handler before clearing mocks
    const handler = mockAddEventListener.mock.calls[0][1] as () => void
    vi.clearAllMocks()

    currentHash = '#/missions/m42'
    handler()

    expect(mockSetActiveMissionId).toHaveBeenCalledWith('m42')
    cleanup()
  })
})
