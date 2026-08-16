// Mianx.ai — Phase 4: Tool Registry API
//
// GET  /api/tools          — List tools (with filters)
// POST /api/tools          — Create tool (admin only)
// GET  /api/tools/[name]   — Get tool details
// PATCH /api/tools/[name]  — Update tool (admin only)
// DELETE /api/tools/[name] — Delete tool (admin only)

import { NextRequest, NextResponse } from "next/server";
import { listTools, getToolStats, createTool, TOOL_CATEGORY_CONFIG } from "@/lib/tool-registry";
import type { ToolCategory, RiskLevel } from "@/lib/mission-types";

// ─────────────────────────────────────────────
//  GET /api/tools — List tools
// ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Stats endpoint
    if (action === "stats") {
      const stats = await getToolStats();
      return NextResponse.json({ success: true, stats });
    }

    // List tools with filters
    const category = searchParams.get("category") as ToolCategory | null;
    const riskLevel = searchParams.get("riskLevel") as RiskLevel | null;
    const search = searchParams.get("search") || undefined;
    const agentName = searchParams.get("agent") || undefined;

    const tools = await listTools({
      category: category || undefined,
      riskLevel: riskLevel || undefined,
      search,
      agentName,
    });

    // Enrich with display config
    const enriched = tools.map((tool) => ({
      ...tool,
      categoryConfig: TOOL_CATEGORY_CONFIG[tool.category],
    }));

    return NextResponse.json({
      success: true,
      tools: enriched,
      total: enriched.length,
      filters: { category, riskLevel, search, agentName },
    });
  } catch (error) {
    console.error("[api/tools] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list tools" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/tools — Create tool (admin only)
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, displayName, description, category, handler } = body;
    if (!name || !displayName || !description || !category || !handler) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, displayName, description, category, handler" },
        { status: 400 },
      );
    }

    const tool = await createTool({
      name,
      displayName,
      description,
      category: category as ToolCategory,
      riskLevel: body.riskLevel || "MEDIUM",
      inputSchema: body.inputSchema || "{}",
      outputSchema: body.outputSchema,
      handler,
      timeoutMs: body.timeoutMs || 30000,
      retryable: body.retryable ?? true,
      maxRetries: body.maxRetries ?? 2,
      requireApproval: body.requireApproval ?? false,
      allowedAgents: body.allowedAgents || [],
      allowedPlans: body.allowedPlans || [],
      costPerCall: body.costPerCall ?? 0,
    });

    return NextResponse.json({ success: true, tool }, { status: 201 });
  } catch (error) {
    console.error("[api/tools] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to create tool";

    // Prisma unique constraint violation
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { success: false, error: `Tool "${error}" already exists` },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
