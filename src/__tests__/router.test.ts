// ─────────────────────────────────────────────
// Unit Tests: SPA Router
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from "vitest";
import {
  viewToPath,
  pathToView,
  pushView,
  replaceView,
  initRouter,
  _suppressUrlSync,
  type ViewKey,
} from "@/lib/router";
import { useApp } from "@/lib/store";

describe("Router — viewToPath", () => {
  it("should map 'home' to '/'", () => {
    expect(viewToPath("home")).toBe("/");
  });

  it("should map 'dashboard' to '/dashboard'", () => {
    expect(viewToPath("dashboard")).toBe("/dashboard");
  });

  it("should map 'missions' to '/dashboard/missions'", () => {
    expect(viewToPath("missions")).toBe("/dashboard/missions");
  });

  it("should map 'templates' to '/templates'", () => {
    expect(viewToPath("templates")).toBe("/templates");
  });

  it("should map 'marketplace' to '/marketplace'", () => {
    expect(viewToPath("marketplace")).toBe("/marketplace");
  });

  it("should map 'toolRegistry' to '/dashboard/tools'", () => {
    expect(viewToPath("toolRegistry")).toBe("/dashboard/tools");
  });

  it("should map 'approvals' to '/dashboard/approvals'", () => {
    expect(viewToPath("approvals")).toBe("/dashboard/approvals");
  });

  it("should map 'budget' to '/dashboard/budget'", () => {
    expect(viewToPath("budget")).toBe("/dashboard/budget");
  });

  it("should map 'trustCenter' to '/dashboard/trust'", () => {
    expect(viewToPath("trustCenter")).toBe("/dashboard/trust");
  });

  it("should map 'commandCenter' to '/dashboard/command-center'", () => {
    expect(viewToPath("commandCenter")).toBe("/dashboard/command-center");
  });

  it("should handle projectDetail with id param", () => {
    const path = viewToPath("projectDetail", { id: "abc123" });
    expect(path).toBe("/dashboard/projects/abc123");
  });

  it("should handle missionDetail with id param", () => {
    const path = viewToPath("missionDetail", { id: "xyz789" });
    expect(path).toBe("/dashboard/missions/xyz789");
  });

  it("should encode special characters in id", () => {
    const path = viewToPath("projectDetail", { id: "hello world" });
    expect(path).toBe("/dashboard/projects/hello%20world");
  });

  it("should append query params for non-special views", () => {
    const path = viewToPath("dashboard", { tab: "overview" });
    expect(path).toBe("/dashboard?tab=overview");
  });
});

describe("Router — pathToView", () => {
  it("should parse '/' to 'home'", () => {
    const result = pathToView("/");
    expect(result?.view).toBe("home");
    expect(result?.params).toEqual({});
  });

  it("should parse '/dashboard' to 'dashboard'", () => {
    const result = pathToView("/dashboard");
    expect(result?.view).toBe("dashboard");
  });

  it("should parse '/dashboard/missions' to 'missions'", () => {
    const result = pathToView("/dashboard/missions");
    expect(result?.view).toBe("missions");
  });

  it("should parse '/templates' to 'templates'", () => {
    const result = pathToView("/templates");
    expect(result?.view).toBe("templates");
  });

  it("should parse '/marketplace' to 'marketplace'", () => {
    const result = pathToView("/marketplace");
    expect(result?.view).toBe("marketplace");
  });

  it("should parse project detail path", () => {
    const result = pathToView("/dashboard/projects/abc123");
    expect(result?.view).toBe("projectDetail");
    expect(result?.params?.id).toBe("abc123");
  });

  it("should parse mission detail path", () => {
    const result = pathToView("/dashboard/missions/xyz789");
    expect(result?.view).toBe("missionDetail");
    expect(result?.params?.id).toBe("xyz789");
  });

  it("should decode URL-encoded id", () => {
    const result = pathToView("/dashboard/projects/hello%20world");
    expect(result?.view).toBe("projectDetail");
    expect(result?.params?.id).toBe("hello world");
  });

  it("should return null for unknown paths", () => {
    const result = pathToView("/nonexistent/path");
    expect(result).toBeNull();
  });

  it("should handle trailing slashes", () => {
    const result = pathToView("/dashboard/");
    expect(result?.view).toBe("dashboard");
  });
});

describe("Router — pushView", () => {
  beforeEach(() => {
    // Reset history
    window.history.replaceState({}, "", "/");
  });

  it("should push history entry and update store", () => {
    pushView("dashboard");
    expect(window.location.pathname).toBe("/dashboard");
    expect(useApp.getState().view).toBe("dashboard");
  });

  it("should update selectedProjectId for projectDetail", () => {
    pushView("projectDetail", { id: "test-id" });
    expect(useApp.getState().selectedProjectId).toBe("test-id");
    expect(useApp.getState().view).toBe("projectDetail");
  });

  it("should update selectedMissionId for missionDetail", () => {
    pushView("missionDetail", { id: "mission-id" });
    expect(useApp.getState().selectedMissionId).toBe("mission-id");
    expect(useApp.getState().view).toBe("missionDetail");
  });
});
