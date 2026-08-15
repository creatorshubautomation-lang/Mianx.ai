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

  try {
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
  } catch (e) {
    console.error("[deliverables/get] error:", e);
    return NextResponse.json(
      {
        error: "Failed to fetch deliverables",
      },
      { status: 500 },
    );
  }
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

    // Look up the assigned agent's role for the ZIP metadata (best-effort —
    // falls back to a generic label if this agent isn't formally assigned).
    const assignedAgent = project.agents.find(
      (pa) => pa.agent.name === agentName,
    )?.agent;

    // Generate real deliverable using AI
    const generated = await generateDeliverable(
      agentName,
      taskDescription,
      projectContext,
    );

    // Generate ZIP file with multiple project files
    let zipBuffer: Buffer | null = null;
    let zipFileName: string | null = null;
    let fileCount = 1;

    try {
      const { generateProjectZip, parseAiContentToFiles } = await import(
        "@/lib/zip-generator"
      );

      const files = parseAiContentToFiles(generated.content);
      fileCount = files.length;

      const zipResult = await generateProjectZip({
        projectName: project.title,
        projectType: project.projectType,
        files,
        deliverableTitle: generated.title,
        agentName,
        agentRole: assignedAgent?.role || "Agent",
        description: taskDescription,
      });

      zipBuffer = zipResult.buffer;
      zipFileName = zipResult.fileName;
      fileCount = zipResult.fileCount;
    } catch (zipErr) {
      console.error("[deliverables] ZIP generation failed:", zipErr);
      // Continue without ZIP — text file will still be saved
    }

    const deliverable = await db.deliverable.create({
      data: {
        projectId,
        uploadedBy: session.user.id,
        title: generated.title,
        description: `${taskDescription}\n\n📦 ZIP contains ${fileCount} files`,
        fileType: zipBuffer ? "archive" : generated.fileType,
        content: generated.content,
        fileName: zipFileName || `${agentName.toLowerCase()}-${Date.now()}.${generated.fileType === "code" ? "txt" : "md"}`,
        fileSize: zipBuffer ? zipBuffer.length : generated.content.length,
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

    // Send deliverable ready email (best-effort)
    try {
      const { sendEmail, deliverableReadyEmail } = await import("@/lib/email");
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      });
      if (user?.email) {
        const { subject, html } = deliverableReadyEmail(
          user.name || "there",
          project.title,
          generated.title,
          agentName,
        );
        await sendEmail({ to: user.email, subject, html });
      }
    } catch (emailErr) {
      console.error("[deliverables] email failed:", emailErr);
    }

    // Auto-update project progress (deliverable = significant progress)
    try {
      const { updateProjectProgress } = await import("@/lib/project-progress");
      await updateProjectProgress(projectId);
    } catch (e) {
      console.error("[deliverables] progress update failed:", e);
    }

    return NextResponse.json({ deliverable, ok: true });
  } catch (e) {
    console.error("[deliverables] error:", e);
    return NextResponse.json(
      { error: "Failed to generate deliverable" },
      { status: 500 },
    );
  }
}
