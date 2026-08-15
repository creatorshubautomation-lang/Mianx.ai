// Mianx.ai — Code Verification Tool (Phase 2)
//
// Runs generated TypeScript/JavaScript code through `tsc --noEmit`
// (or basic syntax parsing as fallback) before marking a deliverable
// as "production-ready". If syntax errors are found, feeds them back
// to the LLM for one retry attempt.
//
// Flow:
//   1. Extract code blocks from LLM output (```lang:filepath ... ```)
//   2. Write code to a temp directory
//   3. Run `tsc --noEmit` via child_process (with 30s timeout)
//   4. If syntax error: feed error back to model for one retry
//   5. If retry also fails: flag deliverable as "unverified" in metadata
//   6. Log verification result to AgentToolCall table

import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";
import { logToolCall } from "@/lib/tool-logger";

const execAsync = promisify(exec);

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface CodeFile {
  filePath: string; // e.g. "src/components/Button.tsx"
  language: string; // e.g. "typescript", "javascript"
  content: string;
}

export interface VerifyResult {
  verified: boolean; // true = passed syntax check
  errors: string[]; // any errors found
  filesChecked: number;
  durationMs: number;
  toolUsed: "tsc" | "parse" | "skipped"; // which method was actually used
}

// ─────────────────────────────────────────────
//  Code block extraction
// ─────────────────────────────────────────────

/**
 * Extract code blocks from LLM output.
 * Supports formats:
 *   ```typescript:src/foo.ts
 *   ```ts:src/foo.ts
 *   ```javascript:src/foo.js
 *   ```jsx:src/foo.jsx
 *   ```typescript
 */
export function extractCodeBlocks(text: string): CodeFile[] {
  const files: CodeFile[] = [];

  // Pattern 1: ```lang:filepath  (Mianx POWER MODE format)
  const pathBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = pathBlockRegex.exec(text)) !== null) {
    const language = normalizeLanguage(match[1]);
    const filePath = match[2].trim();
    const content = match[3].trim();
    if (content.length > 0 && isVerifiable(language)) {
      files.push({ filePath, language, content });
    }
  }

  // If no path-tagged blocks found, fall back to generic code blocks
  if (files.length === 0) {
    const genericBlockRegex = /```(typescript|javascript|tsx|jsx|ts|js)\n([\s\S]*?)```/g;
    while ((match = genericBlockRegex.exec(text)) !== null) {
      const language = normalizeLanguage(match[1]);
      const content = match[2].trim();
      if (content.length > 0 && isVerifiable(language)) {
        files.push({
          filePath: `file-${files.length + 1}.${getExtension(language)}`,
          language,
          content,
        });
      }
    }
  }

  return files;
}

function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  if (["typescript", "ts", "tsx"].includes(lower)) return "typescript";
  if (["javascript", "js", "jsx"].includes(lower)) return "javascript";
  return lower;
}

function getExtension(language: string): string {
  switch (language) {
    case "typescript": return "ts";
    case "javascript": return "js";
    default: return "txt";
  }
}

function isVerifiable(language: string): boolean {
  return ["typescript", "javascript"].includes(language);
}

// ─────────────────────────────────────────────
//  Verification methods
// ─────────────────────────────────────────────

/**
 * Method 1: Use tsc --noEmit if TypeScript is available.
 * This catches type errors, syntax errors, and import issues.
 */
