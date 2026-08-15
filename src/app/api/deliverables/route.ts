import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDeliverable, callAIWithFallback } from "@/lib/ai-service";
import { rateLimit } from "@/lib/rate-limit";
import { AGENT_CATALOG } from "@/lib/agents";

// GET /api/deliverables?projectId=xxx
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      project.clientId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deliverables = await db.deliverable.findMany({
      where: { projectId },
      include: { uploader: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ deliverables });
  } catch (e) {
    console.error("[deliverables/get] error:", e);
    return NextResponse.json(
      {
        error: "Failed to fetch deliverables",
      },
      { status: 500 },
    );
  }
}

// POST /api/deliverables — request a new deliverable (AI-generated)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Deliverable generation calls paid AI providers + does ZIP generation —
  // throttle to protect cost and avoid abuse.
  const limit = rateLimit(`deliverables:${session.user.id}`, 10, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  try {
    const { projectId, agentName, taskDescription } = await req.json();

    if (!projectId || !agentName || !taskDescription) {
      return NextResponse.json(
        { error: "projectId, agentName, and taskDescription are required" },
        { status: 400 },
      );
    }

    if (typeof agentName !== "string" || agentName.length > 100) {
      return NextResponse.json(
        { error: "agentName must be a string under 100 characters" },
        { status: 400 },
      );
    }
    if (typeof taskDescription !== "string" || taskDescription.length > 5000) {
      return NextResponse.json(
        { error: "taskDescription must be a string under 5000 characters" },
        { status: 400 },
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { agents: { include: { agent: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      project.clientId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projectContext = `Project: ${project.title}
Type: ${project.projectType}
Description: ${project.description}`;

    // Look up the assigned agent's role for the ZIP metadata (best-effort —
    // falls back to a generic label if this agent isn't formally assigned).
    const assignedAgent = project.agents.find(
      (pa) => pa.agent.name === agentName,
    )?.agent;

    // Generate real deliverable using AI
    let generated = await generateDeliverable(
      agentName,
      taskDescription,
      projectContext,
      projectId,
      session.user.id,
    );

    // ─────────────────────────────────────────────
    //  Phase 2: Code verification (with retry)
    //  For code-type deliverables, run tsc --noEmit syntax check.
    //  If verification fails, feed errors back to LLM for one retry.
    // ─────────────────────────────────────────────
    let verificationStatus: "verified" | "unverified" | "skipped" = "skipped";

    if (generated.fileType === "code") {
      try {
        const { verifyCode, buildRetryPrompt } = await import(
          "@/lib/code-verify"
        );

        const verifyResult = await verifyCode(generated.content, {
          agentName,
          projectId,
          userId: session.user.id,
        });

        if (!verifyResult.verified && verifyResult.filesChecked > 0) {
          console.log(
            `[deliverables] Code verification failed (${verifyResult.errors.length} errors), retrying...`,
          );

          // One retry with error feedback
          const retryPrompt = buildRetryPrompt(
            taskDescription,
            verifyResult.errors,
          );

          generated = await generateDeliverable(
            agentName,
            retryPrompt,
            projectContext,
            projectId,
            session.user.id,
          );

          // Verify the retry
          const retryVerify = await verifyCode(generated.content, {
            agentName,
            projectId,
            userId: session.user.id,
          });

          verificationStatus = retryVerify.verified ? "verified" : "unverified";

          if (!retryVerify.verified) {
            console.log(
              `[deliverables] Retry also failed — flagging as unverified`,
            );
          }
        } else {
          verificationStatus = verifyResult.verified ? "verified" : "skipped";
        }
      } catch (verifyErr) {
        console.error(
          "[deliverables] Code verification error (non-blocking):",
          verifyErr,
        );
        // Verification failure doesn't block deliverable creation
        verificationStatus = "skipped";
      }
    }

    // ─────────────────────────────────────────────
    //  Phase 3: QA auto-review for code deliverables
    //  After code generation (and optional verification), run Lens (Code Reviewer)
    //  as a mandatory review pass before saving the deliverable.
    // ─────────────────────────────────────────────
    let qaReview: { reviewer: string; review: string; passed: boolean } | null = null;

    if (generated.fileType === "code") {
      try {
        const lensAgent = AGENT_CATALOG.find((a) => a.name === "Lens");

        if (lensAgent) {
          // Truncate content for review to avoid token explosion
          const codeForReview = generated.content.length > 4000
            ? generated.content.slice(0, 4000) + "\n\n[... code truncated for review ...]"
            : generated.content;

          const reviewResult = await callAIWithFallback({
            messages: [
              {
                role: "system",
                content: `${lensAgent.systemPrompt}

You are performing a MANDATORY code review for a deliverable that will be sent to a client.

REVIEW CHECKLIST:
1. 🔴 CRITICAL: Security vulnerabilities (SQL injection, XSS, hardcoded secrets, missing auth)
2. 🔴 CRITICAL: Bugs that would crash at runtime
3. 🟡 IMPORTANT: Missing error handling, broken imports, incomplete code
4. 🟡 IMPORTANT: Best practices violations (unused variables, poor naming, missing types)
5. 🟢 NICE TO HAVE: Performance optimizations, code style, documentation

FORMAT YOUR REVIEW AS:
## Verdict: PASS or NEEDS_REVISION

### 🔴 Critical Issues (if any)
- issue description

### 🟡 Important Issues (if any)
- issue description

### 🟢 Suggestions (if any)
- suggestion

## Summary
1-2 sentence overall assessment.`,
              },
              {
                role: "user",
                content: `Review this code deliverable for a client project titled "${project.title}":\n\n${codeForReview}`,
              },
            ],
            agentName: "Lens",
            projectId,
            userId: session.user.id,
            endpoint: "deliverables", // quality tier for reviews
            temperature: 0.3, // low temperature for consistent review
            maxTokens: 800,
          });

          const passed = !reviewResult.includes("Verdict: NEEDS_REVISION") &&
                         !reviewResult.includes("Verdict: FAIL");

          qaReview = {
            reviewer: "Lens (Code Reviewer)",
            review: reviewResult,
            passed,
          };

          // Log QA review to AgentToolCall table
          try {
            const { logToolCall } = await import("@/lib/tool-logger");
            await logToolCall({
              provider: "orchestrator",
              toolName: "qa_review",
              agentName: "Lens",
              projectId,
              userId: session.user.id,
              input: { fileType: generated.fileType, codeLength: generated.content.length },
              output: { passed, reviewLength: reviewResult.length },
              status: passed ? "success" : "failed",
            });
          } catch {
            // logging best-effort
          }

          // Log QA activity
          await db.activity.create({
            data: {
              projectId,
              userId: session.user.id,
              action: passed ? "QA_REVIEW_PASSED" : "QA_REVIEW_FAILED",
              details: `Lens code review ${passed ? "passed" : "flagged issues"} for deliverable "${generated.title}"`,
            },
          });
        }
      } catch (qaErr) {
        console.error("[deliverables] QA review error (non-blocking):", qaErr);
        // QA failure doesn't block deliverable creation
      }
    }

    // Generate ZIP file with multiple project files
    let zipBuffer: Buffer | null = null;
    let zipFileName: string | null = null;
    let fileCount = 1;

    try {
      const { generateProjectZip, parseAiContentToFiles } = await import(
        "@/lib/zip-generator"
      );

      const files = parseAiContentToFiles(generated.content);
      fileCount = files.length;

      const zipResult = await generateProjectZip({
        projectName: project.title,
        projectType: project.projectType,
        files,
        deliverableTitle: generated.title,
        agentName,
        agentRole: assignedAgent?.role || "Agent",
        description: taskDescription,
      });

      zipBuffer = zipResult.buffer;
      zipFileName = zipResult.fileName;
      fileCount = zipResult.fileCount;
    } catch (zipErr) {
      console.error("[deliverables] ZIP generation failed:", zipErr);
      // Continue without ZIP — text file will still be saved
    }

    const deliverable = await db.deliverable.create({
      data: {
        projectId,
        uploadedBy: session.user.id,
        title: generated.title,
        description: `${taskDescription}\n\n📦 ZIP contains ${fileCount} files${verificationStatus === "verified" ? "\n✅ Code syntax verified" : verificationStatus === "unverified" ? "\n⚠️ Code syntax unverified — may contain errors" : ""}${qaReview ? (qaReview.passed ? "\n🔍 QA Code Review: PASSED" : "\n🔍 QA Code Review: Issues flagged — review recommended") : ""}`,
        fileType: zipBuffer ? "archive" : generated.fileType,
        // When ZIP generation succeeded, persist the actual ZIP bytes
        // (base64-encoded) so downloads return a real, openable archive.
        // Previously this stored the raw AI text under a .zip filename,
        // which downloaded as a broken/unopenable "archive".
        content: zipBuffer ? zipBuffer.toString("base64") : generated.content,
        contentEncoding: zipBuffer ? "base64" : "utf8",
        mimeType: zipBuffer ? "application/zip" : undefined,
        fileName: zipFileName || `${agentName.toLowerCase()}-${Date.now()}.${generated.fileType === "code" ? "txt" : "md"}`,
        fileSize: zipBuffer ? zipBuffer.length : generated.content.length,
      },
      include: { uploader: true },
    });

    // Log activity
    await db.activity.create({
      data: {
        projectId,
        userId: session.user.id,
        action: "DELIVERABLE_GENERATED",
        details: `${agentName} generated: ${generated.title}`,
      },
    });

    // Send deliverable ready email (best-effort)
    try {
      const { sendEmail, deliverableReadyEmail } = await import("@/lib/email");
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      });
      if (user?.email) {
        const { subject, html } = deliverableReadyEmail(
          user.name || "there",
          project.title,
          generated.title,
          agentName,
        );
        await sendEmail({ to: user.email, subject, html });
      }
    } catch (emailErr) {
      console.error("[deliverables] email failed:", emailErr);
    }

    // Auto-update project progress (deliverable = significant progress)
    try {
      const { updateProjectProgress } = await import("@/lib/project-progress");
      await updateProjectProgress(projectId);
    } catch (e) {
      console.error("[deliverables] progress update failed:", e);
    }

    return NextResponse.json({ deliverable, ok: true });
  } catch (e) {
    console.error("[deliverables] error:", e);
    return NextResponse.json(
      { error: "Failed to generate deliverable" },
      { status: 500 },
    );
  }
}
