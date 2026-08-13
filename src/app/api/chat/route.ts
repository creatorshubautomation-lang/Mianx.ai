import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoAgentResponse, findAgent } from "@/lib/ai-service";

// GET /api/chat?projectId=xxx — list messages for a project
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}

// POST /api/chat — send a message and get agent response
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

    // Determine which agent responds.
    // Find the most relevant agent based on message content & assigned agents.
    const assignedAgents = project.agents.map((a) => a.agent);
    if (assignedAgents.length === 0) {
      return NextResponse.json({
        userMessage,
        agentMessage: null,
        error: "No agents assigned to this project",
      });
    }

    // Simple heuristic: find the agent whose role/capabilities best match the message.
    // If no clear match, use the first assigned agent (lead).
    const lowerContent = content.toLowerCase();
    let responder = assignedAgents[0];

    const keywordMap: { keywords: string[]; teams: string[] }[] = [
      { keywords: ["design", "ui", "ux", "color", "logo", "brand", "visual"], teams: ["DESIGN"] },
      { keywords: ["code", "bug", "api", "database", "deploy", "server", "frontend", "backend"], teams: ["DEVELOPMENT"] },
      { keywords: ["write", "content", "copy", "blog", "article", "seo", "script"], teams: ["CONTENT"] },
      { keywords: ["market", "ad", "social", "campaign", "growth", "analytics"], teams: ["MARKETING"] },
      { keywords: ["test", "qa", "review", "security", "performance", "audit"], teams: ["QA"] },
      { keywords: ["support", "help", "issue", "problem", "ticket", "question"], teams: ["SUPPORT"] },
    ];

    for (const { keywords, teams } of keywordMap) {
      if (keywords.some((k) => lowerContent.includes(k))) {
        const match = assignedAgents.find((a) => teams.includes(a.team));
        if (match) {
          responder = match;
          break;
        }
      }
    }

    // Build project context
    const projectContext = `Project: ${project.title}
Type: ${project.projectType}
Description: ${project.description}
Status: ${project.status}
Assigned agents: ${assignedAgents.map((a) => `${a.name} (${a.role})`).join(", ")}`;

    // Get real AI response from the agent
    let agentContent: string;
    try {
      agentContent = await autoAgentResponse(
        responder.name,
        content,
        projectContext,
      );
    } catch (err) {
      console.error("[chat] AI error:", err);
      agentContent = `I'm ${responder.name}, your ${responder.role}. I received your message but encountered an issue generating a response. Please try again in a moment.`;
    }

    // Save agent message
    const agentMessage = await db.message.create({
      data: {
        projectId,
        agentId: responder.id,
        role: "agent",
        content: agentContent,
      },
      include: { user: true, agent: true },
    });

    // Log activity
    await db.activity.create({
      data: {
        projectId,
        userId: session.user.id,
        action: "CHAT_MESSAGE",
        details: `${responder.name} responded to client message`,
      },
    });

    return NextResponse.json({ userMessage, agentMessage, responder });
  } catch (e) {
    console.error("[chat] error:", e);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
