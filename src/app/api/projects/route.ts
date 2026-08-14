import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects — list current user's projects
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const project = await db.project.findUnique({
        where: { id },
        include: {
          agents: { include: { agent: true } },
          tasks: { orderBy: { order: "asc" } },
          messages: {
            include: { user: true, agent: true },
            orderBy: { createdAt: "asc" },
          },
          deliverables: {
            include: { uploader: true },
            orderBy: { createdAt: "desc" },
          },
          activities: { orderBy: { createdAt: "desc" }, take: 20 },
          client: true,
        },
      });

      if (!project) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Admin can see any project; clients only their own
      if (
        project.clientId !== session.user.id &&
        session.user.role !== "ADMIN"
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ project });
    }

    // List view
    const where =
      session.user.role === "ADMIN"
        ? {}
        : { clientId: session.user.id };

    const projects = await db.project.findMany({
      where,
      include: {
        agents: { include: { agent: true } },
        client: true,
        _count: {
          select: { tasks: true, messages: true, deliverables: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (e) {
    console.error("[projects/get] error:", e);
    return NextResponse.json(
      {
        error: "Failed to fetch projects",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      projectType,
      requirements,
      priority = "normal",
      budget,
      deadline,
      recommendedAgents = [],
      suggestedTasks = [],
    } = body;

    if (!title || !description || !projectType) {
      return NextResponse.json(
        { error: "Title, description, and projectType are required" },
        { status: 400 },
      );
    }

    // Create project
    const project = await db.project.create({
      data: {
        clientId: session.user.id,
        title,
        description,
        projectType,
        requirements: JSON.stringify(requirements || {}),
        priority,
        budget: budget ? parseFloat(budget) : null,
        deadline: deadline ? new Date(deadline) : null,
        status: "IN_PROGRESS",
        progress: 5,
      },
    });

    // Ensure agents exist in DB and assign them
    const agentRecords = await db.agent.findMany({
      where: { name: { in: recommendedAgents } },
    });

    if (agentRecords.length > 0) {
      await db.projectAgent.createMany({
        data: agentRecords.map((a, idx) => ({
          projectId: project.id,
          agentId: a.id,
          status: idx === 0 ? "working" : "assigned",
          progress: idx === 0 ? 10 : 0,
        })),
      });
    }

    // Create initial tasks
    if (suggestedTasks?.length > 0) {
      const allAgents = await db.agent.findMany();
      const agentByName = new Map(allAgents.map((a) => [a.name, a]));

      await db.task.createMany({
        data: suggestedTasks
          .filter((t: { agent: string }) => agentByName.has(t.agent))
          .map((t: { title: string; description: string; agent: string }, i: number) => ({
            projectId: project.id,
            title: t.title,
            description: t.description,
            assignedAgentId: agentByName.get(t.agent)!.id,
            status: i === 0 ? "in_progress" : "todo",
            order: i,
          })),
      });
    }

    // Log activity
    await db.activity.create({
      data: {
        projectId: project.id,
        userId: session.user.id,
        action: "PROJECT_CREATED",
        details: `Project "${title}" created with ${agentRecords.length} agents assigned`,
      },
    });

    // Send project created email (best-effort)
    try {
      const { sendEmail, projectCreatedEmail } = await import("@/lib/email");
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      });
      if (user?.email) {
        const { subject, html } = projectCreatedEmail(
          user.name || "there",
          title,
          agentRecords.length,
        );
        await sendEmail({ to: user.email, subject, html });
      }
    } catch (emailErr) {
      console.error("[projects] email failed:", emailErr);
    }

    // Initial welcome message from first assigned agent
    if (agentRecords.length > 0) {
      const firstAgent = agentRecords[0];
      await db.message.create({
        data: {
          projectId: project.id,
          agentId: firstAgent.id,
          role: "agent",
          content: `Hi! I'm ${firstAgent.name}, your ${firstAgent.role}. I've reviewed your project brief and I'm ready to get started. Here's what I'm thinking:\n\n1. I'll analyze your requirements in detail\n2. Break down the work into tasks\n3. Coordinate with the rest of the agent team\n\nFeel free to ask me anything or share more details about your vision!`,
        },
      });
    }

    const fullProject = await db.project.findUnique({
      where: { id: project.id },
      include: {
        agents: { include: { agent: true } },
        tasks: { orderBy: { order: "asc" } },
        messages: {
          include: { user: true, agent: true },
          orderBy: { createdAt: "asc" },
        },
        client: true,
      },
    });

    return NextResponse.json({ project: fullProject, ok: true });
  } catch (e) {
    console.error("[projects/create] error:", e);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}

// PATCH /api/projects — update project
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, ...updates } = await req.json();

    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      project.clientId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await db.project.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ project: updated });
  } catch (e) {
    console.error("[projects/update] error:", e);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}
