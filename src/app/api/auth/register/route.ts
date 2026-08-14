import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Max 10 signup attempts per IP per 15 minutes
  const ip = getClientIp(req);
  const limit = rateLimit(`register:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
      { status: 429 },
    );
  }

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
      // Log full details server-side only — never expose connection strings,
      // project refs, or raw driver errors to the client.
      console.error("[register] DB connection failed:", dbError);
      return NextResponse.json(
        {
          error:
            "We're having trouble connecting right now. Please try again in a moment.",
          code: "DB_CONNECTION_FAILED",
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

    // Trigger webhook (user.signup)
    try {
      const { triggerWebhooks } = await import("@/lib/webhooks");
      await triggerWebhooks(
        "user.signup",
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        user.id,
      );
    } catch (e) {
      console.error("[register] webhook failed:", e);
    }

    return NextResponse.json({ user, ok: true });
  } catch (e) {
    console.error("[register] unexpected error:", e);
    return NextResponse.json(
      {
        error: "Failed to create account. Please try again.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
