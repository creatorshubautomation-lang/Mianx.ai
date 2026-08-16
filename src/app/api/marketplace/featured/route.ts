import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/marketplace/featured — featured/trending agents for discovery
export async function GET(_req: Request) {
  try {
    const featured = await db.customAgent.findMany({
      where: { isPublished: true, isVerified: true },
      orderBy: { downloadCount: "desc" },
      take: 6,
    });

    const trending = await db.customAgent.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    const newAgents = await db.customAgent.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    // Parse JSON fields
    const parse = (agents: typeof featured) =>
      agents.map((a) => ({
        ...a,
        capabilities: JSON.parse(a.capabilities || "[]"),
        tags: JSON.parse(a.tags || "[]"),
      }));

    return NextResponse.json({
      featured: parse(featured),
      trending: parse(trending),
      newAgents: parse(newAgents),
    });
  } catch (e) {
    console.error("[marketplace] featured error:", e);
    return NextResponse.json(
      { error: "Failed to fetch featured agents" },
      { status: 500 },
    );
  }
}
