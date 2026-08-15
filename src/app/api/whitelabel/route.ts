import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  GET /api/whitelabel — fetch current user's white-label config
// ─────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await db.whiteLabelConfig.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        brandName: true,
        brandLogo: true,
        brandColor: true,
        accentColor: true,
        customDomain: true,
        isWhiteLabel: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return NextResponse.json(
        { error: "White-label config not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ config });
  } catch (e) {
    console.error("[whitelabel/get] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch white-label config" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
//  POST /api/whitelabel — create or update white-label config
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-verify role from DB (same pattern as /api/admin)
  let userRole = session.user.role;
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser) userRole = dbUser.role;
  } catch (e) {
    console.error("[whitelabel/post] DB role check error:", e);
  }

  try {
    const body = await req.json();

    // ── Explicit field whitelist (security ground rule) ──
    const ALLOWED_FIELDS = [
      "brandName",
      "brandLogo",
      "brandColor",
      "accentColor",
      "customDomain",
      "isWhiteLabel",
      "plan",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    // ── Validate: brandColor must be valid hex ──
    if (data.brandColor !== undefined && data.brandColor !== null) {
      if (typeof data.brandColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(data.brandColor)) {
        return NextResponse.json(
          { error: "brandColor must be a valid hex color (e.g. #a855f7)" },
          { status: 400 },
        );
      }
    }

    // ── Validate: accentColor must be valid hex ──
    if (data.accentColor !== undefined && data.accentColor !== null) {
      if (typeof data.accentColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(data.accentColor)) {
        return NextResponse.json(
          { error: "accentColor must be a valid hex color (e.g. #06b6d4)" },
          { status: 400 },
        );
      }
    }

    // ── Validate: brandName max 50 chars ──
    if (data.brandName !== undefined && data.brandName !== null) {
      if (typeof data.brandName !== "string" || data.brandName.length > 50 || data.brandName.length === 0) {
        return NextResponse.json(
          { error: "brandName must be a non-empty string under 50 characters" },
          { status: 400 },
        );
      }
    }

    // ── Validate: customDomain if provided ──
    if (data.customDomain !== undefined && data.customDomain !== null) {
      if (typeof data.customDomain !== "string" || data.customDomain.length > 200) {
        return NextResponse.json(
          { error: "customDomain must be a string under 200 characters" },
          { status: 400 },
        );
      }
    }

    // ── Validate: plan if provided ──
    if (data.plan !== undefined && data.plan !== null) {
      const validPlans = ["standard", "pro", "enterprise"];
      if (!validPlans.includes(data.plan as string)) {
        return NextResponse.json(
          { error: "plan must be one of: standard, pro, enterprise" },
          { status: 400 },
        );
      }
    }

    // ── Only ADMIN can enable isWhiteLabel ──
    if (data.isWhiteLabel === true && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Only ADMIN users can enable white-label mode" },
        { status: 403 },
      );
    }

    // ── Upsert: create if not exists, update if exists ──
    const config = await db.whiteLabelConfig.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        brandName: (data.brandName as string) ?? "Mianx.ai",
        brandLogo: (data.brandLogo as string) ?? null,
        brandColor: (data.brandColor as string) ?? "#a855f7",
        accentColor: (data.accentColor as string) ?? "#06b6d4",
        customDomain: (data.customDomain as string) ?? null,
        isWhiteLabel: (data.isWhiteLabel as boolean) ?? false,
        plan: (data.plan as string) ?? "standard",
      },
      update: data,
      select: {
        id: true,
        brandName: true,
        brandLogo: true,
        brandColor: true,
        accentColor: true,
        customDomain: true,
        isWhiteLabel: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ config });
  } catch (e) {
    console.error("[whitelabel/post] error:", e);
    return NextResponse.json(
      { error: "Failed to save white-label config" },
      { status: 500 },
    );
  }
}
