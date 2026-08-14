// Mianx.ai — Project Status Auto-Update Logic
// Updates project status + progress based on task completion

import { db } from "@/lib/db";

// ─────────────────────────────────────────────
//  Update project progress based on tasks
// ─────────────────────────────────────────────

export async function updateProjectProgress(projectId: string): Promise<void> {
  try {
    // Get all tasks for project
    const tasks = await db.task.findMany({
      where: { projectId },
      select: { status: true },
    });

    if (tasks.length === 0) {
      // No tasks yet — set to BRIEFING
      await db.project.update({
        where: { id: projectId },
        data: {
          progress: 5,
          status: "BRIEFING",
        },
      });
      return;
    }

    // Calculate progress
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === "done").length;
    const inProgressTasks = tasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const reviewTasks = tasks.filter((t) => t.status === "review").length;

    // Progress: done=100%, review=75%, in_progress=50%, todo=0%
    const progress = Math.round(
      (doneTasks * 100 +
        reviewTasks * 75 +
        inProgressTasks * 50 +
        (totalTasks - doneTasks - reviewTasks - inProgressTasks) * 0) /
        totalTasks,
    );

    // Determine status
    let status: "BRIEFING" | "PLANNING" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "COMPLETED";

    if (progress === 0) {
      status = "PLANNING";
    } else if (progress < 50) {
      status = "IN_PROGRESS";
    } else if (progress < 100) {
      // If any task in review, status is REVIEW
      status = reviewTasks > 0 ? "REVIEW" : "IN_PROGRESS";
    } else {
      // All tasks done — check if deliverables exist
      const deliverableCount = await db.deliverable.count({
        where: { projectId },
      });
      status = deliverableCount > 0 ? "DELIVERED" : "REVIEW";
    }

    // Update project
    await db.project.update({
      where: { id: projectId },
      data: { progress, status },
    });

    console.log(
      `[progress] Project ${projectId}: ${progress}% (${status}) — ${doneTasks}/${totalTasks} tasks done`,
    );
  } catch (e) {
    console.error("[progress] update failed:", e);
  }
}

// ─────────────────────────────────────────────
//  Mark task as done + update project progress
// ─────────────────────────────────────────────

export async function completeTask(
  taskId: string,
  projectId: string,
): Promise<void> {
  try {
    await db.task.update({
      where: { id: taskId },
      data: { status: "done" },
    });

    await updateProjectProgress(projectId);
  } catch (e) {
    console.error("[progress] completeTask failed:", e);
  }
}

// ─────────────────────────────────────────────
//  Mark project as completed (admin/client action)
// ─────────────────────────────────────────────

export async function completeProject(projectId: string): Promise<void> {
  try {
    await db.project.update({
      where: { id: projectId },
      data: {
        status: "COMPLETED",
        progress: 100,
      },
    });

    // Mark all tasks as done
    await db.task.updateMany({
      where: { projectId },
      data: { status: "done" },
    });

    console.log(`[progress] Project ${projectId} marked as COMPLETED`);
  } catch (e) {
    console.error("[progress] completeProject failed:", e);
  }
}
