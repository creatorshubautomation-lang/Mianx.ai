import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — check if app + database are properly connected
// Use this to verify deployment is working before trying to sign up.
export async function GET() {
  const checks: {
    name: string;
    status: "ok" | "fail" | "warn" | "pending";
    details?: string;
  }[] = [];

  // 1. Check environment variables
  const dbUrl = process.env.DATABASE_URL;
  const hasDbUrl = !!dbUrl;
  const dbUrlMasked = dbUrl
    ? dbUrl.replace(/:[^:@]+@/, ":***@")
    : "(not set)";

  checks.push({
    name: "DATABASE_URL env var",
    status: hasDbUrl ? "ok" : "fail",
    details: hasDbUrl ? dbUrlMasked : "Not set in environment",
  });

  checks.push({
    name: "NEXTAUTH_SECRET env var",
    status: process.env.NEXTAUTH_SECRET ? "ok" : "warn",
    details: process.env.NEXTAUTH_SECRET
      ? "set"
      : "not set (using fallback — works but should be set in production)",
  });

  // 2. Test database connection
  if (hasDbUrl) {
    try {
      // Try a simple query
      const userCount = await db.user.count();
      const agentCount = await db.agent.count();

      checks.push({
        name: "Database connection",
        status: "ok",
        details: `Connected. Users: ${userCount}, Agents: ${agentCount}`,
      });

      // 3. Check if tables exist
      if (agentCount === 0) {
        checks.push({
          name: "Agent seed data",
          status: "fail",
          details:
            "Agent table is empty. Run supabase-setup.sql to insert 24 agents.",
        });
      } else {
        checks.push({
          name: "Agent seed data",
          status: "ok",
          details: `${agentCount} agents found`,
        });
      }

      // 4. Check if any user is admin
      const adminCount = await db.user.count({
        where: { role: "ADMIN" },
      });
      checks.push({
        name: "Admin user",
        status: adminCount > 0 ? "ok" : "pending",
        details:
          adminCount > 0
            ? `${adminCount} admin(s) exist`
            : "No admin yet — first signup will become admin",
      });
    } catch (err) {
      checks.push({
        name: "Database connection",
        status: "fail",
        details:
          err instanceof Error
            ? err.message
            : "Unknown database error",
      });
    }
  }

  const allOk = checks.every((c) => c.status === "ok" || c.status === "pending");
  const criticalFail = checks.some(
    (c) => c.status === "fail" && (c.name === "DATABASE_URL env var" || c.name === "Database connection"),
  );

  return NextResponse.json(
    {
      status: criticalFail ? "fail" : allOk ? "ok" : "partial",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercelUrl: process.env.VERCEL_URL || null,
      checks,
      nextSteps: criticalFail
        ? "Fix DATABASE_URL in Vercel → Settings → Environment Variables. Use Supabase connection pooler URL (port 6543) with password."
        : allOk
          ? "All good! Visit /api/auth/register to create your first admin account."
          : "Some issues found — review checks above.",
    },
    { status: criticalFail ? 503 : 200 },
  );
}
