// Mianx.ai — Human Approval Response Route
//
// POST /api/missions/approvals/[approvalId]/respond — Respond to approval request

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { logMissionEvent } from "@/lib/mission-engine";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { approvalId } = await params;
    const body = await request.json();
    const { action, note } = body; // action: "approve" | "reject"

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    // Find approval and verify ownership
    const approval = await db.humanApproval.findUnique({
      where: { id: approvalId },
      include: { mission: true },
    });

    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    if (approval.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (approval.status !== "PENDING") {
      return NextResponse.json(
        { error: `Approval already ${approval.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    const updated = await db.humanApproval.update({
      where: { id: approvalId },
      data: {
        status: newStatus,
        respondedAt: new Date(),
        responseNote: note || null,
      },
    });

    // Log event
    await logMissionEvent(approval.missionId, {
      eventType: action === "approve" ? "HUMAN_APPROVED" : "HUMAN_REJECTED",
      title: `${action === "approve" ? "Approved" : "Rejected"}: ${approval.title}`,
      description: note || `User ${action}d the request`,
      taskId: approval.taskId || undefined,
      level: action === "approve" ? "success" : "warn",
      metadata: { approvalId, action, note },
    });

    return NextResponse.json({ approval: updated });
  } catch (error) {
    console.error("[approvals] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
