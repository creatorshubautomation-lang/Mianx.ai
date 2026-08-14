// Mianx.ai — Webhook System
// Allows third-party apps to receive notifications when events happen
// (project created, chat message, deliverable ready, etc.)

import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  Event types
// ─────────────────────────────────────────────

export type WebhookEventType =
  | "project.created"
  | "project.updated"
  | "project.completed"
  | "chat.message_received"
  | "chat.agent_response"
  | "deliverable.generated"
  | "ticket.created"
  | "ticket.responded"
  | "subscription.activated"
  | "subscription.cancelled"
  | "user.signup";

export const WEBHOOK_EVENTS: { id: WebhookEventType; label: string; description: string }[] = [
  { id: "project.created", label: "Project Created", description: "When a new project is created" },
  { id: "project.updated", label: "Project Updated", description: "When project status/progress changes" },
  { id: "project.completed", label: "Project Completed", description: "When a project is marked complete" },
  { id: "chat.message_received", label: "Message Received", description: "When client sends a message" },
  { id: "chat.agent_response", label: "Agent Response", description: "When an AI agent responds" },
  { id: "deliverable.generated", label: "Deliverable Generated", description: "When a new deliverable is created" },
  { id: "ticket.created", label: "Ticket Created", description: "When a support ticket is created" },
  { id: "ticket.responded", label: "Ticket Responded", description: "When admin responds to a ticket" },
  { id: "subscription.activated", label: "Subscription Activated", description: "When a subscription starts" },
  { id: "subscription.cancelled", label: "Subscription Cancelled", description: "When a subscription is cancelled" },
  { id: "user.signup", label: "User Signup", description: "When a new user signs up" },
];

// ─────────────────────────────────────────────
//  Trigger webhooks for an event
// ─────────────────────────────────────────────

interface WebhookPayload {
  event: WebhookEventType;
  userId?: string;
  projectId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function triggerWebhooks(
  event: WebhookEventType,
  data: Record<string, unknown>,
  userId?: string,
  projectId?: string,
): Promise<void> {
  try {
    // Find all webhooks subscribed to this event
    // Note: WebhookConfig model would need to be added to Prisma schema
    // For now, we'll use a simple approach with env var for global webhook URL

    const globalWebhookUrl = process.env.WEBHOOK_URL;
    const webhooks: { url: string; secret?: string }[] = [];

    if (globalWebhookUrl) {
      webhooks.push({
        url: globalWebhookUrl,
        secret: process.env.WEBHOOK_SECRET,
      });
    }

    // Also check DB for user-specific webhooks (if model exists)
    try {
      const dbWebhooks = await db.$queryRaw<
        { url: string; secret: string | null }[]
      >`SELECT url, secret FROM "WebhookConfig" WHERE active = true AND ${event} = ANY(events)`;

      for (const wh of dbWebhooks) {
        webhooks.push({ url: wh.url, secret: wh.secret || undefined });
      }
    } catch {
      // WebhookConfig table might not exist — skip
    }

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      userId,
      projectId,
      data,
      timestamp: new Date().toISOString(),
    };

    // Send to all webhooks in parallel (don't await — fire and forget)
    for (const webhook of webhooks) {
      sendWebhook(webhook.url, payload, webhook.secret).catch((err) => {
        console.error(`[webhook] failed for ${webhook.url}:`, err);
      });
    }

    console.log(
      `[webhook] triggered ${event} to ${webhooks.length} endpoint(s)`,
    );
  } catch (e) {
    console.error("[webhook] trigger failed:", e);
  }
}

// ─────────────────────────────────────────────
//  Send webhook with HMAC signature
// ─────────────────────────────────────────────

import crypto from "crypto";

async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string,
): Promise<void> {
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Mianx.ai-Webhook/1.0",
    "X-Mianx-Event": payload.event,
    "X-Mianx-Timestamp": payload.timestamp,
  };

  // Add HMAC signature if secret is provided
  if (secret) {
    const signature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    headers["X-Mianx-Signature"] = `sha256=${signature}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(
      `Webhook to ${url} returned ${response.status}: ${response.statusText}`,
    );
  }
}

// ─────────────────────────────────────────────
//  Verify webhook signature (for receiving webhooks)
// ─────────────────────────────────────────────

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const received = signature.replace("sha256=", "");

    // Use timing-safe comparison
    if (expected.length !== received.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex"),
    );
  } catch {
    return false;
  }
}
