import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/agent-memory?projectId=xxx — get all memories for a project
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const memories = await db.agentMemory.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ memories });
  } catch (e) {
    console.error("[agent-memory] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch memories" },
      { status: 500 },
    );
  }
}
