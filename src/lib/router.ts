"use client";

/**
 * Lightweight history-aware SPA router for Mianx.ai
 *
 * Maps ViewKey (Zustand state) ↔ URL paths using pushState/popState.
 * All navigation should go through `pushView()` / `replaceView()`.
 */

import { useApp } from "@/lib/store";
import type { ViewKey } from "@/lib/store";

// ─────────────────────────────────────────────
//  View → URL path mapping
// ─────────────────────────────────────────────

const VIEW_PATH_MAP: Record<ViewKey, string> = {
  // Public
  home: "/",
  services: "/services",
  agents: "/agents",
  pricing: "/pricing",
  about: "/about",
  useCases: "/use-cases",
  contact: "/contact",
  templates: "/templates",
  apiDocs: "/api-docs",
  academy: "/academy",
  marketplace: "/marketplace",
  // Auth (kept for completeness — mostly modal-based)
  login: "/login",
  signup: "/signup",
  // Dashboard
  dashboard: "/dashboard",
  projects: "/dashboard/projects",
  newProject: "/dashboard/projects/new",
  projectDetail: "/dashboard/projects", // actual path includes /:id suffix
  deliverables: "/dashboard/deliverables",
  support: "/dashboard/support",
  settings: "/dashboard/settings",
  // Mission Engine (Agentic AI)
  missions: "/dashboard/missions",
  missionDetail: "/dashboard/missions", // actual path includes /:id
  // Tool Registry (Phase 4)
  toolRegistry: "/dashboard/tools",
  // Approval Queue (Phase 5)
  approvals: "/dashboard/approvals",
  // Admin
  admin: "/admin",
};

// ─────────────────────────────────────────────
//  Internal state
// ─────────────────────────────────────────────

/**
 * When true, setView inside the store will NOT push a new history entry.
 * This prevents pushState during popstate or initial hydration.
 */
export let _suppressUrlSync = false;

/** Whether initRouter() has been called */
let _initialized = false;

// ─────────────────────────────────────────────
//  Helpers: View ↔ Path conversion
// ─────────────────────────────────────────────

/**
 * Convert a ViewKey + optional params to a full URL path.
 * E.g. viewToPath("projectDetail", { id: "abc" }) → "/dashboard/projects/abc"
 */
export function viewToPath(
  view: ViewKey,
  params?: Record<string, string>,
): string {
  let base = VIEW_PATH_MAP[view] || "/";

  if (view === "projectDetail" && params?.id) {
    base = "/dashboard/projects/" + encodeURIComponent(params.id);
  }

  if (view === "missionDetail" && params?.id) {
    base = "/dashboard/missions/" + encodeURIComponent(params.id);
  }

  // Append any extra query params
  if (params && Object.keys(params).length > 0) {
    const queryParts: string[] = [];
    for (const [key, val] of Object.entries(params)) {
      if (view === "projectDetail" && key === "id") continue; // already in path
      if (view === "missionDetail" && key === "id") continue; // already in path
      queryParts.push(
        encodeURIComponent(key) + "=" + encodeURIComponent(val),
      );
    }
    if (queryParts.length > 0) {
      base += "?" + queryParts.join("&");
    }
  }

  return base;
}

/**
 * Parse a URL pathname (no query/search) back into a ViewKey + params.
 */
export function pathToView(
  pathname: string,
): { view: ViewKey; params: Record<string, string> } | null {
  // Normalize: remove trailing slash, remove query string
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // Direct match
  for (const [view, viewPath] of Object.entries(VIEW_PATH_MAP)) {
    if (path === viewPath) {
      return { view: view as ViewKey, params: {} };
    }
  }

  // Special: /dashboard/projects/:id → projectDetail
  const projectMatch = path.match("^/dashboard/projects/([^/]+)$");
  if (projectMatch) {
    return {
      view: "projectDetail",
      params: { id: decodeURIComponent(projectMatch[1]) },
    };
  }

  // Special: /dashboard/missions/:id → missionDetail
  const missionMatch = path.match("^/dashboard/missions/([^/]+)$");
  if (missionMatch) {
    return {
      view: "missionDetail",
      params: { id: decodeURIComponent(missionMatch[1]) },
    };
  }

  return null;
}

// ─────────────────────────────────────────────
//  Core navigation functions
// ─────────────────────────────────────────────

/**
 * Push a new history entry and update the Zustand view state.
 * This is the primary navigation function for user-initiated navigation.
 */
export function pushView(
  view: ViewKey,
  params?: Record<string, string>,
): void {
  const url = viewToPath(view, params);

  // Push history entry
  window.history.pushState(
    { view, params: params || {} },
    "",
    url,
  );

  // Update Zustand state (suppress URL sync since we already pushed)
  _suppressUrlSync = true;
  const store = useApp.getState();
  store.setView(view);

  // Also sync selectedProjectId for projectDetail
  if (view === "projectDetail" && params?.id) {
    store.setSelectedProject(params.id);
  }

  // Also sync selectedMissionId for missionDetail
  if (view === "missionDetail" && params?.id) {
    store.setSelectedMission(params.id);
  }

  _suppressUrlSync = false;
}

/**
 * Replace the current history entry (no new back/forward entry).
 * Useful for redirects or initial load.
 */
export function replaceView(
  view: ViewKey,
  params?: Record<string, string>,
): void {
  const url = viewToPath(view, params);

  window.history.replaceState(
    { view, params: params || {} },
    "",
    url,
  );

  _suppressUrlSync = true;
  const store = useApp.getState();
  store.setView(view);

  if (view === "projectDetail" && params?.id) {
    store.setSelectedProject(params.id);
  }

  if (view === "missionDetail" && params?.id) {
    store.setSelectedMission(params.id);
  }

  _suppressUrlSync = false;
}

// ─────────────────────────────────────────────
//  Initialization
// ─────────────────────────────────────────────

/**
 * Call once on app mount. Reads the current URL, sets the initial view,
 * and attaches the popstate listener for browser back/forward.
 */
export function initRouter(): void {
  if (_initialized) return;
  if (typeof window === "undefined") return;
  _initialized = true;

  // Sync current URL → view state (using replace so we don't add extra history)
  const pathname = window.location.pathname;
  const parsed = pathToView(pathname);

  if (parsed) {
    replaceView(parsed.view, parsed.params);
  } else {
    // Unknown path — redirect to home
    replaceView("home");
  }

  // Listen for browser back/forward
  window.addEventListener("popstate", (event: PopStateEvent) => {
    // If the state has our view data, use it
    if (event.state?.view) {
      _suppressUrlSync = true;
      const store = useApp.getState();
      store.setView(event.state.view as ViewKey);

      if (event.state.view === "projectDetail" && event.state.params?.id) {
        store.setSelectedProject(event.state.params.id);
      }

      if (event.state.view === "missionDetail" && event.state.params?.id) {
        store.setSelectedMission(event.state.params.id);
      }

      _suppressUrlSync = false;
      return;
    }

    // Fallback: parse from URL
    const parsedPath = pathToView(window.location.pathname);
    if (parsedPath) {
      _suppressUrlSync = true;
      const store = useApp.getState();
      store.setView(parsedPath.view);

      if (parsedPath.view === "projectDetail" && parsedPath.params?.id) {
        store.setSelectedProject(parsedPath.params.id);
      }

      if (parsedPath.view === "missionDetail" && parsedPath.params?.id) {
        store.setSelectedMission(parsedPath.params.id);
      }

      _suppressUrlSync = false;
    }
  });
}
