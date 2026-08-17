import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessOrganization } from "@/lib/authorization";

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/billing/usage
//  Get usage metrics for the organization
//  Filter by meterKey, periodStart, periodEnd
//  Group by meterKey, aggregated with totals
//  Supports page, limit pagination
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const hasAccess = await canAccessOrganization(id, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You don't have an active membership in this organization" } },
        { status: 403 },
      );
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && "statusCode" in error && "message" in error) {
      const e = error as { code: string; statusCode: number; message: string };
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: e.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Authorization check failed" } },
      { status: 500 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    // Filters
    const meterKey = searchParams.get("meterKey");
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    // Build where clause
    const where: Record<string, unknown> = { organizationId: id };

    if (meterKey) {
      where.meterKey = meterKey;
    }

    // Date range filter on periodStart/periodEnd
    if (periodStart || periodEnd) {
      const periodStartFilter: Record<string, Date> = {};
      const periodEndFilter: Record<string, Date> = {};

      if (periodStart) {
        const startDate = new Date(periodStart);
        if (!isNaN(startDate.getTime())) {
          // Records whose period overlaps with the requested start
          periodEndFilter.gte = startDate;
        }
      }
      if (periodEnd) {
        const endDate = new Date(periodEnd);
        if (!isNaN(endDate.getTime())) {
          // Records whose period overlaps with the requested end
          periodStartFilter.lte = endDate;
        }
      }

      if (Object.keys(periodStartFilter).length > 0) {
        where.periodStart = periodStartFilter;
      }
      if (Object.keys(periodEndFilter).length > 0) {
        where.periodEnd = periodEndFilter;
      }
    }

    // Get unique meterKeys for pagination on grouped results
    const groupWhere: Record<string, unknown> = { ...where };

    // Get distinct meter keys
    const distinctMeters = await db.usageRecord.findMany({
      where: groupWhere,
      distinct: ["meterKey"],
      select: { meterKey: true },
      orderBy: { meterKey: "asc" },
    });

    const totalMeters = distinctMeters.length;
    const paginatedMeterKeys = distinctMeters
      .slice((page - 1) * limit, page * limit)
      .map((m) => m.meterKey);

    // Aggregate usage for the paginated meter keys
    const aggregatedUsage = await db.usageRecord.groupBy({
      by: ["meterKey", "unit"],
      where: {
        ...where,
        meterKey: { in: paginatedMeterKeys },
      },
      _sum: {
        quantity: true,
      },
      _count: {
        id: true,
      },
      _min: {
        periodStart: true,
      },
      _max: {
        periodEnd: true,
      },
      orderBy: {
        meterKey: "asc",
      },
    });

    // Also fetch the raw records for the current page's meters (for detail)
    const rawRecords = await db.usageRecord.findMany({
      where: {
        organizationId: id,
        meterKey: { in: paginatedMeterKeys },
        ...(periodStart || periodEnd
          ? {
              ...(periodStart
                ? { periodEnd: { gte: new Date(periodStart) } }
                : {}),
              ...(periodEnd
                ? { periodStart: { lte: new Date(periodEnd) } }
                : {}),
            }
          : {}),
      },
      orderBy: [{ meterKey: "asc" }, { periodStart: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        meterKey: true,
        quantity: true,
        unit: true,
        periodStart: true,
        periodEnd: true,
        metadata: true,
        createdAt: true,
      },
    });

    const data = {
      summary: aggregatedUsage.map((agg) => ({
        meterKey: agg.meterKey,
        totalQuantity: Number(agg._sum.quantity ?? 0),
        totalRecords: agg._count.id,
        unit: agg.unit,
        earliestPeriodStart: agg._min.periodStart,
        latestPeriodEnd: agg._max.periodEnd,
      })),
      records: rawRecords.map((r) => ({
        id: r.id,
        meterKey: r.meterKey,
        quantity: r.quantity,
        unit: r.unit,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        metadata: r.metadata ? JSON.parse(r.metadata) : {},
        createdAt: r.createdAt,
      })),
    };

    return NextResponse.json({
      data,
      meta: {
        totalMeters,
        totalRecords: rawRecords.length,
        page,
        limit,
        totalPages: Math.ceil(totalMeters / limit),
      },
    });
  } catch (error) {
    console.error("[billing/usage] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch usage metrics" } },
      { status: 500 },
    );
  }
}
