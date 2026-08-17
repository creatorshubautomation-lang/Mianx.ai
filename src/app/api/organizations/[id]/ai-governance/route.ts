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
//  GET /api/organizations/[id]/ai-governance
//  Returns AI governance overview for the organization
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
    await requirePermission(orgId, session.user.id, "core.agent.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    // ── Agent count by status ──
    const agentStatusCounts = await db.orgAgent.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    const agentsByStatus = agentStatusCounts.reduce(
      (acc, row) => {
        acc[row.status] = row._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalAgentCount = Object.values(agentsByStatus).reduce((sum, v) => sum + v, 0);

    // ── Autonomy level distribution ──
    const autonomyDistribution = await db.orgAgent.groupBy({
      by: ["autonomyLevel"],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    const autonomyLevels = autonomyDistribution.map((row) => ({
      level: row.autonomyLevel,
      count: row._count.id,
    }));

    // ── Policy denials from AuditLog (actions like "ai.policy.deny", "ai.policy.block") ──
    const policyDenialWhere: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
      action: { startsWith: "ai.policy." },
    };

    const [policyDenialCount, recentDenials] = await Promise.all([
      db.auditLog.count({ where: policyDenialWhere }),
      db.auditLog.findMany({
        where: policyDenialWhere,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          actorType: true,
          actorId: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    // ── Recent approvals (actions like "agent.create", "agent.update" for status changes to ACTIVE) ──
    const recentApprovals = await db.auditLog.findMany({
      where: {
        organizationId: orgId,
        action: {
          in: [
            "agent.create",
            "agent.update",
            "agent.run.started",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        actorType: true,
        actorId: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
      },
    });

    // ── Agent domain distribution ──
    const domainDistribution = await db.orgAgent.groupBy({
      by: ["domainId"],
      where: {
        organizationId: orgId,
        domainId: { not: null },
      },
      _count: { id: true },
    });

    const domainMap: Record<string, number> = {};
    for (const row of domainDistribution) {
      if (row.domainId) {
        domainMap[row.domainId] = row._count.id;
      }
    }

    // ── Agents at high autonomy (L4 or L5) ──
    const highAutonomyAgents = await db.orgAgent.count({
      where: {
        organizationId: orgId,
        autonomyLevel: { in: ["L4_EXECUTE_APPROVED", "L5_AUTONOMOUS_WITHIN_POLICY"] },
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      data: {
        agents: {
          total: totalAgentCount,
          byStatus: agentsByStatus,
          autonomyLevels,
          highAutonomyActive: highAutonomyAgents,
        },
        domains: domainMap,
        policy: {
          denials: policyDenialCount,
          recentDenials,
        },
        recentApprovals,
      },
      meta: {
        total: totalAgentCount + policyDenialCount,
      },
    });
  } catch (error) {
    console.error("[organizations/:id/ai-governance] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch AI governance overview" } },
      { status: 500 },
    );
  }
}
