import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthSecret } from "@/lib/auth-secret";

// Defense-in-depth: block unauthenticated / non-admin access to /api/admin/*
// at the edge, in addition to the per-route checks already in each handler.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: getAuthSecret() });

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (token.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin role required" },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
