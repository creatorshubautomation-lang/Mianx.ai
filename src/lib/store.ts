// ============================================================
// MIANX.AI V3 — Zustand Store
// Central client-side state for the SPA application
// ============================================================

import { create } from 'zustand'
import type {
  StoreState,
  ViewName,
  UserMode,
  ProfileDto,
  OrganizationDto,
  MissionDto,
  MissionTaskDto,
  UiToast,
  UiModal,
} from './types'
import { navigate } from './router'

/**
 * Generate a unique ID for toasts and modals.
 */
let toastCounter = 0
function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++toastCounter}`
}

/**
 * The main Zustand store combining all state slices.
 * This is the single source of truth for the SPA.
 */
export const useStore = create<StoreState>((set, get) => ({
  // ============================================================
  // Auth State
  // ============================================================
  user: null,
  isAuthenticated: false,

  setUser: (user: ProfileDto | null) =>
    set({
      user,
      isAuthenticated: user !== null,
    }),

  logout: () => {
    set({
      user: null,
      isAuthenticated: false,
      organizations: [],
      activeOrgId: null,
      activeDomainId: null,
      missions: [],
      activeMissionId: null,
      tasks: [],
      currentView: 'landing',
      viewParams: {},
    })
    navigate('landing')
  },

  // ============================================================
  // App State
  // ============================================================
  currentView: 'landing',
  viewParams: {},
  sidebarOpen: true,
  userMode: 'simple' as UserMode,

  setCurrentView: (view: ViewName, params: Record<string, string> = {}) =>
    set({
      currentView: view,
      viewParams: params,
    }),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setUserMode: (mode: UserMode) => set({ userMode: mode }),

  // ============================================================
  // Organization State
  // ============================================================
  organizations: [],
  activeOrgId: null,
  activeDomainId: null,

  setOrganizations: (orgs: OrganizationDto[]) => {
    const state = get()
    // If no active org is set, auto-select the first one
    const activeOrgId = state.activeOrgId ?? orgs[0]?.id ?? null
    set({ organizations: orgs, activeOrgId })
  },

  setActiveOrgId: (id: string | null) => set({ activeOrgId: id }),
  setActiveDomainId: (id: string | null) => set({ activeDomainId: id }),

  // ============================================================
  // Mission State
  // ============================================================
  missions: [],
  activeMissionId: null,
  tasks: [],

  setMissions: (missions: MissionDto[]) => set({ missions }),

  setActiveMissionId: (id: string | null) => set({ activeMissionId: id }),

  setTasks: (tasks: MissionTaskDto[]) => set({ tasks }),

  addMission: (mission: MissionDto) =>
    set((state) => ({
      missions: [mission, ...state.missions],
    })),

  updateMission: (id: string, data: Partial<MissionDto>) =>
    set((state) => ({
      missions: state.missions.map((m) =>
        m.id === id ? { ...m, ...data } : m,
      ),
    })),

  removeMission: (id: string) =>
    set((state) => ({
      missions: state.missions.filter((m) => m.id !== id),
      activeMissionId:
        state.activeMissionId === id ? null : state.activeMissionId,
    })),

  // ============================================================
  // UI State
  // ============================================================
  toasts: [],
  modals: [],

  addToast: (toast: Omit<UiToast, 'id'>) => {
    const id = uniqueId('toast')
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    // Auto-remove after duration (default 5s)
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
  },

  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  openModal: (modal: Omit<UiModal, 'id'>) => {
    const id = uniqueId('modal')
    set((state) => ({
      modals: [...state.modals, { ...modal, id }],
    }))
  },

  closeModal: (id: string) =>
    set((state) => ({
      modals: state.modals.filter((m) => m.id !== id),
    })),
}))

// ============================================================
// Selector Hooks (for optimized re-renders)
// ============================================================

/** Get the current authenticated user */
export const useUser = () => useStore((s) => s.user)

/** Get the current active organization */
export const useActiveOrg = () => {
  const activeOrgId = useStore((s) => s.activeOrgId)
  const organizations = useStore((s) => s.organizations)
  return organizations.find((o) => o.id === activeOrgId) ?? null
}

/** Get the current view name */
export const useCurrentView = () => useStore((s) => s.currentView)

/** Get the current user mode */
export const useUserMode = () => useStore((s) => s.userMode)

/** Get sidebar open state */
export const useSidebarOpen = () => useStore((s) => s.sidebarOpen)

/** Get missions for the active organization */
export const useMissions = () => useStore((s) => s.missions)

/** Get the active mission */
export const useActiveMission = () => {
  const activeMissionId = useStore((s) => s.activeMissionId)
  const missions = useStore((s) => s.missions)
  return missions.find((m) => m.id === activeMissionId) ?? null
}

/** Get mission tasks */
export const useMissionTasks = () => useStore((s) => s.tasks)

/** Get toast list */
export const useToasts = () => useStore((s) => s.toasts)

/** Get modal list */
export const useModals = () => useStore((s) => s.modals)
