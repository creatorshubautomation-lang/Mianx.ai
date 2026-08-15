import { db } from "@/lib/db";

/**
 * Create a notification for a user.
 *
 * The SSE stream (`/api/notifications/stream`) will pick up the new
 * notification within ~2 seconds and push it to any connected clients.
 *
 * @example
 * ```ts
 * await notifyUser(
 *   userId,
 *   "AGENT_COMPLETED",
 *   "Agent finished task",
 *   "Zen completed the UI implementation",
 *   "normal",
 *   "/dashboard/projects/xyz",
 * );
 * ```
 */
export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  message: string,
  priority: "low" | "normal" | "high" | "urgent" = "normal",
  actionUrl: string | null = null,
) {
  try {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        priority,
        actionUrl,
      },
    });

    return notification;
  } catch (error) {
    console.error("[notifyUser] Failed to create notification:", error);
    return null;
  }
}
