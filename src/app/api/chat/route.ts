import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamAgentResponse, type TeamAgentInfo } from "@/lib/ai-service";
import { rateLimit } from "@/lib/rate-limit";

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

  // Max 20 AI messages per user per minute — protects paid AI provider spend
  const limit = rateLimit(`chat:${session.user.id}`, 20, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Please slow down." },
      { status: 429 },
    );
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
    //  PRIORITY: @mentions first, then keywords, then default
    // ─────────────────────────────────────────────
    const lowerContent = content.toLowerCase();

    // STEP 1: Check for @mentions (e.g., "@Atlas", "@Aria", "@Zen")
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let mentionMatch;
    while ((mentionMatch = mentionRegex.exec(content)) !== null) {
      mentions.push(mentionMatch[1].toLowerCase());
    }

    let responders: TeamAgentInfo[] = [];

    // If user mentioned specific agents, route to THEM only
    if (mentions.length > 0) {
      for (const mention of mentions) {
        // Find agent by name (case-insensitive)
        const agent = assignedAgents.find(
          (a) => a.name.toLowerCase() === mention,
        );
        if (agent && responders.length < 3) {
          responders.push({
            name: agent.name,
            role: agent.role,
            team: agent.team,
          });
        }
      }
    }

    // STEP 2: If no @mentions found, use keyword-based team detection
    if (responders.length === 0) {
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
      if (mentionedTeams.size > 0) {
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

    // D2: Log agent activity for live feed
    try {
      const { logAgentActivity } = await import("@/lib/auto-execute");
      for (const result of teamResults) {
        if (result.success) {
          await logAgentActivity(projectId, {
            agentName: result.agentName,
            activity: "responded",
            description: `${result.agentName} responded to client message`,
            progress: 50,
          });
        }
      }
    } catch (e) {
      console.error("[chat] agent activity log failed:", e);
    }

    // D3: Extract memories from user message
    try {
      const { extractMemoriesFromMessage } = await import("@/lib/agent-memory");
      // Use first responder's agent ID for memory
      const firstResponder = assignedAgents.find(
        (a) => a.name === teamResults[0]?.agentName,
      );
      if (firstResponder) {
        await extractMemoriesFromMessage(
          projectId,
          firstResponder.id,
          content,
        );
      }
    } catch (e) {
      console.error("[chat] memory extraction failed:", e);
    }

    // D1: Auto-execute next task (trigger progress)
    try {
      const { autoExecuteNextTask } = await import("@/lib/auto-execute");
      await autoExecuteNextTask(projectId);
    } catch (e) {
      console.error("[chat] auto-execute failed:", e);
    }

    // D5: Create notification for agent response
    try {
      const project2 = await db.project.findUnique({
        where: { id: projectId },
        select: { title: true, clientId: true },
      });
      if (project2) {
        await db.notification.create({
          data: {
            userId: project2.clientId,
            projectId,
            type: "agent_response",
            title: `💬 ${teamResults[0]?.agentName || "Agent"} responded`,
            message: `New response on "${project2.title}"`,
            priority: "normal",
            actionUrl: `/projects/${projectId}`,
          },
        });
      }
    } catch (e) {
      console.error("[chat] notification failed:", e);
    }

    // Auto-update project progress (small increment for chat activity)
    try {
      const { updateProjectProgress } = await import("@/lib/project-progress");
      await updateProjectProgress(projectId);
    } catch (e) {
      console.error("[chat] progress update failed:", e);
    }

    // Send agent response email to client (best-effort)
    try {
      const { sendEmail, agentResponseEmail } = await import("@/lib/email");
      const user = await db.user.findUnique({
        where: { id: project.clientId },
        select: { name: true, email: true },
      });

      if (user?.email && teamResults.length > 0) {
        // Send email for first agent's response (avoid spam if multiple agents)
        const firstResponse = teamResults[0];
        const { subject, html } = agentResponseEmail(
          user.name || "there",
          project.title,
          firstResponse.agentName,
          firstResponse.agentRole,
          firstResponse.content,
        );
        await sendEmail({ to: user.email, subject, html });
      }
    } catch (emailErr) {
      console.error("[chat] email failed:", emailErr);
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
      },
      { status: 500 },
    );
  }
}
