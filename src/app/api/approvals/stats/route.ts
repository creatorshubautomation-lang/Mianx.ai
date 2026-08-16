// Mianx.ai — Phase 5: Approval Stats API
//
// GET /api/approvals/stats — Approval statistics for dashboard

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApprovalStats } from "@/lib/approval-engine";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getApprovalStats(session.user.id);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[approvals/stats] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch approval stats" },
      { status: 500 },
    );
  }
}
