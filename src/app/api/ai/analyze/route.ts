import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeProjectBrief } from "@/lib/ai-service";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/ai/analyze — analyze project brief and recommend agents
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 10 analyses per user per minute — this calls paid AI providers
  const limit = await rateLimit(`ai-analyze:${session.user.id}`, 10, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  try {
    const { title, description, projectType } = await req.json();

    if (!title || !description || !projectType) {
      return NextResponse.json(
        { error: "title, description, and projectType are required" },
        { status: 400 },
      );
    }

    if (typeof title !== "string" || title.length > 200) {
      return NextResponse.json(
        { error: "title must be a string under 200 characters" },
        { status: 400 },
      );
    }
    if (typeof description !== "string" || description.length > 5000) {
      return NextResponse.json(
        { error: "description must be a string under 5000 characters" },
        { status: 400 },
      );
    }
    if (typeof projectType !== "string" || projectType.length > 50) {
      return NextResponse.json(
        { error: "projectType must be a string under 50 characters" },
        { status: 400 },
      );
    }

    const analysis = await analyzeProjectBrief(
      title,
      description,
      projectType,
    );

    return NextResponse.json({ analysis, ok: true });
  } catch (e) {
    console.error("[ai/analyze] error:", e);
    return NextResponse.json(
      { error: "Failed to analyze project brief" },
      { status: 500 },
    );
  }
}
