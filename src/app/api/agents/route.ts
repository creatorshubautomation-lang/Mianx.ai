import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGENT_CATALOG } from "@/lib/agents";

// GET /api/agents — list all agents (seed if empty)
export async function GET() {
  try {
    let agents = await db.agent.findMany({
      include: {
        _count: {
          select: { assignments: true, messages: true },
        },
      },
      orderBy: [{ team: "asc" }, { name: "asc" }],
    });

    // Auto-seed the agent catalog if database is empty.
    // This is the platform's product catalog, not demo data —
    // these are the agent definitions that power the software house.
    if (agents.length === 0) {
      await db.agent.createMany({
        data: AGENT_CATALOG.map((a) => ({
          team: a.team,
          name: a.name,
          role: a.role,
          description: a.description,
          capabilities: JSON.stringify(a.capabilities),
          icon: a.icon,
          color: a.color,
          systemPrompt: a.systemPrompt,
        })),
      });

      agents = await db.agent.findMany({
        include: {
          _count: {
            select: { assignments: true, messages: true },
          },
        },
        orderBy: [{ team: "asc" }, { name: "asc" }],
      });
    }

    return NextResponse.json({ agents });
  } catch (e) {
    console.error("[agents] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}
