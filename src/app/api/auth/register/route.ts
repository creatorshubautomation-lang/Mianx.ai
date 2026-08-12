import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password, name, company } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // First user becomes admin
    const userCount = await db.user.count();
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

    return NextResponse.json({ user, ok: true });
  } catch (e) {
    console.error("[register] error:", e);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
