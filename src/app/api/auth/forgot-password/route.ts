import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Store only a hash of the reset token in the DB. The raw token is what
// gets emailed to the user and appears in the reset URL — if the database
// were ever compromised, the leaked hashes alone can't be used as working
// reset links.
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// POST /api/auth/forgot-password
// Sends a password reset email if the user exists
//
// Body: { email: string }
// Returns: { ok: true } (always — don't reveal if email exists or not)

export async function POST(req: Request) {
  // Max 5 reset requests per IP per 15 minutes
  const ip = getClientIp(req);
  const limit = await rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    // Always return success (don't reveal if email exists)
    const genericResponse = NextResponse.json({
      ok: true,
      message:
        "If an account with that email exists, we've sent a password reset link.",
    });

    // Find user
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal that email doesn't exist
      return genericResponse;
    }

    // Generate secure random token
    const token = randomBytes(32).toString("hex");

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Save only the HASH to DB — the raw token never touches storage.
    // Also invalidate any older unused tokens for this user so only the
    // newest reset link is valid.
    await db.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await db.passwordReset.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt,
      },
    });

    // Build reset URL
    const origin =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const resetUrl = `${origin}/?reset_token=${token}`;

    // Send email
    const { subject, html } = passwordResetEmail(user.name || "there", resetUrl);
    const result = await sendEmail({
      to: user.email,
      subject,
      html,
    });

    if (!result.success) {
      console.error("[forgot-password] email send failed:", result.error);
      // Still return success (don't reveal email exists)
    }

    console.log(`[forgot-password] reset email sent to ${user.email}`);

    return genericResponse;
  } catch (e) {
    console.error("[forgot-password] error:", e);
    // Still return success to not reveal anything
    return NextResponse.json({
      ok: true,
      message:
        "If an account with that email exists, we've sent a password reset link.",
    });
  }
}
