import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

const VALID_GROUP_BY = ["day", "week", "month", "agent", "provider"] as const;

/**
 * Truncate a date to the start of its grouping period.
 */
function truncateToDate(date: Date, groupBy: string): Date {
  const d = new Date(date);
  switch (groupBy) {
    case "day":
      d.setHours(0, 0, 0, 0);
      return d;
    case "week": {
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - dayOfWeek);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    default:
      d.setHours(0, 0, 0, 0);
      return d;
  }
}

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/ai-usage
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(orgId, session.user.id, "core.ai.usage.view");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = parseDate(searchParams.get("startDate"));
    const endDate = parseDate(searchParams.get("endDate"));
    const groupBy = searchParams.get("groupBy") || "day";

    if (!VALID_GROUP_BY.includes(groupBy as typeof VALID_GROUP_BY[number])) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid groupBy. Must be one of: ${VALID_GROUP_BY.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    // Build base date filter
    const dateFilter: Prisma.AiProviderUsageWhereInput["createdAt"] = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const usageDateFilter: Prisma.UsageRecordWhereInput["createdAt"] = {};
    if (startDate) usageDateFilter.gte = startDate;
    if (endDate) usageDateFilter.lte = endDate;

    // Get project IDs belonging to this org for AiProviderUsage filtering
    const orgProjects = await db.project.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const projectIds = orgProjects.map((p) => p.id);

    // ── AiProviderUsage aggregation ──
    const providerWhere: Prisma.AiProviderUsageWhereInput = {
      ...(projectIds.length > 0 ? { projectId: { in: projectIds } } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const [usageTotals, usageByProvider, usageByAgent] = await Promise.all([
      // Total tokens and cost from AiProviderUsage
      db.aiProviderUsage.aggregate({
        where: providerWhere,
        _sum: {
          totalTokens: true,
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: true,
      }),

      // Grouped by provider
      db.aiProviderUsage.groupBy({
        by: ["provider"],
        where: providerWhere,
        _sum: {
          totalTokens: true,
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: true,
        orderBy: { _sum: { costUsd: "desc" } },
      }),

      // Grouped by agent name
      db.aiProviderUsage.groupBy({
        by: ["agentName"],
        where: providerWhere,
        _sum: {
          totalTokens: true,
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: true,
        orderBy: { _sum: { costUsd: "desc" } },
      }),
    ]);

    // ── UsageRecord aggregation (ai.* meter keys) ──
    const usageRecordWhere: Prisma.UsageRecordWhereInput = {
      organizationId: orgId,
      meterKey: { startsWith: "ai." },
      ...(Object.keys(usageDateFilter).length > 0 ? { createdAt: usageDateFilter } : {}),
    };

    const usageRecordAgg = await db.usageRecord.aggregate({
      where: usageRecordWhere,
      _sum: { quantity: true },
      _count: true,
    });

    // ── Timeline data (AiProviderUsage grouped by date) ──
    let timeline: Array<{
      period: string;
      totalTokens: number;
      totalCost: number;
      requestCount: number;
    }> = [];

    if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
      const rawTimeline = await db.aiProviderUsage.findMany({
        where: providerWhere,
        select: {
          totalTokens: true,
          costUsd: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by truncated date
      const grouped = new Map<string, { totalTokens: number; totalCost: number; requestCount: number }>();

      for (const row of rawTimeline) {
        const truncated = truncateToDate(row.createdAt, groupBy);
        const key = truncated.toISOString().split("T")[0];
        const existing = grouped.get(key) || { totalTokens: 0, totalCost: 0, requestCount: 0 };
        existing.totalTokens += row.totalTokens;
        existing.totalCost += row.costUsd;
        existing.requestCount += 1;
        grouped.set(key, existing);
      }

      timeline = Array.from(grouped.entries()).map(([period, agg]) => ({
        period,
        totalTokens: agg.totalTokens,
        totalCost: Math.round(agg.totalCost * 1000) / 1000,
        requestCount: agg.requestCount,
      }));
    }

    return NextResponse.json({
      data: {
        totalTokens: usageTotals._sum.totalTokens ?? 0,
        totalCost: Math.round((usageTotals._sum.costUsd ?? 0) * 1000) / 1000,
        totalRequests: usageTotals._count,
        inputTokens: usageTotals._sum.inputTokens ?? 0,
        outputTokens: usageTotals._sum.outputTokens ?? 0,
        usageRecordQuantity: usageRecordAgg._sum.quantity ?? 0,
        usageRecordCount: usageRecordAgg._count,
        byProvider: usageByProvider.map((row) => ({
          provider: row.provider,
          totalTokens: row._sum.totalTokens ?? 0,
          totalCost: Math.round((row._sum.costUsd ?? 0) * 1000) / 1000,
          inputTokens: row._sum.inputTokens ?? 0,
          outputTokens: row._sum.outputTokens ?? 0,
          requestCount: row._count,
        })),
        byAgent: usageByAgent.map((row) => ({
          agentName: row.agentName ?? "unknown",
          totalTokens: row._sum.totalTokens ?? 0,
          totalCost: Math.round((row._sum.costUsd ?? 0) * 1000) / 1000,
          inputTokens: row._sum.inputTokens ?? 0,
          outputTokens: row._sum.outputTokens ?? 0,
          requestCount: row._count,
        })),
        timeline,
      },
      meta: {
        groupBy,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
        total: usageByProvider.length + usageByAgent.length,
      },
    });
  } catch (error) {
    console.error("[organizations/:id/ai-usage] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch AI usage statistics" } },
      { status: 500 },
    );
  }
}
