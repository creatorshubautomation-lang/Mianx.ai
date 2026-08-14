import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/marketplace/agents — list all marketplace agents
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const freeOnly = url.searchParams.get("free") === "true";

    const agents = await db.customAgent.findMany({
      where: {
        isPublished: true,
        ...(category && category !== "all" ? { category } : {}),
        ...(freeOnly ? { price: 0 } : {}),
      },
      orderBy: { downloadCount: "desc" },
      take: 50,
    });

    return NextResponse.json({ agents });
  } catch (e) {
    console.error("[marketplace] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}

// POST /api/marketplace/agents — create custom agent
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, category, systemPrompt, capabilities, price, tags } =
      await req.json();

    if (!name || !description || !systemPrompt) {
      return NextResponse.json(
        { error: "name, description, and systemPrompt are required" },
        { status: 400 },
      );
    }

    const agent = await db.customAgent.create({
      data: {
        creatorId: session.user.id,
        name,
        description,
        category: category || "custom",
        systemPrompt,
        capabilities: JSON.stringify(capabilities || []),
        price: price || 0,
        tags: JSON.stringify(tags || []),
      },
    });

    return NextResponse.json({ agent, ok: true });
  } catch (e) {
    console.error("[marketplace] create error:", e);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 },
    );
  }
}
