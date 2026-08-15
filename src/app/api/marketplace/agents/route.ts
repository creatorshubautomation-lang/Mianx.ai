import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MARKETPLACE_AGENTS } from "@/lib/marketplace-data";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/marketplace/agents — list all marketplace agents (auto-seeds if empty)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const freeOnly = url.searchParams.get("free") === "true";

    let agents = await db.customAgent.findMany({
      where: {
        isPublished: true,
        ...(category && category !== "all" ? { category } : {}),
        ...(freeOnly ? { price: 0 } : {}),
      },
      orderBy: { downloadCount: "desc" },
      take: 50,
    });

    // Auto-seed marketplace agents if database is empty.
    // Uses createMany + skipDuplicates so concurrent requests racing to
    // seed an empty table can't create duplicate rows (relies on the
    // @@unique([creatorId, name]) constraint on CustomAgent).
    if (agents.length === 0) {
      // Use first admin user as creator
      const adminUser = await db.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      const creatorId = adminUser?.id || "system";

      await db.customAgent.createMany({
        data: MARKETPLACE_AGENTS.map((template, i) => ({
          creatorId,
          name: template.name,
          description: template.description,
          category: template.category,
          icon: template.icon,
          color: template.color,
          systemPrompt: template.systemPrompt,
          capabilities: JSON.stringify(template.capabilities),
          price: template.price,
          isVerified: template.isVerified,
          tags: JSON.stringify(template.tags),
          // Deterministic sample stats (not randomly generated) — this is
          // seed/demo catalog data, not real usage figures, so it should
          // stay stable and reproducible rather than faking organic growth.
          downloadCount: 50 + i * 37,
          rating: 4.5,
        })),
        skipDuplicates: true,
      });

      // Re-fetch after seeding
      agents = await db.customAgent.findMany({
        where: {
          isPublished: true,
          ...(category && category !== "all" ? { category } : {}),
          ...(freeOnly ? { price: 0 } : {}),
        },
        orderBy: { downloadCount: "desc" },
        take: 50,
      });

      console.log(`[marketplace] seeded ${MARKETPLACE_AGENTS.length} agents`);
    }

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

  // Basic anti-spam throttle on agent creation
  const limit = rateLimit(`marketplace-create:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many agents created. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { name, description, category, systemPrompt, capabilities, tags } =
      await req.json();

    if (!name || !description || !systemPrompt) {
      return NextResponse.json(
        { error: "name, description, and systemPrompt are required" },
        { status: 400 },
      );
    }

    if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json(
        { error: "name must be a string between 1 and 100 characters" },
        { status: 400 },
      );
    }
    if (typeof description !== "string" || description.length > 2000) {
      return NextResponse.json(
        { error: "description must be a string under 2000 characters" },
        { status: 400 },
      );
    }
    if (typeof systemPrompt !== "string" || systemPrompt.length > 8000) {
      return NextResponse.json(
        { error: "systemPrompt must be a string under 8000 characters" },
        { status: 400 },
      );
    }
    if (
      capabilities !== undefined &&
      (!Array.isArray(capabilities) || capabilities.length > 30)
    ) {
      return NextResponse.json(
        { error: "capabilities must be an array of at most 30 items" },
        { status: 400 },
      );
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 20)) {
      return NextResponse.json(
        { error: "tags must be an array of at most 20 items" },
        { status: 400 },
      );
    }

    const agent = await db.customAgent.create({
      data: {
        creatorId: session.user.id,
        name,
        description,
        category: typeof category === "string" ? category.slice(0, 50) : "custom",
        systemPrompt,
        capabilities: JSON.stringify(capabilities || []),
        // Pricing is not client-controllable: this platform has no purchase/
        // payment flow for marketplace agents yet, and price is a
        // trust-sensitive field that must be set server-side (by an admin
        // review process) once monetization exists. User-created agents are
        // always free and unverified until then.
        price: 0,
        isVerified: false,
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
