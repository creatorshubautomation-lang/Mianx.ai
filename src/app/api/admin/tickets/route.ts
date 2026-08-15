import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/tickets — list all tickets (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role from DB
  let userRole = session.user.role;
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser) userRole = dbUser.role;
  } catch (e) {
    console.error("[admin/tickets] role check error:", e);
  }

  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tickets = await db.supportTicket.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (e) {
    console.error("[admin/tickets/get] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/tickets — respond to ticket / update status
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin
  let userRole = session.user.role;
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser) userRole = dbUser.role;
  } catch (e) {
    console.error("[admin/tickets] role check error:", e);
  }

  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id, response, status } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "closed"];
    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    if (response !== undefined && typeof response === "string" && response.length > 5000) {
      return NextResponse.json(
        { error: "response must be under 5000 characters" },
        { status: 400 },
      );
    }

    const updateData: {
      response?: string;
      status?: string;
      respondedAt?: Date;
    } = {};

    if (response !== undefined) {
      updateData.response = response;
      updateData.respondedAt = new Date();
      updateData.status = "in_progress";
    }

    if (status) {
      updateData.status = status;
    }

    const ticket = await db.supportTicket.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ticket, ok: true });
  } catch (e) {
    console.error("[admin/tickets/update] error:", e);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}
