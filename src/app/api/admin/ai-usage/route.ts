import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/ai-usage — AI provider usage stats for admin dashboard
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-verify role from DB
  let userRole = session.user.role;
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser) userRole = dbUser.role;
  } catch (e) {
    console.error("[ai-usage] DB role check error:", e);
  }

  if (userRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin role required" },
      { status: 403 },
    );
  }

  try {
    // Default provider list (used if config table is empty)
    const DEFAULT_PROVIDERS = [
      {
        name: "zai",
        displayName: "Z.ai (GLM)",
        envKeyName: "ZAI_API_KEY",
        freeLimitUsd: 18,
      },
      {
        name: "gemini",
        displayName: "Google Gemini",
        envKeyName: "GEMINI_API_KEY",
        freeLimitUsd: 50,
      },
      {
        name: "groq",
        displayName: "Groq (Fast)",
        envKeyName: "GROQ_API_KEY",
        freeLimitUsd: 20,
      },
      {
        name: "openai",
        displayName: "OpenAI (GPT)",
        envKeyName: "OPENAI_API_KEY",
        freeLimitUsd: 5,
      },
      {
        name: "anthropic",
        displayName: "Anthropic (Claude)",
        envKeyName: "ANTHROPIC_API_KEY",
        freeLimitUsd: 5,
      },
    ];

    // Get config for each provider (or use defaults)
    const providers = await Promise.all(
      DEFAULT_PROVIDERS.map(async (p) => {
        let config = null;
        try {
          config = await db.aiProviderConfig.findUnique({
            where: { provider: p.name },
          });
        } catch {
          // ignore
        }

        const apiKeySet = !!process.env[p.envKeyName];

        // Get usage stats for this provider
        let stats = {
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
          totalTokens: 0,
          totalCostUsd: 0,
        };

        try {
          const usageRecords = await db.aiProviderUsage.groupBy({
            by: ["status"],
            where: { provider: p.name },
            _count: true,
            _sum: {
              totalTokens: true,
              costUsd: true,
            },
          });

          for (const r of usageRecords) {
            stats.totalCalls += r._count;
            if (r.status === "success") stats.successCalls += r._count;
            else stats.failedCalls += r._count;
            stats.totalTokens += r._sum.totalTokens || 0;
            stats.totalCostUsd += r._sum.costUsd || 0;
          }
        } catch {
          // ignore
        }

        const usedUsd = config?.usedUsd || stats.totalCostUsd;
        const freeLimitUsd = config?.freeLimitUsd || p.freeLimitUsd;
        const remainingUsd = Math.max(0, freeLimitUsd - usedUsd);
        const percentUsed =
          freeLimitUsd > 0 ? (usedUsd / freeLimitUsd) * 100 : 0;

        return {
          name: p.name,
          displayName: p.displayName,
          envKeyName: p.envKeyName,
          apiKeySet,
          enabled: config?.enabled ?? true,
          priority: config?.priority ?? DEFAULT_PROVIDERS.indexOf(p) + 1,
          usedUsd: Number(usedUsd.toFixed(4)),
          freeLimitUsd,
          remainingUsd: Number(remainingUsd.toFixed(4)),
          percentUsed: Number(percentUsed.toFixed(1)),
          quotaExceeded: usedUsd >= freeLimitUsd,
          stats,
        };
      }),
    );

    // Get recent usage logs (last 50)
    let recentLogs: unknown[] = [];
    try {
      recentLogs = await db.aiProviderUsage.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          endpoint: true,
          agentName: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costUsd: true,
          status: true,
          errorMessage: true,
          responseTimeMs: true,
          createdAt: true,
        },
      });
    } catch {
      // ignore
    }

    // Summary stats
    const totalUsedUsd = providers.reduce((sum, p) => sum + p.usedUsd, 0);
    const totalFreeUsd = providers.reduce(
      (sum, p) => sum + p.freeLimitUsd,
      0,
    );
    const totalRemainingUsd = providers.reduce(
      (sum, p) => sum + p.remainingUsd,
      0,
    );
    const totalCalls = providers.reduce(
      (sum, p) => sum + p.stats.totalCalls,
      0,
    );
    const activeProviders = providers.filter((p) => p.apiKeySet).length;

    return NextResponse.json({
      providers,
      recentLogs,
      summary: {
        totalProviders: providers.length,
        activeProviders,
        totalUsedUsd: Number(totalUsedUsd.toFixed(4)),
        totalFreeUsd: Number(totalFreeUsd.toFixed(4)),
        totalRemainingUsd: Number(totalRemainingUsd.toFixed(4)),
        totalCalls,
      },
    });
  } catch (e) {
    console.error("[ai-usage] error:", e);
    return NextResponse.json(
      {
        error: "Failed to fetch AI usage stats",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
