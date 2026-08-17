import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  requirePermission,
} from "@/lib/authorization";
import { formatErrorResponse } from "@/lib/org-context";

// ─────────────────────────────────────────────
//  VALID SOURCE TYPES (matches EventSource enum)
// ─────────────────────────────────────────────

const VALID_SOURCE_TYPES = [
  "USER_ACTION",
  "AI_AGENT",
  "API",
  "INTEGRATION",
  "SCHEDULED_JOB",
  "WORKFLOW",
  "SYSTEM",
] as const;

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const PAYLOAD_MAX_DISPLAY_LENGTH = 1000;

function truncatePayload(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    const stringified = JSON.stringify(parsed);
    if (stringified.length <= PAYLOAD_MAX_DISPLAY_LENGTH) return stringified;
    return stringified.slice(0, PAYLOAD_MAX_DISPLAY_LENGTH) + "...\"[truncated]";
  } catch {
    if (payload.length <= PAYLOAD_MAX_DISPLAY_LENGTH) return payload;
    return payload.slice(0, PAYLOAD_MAX_DISPLAY_LENGTH) + "...[truncated]";
  }
}

// ─────────────────────────────────────────────
//  GET /api/organizations/[id]/events
//  Cursor-based pagination, heavily filtered
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
    await requirePermission(id, session.user.id, "core.org.audit.view");
  } catch (error) {
    return formatErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);

    // Cursor-based pagination
    const cursor = searchParams.get("cursor");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    // Filters
    const eventType = searchParams.get("eventType");
    const sourceType = searchParams.get("sourceType");
    const actorType = searchParams.get("actorType");
    const domainId = searchParams.get("domainId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: Record<string, unknown> = { organizationId: id };

    if (eventType) {
      where.eventType = eventType;
    }

    if (sourceType && VALID_SOURCE_TYPES.includes(sourceType as (typeof VALID_SOURCE_TYPES)[number])) {
      where.sourceType = sourceType;
    }

    if (actorType) {
      where.actorType = actorType;
    }

    if (domainId) {
      where.domainId = domainId;
    }

    // Date range filter on occurredAt
    if (startDate || endDate) {
      const occurredAt: Record<string, Date> = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          occurredAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          occurredAt.lte = end;
        }
      }
      if (Object.keys(occurredAt).length > 0) {
        where.occurredAt = occurredAt;
      }
    }

    // Cursor filter: events with occurredAt < cursor's occurredAt, or equal with id < cursor id
    let cursorFilter: Record<string, unknown> | undefined;
    if (cursor) {
      // Decode cursor to get the occurredAt timestamp and id
      try {
        const cursorData = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        const cursorDate = new Date(cursorData.o as string);
        const cursorId = cursorData.i as string;

        if (!isNaN(cursorDate.getTime())) {
          cursorFilter = {
            OR: [
              { occurredAt: { lt: cursorDate } },
              {
                occurredAt: cursorDate,
                id: { lt: cursorId },
              },
            ],
          };
        }
      } catch {
        // Invalid cursor, ignore and start from beginning
      }
    }

    const finalWhere: Record<string, unknown> = { ...where };
    if (cursorFilter) {
      finalWhere.AND = [cursorFilter];
    }

    const events = await db.event.findMany({
      where: finalWhere,
      orderBy: [
        { occurredAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1, // Fetch one extra to determine if there's a next page
      select: {
        id: true,
        eventType: true,
        eventVersion: true,
        sourceType: true,
        sourceId: true,
        actorType: true,
        actorId: true,
        domainId: true,
        correlationId: true,
        causationId: true,
        payload: true,
        occurredAt: true,
        createdAt: true,
      },
    });

    const hasMore = events.length > limit;
    const trimmedEvents = hasMore ? events.slice(0, limit) : events;

    // Build next cursor from the last event
    let nextCursor: string | null = null;
    if (hasMore && trimmedEvents.length > 0) {
      const lastEvent = trimmedEvents[trimmedEvents.length - 1];
      const cursorPayload = {
        o: lastEvent.occurredAt.toISOString(),
        i: lastEvent.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString("base64url");
    }

    return NextResponse.json({
      data: trimmedEvents.map((event) => ({
        ...event,
        payload: truncatePayload(event.payload),
      })),
      meta: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("[organizations/:id/events] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch events" } },
      { status: 500 },
    );
  }
}
