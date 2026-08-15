// Mianx.ai — Auto-Project Execution (D1)
// Agents automatically progress through tasks without client intervention

import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  Auto-execute next task in a project
//  Called when: project created, chat happens, deliverable generated
// ─────────────────────────────────────────────

export async function autoExecuteNextTask(
  projectId: string,
): Promise<{ executed: boolean; taskTitle?: string; agentName?: string }> {
  try {
    // Find next todo task
    const nextTask = await db.task.findFirst({
      where: { projectId, status: "todo" },
      orderBy: { order: "asc" },
    });

    if (!nextTask) {
      // Check if any in_progress tasks exist
      const inProgress = await db.task.findFirst({
        where: { projectId, status: "in_progress" },
      });

      if (inProgress) {
        // Complete the in-progress task — atomic claim, same reasoning as
        // the todo→in_progress transition below.
        const claimed = await db.task.updateMany({
          where: { id: inProgress.id, status: "in_progress" },
          data: { status: "done" },
        });

        if (claimed.count === 0) {
          return { executed: false };
        }

        // Log agent activity
        await logAgentActivity(projectId, {
          agentName: "System",
          activity: "done",
          description: `Completed: ${inProgress.title}`,
          progress: 100,
        });

        // Update project progress
        await updateProgress(projectId);

        return {
          executed: true,
          taskTitle: inProgress.title,
          agentName: "System",
        };
      }

      return { executed: false };
    }

    // Mark next task as in_progress — atomically, conditioned on it still
    // being "todo". If two requests race to auto-execute the same project
    // (e.g. a burst of chat messages), only one of them will actually flip
    // the status and proceed; the other sees count 0 and exits early
    // instead of duplicating activity logs / progress updates for the same
    // task.
    const claimed = await db.task.updateMany({
      where: { id: nextTask.id, status: "todo" },
      data: { status: "in_progress" },
    });

    if (claimed.count === 0) {
      // Another concurrent request already claimed this task.
      return { executed: false };
    }

    // Find assigned agent
    let agentName = "AI Agent";
    if (nextTask.assignedAgentId) {
      const agent = await db.agent.findUnique({
        where: { id: nextTask.assignedAgentId },
        select: { name: true, role: true },
      });
      if (agent) {
        agentName = `${agent.name} (${agent.role})`;
      }
    }

    // Log activity
    await logAgentActivity(projectId, {
      agentName,
      activity: "working",
      description: `Started: ${nextTask.title}`,
      progress: 25,
    });

    // Update project progress
    await updateProgress(projectId);

    return {
      executed: true,
      taskTitle: nextTask.title,
      agentName,
    };
  } catch (e) {
    console.error("[auto-execute] error:", e);
    return { executed: false };
  }
}

// ─────────────────────────────────────────────
//  Complete a specific task
// ─────────────────────────────────────────────

export async function completeTaskAuto(
  taskId: string,
  projectId: string,
): Promise<void> {
  try {
    await db.task.update({
      where: { id: taskId },
      data: { status: "done" },
    });

    await logAgentActivity(projectId, {
      agentName: "System",
      activity: "done",
      description: `Task completed automatically`,
      progress: 100,
    });

    await updateProgress(projectId);

    // Auto-execute next task
    await autoExecuteNextTask(projectId);
  } catch (e) {
    console.error("[auto-execute] completeTask error:", e);
  }
}

// ─────────────────────────────────────────────
//  Log agent activity (for D2 real-time feed)
// ─────────────────────────────────────────────

interface ActivityLog {
  agentName: string;
  activity: string;
  description: string;
  progress: number;
}

export async function logAgentActivity(
  projectId: string,
  log: ActivityLog,
): Promise<void> {
  try {
    // Mark previous live activities as not live
    await db.agentActivity.updateMany({
      where: { projectId, isLive: true },
      data: { isLive: false },
    });

    // Create new activity
    await db.agentActivity.create({
      data: {
        projectId,
        agentName: log.agentName,
        activity: log.activity,
        description: log.description,
        progress: log.progress,
        isLive: true,
      },
    });
  } catch (e) {
    console.error("[auto-execute] activity log error:", e);
  }
}

// ─────────────────────────────────────────────
//  Update project progress
// ─────────────────────────────────────────────

async function updateProgress(projectId: string): Promise<void> {
  try {
    const tasks = await db.task.findMany({
      where: { projectId },
      select: { status: true },
    });

    if (tasks.length === 0) return;

    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const review = tasks.filter((t) => t.status === "review").length;

    const progress = Math.round(
      (done * 100 + review * 75 + inProgress * 50) / tasks.length,
    );

    let status = "IN_PROGRESS";
    if (progress === 100) status = "DELIVERED";
    else if (progress >= 75) status = "REVIEW";
    else if (progress >= 50) status = "IN_PROGRESS";
    else if (progress > 0) status = "IN_PROGRESS";
    else status = "PLANNING";

    await db.project.update({
      where: { id: projectId },
      data: { progress, status: status as never },
    });

    // Create notification for milestones
    if (progress === 25 || progress === 50 || progress === 75 || progress === 100) {
      await createMilestoneNotification(projectId, progress);
    }
  } catch (e) {
    console.error("[auto-execute] progress update error:", e);
  }
}

// ─────────────────────────────────────────────
//  Create milestone notification (D5)
// ─────────────────────────────────────────────

async function createMilestoneNotification(
  projectId: string,
  progress: number,
): Promise<void> {
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { title: true, clientId: true },
    });

    if (!project) return;

    const messages: Record<number, { title: string; message: string }> = {
      25: {
        title: "🚀 Project 25% Complete!",
        message: `${project.title} is making progress. Agents are working on initial tasks.`,
      },
      50: {
        title: "⚡ Project 50% Complete!",
        message: `${project.title} is halfway done! Core features are being built.`,
      },
      75: {
        title: "🎯 Project 75% Complete!",
        message: `${project.title} is almost ready. Final review and testing in progress.`,
      },
      100: {
        title: "🎉 Project Complete!",
        message: `${project.title} is fully delivered! Check your deliverables.`,
      },
    };

    const msg = messages[progress];
    if (!msg) return;

    await db.notification.create({
      data: {
        userId: project.clientId,
        projectId,
        type: "milestone",
        title: msg.title,
        message: msg.message,
        priority: progress === 100 ? "high" : "normal",
        actionUrl: `/projects/${projectId}`,
      },
    });
  } catch (e) {
    console.error("[auto-execute] notification error:", e);
  }
}

// ─────────────────────────────────────────────
//  Get live agent activity feed (D2)
// ─────────────────────────────────────────────

export async function getLiveActivity(
  projectId: string,
  limit: number = 20,
): Promise<
  {
    id: string;
    agentName: string;
    activity: string;
    description: string;
    progress: number;
    isLive: boolean;
    createdAt: Date;
  }[]
> {
  try {
    const activities = await db.agentActivity.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return activities;
  } catch (e) {
    console.error("[auto-execute] getLiveActivity error:", e);
    return [];
  }
}
