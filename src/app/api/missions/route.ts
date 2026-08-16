// Mianx.ai — Mission Engine: API Routes
//
// GET    /api/missions          — List user's missions
// POST   /api/missions          — Create new mission

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { logMissionEvent } from "@/lib/mission-engine";

// ─────────────────────────────────────────────
//  Helper: Auth check
// ─────────────────────────────────────────────

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

// ─────────────────────────────────────────────
//  GET /api/missions — List missions
// ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;

    const [missions, total] = await Promise.all([
      db.mission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          progress: true,
          totalTasks: true,
          completedTasks: true,
          failedTasks: true,
          budgetUsd: true,
          spentUsd: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      db.mission.count({ where }),
    ]);

    return NextResponse.json({ missions, total, limit, offset });
  } catch (error) {
    console.error("[missions] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
//  POST /api/missions — Create mission
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, projectId, priority, budgetUsd, deadline } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 },
      );
    }

    if (!title.trim() || !description.trim()) {
      return NextResponse.json(
        { error: "title and description cannot be empty" },
        { status: 400 },
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: "title must be under 200 characters" },
        { status: 400 },
      );
    }

    if (description.length > 5000) {
      return NextResponse.json(
        { error: "description must be under 5000 characters" },
        { status: 400 },
      );
    }

    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId, clientId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const mission = await db.mission.create({
      data: {
        userId: user.id,
        projectId: projectId || null,
        title: title.trim(),
        description: description.trim(),
        status: "DRAFT",
        priority: priority || "normal",
        budgetUsd: budgetUsd || null,
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    await logMissionEvent(mission.id, {
      eventType: "CREATED",
      title: "Mission Created",
      description: `Mission "${mission.title}" created as DRAFT`,
      level: "info",
    });

    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    console.error("[missions] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
