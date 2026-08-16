// Mianx.ai — Phase 8: Budget Settings API
//
// GET  /api/budget/settings — Get user's budget configuration
// PUT  /api/budget/settings — Update user's budget preferences

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_BUDGET_LIMITS, getApprovalPolicy } from "@/lib/approval-engine";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface BudgetSettings {
  // Spending alerts
  alertThresholdPercent: number;     // e.g. 80 — alert at 80% budget usage
  alertEmailEnabled: boolean;
  alertInAppEnabled: boolean;

  // Auto-approval
  autoApprovalRiskLevels: string[];  // which risk levels auto-approve
  requireApprovalAbove: number;      // $ amount — require approval above this

  // Daily / monthly caps
  dailySpendCap: number | null;       // null = no cap
  monthlySpendCap: number | null;    // null = use plan default

  // Preferences
  currency: string;
  timezone: string;
}

const DEFAULT_SETTINGS: BudgetSettings = {
  alertThresholdPercent: 80,
  alertEmailEnabled: true,
  alertInAppEnabled: true,
  autoApprovalRiskLevels: ["LOW"],
  requireApprovalAbove: 10,
  dailySpendCap: null,
  monthlySpendCap: null,
  currency: "USD",
  timezone: "UTC",
};

// ─────────────────────────────────────────────
//  GET /api/budget/settings
// ─────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user plan and existing settings (stored in a JSON field or as a simple object)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const planTier = user?.plan || "FREE";
    const limits = PLAN_BUDGET_LIMITS[planTier] || PLAN_BUDGET_LIMITS.FREE;
    const policy = getApprovalPolicy(planTier);

    // Try to load settings from HumanApproval metadata or use defaults
    // For now, settings are client-side persisted; server provides plan defaults
    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      plan: planTier,
      planLimits: limits,
      approvalPolicy: {
        autoApproveRiskLevels: policy.autoApproveRiskLevels,
        requireApprovalRiskLevels: policy.requireApprovalRiskLevels,
        requireAdminEscalation: policy.requireAdminEscalation,
        budgetThresholdPercent: policy.budgetThresholdPercent,
        timeoutMinutes: policy.timeoutMinutes,
      },
    });
  } catch (error) {
    console.error("[budget/settings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget settings" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PUT /api/budget/settings
// ─────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      alertThresholdPercent,
      alertEmailEnabled,
      alertInAppEnabled,
      requireApprovalAbove,
      dailySpendCap,
    } = body;

    // Validate inputs
    if (alertThresholdPercent !== undefined) {
      if (alertThresholdPercent < 50 || alertThresholdPercent > 100) {
        return NextResponse.json(
          { error: "alertThresholdPercent must be between 50 and 100" },
          { status: 400 },
        );
      }
    }

    if (requireApprovalAbove !== undefined && requireApprovalAbove < 0) {
      return NextResponse.json(
        { error: "requireApprovalAbove must be non-negative" },
        { status: 400 },
      );
    }

    if (dailySpendCap !== undefined && dailySpendCap !== null && dailySpendCap < 0) {
      return NextResponse.json(
        { error: "dailySpendCap must be non-negative or null" },
        { status: 400 },
      );
    }

    // Settings are currently stored client-side (Zustand persist).
    // Server validates and returns the merged settings.
    const mergedSettings: BudgetSettings = {
      ...DEFAULT_SETTINGS,
      ...(alertThresholdPercent !== undefined && { alertThresholdPercent }),
      ...(alertEmailEnabled !== undefined && { alertEmailEnabled }),
      ...(alertInAppEnabled !== undefined && { alertInAppEnabled }),
      ...(requireApprovalAbove !== undefined && { requireApprovalAbove }),
      ...(dailySpendCap !== undefined && { dailySpendCap }),
    };

    return NextResponse.json({
      settings: mergedSettings,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("[budget/settings] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update budget settings" },
      { status: 500 },
    );
  }
}
