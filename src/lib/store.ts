"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n";

// ─────────────────────────────────────────────
//  App Navigation State
//  Since the sandbox only exposes the `/` route,
//  we manage "pages" via client-side state.
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
  // Admin
  | "admin";

interface AppState {
  // Navigation
  view: ViewKey;
  setView: (v: ViewKey) => void;

  // Selected project (for detail view)
  selectedProjectId: string | null;
  setSelectedProject: (id: string | null) => void;

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
      },

      selectedProjectId: null,
      setSelectedProject: (id) => set({ selectedProjectId: id }),

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
