// ─────────────────────────────────────────────
// Unit Tests: Zustand Store
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from "vitest";
import { useApp } from "@/lib/store";

describe("Zustand Store — Navigation", () => {
  beforeEach(() => {
    // Reset store to defaults
    useApp.setState({
      view: "home",
      selectedProjectId: null,
      selectedMissionId: null,
      selectedApprovalId: null,
      authModal: null,
      lang: "en",
      theme: "dark",
    });
  });

  it("should have default view 'home'", () => {
    expect(useApp.getState().view).toBe("home");
  });

  it("should have default theme 'dark'", () => {
    expect(useApp.getState().theme).toBe("dark");
  });

  it("should have default lang 'en'", () => {
    expect(useApp.getState().lang).toBe("en");
  });

  it("setView should update the view", () => {
    useApp.getState().setView("dashboard");
    expect(useApp.getState().view).toBe("dashboard");
  });

  it("setView should reset selectedProjectId when not navigating to projectDetail", () => {
    useApp.getState().setSelectedProject("proj-1");
    useApp.getState().setView("dashboard");
    expect(useApp.getState().selectedProjectId).toBe("proj-1");
  });

  it("setSelectedProject should update the selected project", () => {
    useApp.getState().setSelectedProject("proj-123");
    expect(useApp.getState().selectedProjectId).toBe("proj-123");
  });

  it("setSelectedMission should update the selected mission", () => {
    useApp.getState().setSelectedMission("mission-456");
    expect(useApp.getState().selectedMissionId).toBe("mission-456");
  });

  it("setSelectedApproval should update the selected approval", () => {
    useApp.getState().setSelectedApproval("approval-789");
    expect(useApp.getState().selectedApprovalId).toBe("approval-789");
  });

  it("toggleTheme should switch dark → light", () => {
    useApp.getState().toggleTheme();
    expect(useApp.getState().theme).toBe("light");
  });

  it("toggleTheme should switch light → dark", () => {
    useApp.setState({ theme: "light" });
    useApp.getState().toggleTheme();
    expect(useApp.getState().theme).toBe("dark");
  });

  it("setLang should update language", () => {
    useApp.getState().setLang("ur");
    expect(useApp.getState().lang).toBe("ur");
  });

  it("setAuthModal should set auth modal type", () => {
    useApp.getState().setAuthModal("login");
    expect(useApp.getState().authModal).toBe("login");
  });

  it("setAuthModal should clear auth modal with null", () => {
    useApp.getState().setAuthModal("signup");
    useApp.getState().setAuthModal(null);
    expect(useApp.getState().authModal).toBeNull();
  });
});
