import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/templates/usage — record template usage when a project is started from a template
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 20 template uses per hour
    const limit = await rateLimit(
      `template-usage:${session.user.id}`,
      20,
      60 * 60 * 1000,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const { templateId, projectId } = await req.json();

    if (!templateId || typeof templateId !== "string" || templateId.length > 100) {
      return NextResponse.json(
        { error: "templateId is required (string, max 100 chars)" },
        { status: 400 },
      );
    }

    const usage = await db.templateUsage.create({
      data: {
        templateId,
        userId: session.user.id,
        projectId: typeof projectId === "string" ? projectId : null,
      },
    });

    return NextResponse.json({ usage, ok: true });
  } catch (e) {
    console.error("[templates] usage error:", e);
    return NextResponse.json(
      { error: "Failed to record template usage" },
      { status: 500 },
    );
  }
}

// GET /api/templates/usage — get usage counts (optionally filtered by template)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const templateId = url.searchParams.get("templateId");

    if (templateId) {
      // Single template usage count
      const count = await db.templateUsage.count({
        where: { templateId },
      });
      return NextResponse.json({ templateId, usageCount: count });
    }

    // All template usage counts (aggregated)
    const allUsage = await db.templateUsage.groupBy({
      by: ["templateId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    return NextResponse.json({
      usage: allUsage.map((u) => ({
        templateId: u.templateId,
        count: u._count.id,
      })),
    });
  } catch (e) {
    console.error("[templates] usage fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch template usage" },
      { status: 500 },
    );
  }
}
