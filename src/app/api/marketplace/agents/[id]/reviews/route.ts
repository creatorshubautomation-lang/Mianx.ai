import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/marketplace/agents/[id]/reviews — list reviews for an agent
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)));

    const reviews = await db.agentReview.findMany({
      where: { agentId: id, isPublished: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await db.agentReview.count({
      where: { agentId: id, isPublished: true },
    });

    // Fetch reviewer names
    const userIds = [...new Set(reviews.map((r) => r.userId))];
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = reviews.map((r) => {
      const user = userMap.get(r.userId);
      return {
        ...r,
        userName: user?.name || "Anonymous",
        userAvatar: user?.avatarUrl || null,
      };
    });

    return NextResponse.json({
      reviews: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error("[marketplace] reviews list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}

// POST /api/marketplace/agents/[id]/reviews — submit a review
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check agent exists
    const agent = await db.customAgent.findUnique({
      where: { id, isPublished: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await req.json();
    const { rating, title, body: reviewBody } = body;

    // Validate
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "rating must be a number between 1 and 5" },
        { status: 400 },
      );
    }
    if (title !== undefined && (typeof title !== "string" || title.length > 200)) {
      return NextResponse.json(
        { error: "title must be a string under 200 characters" },
        { status: 400 },
      );
    }
    if (reviewBody !== undefined && (typeof reviewBody !== "string" || reviewBody.length > 2000)) {
      return NextResponse.json(
        { error: "review body must be a string under 2000 characters" },
        { status: 400 },
      );
    }

    // Upsert review (one per user per agent)
    const review = await db.agentReview.upsert({
      where: { agentId_userId: { agentId: id, userId: session.user.id } },
      create: {
        agentId: id,
        userId: session.user.id,
        rating,
        title: typeof title === "string" ? title : null,
        body: typeof reviewBody === "string" ? reviewBody : null,
      },
      update: {
        rating,
        title: typeof title === "string" ? title : null,
        body: typeof reviewBody === "string" ? reviewBody : null,
      },
    });

    // Recalculate agent average rating
    const allReviews = await db.agentReview.findMany({
      where: { agentId: id, isPublished: true },
      select: { rating: true },
    });
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 5.0;
    await db.customAgent.update({
      where: { id },
      data: { rating: Math.round(avgRating * 10) / 10 },
    });

    return NextResponse.json({ review, ok: true });
  } catch (e) {
    console.error("[marketplace] review create error:", e);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 },
    );
  }
}
