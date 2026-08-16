// Mianx.ai — Phase 5: Individual Approval API
//
// GET    /api/approvals/[id]  — Get single approval details
// PATCH  /api/approvals/[id]  — Approve or reject
// POST   /api/approvals/[id]  — Approve or reject (alias)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApproval, processApproval } from "@/lib/approval-engine";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────
//  GET /api/approvals/[id] — Get approval details
// ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const approval = await getApproval(id, session.user.id);

    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    return NextResponse.json({ approval });
  } catch (error) {
    console.error("[approvals/[id]] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch approval" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/approvals/[id] — Approve or reject
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, note } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    const result = await processApproval(id, action, session.user.id, note);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: result.newStatus === "PENDING" ? 409 : 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[approvals/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/approvals/[id] — Approve or reject (alias)
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  return PATCH(request, { params });
}
