import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/tickets — list current user's tickets
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tickets = await db.supportTicket.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (e) {
    console.error("[tickets/get] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}

// POST /api/tickets — create a new support ticket
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subject, description, priority, category, projectId } =
      await req.json();

    if (!subject || !description) {
      return NextResponse.json(
        { error: "Subject and description are required" },
        { status: 400 },
      );
    }

    if (typeof subject !== "string" || subject.length > 200) {
      return NextResponse.json(
        { error: "subject must be a string under 200 characters" },
        { status: 400 },
      );
    }
    if (typeof description !== "string" || description.length > 5000) {
      return NextResponse.json(
        { error: "description must be a string under 5000 characters" },
        { status: 400 },
      );
    }
    const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"];
    if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` },
        { status: 400 },
      );
    }

    let linkedProjectId: string | null = null;
    if (projectId) {
      const linkedProject = await db.project.findUnique({
        where: { id: projectId },
        select: { clientId: true },
      });
      if (
        linkedProject &&
        (linkedProject.clientId === session.user.id ||
          session.user.role === "ADMIN")
      ) {
        linkedProjectId = projectId;
      }
      // If the project doesn't exist or isn't theirs, silently drop the
      // link rather than letting a client attach a ticket to a project
      // they don't own.
    }

    const ticket = await db.supportTicket.create({
      data: {
        userId: session.user.id,
        subject,
        description,
        priority: priority || "normal",
        category: category || "general",
        projectId: linkedProjectId,
        status: "open",
      },
    });

    return NextResponse.json({ ticket, ok: true });
  } catch (e) {
    console.error("[tickets/create] error:", e);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 },
    );
  }
}
