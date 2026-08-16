import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/marketplace/agents/[id] — single agent detail with review summary
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const agent = await db.customAgent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Aggregate review stats
    const reviews = await db.agentReview.findMany({
      where: { agentId: id, isPublished: true },
      select: { rating: true, createdAt: true },
    });

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : agent.rating;

    // Rating distribution
    const distribution = [0, 0, 0, 0, 0]; // 1-5 star buckets
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;
    });

    // Parse JSON fields
    const capabilities = JSON.parse(agent.capabilities || "[]") as string[];
    const tags = JSON.parse(agent.tags || "[]") as string[];

    // Install count
    const installCount = await db.agentInstall.count({
      where: { agentId: id },
    });

    return NextResponse.json({
      agent: {
        ...agent,
        capabilities,
        tags,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews,
        installCount,
        ratingDistribution: distribution,
      },
    });
  } catch (e) {
    console.error("[marketplace] agent detail error:", e);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 },
    );
  }
}
