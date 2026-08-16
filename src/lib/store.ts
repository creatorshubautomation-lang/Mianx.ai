"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n";
import { _suppressUrlSync, viewToPath, pushView } from "@/lib/router";

// ─────────────────────────────────────────────
//  App Navigation State
//  Since the sandbox only exposes the `/` route,
//  we manage "pages" via client-side state.
//  Deep linking: URL is synced via router.ts
// ─────────────────────────────────────────────

export type ViewKey =
  // Public
  | "home"
  | "services"
  | "agents"
  | "pricing"
  | "about"
  | "useCases"
  | "contact"
  | "templates"
  | "apiDocs"
  | "academy"
  | "marketplace"
  // Auth
  | "login"
  | "signup"
  // Client dashboard
  | "dashboard"
  | "projects"
  | "newProject"
  | "projectDetail"
  | "deliverables"
  | "support"
  | "settings"
  // Mission Engine (Agentic AI)
  | "missions"
  | "missionDetail"
  // Tool Registry (Phase 4)
  | "toolRegistry"
  // Approval Queue (Phase 5)
  | "approvals"
  // Command Center (Phase 7)
  | "commandCenter"
  // Budget Control (Phase 8)
  | "budget"
  // Trust & Audit Center (Phase 9)
  | "trustCenter"
  // Agent Performance Dashboard
  | "agentPerformance"
  // Admin
  | "admin";

interface AppState {
  // Navigation
  view: ViewKey;
  /** Raw state setter — prefer `navigate()` for user-initiated navigation */
  setView: (v: ViewKey) => void;
  /** Navigate to a view: pushes browser history + updates URL + updates state */
  navigate: (v: ViewKey, params?: Record<string, string>) => void;

  // Selected project (for detail view)
  selectedProjectId: string | null;
  setSelectedProject: (id: string | null) => void;

  // Selected mission (for detail view)
  selectedMissionId: string | null;
  setSelectedMission: (id: string | null) => void;

  // Selected approval (for detail view)
  selectedApprovalId: string | null;
  setSelectedApproval: (id: string | null) => void;

  // Selected agent name (for agent performance detail)
  selectedAgentName: string | null;
  setSelectedAgentName: (name: string | null) => void;

  // Auth modal
  authModal: "login" | "signup" | null;
  setAuthModal: (m: "login" | "signup" | null) => void;

  // Language (persisted)
  lang: Lang;
  setLang: (l: Lang) => void;

  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      view: "home",
      setView: (v) => {
        set({ view: v });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        // If called outside the router (legacy code), auto-sync the URL
        if (
          typeof window !== "undefined" &&
          !_suppressUrlSync &&
          // Only sync after router has initialized (pushed initial state)
          window.history.state?.view !== undefined
        ) {
          const url = viewToPath(v);
          window.history.pushState({ view: v, params: {} }, "", url);
        }
      },

      navigate: (v, params) => {
        pushView(v, params);
      },

      selectedProjectId: null,
      setSelectedProject: (id) => set({ selectedProjectId: id }),

      selectedMissionId: null,
      setSelectedMission: (id) => set({ selectedMissionId: id }),

      selectedApprovalId: null,
      setSelectedApproval: (id) => set({ selectedApprovalId: id }),

      selectedAgentName: null,
      setSelectedAgentName: (name) => set({ selectedAgentName: name }),

      authModal: null,
      setAuthModal: (m) => set({ authModal: m }),

      lang: "en",
      setLang: (l) => set({ lang: l }),

      theme: "dark",
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: "mianx-app-state",
      partialize: (s) => ({ lang: s.lang, theme: s.theme }),
    },
  ),
);

// Helper hook for translations
import { translate } from "@/lib/i18n";

export function useT() {
  const lang = useApp((s) => s.lang);
  return (key: string) => translate(lang, key);
}
