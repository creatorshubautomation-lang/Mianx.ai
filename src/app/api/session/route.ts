import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/session — current user info
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ user: null });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      avatarUrl: true,
      preferredLang: true,
      plan: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}

// PATCH /api/session — update profile
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updates = await req.json();
    const allowed = ["name", "company", "phone", "avatarUrl", "preferredLang"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key];
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        company: true,
        phone: true,
        avatarUrl: true,
        preferredLang: true,
        plan: true,
      },
    });

    return NextResponse.json({ user, ok: true });
  } catch (e) {
    console.error("[session/update] error:", e);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
