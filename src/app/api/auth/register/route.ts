import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, company } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        {
          error: "Email, password, and name are required",
          code: "MISSING_FIELDS",
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error: "Password must be at least 6 characters",
          code: "WEAK_PASSWORD",
        },
        { status: 400 },
      );
    }

    // Test DB connection first — give a clear error if DATABASE_URL is wrong
    let userCount: number;
    try {
      userCount = await db.user.count();
    } catch (dbError) {
      console.error("[register] DB connection failed:", dbError);
      return NextResponse.json(
        {
          error:
            "Database connection failed. Please check that DATABASE_URL is set correctly in Vercel environment variables. " +
            "For Supabase, use the connection pooler URL (port 6543) with your password, " +
            "e.g. postgresql://postgres.sneshfeidnitwabmafsh:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres",
          code: "DB_CONNECTION_FAILED",
          details:
            dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 503 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          error: "An account with this email already exists",
          code: "EMAIL_EXISTS",
        },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // First user becomes admin
    const role = userCount === 0 ? "ADMIN" : "CLIENT";

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        company: company || null,
        role,
        plan: "FREE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    console.log(`[register] User created: ${user.email} (${user.role})`);

    // Send welcome email (best-effort — doesn't block signup)
    try {
      const { sendEmail, welcomeEmail } = await import("@/lib/email");
      const { subject, html } = welcomeEmail(name);
      await sendEmail({ to: email, subject, html });
      console.log(`[register] Welcome email sent to ${email}`);
    } catch (emailErr) {
      console.error("[register] Welcome email failed:", emailErr);
      // Don't fail signup if email fails
    }

    return NextResponse.json({ user, ok: true });
  } catch (e) {
    console.error("[register] unexpected error:", e);
    return NextResponse.json(
      {
        error: "Failed to create account",
        code: "INTERNAL_ERROR",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
