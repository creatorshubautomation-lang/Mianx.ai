import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/notifications/stream
// Returns an SSE stream that pushes new notifications to the client.
// Requires authentication.
//
// Protocol:
// - Client connects via EventSource("/api/notifications/stream")
// - On connect: server sends any unread notifications as an initial batch
// - Server polls DB every 2 seconds for new unread notifications
// - event: notification  → { id, type, title, message, priority, createdAt }
// - event: heartbeat    → { ts } every 30 seconds
// - event: ping         → {} every 15 seconds (keepalive)
// - On client disconnect (abort signal), polling is cleaned up

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  // Track the timestamp of the last notification we sent so we only
  // send genuinely new ones on each poll cycle.
  let lastCheckedAt = new Date();

  // We need a writer to push SSE frames into the stream.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Helper to push an SSE event into the stream.
  function sendSSE(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(payload)).catch(() => {
      // Client already disconnected — writer is closed.
    });
  }

  // ─── Initial batch: send all current unread notifications ─────────
  (async () => {
    try {
      const unread = await db.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      if (unread.length > 0) {
        // Send as a single "notification" event with an array so the
        // client can distinguish the initial batch from individual pushes.
        sendSSE(
          "notification",
          unread.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            priority: n.priority,
            actionUrl: n.actionUrl,
            createdAt: n.createdAt.toISOString(),
            isRead: n.isRead,
          })),
        );
      }

      // Update lastCheckedAt to now so we don't re-send these.
      lastCheckedAt = new Date();
    } catch (err) {
      console.error("[sse/notifications] initial batch error:", err);
    }
  })();

  // ─── Poll DB every 2 seconds for new notifications ────────────────
  const pollInterval = setInterval(async () => {
    try {
      const newNotifs = await db.notification.findMany({
        where: {
          userId,
          isRead: false,
          createdAt: { gt: lastCheckedAt },
        },
        orderBy: { createdAt: "asc" },
      });

      if (newNotifs.length > 0) {
        for (const n of newNotifs) {
          sendSSE("notification", {
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            priority: n.priority,
            actionUrl: n.actionUrl,
            createdAt: n.createdAt.toISOString(),
            isRead: n.isRead,
          });
        }
        // Move the cursor forward to the latest notification's timestamp.
        lastCheckedAt = newNotifs[newNotifs.length - 1].createdAt;
      }
    } catch (err) {
      // DB query can fail if the connection drops; just skip this cycle.
      console.error("[sse/notifications] poll error:", err);
    }
  }, 2000);

  // ─── Heartbeat every 30 seconds (connection health check) ─────────
  const heartbeatInterval = setInterval(() => {
    sendSSE("heartbeat", { ts: Date.now() });
  }, 30_000);

  // ─── Ping every 15 seconds (keepalive to prevent proxy timeout) ───
  const pingInterval = setInterval(() => {
    // SSE comment lines (starting with ":") are ignored by EventSource
    // but keep the connection alive through proxies and load balancers.
    writer
      .write(encoder.encode(`: ping ${Date.now()}\n\n`))
      .catch(() => {});
  }, 15_000);

  // ─── Clean up when client disconnects ─────────────────────────────
  req.signal.addEventListener("abort", () => {
    clearInterval(pollInterval);
    clearInterval(heartbeatInterval);
    clearInterval(pingInterval);
    writer
      .close()
      .catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
