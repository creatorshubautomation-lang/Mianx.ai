// Mianx.ai — Phase 5: Budget Check API
//
// POST /api/budget/check — Check if a cost is allowed against mission budget
// GET  /api/budget/check  — Validate budget against user plan limits

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkBudgetAllowance,
  validateBudgetAgainstPlan,
  PLAN_BUDGET_LIMITS,
} from "@/lib/approval-engine";

// ─────────────────────────────────────────────
//  POST /api/budget/check — Check mission budget allowance
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { missionId, additionalCostUsd } = body;

    if (!missionId || additionalCostUsd === undefined) {
      return NextResponse.json(
        { error: "missionId and additionalCostUsd are required" },
        { status: 400 },
      );
    }

    // Verify mission belongs to user
    const mission = await db.mission.findUnique({
      where: { id: missionId },
      select: { userId: true },
    });

    if (!mission || mission.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Mission not found or access denied" },
        { status: 404 },
      );
    }

    const result = await checkBudgetAllowance(
      missionId,
      Number(additionalCostUsd),
      session.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[budget/check] POST error:", error);
    return NextResponse.json(
      { error: "Failed to check budget" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  GET /api/budget/check — Validate budget against plan
// ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    const planTier = user?.plan || "FREE";
    const { searchParams } = new URL(request.url);
    const requestedBudget = parseFloat(searchParams.get("budget") || "0");

    const validation = validateBudgetAgainstPlan(requestedBudget, planTier);
    const limits = PLAN_BUDGET_LIMITS[planTier] || PLAN_BUDGET_LIMITS.FREE;

    return NextResponse.json({
      plan: planTier,
      requestedBudget,
      validation,
      limits,
    });
  } catch (error) {
    console.error("[budget/check] GET error:", error);
    return NextResponse.json(
      { error: "Failed to validate budget" },
      { status: 500 },
    );
  }
}
