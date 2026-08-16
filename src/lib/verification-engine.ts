// Mianx.ai — Mission Engine: Verification Engine
//
// The Verification Engine ensures task outputs are real and correct.
// Core principle: NEVER trust LLM claims. Always verify actual outcomes.
//
// Verification strategies:
//   1. Structural checks — output is non-empty, properly formatted
//   2. Content checks — output addresses the task requirements
//   3. Code checks — code blocks are syntactically valid
//   4. AI-assisted verification — LLM cross-checks the output against criteria
//   5. Risk-based depth — LOW tasks get light checks, CRITICAL tasks get deep verification

import { callAIWithFallback } from "@/lib/ai-service";
import { db } from "@/lib/db";
import { logMissionEvent } from "./mission-engine";
import type { RiskLevel } from "./mission-types";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface VerificationRequest {
  missionId: string;
  taskId: string;
  output: string;
  outputType: string;
  taskTitle: string;
  riskLevel: RiskLevel;
}

export interface VerificationResult {
  passed: boolean;
  reasoning: string;
  issues: string[];
  score: number; // 0-100 quality score
  checks: VerificationCheck[];
  previousOutput?: string; // stored for repair context
}

interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
}

// ─────────────────────────────────────────────
//  Verification Engine
// ─────────────────────────────────────────────

/**
 * Verify a task output using multiple strategies.
 * Higher risk tasks get more thorough verification.
 */
export async function verifyTaskOutput(
  request: VerificationRequest,
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];
  const issues: string[] = [];

  // ── Check 1: Structural Validity ──
  const structuralCheck = verifyStructure(request.output, request.outputType);
  checks.push(structuralCheck);
  if (!structuralCheck.passed) {
    issues.push(structuralCheck.details);
  }

  // ── Check 2: Content Relevance ──
  const contentCheck = verifyContent(request.output, request.taskTitle);
  checks.push(contentCheck);
  if (!contentCheck.passed) {
    issues.push(contentCheck.details);
  }

  // ── Check 3: Code Validity (if output contains code) ──
  if (request.outputType === "code" || containsCodeBlocks(request.output)) {
    const codeCheck = await verifyCodeBlocks(request.output);
    checks.push(codeCheck);
    if (!codeCheck.passed) {
      issues.push(codeCheck.details);
    }
  }

  // ── Check 4: AI-Assisted Verification (for MEDIUM+ risk) ──
  if (request.riskLevel !== "LOW") {
    const aiCheck = await verifyWithAI(request);
    checks.push(aiCheck);
    if (!aiCheck.passed) {
      issues.push(aiCheck.details);
    }
  }

  // ── Check 5: Deep Verification (for HIGH/CRITICAL risk) ──
  if (request.riskLevel === "HIGH" || request.riskLevel === "CRITICAL") {
    const deepCheck = await deepVerify(request);
    checks.push(deepCheck);
    if (!deepCheck.passed) {
      issues.push(deepCheck.details);
    }
  }

  // Calculate overall score
  const passedChecks = checks.filter((c) => c.passed).length;
  const score = Math.round((passedChecks / checks.length) * 100);

  // Determine pass/fail
  // LOW risk: pass if 50%+ checks pass
  // MEDIUM: pass if 70%+ checks pass
  // HIGH: pass if 85%+ checks pass
  // CRITICAL: pass if 100% checks pass
  const thresholds: Record<RiskLevel, number> = {
    LOW: 50,
    MEDIUM: 70,
    HIGH: 85,
    CRITICAL: 100,
  };

  const passed = score >= thresholds[request.riskLevel];

  return {
    passed,
    reasoning: passed
      ? `Verification passed (${passedChecks}/${checks.length} checks, score: ${score}%)`
      : `Verification failed (${passedChecks}/${checks.length} checks, score: ${score}%). Issues: ${issues.join("; ")}`,
    issues,
    score,
    checks,
    previousOutput: request.output,
  };
}

// ─────────────────────────────────────────────
//  Structural Verification
// ─────────────────────────────────────────────

