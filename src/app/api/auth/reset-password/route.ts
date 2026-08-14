import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// POST /api/auth/reset-password
// Resets password using a valid token
//
// Body: { token: string, newPassword: string }
// Returns: { ok: true } on success

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Find valid, unused, non-expired token
    const resetRecord = await db.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid reset token" },
        { status: 400 },
      );
    }

    // Check if already used
    if (resetRecord.usedAt) {
      return NextResponse.json(
        { error: "This reset link has already been used. Please request a new one." },
        { status: 400 },
      );
    }

    // Check if expired
    if (resetRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 },
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user's password
    await db.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await db.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    // Invalidate all other reset tokens for this user (security)
    await db.passwordReset.updateMany({
      where: {
        userId: resetRecord.userId,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    console.log(
      `[reset-password] password reset successfully for user ${resetRecord.userId}`,
    );

    return NextResponse.json({
      ok: true,
      message: "Password reset successful! You can now sign in with your new password.",
    });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json(
      {
        error: "Failed to reset password",
      },
      { status: 500 },
    );
  }
}

// GET /api/auth/reset-password?token=xxx
// Validates if a token is still valid (for the reset form)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 },
      );
    }

    const resetRecord = await db.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return NextResponse.json({ valid: false, error: "Invalid token" });
    }

    if (resetRecord.usedAt) {
      return NextResponse.json({ valid: false, error: "Token already used" });
    }

    if (resetRecord.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: "Token expired" });
    }

    return NextResponse.json({ valid: true });
  } catch (e) {
    console.error("[reset-password/validate] error:", e);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 },
    );
  }
}
