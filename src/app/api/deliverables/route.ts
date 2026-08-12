import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDeliverable } from "@/lib/ai-service";

// GET /api/deliverables?projectId=xxx
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    project.clientId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deliverables = await db.deliverable.findMany({
    where: { projectId },
    include: { uploader: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ deliverables });
}

// POST /api/deliverables — request a new deliverable (AI-generated)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, agentName, taskDescription } = await req.json();

    if (!projectId || !agentName || !taskDescription) {
      return NextResponse.json(
        { error: "projectId, agentName, and taskDescription are required" },
        { status: 400 },
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { agents: { include: { agent: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      project.clientId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projectContext = `Project: ${project.title}
Type: ${project.projectType}
Description: ${project.description}`;

    // Generate real deliverable using AI
    const generated = await generateDeliverable(
      agentName,
      taskDescription,
      projectContext,
    );

    const deliverable = await db.deliverable.create({
      data: {
        projectId,
        uploadedBy: session.user.id,
        title: generated.title,
        description: taskDescription,
        fileType: generated.fileType,
        content: generated.content,
        fileName: `${agentName.toLowerCase()}-${Date.now()}.${generated.fileType === "code" ? "txt" : "md"}`,
        fileSize: generated.content.length,
      },
      include: { uploader: true },
    });

    // Log activity
    await db.activity.create({
      data: {
        projectId,
        userId: session.user.id,
        action: "DELIVERABLE_GENERATED",
        details: `${agentName} generated: ${generated.title}`,
      },
    });

    return NextResponse.json({ deliverable, ok: true });
  } catch (e) {
    console.error("[deliverables] error:", e);
    return NextResponse.json(
      { error: "Failed to generate deliverable" },
      { status: 500 },
    );
  }
}
