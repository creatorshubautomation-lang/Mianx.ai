import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// POST /api/dev/debug-auth
// Diagnostic endpoint to figure out why login is failing.
// Returns detailed info about what's happening during auth.
//
// Usage (from browser console):
//   fetch('/api/dev/debug-auth', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ email: 'you@example.com', password: 'yourpass' })
//   }).then(r => r.json()).then(console.log)

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 },
      );
    }

    const diagnosis: {
      step: string;
      status: "ok" | "fail" | "warn";
      details: string;
    }[] = [];

    // Step 1: Check if user exists
    let user;
    try {
      user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        // Try case-insensitive search
        const userCI = await db.user.findFirst({
          where: { email: { contains: email, mode: "insensitive" } },
          select: { id: true, email: true, name: true, role: true },
        });

        diagnosis.push({
          step: "1. Find user by email",
          status: "fail",
          details: userCI
            ? `No exact match, but found similar: ${userCI.email}. Email is case-sensitive!`
            : `No user found with email: ${email}`,
        });

        return NextResponse.json({ diagnosis });
      }

      diagnosis.push({
        step: "1. Find user by email",
        status: "ok",
        details: `Found: ${user.email} (role: ${user.role})`,
      });
    } catch (e) {
      diagnosis.push({
        step: "1. Find user by email",
        status: "fail",
        details: `DB error: ${e instanceof Error ? e.message : String(e)}`,
      });
      return NextResponse.json({ diagnosis });
    }

    // Step 2: Check password hash format
    const hash = user.passwordHash;
    if (!hash || !hash.startsWith("$2b$") && !hash.startsWith("$2a$") && !hash.startsWith("$2y$")) {
      diagnosis.push({
        step: "2. Password hash format",
        status: "fail",
        details: `Hash is not a valid bcrypt format. Got: ${hash?.slice(0, 20) || "(empty)"}...`,
      });
      return NextResponse.json({ diagnosis });
    }

    diagnosis.push({
      step: "2. Password hash format",
      status: "ok",
      details: `Valid bcrypt hash: ${hash.slice(0, 10)}... (length: ${hash.length})`,
    });

    // Step 3: Test bcrypt comparison
    try {
      const passwordValid = await bcrypt.compare(password, hash);
      if (passwordValid) {
        diagnosis.push({
          step: "3. Password comparison",
          status: "ok",
          details: "Password is CORRECT! Login should work.",
        });
      } else {
        diagnosis.push({
          step: "3. Password comparison",
          status: "fail",
          details: `Password does NOT match hash. The password you entered is different from what was used during signup. Hash was created at: ${user.createdAt}`,
        });
      }
    } catch (e) {
      diagnosis.push({
        step: "3. Password comparison",
        status: "fail",
        details: `bcrypt error: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // Step 4: Suggest fix
    diagnosis.push({
      step: "4. Recommendation",
      status: "warn",
      details:
        "If password doesn't match, use /api/dev/reset-password to set a new password. The hash in DB might be from a different password than you remember (e.g., from an earlier failed signup attempt).",
    });

    return NextResponse.json({
      email: user.email,
      role: user.role,
      userCreatedAt: user.createdAt,
      userUpdatedAt: user.updatedAt,
      hashPreview: hash.slice(0, 20) + "...",
      diagnosis,
    });
  } catch (e) {
    console.error("[debug-auth] error:", e);
    return NextResponse.json(
      {
        error: "Debug failed",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
