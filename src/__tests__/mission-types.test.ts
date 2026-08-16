// ─────────────────────────────────────────────
// Unit Tests: Mission Types & State Machine
// ─────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  VALID_TRANSITIONS,
  MISSION_STATUS_CONFIG,
  TASK_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  type MissionStatus,
  type MissionTaskStatus,
  type RiskLevel,
} from "@/lib/mission-types";

describe("Mission Types — Valid Transitions", () => {
  const allStatuses: MissionStatus[] = [
    "DRAFT", "PLANNING", "AWAITING_APPROVAL", "APPROVED", "EXECUTING",
    "PAUSED", "VERIFYING", "REPAIRING", "COMPLETED", "FAILED", "CANCELLED",
  ];

  it("should export all 11 mission statuses in VALID_TRANSITIONS", () => {
    for (const status of allStatuses) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("should allow DRAFT → PLANNING", () => {
    expect(isValidTransition("DRAFT", "PLANNING")).toBe(true);
  });

  it("should allow DRAFT → CANCELLED", () => {
    expect(isValidTransition("DRAFT", "CANCELLED")).toBe(true);
  });

  it("should reject DRAFT → EXECUTING (must plan first)", () => {
    expect(isValidTransition("DRAFT", "EXECUTING")).toBe(false);
  });

  it("should allow PLANNING → AWAITING_APPROVAL", () => {
    expect(isValidTransition("PLANNING", "AWAITING_APPROVAL")).toBe(true);
  });

  it("should allow PLANNING → APPROVED (auto-approve path)", () => {
    expect(isValidTransition("PLANNING", "APPROVED")).toBe(true);
  });

  it("should allow EXECUTING → PAUSED", () => {
    expect(isValidTransition("EXECUTING", "PAUSED")).toBe(true);
  });

  it("should allow EXECUTING → VERIFYING", () => {
    expect(isValidTransition("EXECUTING", "VERIFYING")).toBe(true);
  });

  it("should allow EXECUTING → COMPLETED", () => {
    expect(isValidTransition("EXECUTING", "COMPLETED")).toBe(true);
  });

  it("should allow EXECUTING → FAILED", () => {
    expect(isValidTransition("EXECUTING", "FAILED")).toBe(true);
  });

  it("should allow PAUSED → EXECUTING (resume)", () => {
    expect(isValidTransition("PAUSED", "EXECUTING")).toBe(true);
  });

  it("should allow REPAIRING → EXECUTING (retry)", () => {
    expect(isValidTransition("REPAIRING", "EXECUTING")).toBe(true);
  });

  it("should allow REPAIRING → VERIFYING (re-verify)", () => {
    expect(isValidTransition("REPAIRING", "VERIFYING")).toBe(true);
  });

  // Terminal states — no transitions out
  it("COMPLETED should have no valid transitions", () => {
    expect(VALID_TRANSITIONS.COMPLETED).toEqual([]);
    expect(isValidTransition("COMPLETED", "EXECUTING")).toBe(false);
    expect(isValidTransition("COMPLETED", "DRAFT")).toBe(false);
  });

  it("FAILED should have no valid transitions", () => {
    expect(VALID_TRANSITIONS.FAILED).toEqual([]);
  });

  it("CANCELLED should have no valid transitions", () => {
    expect(VALID_TRANSITIONS.CANCELLED).toEqual([]);
  });

  // Invalid transitions
  it("should reject AWAITING_APPROVAL → EXECUTING (must approve first)", () => {
    expect(isValidTransition("AWAITING_APPROVAL", "EXECUTING")).toBe(false);
  });

  it("should reject COMPLETED → DRAFT (cannot restart)", () => {
    expect(isValidTransition("COMPLETED", "DRAFT")).toBe(false);
  });

  it("should handle unknown from status gracefully", () => {
    expect(isValidTransition("UNKNOWN" as MissionStatus, "PLANNING")).toBe(false);
  });

  it("should handle unknown to status gracefully", () => {
    expect(isValidTransition("DRAFT", "UNKNOWN" as MissionStatus)).toBe(false);
  });
});

describe("Mission Types — Status Config", () => {
  const allStatuses: MissionStatus[] = [
    "DRAFT", "PLANNING", "AWAITING_APPROVAL", "APPROVED", "EXECUTING",
    "PAUSED", "VERIFYING", "REPAIRING", "COMPLETED", "FAILED", "CANCELLED",
  ];

  it("should have config for every status", () => {
    for (const status of allStatuses) {
      const config = MISSION_STATUS_CONFIG[status];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.color).toMatch(/^text-/);
      expect(config.bgColor).toMatch(/^bg-/);
      expect(config.icon).toBeTruthy();
      expect(config.description).toBeTruthy();
    }
  });

  it("should have unique labels for each status", () => {
    const labels = Object.values(MISSION_STATUS_CONFIG).map(c => c.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});

describe("Mission Types — Task Status Config", () => {
  const allTaskStatuses: MissionTaskStatus[] = [
    "PENDING", "READY", "RUNNING", "COMPLETED", "FAILED", "SKIPPED", "CANCELLED",
  ];

  it("should have config for every task status", () => {
    for (const status of allTaskStatuses) {
      const config = TASK_STATUS_CONFIG[status];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.color).toMatch(/^text-/);
      expect(config.bgColor).toMatch(/^bg-/);
    }
  });
});

describe("Mission Types — Risk Level Config", () => {
  const allRisks: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  it("should have config for every risk level", () => {
    for (const risk of allRisks) {
      const config = RISK_LEVEL_CONFIG[risk];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.dotColor).toMatch(/^bg-/);
    }
  });
});