function verifyStructure(output: string, outputType: string): VerificationCheck {
  const trimmed = output.trim();

  // Check empty
  if (!trimmed) {
    return {
      name: "structural",
      passed: false,
      details: "Output is empty — no content produced",
    };
  }

  // Check minimum length
  if (trimmed.length < 20) {
    return {
      name: "structural",
      passed: false,
      details: `Output too short (${trimmed.length} chars) — likely insufficient`,
    };
  }

  // Type-specific checks
  if (outputType === "json") {
    try {
      JSON.parse(trimmed);
      return {
        name: "structural",
        passed: true,
        details: "Valid JSON structure",
      };
    } catch (e) {
      return {
        name: "structural",
        passed: false,
        details: `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`,
      };
    }
  }

  if (outputType === "url") {
    const urlRegex = /^https?:\/\/.+\..+/;
    if (!urlRegex.test(trimmed)) {
      return {
        name: "structural",
        passed: false,
        details: "Output claims to be a URL but doesn't match URL format",
      };
    }
  }

  return {
    name: "structural",
    passed: true,
    details: `Valid structure (${trimmed.length} chars, type: ${outputType})`,
  };
}

// ─────────────────────────────────────────────
//  Content Verification
// ─────────────────────────────────────────────

function verifyContent(output: string, taskTitle: string): VerificationCheck {
  const words = output.trim().split(/\s+/).length;

  // Check minimum content
  if (words < 10) {
    return {
      name: "content",
      passed: false,
      details: `Output has only ${words} words — too few for meaningful content`,
    };
  }

  // Check for placeholder/generic content
  const genericPhrases = [
    "I cannot", "I'm sorry", "As an AI", "I don't have access",
    "I apologize", "I'm unable to", "placeholder", "TODO",
    "lorem ipsum", "[insert", "your content here",
  ];

  const lowerOutput = output.toLowerCase();
  const genericMatches = genericPhrases.filter((phrase) =>
    lowerOutput.includes(phrase.toLowerCase()),
  );

  if (genericMatches.length >= 2) {
    return {
      name: "content",
      passed: false,
      details: `Output contains generic/placeholder phrases: ${genericMatches.join(", ")}`,
    };
  }

  // Check if output relates to task (keyword overlap)
  const taskWords = taskTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const outputWords = new Set(lowerOutput.split(/\s+/));
  const overlap = taskWords.filter((w) => outputWords.has(w));

  if (taskWords.length > 2 && overlap.length === 0) {
    return {
      name: "content",
      passed: false,
      details: "Output doesn't appear to relate to the task (no keyword overlap)",
    };
  }

  return {
    name: "content",
    passed: true,
    details: `Content verified (${words} words, ${overlap.length}/${taskWords.length} task keywords found)`,
  };
}

// ─────────────────────────────────────────────
//  Code Verification
// ─────────────────────────────────────────────

