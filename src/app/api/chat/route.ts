import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamAgentResponse, type TeamAgentInfo } from "@/lib/ai-service";

// GET /api/chat?projectId=xxx — list messages for a project
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

    const messages = await db.message.findMany({
      where: { projectId },
      include: { user: true, agent: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ messages });
  } catch (e) {
    console.error("[chat/get] error:", e);
    return NextResponse.json(
      {
        error: "Failed to fetch messages",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

// POST /api/chat — send a message and get MULTI-AGENT team response
//
// New behavior (Multi-Agent Team Chat):
//   1. Client sends message
//   2. System identifies 1-3 relevant agents based on message content
//   3. All relevant agents respond IN PARALLEL
//   4. Each agent's response saved as separate message
//   5. Client sees team collaboration in chat
//
// If message is general (no specific keywords), only lead agent responds.
// If message mentions multiple areas (e.g., "design + code"), multiple agents respond.

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, content } = await req.json();

    if (!projectId || !content) {
      return NextResponse.json(
        { error: "projectId and content are required" },
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

    // Save user message
    const userMessage = await db.message.create({
      data: {
        projectId,
        userId: session.user.id,
        role: "user",
        content,
      },
      include: { user: true, agent: true },
    });

    const assignedAgents = project.agents.map((a) => a.agent);
    if (assignedAgents.length === 0) {
      return NextResponse.json({
        userMessage,
        agentMessages: [],
        error: "No agents assigned to this project",
      });
    }

    // ─────────────────────────────────────────────
    //  IDENTIFY RELEVANT AGENTS (1-3 based on content)
    // ─────────────────────────────────────────────
    const lowerContent = content.toLowerCase();

    // Keyword → team mapping
    const teamKeywords: { teams: string[]; keywords: string[] }[] = [
      {
        teams: ["DESIGN"],
        keywords: ["design", "ui", "ux", "color", "colour", "logo", "brand", "visual", "layout", "wireframe", "mockup", "figma", "interface"],
      },
      {
        teams: ["DEVELOPMENT"],
        keywords: ["code", "coding", "bug", "api", "database", "db", "deploy", "server", "frontend", "backend", "react", "nextjs", "next.js", "typescript", "javascript", "python", "node", "auth", "login"],
      },
      {
        teams: ["CONTENT"],
        keywords: ["write", "writing", "content", "copy", "copywriting", "blog", "article", "seo writing", "script", "tagline", "headline", "description"],
      },
      {
        teams: ["MARKETING"],
        keywords: ["market", "marketing", "ad", "ads", "advertising", "social", "social media", "campaign", "growth", "analytics", "seo", "sem", "facebook ads", "google ads", "instagram"],
      },
      {
        teams: ["QA"],
        keywords: ["test", "testing", "qa", "quality", "review", "security", "vulnerability", "performance", "audit", "bug fix", "lint", "debug"],
      },
      {
        teams: ["SUPPORT"],
        keywords: ["support", "help", "issue", "problem", "ticket", "question", "error", "not working", "broken", "can't", "cannot"],
      },
    ];

    // Find which teams are mentioned in the message
    const mentionedTeams = new Set<string>();
    for (const { teams, keywords } of teamKeywords) {
      if (keywords.some((k) => lowerContent.includes(k))) {
        teams.forEach((t) => mentionedTeams.add(t));
      }
    }

    // Pick relevant agents from assigned agents (max 3)
    let responders: TeamAgentInfo[] = [];

    if (mentionedTeams.size > 0) {
      // Get one agent from each mentioned team (max 3)
      for (const team of mentionedTeams) {
        const agent = assignedAgents.find((a) => a.team === team);
        if (agent && responders.length < 3) {
          responders.push({
            name: agent.name,
            role: agent.role,
            team: agent.team,
          });
        }
      }
    }

    // If no specific match, use lead agent (first assigned)
    if (responders.length === 0) {
      const lead = assignedAgents[0];
      responders = [
        { name: lead.name, role: lead.role, team: lead.team },
      ];
    }

    // Limit to 3 agents max for performance
    if (responders.length > 3) {
      responders = responders.slice(0, 3);
    }

    // ─────────────────────────────────────────────
    //  BUILD PROJECT CONTEXT
    // ─────────────────────────────────────────────
    const projectContext = `Project: ${project.title}
Type: ${project.projectType}
Description: ${project.description}
Status: ${project.status}
Assigned team: ${assignedAgents.map((a) => `${a.name} (${a.role})`).join(", ")}`;

    // ─────────────────────────────────────────────
    //  GET TEAM RESPONSES (parallel)
    // ─────────────────────────────────────────────
    const teamResults = await teamAgentResponse(
      responders,
      content,
      projectContext,
      projectId,
      session.user.id,
    );

    // ─────────────────────────────────────────────
    //  SAVE ALL AGENT MESSAGES
    // ─────────────────────────────────────────────
    const agentMessages = [];

    for (const result of teamResults) {
      // Find the agent record to get ID
      const agentRecord = assignedAgents.find(
        (a) => a.name === result.agentName,
      );

      if (!agentRecord) continue;

      try {
        const msg = await db.message.create({
          data: {
            projectId,
            agentId: agentRecord.id,
            role: "agent",
            content: result.content,
            meta: JSON.stringify({
              teamResponse: teamResults.length > 1,
              teamSize: teamResults.length,
              success: result.success,
              teammates: responders
                .filter((r) => r.name !== result.agentName)
                .map((r) => r.name),
            }),
          },
          include: { user: true, agent: true },
        });
        agentMessages.push(msg);
      } catch (e) {
        console.error("[chat] failed to save agent message:", e);
      }
    }

    // Log activity
    try {
      await db.activity.create({
        data: {
          projectId,
          userId: session.user.id,
          action: "TEAM_CHAT_MESSAGE",
          details:
            teamResults.length > 1
              ? `${teamResults.length} agents responded: ${teamResults.map((r) => r.agentName).join(", ")}`
              : `${teamResults[0]?.agentName} responded to client message`,
        },
      });
    } catch (e) {
      console.error("[chat] activity log failed:", e);
    }

    return NextResponse.json({
      userMessage,
      agentMessages,
      teamSize: teamResults.length,
      isTeamResponse: teamResults.length > 1,
    });
  } catch (e) {
    console.error("[chat] error:", e);
    return NextResponse.json(
      {
        error: "Failed to send message",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
