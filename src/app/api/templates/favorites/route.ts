import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/templates/favorites — list user's favorited template IDs
export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const favorites = await db.templateFavorite.findMany({
      where: { userId: session.user.id },
      select: { templateId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      favorites: favorites.map((f) => f.templateId),
    });
  } catch (e) {
    console.error("[templates] favorites fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 },
    );
  }
}

// POST /api/templates/favorites — favorite a template
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await req.json();

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 },
      );
    }

    const favorite = await db.templateFavorite.upsert({
      where: { templateId_userId: { templateId, userId: session.user.id } },
      create: { templateId, userId: session.user.id },
      update: {},
    });

    return NextResponse.json({ favorited: true, favorite });
  } catch (e) {
    console.error("[templates] favorite error:", e);
    return NextResponse.json(
      { error: "Failed to favorite template" },
      { status: 500 },
    );
  }
}

// DELETE /api/templates/favorites — unfavorite a template
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await req.json();

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 },
      );
    }

    await db.templateFavorite.deleteMany({
      where: { templateId, userId: session.user.id },
    });

    return NextResponse.json({ unfavorited: true });
  } catch (e) {
    console.error("[templates] unfavorite error:", e);
    return NextResponse.json(
      { error: "Failed to unfavorite template" },
      { status: 500 },
    );
  }
}