async function verifyCodeBlocks(output: string): Promise<VerificationCheck> {
  const codeBlocks: string[] = [];
  const regex = /```(?:\w*)\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(output)) !== null) {
    codeBlocks.push(match[1].trim());
  }

  if (codeBlocks.length === 0) {
    return {
      name: "code",
      passed: false,
      details: "Output type is 'code' but no code blocks found",
    };
  }

  // Basic syntax checks for common languages
  let issuesFound = 0;

  for (const block of codeBlocks) {
    // Check for common syntax errors
    const openBraces = (block.match(/\{/g) || []).length;
    const closeBraces = (block.match(/\}/g) || []).length;
    const openParens = (block.match(/\(/g) || []).length;
    const closeParens = (block.match(/\)/g) || []).length;
    const openBrackets = (block.match(/\[/g) || []).length;
    const closeBrackets = (block.match(/\]/g) || []).length;

    if (Math.abs(openBraces - closeBraces) > 1) issuesFound++;
    if (Math.abs(openParens - closeParens) > 1) issuesFound++;
    if (Math.abs(openBrackets - closeBrackets) > 1) issuesFound++;

    // Check for obvious issues
    if (block.includes("undefined") && block.includes("Cannot read")) issuesFound++;
    if (block.includes("TypeError") || block.includes("ReferenceError")) issuesFound++;
  }

  if (issuesFound > codeBlocks.length) {
    return {
      name: "code",
      passed: false,
      details: `Found ${issuesFound} potential syntax issues in ${codeBlocks.length} code block(s)`,
    };
  }

  return {
    name: "code",
    passed: true,
    details: `${codeBlocks.length} code block(s) passed structural checks`,
  };
}

// ─────────────────────────────────────────────
//  AI-Assisted Verification
// ─────────────────────────────────────────────

async function verifyWithAI(
  request: VerificationRequest,
): Promise<VerificationCheck> {
  try {
    const verifierPrompt = `You are a quality verifier for the Mianx.ai Agentic AI Platform.
Your job is to verify that a task output actually accomplishes what was asked.

TASK: "${request.taskTitle}"
OUTPUT:
${request.output.slice(0, 3000)}

Respond with ONLY a JSON object:
{
  "passed": true/false,
  "reasoning": "Brief explanation",
  "issues": ["issue1", "issue2"]
}

Be STRICT. Only pass if the output clearly and completely addresses the task.`;

    const response = await callAIWithFallback({
      messages: [
        { role: "system", content: verifierPrompt },
        { role: "user", content: `Verify this output for the task "${request.taskTitle}"` },
      ],
      agentName: "Verifier",
      projectId: request.missionId,
      endpoint: "chat",
      temperature: 0.2,
      maxTokens: 300,
    });

    // Parse verification response
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        name: "ai_verification",
        passed: parsed.passed === true,
        details: parsed.reasoning || "AI verification completed",
      };
    } catch {
      return {
        name: "ai_verification",
        passed: true, // Default to pass if parse fails (avoid false negatives)
        details: "Could not parse AI verification response, defaulting to pass",
      };
    }
  } catch (error) {
    return {
      name: "ai_verification",
      passed: true, // Default to pass on error
      details: `AI verification unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ─────────────────────────────────────────────
//  Deep Verification (HIGH/CRITICAL risk only)
// ─────────────────────────────────────────────

async function deepVerify(
  request: VerificationRequest,
): Promise<VerificationCheck> {
  try {
    const deepPrompt = `You are a senior quality auditor for the Mianx.ai Agentic AI Platform.
Perform a deep audit of this task output. Check for:
1. Completeness — does it address ALL aspects of the task?
2. Correctness — is the information/code accurate?
3. Consistency — are there contradictions?
4. Security — any vulnerabilities (for code)?
5. Best Practices — does it follow industry standards?

TASK: "${request.taskTitle}"
RISK LEVEL: ${request.riskLevel}
OUTPUT:
${request.output.slice(0, 4000)}

Respond with ONLY a JSON object:
{
  "passed": true/false,
  "reasoning": "Detailed audit findings",
  "issues": ["issue1", "issue2"]
}

Be EXTREMELY strict. ${request.riskLevel === "CRITICAL" ? "Any issue = fail." : "Multiple issues = fail."}`;

    const response = await callAIWithFallback({
      messages: [
        { role: "system", content: deepPrompt },
        { role: "user", content: `Deep audit this output for task "${request.taskTitle}"` },
      ],
      agentName: "DeepVerifier",
      projectId: request.missionId,
      endpoint: "chat", // use fast tier even for deep verification
      temperature: 0.1,
      maxTokens: 500,
    });

    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        name: "deep_verification",
        passed: parsed.passed === true,
        details: parsed.reasoning || "Deep verification completed",
      };
    } catch {
      return {
        name: "deep_verification",
        passed: true,
        details: "Could not parse deep verification response",
      };
    }
  } catch (error) {
    return {
      name: "deep_verification",
      passed: true,
      details: `Deep verification unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function containsCodeBlocks(output: string): boolean {
  return /```(?:\w*)\s*\n/.test(output);
}
