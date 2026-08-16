import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/marketplace/stats — marketplace-wide statistics
export async function GET(_req: Request) {
  try {
    const [totalAgents, totalInstalls, totalReviews, verifiedCount] =
      await Promise.all([
        db.customAgent.count({ where: { isPublished: true } }),
        db.agentInstall.count(),
        db.agentReview.count({ where: { isPublished: true } }),
        db.customAgent.count({
          where: { isPublished: true, isVerified: true },
        }),
      ]);

    // Category breakdown
    const categories = await db.customAgent.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    return NextResponse.json({
      totalAgents,
      totalInstalls,
      totalReviews,
      verifiedCount,
      categories: categories.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
    });
  } catch (e) {
    console.error("[marketplace] stats error:", e);
    return NextResponse.json(
      { error: "Failed to fetch marketplace stats" },
      { status: 500 },
    );
  }
}
