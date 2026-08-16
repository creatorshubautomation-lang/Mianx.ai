import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/marketplace/installed — list agents installed by the current user
export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const installs = await db.agentInstall.findMany({
      where: { userId: session.user.id },
      orderBy: { installedAt: "desc" },
    });

    // Fetch agents separately since we don't have a declared relation
    const agentIds = installs.map((i) => i.agentId);
    const agents =
      agentIds.length > 0
        ? await db.customAgent.findMany({
            where: { id: { in: agentIds } },
          })
        : [];

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const result = installs.map((inst) => {
      const agent = agentMap.get(inst.agentId);
      if (!agent) return null;
      return {
        ...agent,
        capabilities: JSON.parse(agent.capabilities || "[]"),
        tags: JSON.parse(agent.tags || "[]"),
        installedAt: inst.installedAt,
      };
    }).filter(Boolean);

    return NextResponse.json({ installed: result });
  } catch (e) {
    console.error("[marketplace] installed list error:", e);
    return NextResponse.json(
      { error: "Failed to fetch installed agents" },
      { status: 500 },
    );
  }
}
