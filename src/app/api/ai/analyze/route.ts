import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeProjectBrief } from "@/lib/ai-service";

// POST /api/ai/analyze — analyze project brief and recommend agents
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, projectType } = await req.json();

    if (!title || !description || !projectType) {
      return NextResponse.json(
        { error: "title, description, and projectType are required" },
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
