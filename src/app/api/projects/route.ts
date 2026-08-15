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

    // ── Input validation ──────────────────────────────────────────
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: "title must be a string between 1 and 200 characters" },
        { status: 400 },
      );
    }
    if (typeof description !== "string" || description.length > 10_000) {
      return NextResponse.json(
        { error: "description must be a string under 10,000 characters" },
        { status: 400 },
      );
    }
    const ALLOWED_PROJECT_TYPES = [
      "web",
      "mobile",
      "branding",
      "content",
      "marketing",
      "full_stack",
    ];
    if (
      typeof projectType !== "string" ||
      !ALLOWED_PROJECT_TYPES.includes(projectType)
    ) {
      return NextResponse.json(
        {
          error: `projectType must be one of: ${ALLOWED_PROJECT_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"];
    if (typeof priority !== "string" || !ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` },
        { status: 400 },
      );
    }
    if (budget !== undefined && budget !== null && budget !== "") {
      const parsedBudget = parseFloat(budget);
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        return NextResponse.json(
          { error: "budget must be a non-negative number" },
          { status: 400 },
        );
      }
    }
    if (deadline) {
      const parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        return NextResponse.json(
          { error: "deadline must be a valid date" },
          { status: 400 },
        );
      }
    }
    if (requirements !== undefined) {
      const requirementsStr = JSON.stringify(requirements ?? {});
      if (requirementsStr.length > 50_000) {
        return NextResponse.json(
          { error: "requirements payload is too large" },
          { status: 400 },
        );
      }
    }
    if (!Array.isArray(recommendedAgents) || recommendedAgents.length > 20) {
      return NextResponse.json(
        { error: "recommendedAgents must be an array of at most 20 items" },
        { status: 400 },
      );
    }
    if (!Array.isArray(suggestedTasks) || suggestedTasks.length > 50) {
      return NextResponse.json(
        { error: "suggestedTasks must be an array of at most 50 items" },
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
    // STEP 1: Get AI-recommended agents
    const recommendedAgentRecords = await db.agent.findMany({
      where: { name: { in: recommendedAgents } },
    });

    // STEP 2: Ensure FULL TEAM — at least 1 agent from each of 6 teams
    // This ensures every project has Design, Dev, Content, Marketing, QA, Support
    const allAgents = await db.agent.findMany();
    const TEAMS = ["DESIGN", "DEVELOPMENT", "CONTENT", "MARKETING", "QA", "SUPPORT"];

    const fullTeamAgents = new Map<string, typeof allAgents[0]>();

    // First add recommended agents
    for (const a of recommendedAgentRecords) {
      fullTeamAgents.set(a.id, a);
    }

    // Then ensure at least 1 from each team
    for (const team of TEAMS) {
      const hasTeam = Array.from(fullTeamAgents.values()).some(
        (a) => a.team === team,
      );
      if (!hasTeam) {
        // Pick first agent from this team
        const teamAgent = allAgents.find((a) => a.team === team);
        if (teamAgent) {
          fullTeamAgents.set(teamAgent.id, teamAgent);
        }
      }
    }

    // Convert to array and sort by team priority
    const agentRecords = Array.from(fullTeamAgents.values()).sort((a, b) => {
      const teamOrder = ["DESIGN", "DEVELOPMENT", "CONTENT", "MARKETING", "QA", "SUPPORT"];
      return teamOrder.indexOf(a.team) - teamOrder.indexOf(b.team);
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

    // Auto-update project progress based on tasks
    try {
      const { updateProjectProgress } = await import("@/lib/project-progress");
      await updateProjectProgress(project.id);
    } catch (e) {
      console.error("[projects] progress update failed:", e);
    }

    // Trigger webhook (project.created)
    try {
      const { triggerWebhooks } = await import("@/lib/webhooks");
      await triggerWebhooks(
        "project.created",
        {
          projectId: project.id,
          title: project.title,
          projectType: project.projectType,
          agentCount: agentRecords.length,
        },
        session.user.id,
        project.id,
      );
    } catch (e) {
      console.error("[projects] webhook failed:", e);
    }

    return NextResponse.json({ project: fullProject, ok: true });
  } catch (e) {
    console.error("[projects/create] error:", e);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}

// Fields a project's own client is allowed to edit.
const CLIENT_EDITABLE_FIELDS = [
  "title",
  "description",
  "requirements",
  "priority",
  "budget",
  "deadline",
] as const;

// Additional fields only an ADMIN may edit (internal workflow state).
const ADMIN_ONLY_FIELDS = ["status", "progress"] as const;

const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"];
const ALLOWED_STATUSES = [
  "BRIEFING",
  "PLANNING",
  "IN_PROGRESS",
  "REVIEW",
  "DELIVERED",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
];

// PATCH /api/projects — update project
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN";
    if (project.clientId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Whitelist: only accept known, role-appropriate fields. Anything else
    // in the request body (e.g. clientId, id, createdAt) is silently
    // ignored rather than passed through to the DB update.
    const allowedFields: readonly string[] = isAdmin
      ? [...CLIENT_EDITABLE_FIELDS, ...ADMIN_ONLY_FIELDS]
      : CLIENT_EDITABLE_FIELDS;

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    // Basic validation on whatever was actually submitted.
    if (typeof updates.title === "string") {
      if (updates.title.trim().length === 0 || updates.title.length > 200) {
        return NextResponse.json(
          { error: "title must be 1-200 characters" },
          { status: 400 },
        );
      }
    }
    if (
      typeof updates.description === "string" &&
      updates.description.length > 10_000
    ) {
      return NextResponse.json(
        { error: "description must be under 10,000 characters" },
        { status: 400 },
      );
    }
    if (updates.priority !== undefined) {
      if (
        typeof updates.priority !== "string" ||
        !ALLOWED_PRIORITIES.includes(updates.priority)
      ) {
        return NextResponse.json(
          { error: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` },
          { status: 400 },
        );
      }
    }
    if (updates.budget !== undefined && updates.budget !== null) {
      if (typeof updates.budget !== "number" || updates.budget < 0) {
        return NextResponse.json(
          { error: "budget must be a non-negative number" },
          { status: 400 },
        );
      }
    }
    if (updates.deadline !== undefined && updates.deadline !== null) {
      const parsed = new Date(updates.deadline as string);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "deadline must be a valid date" },
          { status: 400 },
        );
      }
      updates.deadline = parsed;
    }
    if (updates.status !== undefined) {
      if (
        typeof updates.status !== "string" ||
        !ALLOWED_STATUSES.includes(updates.status)
      ) {
        return NextResponse.json(
          { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
          { status: 400 },
        );
      }
    }
    if (updates.progress !== undefined) {
      if (
        typeof updates.progress !== "number" ||
        updates.progress < 0 ||
        updates.progress > 100
      ) {
        return NextResponse.json(
          { error: "progress must be a number between 0 and 100" },
          { status: 400 },
        );
      }
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
