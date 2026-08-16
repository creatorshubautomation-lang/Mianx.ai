// Mianx.ai — Mission Execution: SSE Stream Endpoint
//
// GET /api/missions/[id]/stream — SSE stream of live mission updates
//
// This endpoint provides real-time updates during mission execution
// using Server-Sent Events (SSE). The client connects and receives
// events as tasks are executed, verified, and completed.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify mission ownership
  const mission = await db.mission.findUnique({
    where: { id, userId: user.id },
    select: { status: true },
  });

  if (!mission) {
    return new Response("Mission not found", { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: {"missionId":"${id}","status":"${mission.status}"}\n\n`),
      );

      // Poll for updates every 1.5 seconds
      let lastEventCount = 0;
      let lastTaskStates = new Map<string, string>();
      let active = true;

      // Track events already sent
      const sentEvents = new Set<string>();

      const pollInterval = setInterval(async () => {
        if (!active) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Get latest mission state
          const currentMission = await db.mission.findUnique({
            where: { id },
            select: {
              status: true,
              progress: true,
              completedTasks: true,
              failedTasks: true,
              totalTasks: true,
              spentUsd: true,
            },
          });

          if (!currentMission) {
            active = false;
            controller.enqueue(
              encoder.encode(`event: error\ndata: {"message":"Mission not found"}\n\n`),
            );
            controller.close();
            return;
          }

          // Check if mission is in terminal state
          const terminalStates = ["COMPLETED", "FAILED", "CANCELLED"];
          if (terminalStates.includes(currentMission.status)) {
            controller.enqueue(
              encoder.encode(
                `event: mission_${currentMission.status.toLowerCase()}\ndata: ${JSON.stringify({
                  status: currentMission.status,
                  progress: currentMission.progress,
                  completedTasks: currentMission.completedTasks,
                  failedTasks: currentMission.failedTasks,
                  totalTasks: currentMission.totalTasks,
                  spentUsd: currentMission.spentUsd,
                })}\n\n`,
              ),
            );
            active = false;
            controller.close();
            return;
          }

          // Get recent events
          const events = await db.missionEvent.findMany({
            where: { missionId: id },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          // Send new events
          for (const event of events.reverse()) {
            if (!sentEvents.has(event.id)) {
              sentEvents.add(event.id);
              controller.enqueue(
                encoder.encode(
                  `event: ${event.eventType.toLowerCase()}\ndata: ${JSON.stringify({
                    id: event.id,
                    type: event.eventType,
                    title: event.title,
                    description: event.description,
                    level: event.level,
                    taskId: event.taskId,
                    createdAt: event.createdAt.toISOString(),
                  })}\n\n`,
                ),
              );
            }
          }

          // Get task states and send updates for changed tasks
          const tasks = await db.missionTask.findMany({
            where: { missionId: id },
            select: { id: true, status: true, title: true, progress: true },
            orderBy: { order: "asc" },
          });

          for (const task of tasks) {
            const prevState = lastTaskStates.get(task.id);
            if (prevState !== task.status) {
              lastTaskStates.set(task.id, task.status);
              controller.enqueue(
                encoder.encode(
                  `event: task_update\ndata: ${JSON.stringify({
                    taskId: task.id,
                    title: task.title,
                    status: task.status,
                  })}\n\n`,
                ),
              );
            }
          }

          // Send periodic progress heartbeat
          controller.enqueue(
            encoder.encode(
              `event: heartbeat\ndata: ${JSON.stringify({
                status: currentMission.status,
                progress: currentMission.progress,
                completedTasks: currentMission.completedTasks,
                failedTasks: currentMission.failedTasks,
                spentUsd: currentMission.spentUsd,
              })}\n\n`,
            ),
          );

          lastEventCount = events.length;
        } catch (error) {
          console.error("[mission-stream] Poll error:", error);
        }
      }, 1500);

      // Clean up on abort
      const abortHandler = () => {
        active = false;
        clearInterval(pollInterval);
        controller.close();
      };

      request.signal.addEventListener("abort", abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
