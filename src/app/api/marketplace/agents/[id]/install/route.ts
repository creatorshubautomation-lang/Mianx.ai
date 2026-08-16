import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/marketplace/agents/[id]/install — install an agent
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check agent exists
    const agent = await db.customAgent.findUnique({
      where: { id, isPublished: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Upsert install (idempotent)
    const install = await db.agentInstall.upsert({
      where: { agentId_userId: { agentId: id, userId: session.user.id } },
      create: { agentId: id, userId: session.user.id },
      update: {}, // no-op if already installed
    });

    // Increment download count
    await db.customAgent.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    return NextResponse.json({ installed: true, install });
  } catch (e) {
    console.error("[marketplace] install error:", e);
    return NextResponse.json(
      { error: "Failed to install agent" },
      { status: 500 },
    );
  }
}

// DELETE /api/marketplace/agents/[id]/install — uninstall an agent
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deleted = await db.agentInstall.deleteMany({
      where: { agentId: id, userId: session.user.id },
    });

    // Decrement download count (floor at 0)
    if (deleted.count > 0) {
      const agent = await db.customAgent.findUnique({ where: { id } });
      if (agent && agent.downloadCount > 0) {
        await db.customAgent.update({
          where: { id },
          data: { downloadCount: Math.max(0, agent.downloadCount - 1) },
        });
      }
    }

    return NextResponse.json({ uninstalled: true });
  } catch (e) {
    console.error("[marketplace] uninstall error:", e);
    return NextResponse.json(
      { error: "Failed to uninstall agent" },
      { status: 500 },
    );
  }
}
