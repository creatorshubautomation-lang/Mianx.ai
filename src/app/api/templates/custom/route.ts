import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/templates/custom — list user's custom templates
export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customs = await db.customTemplate.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      templates: customs.map((t) => ({
        ...t,
        requiredAgents: JSON.parse(t.requiredAgents || "[]"),
        features: JSON.parse(t.features || "[]"),
        techStack: JSON.parse(t.techStack || "[]"),
      })),
    });
  } catch (e) {
    console.error("[templates] custom list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch custom templates" },
      { status: 500 },
    );
  }
}

// POST /api/templates/custom — create a custom template
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await rateLimit(
      `custom-template:${session.user.id}`,
      10,
      60 * 60 * 1000,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many templates created. Please try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { name, description, category, icon, color, requiredAgents, features, techStack, defaultProjectType, defaultDescription, estimatedDays } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json({ error: "name must be a string between 1 and 100 characters" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.length > 2000) {
      return NextResponse.json({ error: "description must be a string under 2000 characters" }, { status: 400 });
    }

    const agents = Array.isArray(requiredAgents) ? requiredAgents.slice(0, 20) : [];
    const feats = Array.isArray(features) ? features.slice(0, 30) : [];
    const tech = Array.isArray(techStack) ? techStack.slice(0, 15) : [];

    const template = await db.customTemplate.create({
      data: {
        creatorId: session.user.id,
        name: name.trim(),
        description: description.trim(),
        category: typeof category === "string" ? category.slice(0, 50) : "custom",
        icon: typeof icon === "string" ? icon.slice(0, 50) : "Sparkles",
        color: typeof color === "string" ? color.slice(0, 100) : "from-purple-500 to-cyan-500",
        requiredAgents: JSON.stringify(agents),
        features: JSON.stringify(feats),
        techStack: JSON.stringify(tech),
        defaultProjectType: typeof defaultProjectType === "string" ? defaultProjectType : "web",
        defaultDescription: typeof defaultDescription === "string" ? defaultDescription : "",
        estimatedDays: typeof estimatedDays === "number" ? Math.min(30, Math.max(1, estimatedDays)) : 3,
      },
    });

    return NextResponse.json({ template, ok: true });
  } catch (e) {
    console.error("[templates] custom create error:", e);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}

// DELETE /api/templates/custom — delete a custom template
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Only creator can delete
    const template = await db.customTemplate.findUnique({ where: { id } });
    if (!template || template.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await db.customTemplate.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("[templates] custom delete error:", e);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 },
    );
  }
}
