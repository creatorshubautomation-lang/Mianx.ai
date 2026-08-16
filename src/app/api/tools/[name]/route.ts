// Mianx.ai — Phase 4: Tool Detail API
//
// GET    /api/tools/[name]         — Get tool details
// PATCH  /api/tools/[name]         — Update tool (admin only)
// DELETE /api/tools/[name]         — Delete tool (admin only)
// POST   /api/tools/[name]/execute — Execute tool

import { NextRequest, NextResponse } from "next/server";
import { resolveTool, updateTool, deleteTool, TOOL_CATEGORY_CONFIG } from "@/lib/tool-registry";
import { executeTool } from "@/lib/tool-executor";

// ─────────────────────────────────────────────
//  GET /api/tools/[name] — Tool details
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const tool = await resolveTool(decodeURIComponent(name));

    if (!tool) {
      return NextResponse.json(
        { success: false, error: `Tool "${name}" not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      tool: {
        ...tool,
        categoryConfig: TOOL_CATEGORY_CONFIG[tool.category],
      },
    });
  } catch (error) {
    console.error("[api/tools/[name]] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get tool" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  PATCH /api/tools/[name] — Update tool
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const body = await request.json();

    const updated = await updateTool(decodeURIComponent(name), body);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: `Tool "${name}" not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      tool: {
        ...updated,
        categoryConfig: TOOL_CATEGORY_CONFIG[updated.category],
      },
    });
  } catch (error) {
    console.error("[api/tools/[name]] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update tool" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  DELETE /api/tools/[name] — Delete tool
// ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const deleted = await deleteTool(decodeURIComponent(name));

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `Tool "${name}" not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: `Tool "${name}" deleted` });
  } catch (error) {
    console.error("[api/tools/[name]] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete tool" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/tools/[name]/execute — Execute tool
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;
    const body = await request.json();

    const toolName = decodeURIComponent(name);

    // Check if this is an execute action
    if (body.action === "execute" || request.url.endsWith("/execute")) {
      const result = await executeTool({
        toolName,
        input: body.input || {},
        agentName: body.agentName,
        userPlan: body.userPlan,
        userId: body.userId,
        projectId: body.projectId,
        missionId: body.missionId,
        taskId: body.taskId,
        skipApproval: body.skipApproval,
      });

      const status = result.success ? 200 : result.approvalRequired ? 202 : 422;
      return NextResponse.json({ ...result }, { status });
    }

    // Default: just return tool info (backward compat)
    const tool = await resolveTool(toolName);
    if (!tool) {
      return NextResponse.json(
        { success: false, error: `Tool "${name}" not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      tool: { ...tool, categoryConfig: TOOL_CATEGORY_CONFIG[tool.category] },
    });
  } catch (error) {
    console.error("[api/tools/[name]] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to execute tool" },
      { status: 500 },
    );
  }
}
