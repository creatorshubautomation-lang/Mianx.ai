import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/templates/stats — template-wide statistics
export async function GET(_req: Request) {
  try {
    // Total usage across all templates
    const totalUsage = await db.templateUsage.count();

    // Total favorites
    const totalFavorites = await db.templateFavorite.count();

    // Total custom templates
    const totalCustom = await db.customTemplate.count();

    // Usage by template (top 10)
    const usageByTemplate = await db.templateUsage.groupBy({
      by: ["templateId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Most favorited templates
    const favoriteCounts = await db.templateFavorite.groupBy({
      by: ["templateId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Usage trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsage = await db.templateUsage.groupBy({
      by: ["createdAt"],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    return NextResponse.json({
      totalUsage,
      totalFavorites,
      totalCustom,
      usageByTemplate: usageByTemplate.map((u) => ({
        templateId: u.templateId,
        count: u._count.id,
      })),
      favoriteCounts: favoriteCounts.map((f) => ({
        templateId: f.templateId,
        count: f._count.id,
      })),
      recentUsageCount: recentUsage.reduce((sum, r) => sum + r._count.id, 0),
    });
  } catch (e) {
    console.error("[templates] stats error:", e);
    return NextResponse.json(
      { error: "Failed to fetch template stats" },
      { status: 500 },
    );
  }
}
