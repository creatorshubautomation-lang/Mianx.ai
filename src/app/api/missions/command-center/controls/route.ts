// Mianx.ai — Phase 7+: Command Center Global Controls
//
// POST /api/missions/command-center/controls — Bulk mission control actions
// Allows admins to pause-all, cancel-all, emergency-stop, or targeted actions

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logMissionEvent } from "@/lib/mission-engine";

type BulkAction = "pause_all" | "resume_all" | "cancel_all" | "emergency_stop";

interface BulkControlRequest {
  action: BulkAction;
  missionIds?: string[];
  reason?: string;
}

const PAUSABLE_STATUSES = ["EXECUTING", "VERIFYING", "REPAIRING"];
const RESUMABLE_STATUSES = ["PAUSED"];
const CANCELLABLE_STATUSES = [
  "EXECUTING", "PLANNING", "VERIFYING", "REPAIRING",
  "APPROVED", "PAUSED", "AWAITING_APPROVAL", "DRAFT",
];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BulkControlRequest = await req.json();
    const { action, missionIds, reason } = body;

    const validActions: BulkAction[] = ["pause_all", "resume_all", "cancel_all", "emergency_stop"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use: pause_all, resume_all, cancel_all, or emergency_stop" },
        { status: 400 },
      );
    }

    // Build filter
    const where: Record<string, unknown> = {};
    if (missionIds && missionIds.length > 0) {
      where.id = { in: missionIds };
    }

    let newStatus: string;
    switch (action) {
      case "pause_all":
        where.status = { in: PAUSABLE_STATUSES };
        newStatus = "PAUSED";
        break;
      case "resume_all":
        where.status = { in: RESUMABLE_STATUSES };
        newStatus = "EXECUTING";
        break;
      case "cancel_all":
      case "emergency_stop":
        where.status = { in: CANCELLABLE_STATUSES };
        newStatus = "CANCELLED";
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Find matching missions
    const missions = await db.mission.findMany({
      where,
      select: { id: true, title: true, status: true },
    });

    if (missions.length === 0) {
      return NextResponse.json({
        action,
        affected: 0,
        message: "No missions matched the criteria",
      });
    }

    // Bulk update
    const result = await db.mission.updateMany({
      where: { id: { in: missions.map((m) => m.id) } },
      data: {
        status: newStatus as any,
        ...(newStatus === "CANCELLED" ? { completedAt: new Date() } : {}),
      },
    });

    // Log events (fire-and-forget)
    await Promise.allSettled(
      missions.map((m) =>
        logMissionEvent(m.id, {
          eventType: action === "emergency_stop" ? "MISSION_CANCELLED" : "STATUS_CHANGED",
          title: action === "emergency_stop"
            ? "EMERGENCY STOP"
            : `Bulk ${action.replace("_all", "")}`,
          description: reason || `Admin applied ${action}`,
          metadata: {
            action,
            triggeredBy: session.user.id,
            previousStatus: m.status,
            newStatus,
          },
          level: action === "emergency_stop" ? "CRITICAL" : "WARNING",
        }).catch(() => {}),
      ),
    );

    return NextResponse.json({
      action,
      affected: result.count,
      missions: missions.map((m) => ({
        id: m.id,
        title: m.title,
        previousStatus: m.status,
      })),
      message: `${action} applied to ${result.count} mission(s)`,
    });
  } catch (error) {
    console.error("[command-center/controls] POST error:", error);
    return NextResponse.json(
      { error: "Failed to execute control action" },
      { status: 500 },
    );
  }
}
