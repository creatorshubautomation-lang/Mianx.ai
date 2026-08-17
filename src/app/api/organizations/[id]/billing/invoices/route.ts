import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/billing/invoices
//  List invoices — placeholder returning empty array
//  (Full Stripe invoicing not wired yet)
//  Requires core.billing.manage
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    await requirePermission(id, session.user.id, "core.org.billing.manage");
  } catch (error) {
    return formatErrorResponse(error);
  }

  // Placeholder: Return empty array with the correct data structure
  // for UI development. Real Stripe invoicing integration will populate this.
  return NextResponse.json({
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      note: "Stripe invoicing integration is not yet connected. Invoice data will appear here once billing is configured.",
    },
  });
}