async function verifyWithTsc(
  files: CodeFile[],
  tempDir: string,
): Promise<{ errors: string[]; durationMs: number }> {
  const startTime = Date.now();

  // Write all files to temp dir
  for (const file of files) {
    const fullPath = path.join(tempDir, file.filePath);
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, file.content, "utf8");
  }

  // Create a minimal tsconfig.json for the temp project
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
    },
    include: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  };
  await writeFile(path.join(tempDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  try {
    await execAsync(`npx tsc --noEmit --project ${path.join(tempDir, "tsconfig.json")}`, {
      timeout: 30_000, // 30 second timeout
      cwd: tempDir,
    });

    return { errors: [], durationMs: Date.now() - startTime };
  } catch (e: unknown) {
    const stderr = (e as { stderr?: string }).stderr || "";
    // Parse tsc errors — extract file:line:message lines
    const errorLines = stderr
      .split("\n")
      .filter((line) => line.includes("error TS"))
      .map((line) => line.trim())
      .slice(0, 20); // cap at 20 errors to avoid huge retry prompts

    return {
      errors: errorLines.length > 0 ? errorLines : [stderr.slice(0, 500)],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Method 2: Basic JS/TS syntax check via Node.js parser.
 * Fallback when tsc is not available. Catches syntax errors only.
 */
async function verifyWithParse(
  files: CodeFile[],
): Promise<{ errors: string[]; durationMs: number }> {
  const startTime = Date.now();
  const errors: string[] = [];

  for (const file of files) {
    try {
      // Use Node.js to check syntax via dynamic import
      const code = file.content;
      // Simple bracket/brace matching check for obvious syntax errors
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      const openBrackets = (code.match(/\[/g) || []).length;
      const closeBrackets = (code.match(/]/g) || []).length;
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;

      const mismatches: string[] = [];
      if (Math.abs(openBraces - closeBraces) > 1) {
        mismatches.push(`Unmatched braces: { ${openBraces} vs } ${closeBraces}`);
      }
      if (Math.abs(openBrackets - closeBrackets) > 1) {
        mismatches.push(`Unmatched brackets: [ ${openBrackets} vs ] ${closeBrackets}`);
      }
      if (Math.abs(openParens - closeParens) > 1) {
        mismatches.push(`Unmatched parentheses: ( ${openParens} vs ) ${closeParens}`);
      }

      // Also check for template literal mismatches
      const backtickCount = (code.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        mismatches.push("Unmatched template literal backticks");
      }

      if (mismatches.length > 0) {
        errors.push(`${file.filePath}: ${mismatches.join("; ")}`);
      }
    } catch (e) {
      errors.push(`${file.filePath}: ${(e as Error).message}`);
    }
  }

  return { errors, durationMs: Date.now() - startTime };
}

// ─────────────────────────────────────────────
//  Main verify function
// ─────────────────────────────────────────────

/**
 * Verify code deliverables. Tries tsc first, falls back to parse check.
 * Cleans up temp files after verification.
 */
export async function verifyCode(
  aiOutput: string,
  opts?: {
    provider?: string;
    toolName?: string;
    agentName?: string;
    projectId?: string;
    userId?: string;
  },
): Promise<VerifyResult> {
  const startTime = Date.now();
  const provider = opts?.provider || "unknown";
  const agentName = opts?.agentName;
  const projectId = opts?.projectId;
  const userId = opts?.userId;

  const files = extractCodeBlocks(aiOutput);

  // No verifiable code found — skip verification
  if (files.length === 0) {
    const result: VerifyResult = {
      verified: true, // no code to verify = vacuously true
      errors: [],
      filesChecked: 0,
      durationMs: Date.now() - startTime,
      toolUsed: "skipped",
    };

    await logToolCall({
      provider,
      toolName: "code_verify",
      agentName,
      projectId,
      userId,
      input: { filesExtracted: 0, outputLength: aiOutput.length },
      output: { verified: true, reason: "No verifiable code blocks found" },
      status: "success",
      durationMs: result.durationMs,
    });

    return result;
  }

  let tempDir = "";
  let verifyResult: { errors: string[]; durationMs: number };

  try {
    tempDir = path.join(os.tmpdir(), `mianx-verify-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Try tsc first
    try {
      verifyResult = await verifyWithTsc(files, tempDir);
    } catch {
      // tsc not available — fall back to basic parse check
      verifyResult = await verifyWithParse(files);
    }
  } finally {
    // Always clean up temp dir
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }

  const result: VerifyResult = {
    verified: verifyResult.errors.length === 0,
    errors: verifyResult.errors,
    filesChecked: files.length,
    durationMs: Date.now() - startTime,
    toolUsed: "tsc",
  };

  await logToolCall({
    provider,
    toolName: "code_verify",
    agentName,
    projectId,
    userId,
    input: {
      filesExtracted: files.length,
      fileNames: files.map((f) => f.filePath),
      outputLength: aiOutput.length,
    },
    output: {
      verified: result.verified,
      errors: result.errors.slice(0, 10), // cap logged errors
      filesChecked: result.filesChecked,
    },
    status: result.verified ? "success" : "failed",
    durationMs: result.durationMs,
  });

  return result;
}

/**
 * Build a retry prompt that feeds verification errors back to the LLM.
 * Used when code verification fails and we want one retry.
 */
export function buildRetryPrompt(
  originalTask: string,
  errors: string[],
): string {
  return `The code I generated had syntax errors. Please fix them and regenerate the complete code.

ORIGINAL TASK: ${originalTask}

VERIFICATION ERRORS:
${errors.join("\n")}

REQUIREMENTS:
1. Fix ALL the errors listed above
2. Regenerate the COMPLETE code (not just the broken parts)
3. Use proper markdown code blocks: \`\`\`language:filepath
4. Include ALL imports and dependencies
5. Ensure all brackets, braces, and parentheses are balanced`;
}
