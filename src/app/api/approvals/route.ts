// Mianx.ai — Phase 5: Approval API
//
// GET  /api/approvals         — List approvals for the authenticated user
// POST /api/approvals         — Create a new approval request

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  listApprovals,
  createApproval,
  evaluateApprovalRequirement,
} from "@/lib/approval-engine";

// ─────────────────────────────────────────────
//  GET /api/approvals — List approvals
// ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;
    const riskLevel = searchParams.get("riskLevel") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
    const missionId = searchParams.get("missionId");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { approvals, total } = await listApprovals(session.user.id, {
      status: status || undefined,
      riskLevel: riskLevel || undefined,
      missionId: missionId || undefined,
      search: search || undefined,
      limit: Math.min(limit, 100),
      offset,
    });

    return NextResponse.json({
      approvals,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[approvals] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/approvals — Create approval
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { missionId, taskId, title, description, riskLevel, metadata, approvalType } = body;

    if (!missionId || !title) {
      return NextResponse.json(
        { error: "missionId and title are required" },
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

    // Evaluate if approval is actually needed
    const evaluation = await evaluateApprovalRequirement({
      riskLevel: riskLevel || "MEDIUM",
      userId: session.user.id,
      missionId,
      approvalType,
    });

    if (!evaluation.requiresApproval) {
      return NextResponse.json({
        approvalId: null,
        autoApproved: true,
        reason: evaluation.reason,
      });
    }

    const approvalId = await createApproval({
      missionId,
      taskId,
      userId: session.user.id,
      title,
      description,
      riskLevel: riskLevel || "MEDIUM",
      metadata: metadata || { approvalType: approvalType || "custom" },
      approvalType: approvalType || "custom",
    });

    return NextResponse.json({
      approvalId,
      autoApproved: false,
      reason: evaluation.reason,
      escalated: evaluation.escalated,
    });
  } catch (error) {
    console.error("[approvals] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create approval" },
      { status: 500 },
    );
  }
}
