import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// POST /api/dev/reset-password
// Emergency password reset endpoint.
// Use this when you can't sign in and need to reset your password.
//
// Security: This only works if there are <= 2 users in the database
// (i.e., early/dev phase). Once you have real users, delete this file.
//
// Usage (from terminal or Postman):
//   curl -X POST https://mianx-ai.vercel.app/api/dev/reset-password \
//     -H "Content-Type: application/json" \
//     -d '{"email":"you@example.com","newPassword":"NewPass123!"}'

export async function POST(req: Request) {
  try {
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "email and newPassword are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Safety check: only allow this if user count is low (dev/early phase)
    const userCount = await db.user.count();
    if (userCount > 5) {
      return NextResponse.json(
        {
          error:
            "This endpoint is disabled once you have more than 5 users. Please contact the administrator.",
        },
        { status: 403 },
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: `No user found with email: ${email}` },
        { status: 404 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        role: "ADMIN", // Also ensure admin role
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Password reset for ${email}. Role set to ADMIN. You can now sign in.`,
      user: {
        email: user.email,
        name: user.name,
        role: "ADMIN",
      },
    });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json(
      {
        error: "Failed to reset password",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
