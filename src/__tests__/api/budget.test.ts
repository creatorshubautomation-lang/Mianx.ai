// ─────────────────────────────────────────────
// API Route Tests: Budget — Check & Settings
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as BudgetCheckPost, GET as BudgetCheckGet } from "@/app/api/budget/check/route";
import { GET as BudgetSettingsGet, PUT as BudgetSettingsPut } from "@/app/api/budget/settings/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const mockGetServerSession = vi.mocked(getServerSession);
const mockDb = vi.mocked(db, true);

// Mock approval-engine functions
vi.mock("@/lib/approval-engine", () => ({
  checkBudgetAllowance: vi.fn(),
  validateBudgetAgainstPlan: vi.fn((budget, plan) => ({
    allowed: budget <= 50,
    reason: budget <= 50 ? "Within plan limits" : "Exceeds plan limits",
  })),
  PLAN_BUDGET_LIMITS: {
    FREE: { maxMissionBudget: 5, maxMonthlySpend: 20 },
    STARTER: { maxMissionBudget: 25, maxMonthlySpend: 100 },
    PRO: { maxMissionBudget: 100, maxMonthlySpend: 500 },
    ENTERPRISE: { maxMissionBudget: 1000, maxMonthlySpend: 10000 },
  },
  getApprovalPolicy: vi.fn((plan) => ({
    autoApproveRiskLevels: plan === "FREE" ? ["LOW"] : ["LOW", "MEDIUM"],
    requireApprovalRiskLevels: plan === "FREE" ? ["HIGH", "CRITICAL"] : ["HIGH", "CRITICAL"],
    requireAdminEscalation: ["CRITICAL"],
    timeoutMinutes: 60,
    budgetThresholdPercent: 80,
  })),
}));

describe("POST /api/budget/check", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/budget/check", {
      method: "POST",
      body: JSON.stringify({ missionId: "m1", additionalCostUsd: 1 }),
    });
    const res = await BudgetCheckPost(req as any);
    expect(res.status).toBe(401);
  });

  it("should return 400 when missionId missing", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/budget/check", {
      method: "POST",
      body: JSON.stringify({ additionalCostUsd: 1 }),
    });
    const res = await BudgetCheckPost(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 404 when mission not found", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.mission.findUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/budget/check", {
      method: "POST",
      body: JSON.stringify({ missionId: "nonexistent", additionalCostUsd: 1 }),
    });
    const res = await BudgetCheckPost(req as any);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/budget/check", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await BudgetCheckGet(new Request("http://localhost/api/budget/check") as any);
    expect(res.status).toBe(401);
  });

  it("should return plan limits for authenticated user", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.user.findUnique.mockResolvedValueOnce({ plan: "PRO" } as any);
    const res = await BudgetCheckGet(new Request("http://localhost/api/budget/check?budget=50") as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.plan).toBe("PRO");
    expect(data.requestedBudget).toBe(50);
    expect(data.validation).toBeDefined();
    expect(data.limits).toBeDefined();
  });
});

describe("GET /api/budget/settings", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await BudgetSettingsGet();
    expect(res.status).toBe(401);
  });

  it("should return default settings for FREE user", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.user.findUnique.mockResolvedValueOnce({ plan: "FREE" } as any);
    const res = await BudgetSettingsGet();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.plan).toBe("FREE");
    expect(data.settings.alertThresholdPercent).toBe(80);
    expect(data.settings.currency).toBe("USD");
    expect(data.approvalPolicy).toBeDefined();
  });
});

describe("PUT /api/budget/settings", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify({ alertThresholdPercent: 90 }),
    });
    const res = await BudgetSettingsPut(req as any);
    expect(res.status).toBe(401);
  });

  it("should reject alertThresholdPercent < 50", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify({ alertThresholdPercent: 40 }),
    });
    const res = await BudgetSettingsPut(req as any);
    expect(res.status).toBe(400);
  });

  it("should reject alertThresholdPercent > 100", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify({ alertThresholdPercent: 110 }),
    });
    const res = await BudgetSettingsPut(req as any);
    expect(res.status).toBe(400);
  });

  it("should reject negative requireApprovalAbove", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify({ requireApprovalAbove: -5 }),
    });
    const res = await BudgetSettingsPut(req as any);
    expect(res.status).toBe(400);
  });

  it("should reject negative dailySpendCap", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify({ dailySpendCap: -10 }),
    });
    const res = await BudgetSettingsPut(req as any);
    expect(res.status).toBe(400);
  });

  it("should accept valid settings", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify({ alertThresholdPercent: 90, dailySpendCap: 50 }),
    });
    const res = await BudgetSettingsPut(req as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.settings.alertThresholdPercent).toBe(90);
    expect(data.settings.dailySpendCap).toBe(50);
  });
});
