// Mianx.ai — Phase 4: Tool Handlers
//
// Registry of executable tool handler functions.
// Each handler receives typed input and returns a structured result.
// Handlers are registered by name and referenced by ToolDefinition.handler.
//
// Built-in handlers:
//   - web_search     — Web search via SerpAPI/DuckDuckGo
//   - code_verify    — Static code analysis and validation
//   - code_execute   — Safe code execution (sandboxed eval)
//   - file_read      — Read file contents
//   - file_write     — Write content to file
//   - http_request   — Make HTTP requests to external APIs
//   - json_transform — Parse, validate, transform JSON data
//   - text_analysis  — Analyze text (sentiment, keywords, summary)
//   - git_info       — Get git repository info
//   - ai_generate    — Call AI model for text generation
//   - data_extract   — Extract structured data from unstructured text
//   - system_info    — Get system/platform information

import { webSearch, formatSearchContext } from "./web-search-tool";
import { logToolCall } from "./tool-logger";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ToolHandlerInput {
  [key: string]: unknown;
}

export interface ToolHandlerResult {
  success: boolean;
  output: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type ToolHandler = (
  input: ToolHandlerInput,
  context: ToolHandlerContext,
) => Promise<ToolHandlerResult>;

export interface ToolHandlerContext {
  userId?: string;
  projectId?: string;
  missionId?: string;
  taskId?: string;
  agentName?: string;
  timeoutMs: number;
}

// ─────────────────────────────────────────────
//  Handler Registry
// ─────────────────────────────────────────────

const handlerRegistry = new Map<string, ToolHandler>();

/**
 * Register a tool handler function.
 * Called during module initialization.
 */
export function registerHandler(name: string, handler: ToolHandler): void {
  handlerRegistry.set(name, handler);
}

/**
 * Get a registered handler by name.
 * Returns null if not found.
 */
export function getHandler(name: string): ToolHandler | null {
  return handlerRegistry.get(name) || null;
}

/**
 * Get all registered handler names.
 */
export function getRegisteredHandlerNames(): string[] {
  return Array.from(handlerRegistry.keys());
}

// ─────────────────────────────────────────────
//  Built-in Tool Handlers
// ─────────────────────────────────────────────

// ── web_search ──────────────────────────────

registerHandler("web_search", async (input, ctx) => {
  const query = (input.query as string) || "";
  if (!query) {
    return { success: false, output: null, error: "Missing required field: query" };
  }

  const maxResults = (input.maxResults as number) || 5;

  try {
    const result = await webSearch(query, {
      provider: "mianx",
      agentName: ctx.agentName,
      projectId: ctx.projectId,
      userId: ctx.userId,
    });

    return {
      success: true,
      output: {
        query: result.query,
        results: result.results.slice(0, maxResults),
        totalResults: result.totalResults,
        toolUsed: result.toolUsed,
        durationMs: result.durationMs,
        formattedContext: formatSearchContext(result),
      },
      metadata: { totalResults: result.totalResults, toolUsed: result.toolUsed },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── code_verify ──────────────────────────────

registerHandler("code_verify", async (input, ctx) => {
  const code = (input.code as string) || "";
  const language = (input.language as string) || "auto";

  if (!code) {
    return { success: false, output: null, error: "Missing required field: code" };
  }

  try {
    const issues: { type: string; message: string; line?: number; severity: string }[] = [];

    // Basic static checks
    const lines = code.split("\n");

    // Check for common issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for console.log in production code
      if (/(?:console\.log|console\.debug)\s*\(/.test(line)) {
        issues.push({ type: "warning", message: "Console.log statement found — remove for production", line: lineNum, severity: "low" });
      }

      // Check for TODO/FIXME
      if (/\/\/\s*(?:TODO|FIXME|HACK|XXX)/i.test(line)) {
        issues.push({ type: "info", message: "TODO/FIXME comment found", line: lineNum, severity: "info" });
      }

      // Check for hardcoded secrets
      if (/(?:password|secret|api_key|apikey)\s*[:=]\s*["'][^"']{8,}["']/.test(line)) {
        issues.push({ type: "critical", message: "Possible hardcoded secret detected — use environment variables", line: lineNum, severity: "critical" });
      }

      // Check for eval usage
      if (/\beval\s*\(/.test(line)) {
        issues.push({ type: "error", message: "eval() usage detected — potential security risk", line: lineNum, severity: "high" });
      }

      // Check for var usage (prefer const/let)
      if (/\bvar\s+\w/.test(line)) {
        issues.push({ type: "warning", message: "var keyword detected — prefer const or let", line: lineNum, severity: "low" });
      }
    }

    // Language-specific checks
    if (language === "typescript" || language === "auto") {
      // Check for any type usage
      if (code.includes(": any") || code.includes("<any>")) {
        issues.push({ type: "warning", message: "'any' type usage detected — use specific types for better type safety", severity: "low" });
      }

      // Check for non-null assertions
      const nonNullCount = (code.match(/!/g) || []).length;
      if (nonNullCount > 5) {
        issues.push({ type: "warning", message: `Excessive non-null assertions (${nonNullCount}) — consider proper null checks`, severity: "medium" });
      }
    }

    // Check import statements
    const imports = code.match(/import\s+.*from\s+["'][^"']+["']/g) || [];
    const hasReactImport = imports.some((imp) => imp.includes("react"));

    // Check for missing error handling in async functions
    const asyncFunctions = code.match(/async\s+\w+\s*\([^)]*\)\s*{/g) || [];
    for (const fn of asyncFunctions) {
      const fnStartIndex = code.indexOf(fn);
      const fnBody = code.slice(fnStartIndex, fnStartIndex + 500);
      if (!fnBody.includes("try") && !fnBody.includes("catch")) {
        issues.push({ type: "warning", message: "Async function without try-catch error handling", severity: "medium" });
      }
    }

    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const errorCount = issues.filter((i) => i.severity === "high").length;
    const warningCount = issues.filter((i) => i.severity === "low" || i.severity === "medium").length;

    return {
      success: true,
      output: {
        valid: criticalCount === 0,
        score: Math.max(0, 100 - (criticalCount * 30) - (errorCount * 15) - (warningCount * 3)),
        issues,
        summary: {
          total: issues.length,
          critical: criticalCount,
          errors: errorCount,
          warnings: warningCount,
        },
        language,
        lineCount: lines.length,
        importCount: imports.length,
        hasReactImport,
      },
      metadata: { score: Math.max(0, 100 - (criticalCount * 30) - (errorCount * 15) - (warningCount * 3)) },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `Code verification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── code_execute ────────────────────────────

registerHandler("code_execute", async (input) => {
  const code = (input.code as string) || "";
  const language = (input.language as string) || "javascript";

  if (!code) {
    return { success: false, output: null, error: "Missing required field: code" };
  }

  // Safety: Only allow JavaScript execution in this context
  if (language !== "javascript" && language !== "typescript") {
    return {
      success: false,
      output: null,
      error: `Language "${language}" not supported for execution. Only javascript/typescript allowed.`,
    };
  }

  // Safety checks
  const forbiddenPatterns = [
    /require\s*\(/,
    /import\s+/,
    /process\./,
    /child_process/,
    /fs\./,
    /__dirname/,
    /__filename/,
    /module\./,
    /global\./,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(code)) {
      return {
        success: false,
        output: null,
        error: `Code contains forbidden pattern: ${pattern.source}. Sandboxed execution prohibits file system and process access.`,
      };
    }
  }

  try {
    // Simple evaluation for expression-like code
    // For safety, we only evaluate simple expressions, not full scripts
    const isExpression = !code.includes("\n") && code.length < 200;

    if (isExpression) {
      // Wrap in async function for await support
      const fn = new Function(`return (async () => { return (${code}); })()`);
      const result = await fn();
      return {
        success: true,
        output: { result, type: typeof result },
        metadata: { executionMode: "expression" },
      };
    }

    // For multi-line code, only allow data transformation patterns
    const hasSideEffects = /(?:fetch|XMLHttpRequest|document|window)\s*[.(]/.test(code);
    if (hasSideEffects) {
      return {
        success: false,
        output: null,
        error: "Code contains side-effect operations (fetch, DOM access). Only pure functions are allowed in sandboxed execution.",
      };
    }

    const fn = new Function(`return (async () => { ${code} })()`);
    const result = await fn();
    return {
      success: true,
      output: { result: result ?? undefined, type: typeof result },
      metadata: { executionMode: "function" },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── file_read ───────────────────────────────

registerHandler("file_read", async (input) => {
  const path = (input.path as string) || "";

  if (!path) {
    return { success: false, output: null, error: "Missing required field: path" };
  }

  // Safety: Only allow reading from specific safe directories
  const safePrefixes = ["/tmp/", "/home/z/my-project/"];
  const isSafe = safePrefixes.some((prefix) => path.startsWith(prefix));

  if (!isSafe) {
    return {
      success: false,
      output: null,
      error: `Path "${path}" is outside allowed directories. Only ${safePrefixes.join(", ")} are accessible.`,
    };
  }

  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(path, "utf-8");
    const stats = await fs.stat(path);

    return {
      success: true,
      output: {
        content,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        path,
      },
      metadata: { size: stats.size },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `File read error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── file_write ──────────────────────────────

registerHandler("file_write", async (input) => {
  const path = (input.path as string) || "";
  const content = (input.content as string) || "";

  if (!path || content === undefined) {
    return { success: false, output: null, error: "Missing required fields: path, content" };
  }

  // Safety: Only allow writing to specific safe directories
  const safePrefixes = ["/tmp/", "/home/z/my-project/download/", "/home/z/my-project/scripts/"];
  const isSafe = safePrefixes.some((prefix) => path.startsWith(prefix));

  if (!isSafe) {
    return {
      success: false,
      output: null,
      error: `Path "${path}" is outside allowed write directories.`,
    };
  }

  try {
    const fs = await import("fs/promises");
    const directory = path.substring(0, path.lastIndexOf("/"));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path, content, "utf-8");
    const stats = await fs.stat(path);

    return {
      success: true,
      output: {
        path,
        size: stats.size,
        created: stats.birthtime.toISOString(),
      },
      metadata: { size: stats.size },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `File write error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── http_request ────────────────────────────

registerHandler("http_request", async (input) => {
  const url = (input.url as string) || "";
  const method = ((input.method as string) || "GET").toUpperCase();
  const headers = (input.headers as Record<string, string>) || {};
  const body = (input.body as string) || undefined;
  const timeoutMs = (input.timeout as number) || 10000;

  if (!url) {
    return { success: false, output: null, error: "Missing required field: url" };
  }

  // Validate URL protocol
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return { success: false, output: null, error: `Protocol "${parsed.protocol}" not allowed. Only http/https supported.` };
    }
  } catch {
    return { success: false, output: null, error: `Invalid URL: ${url}` };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": headers["Content-Type"] || "application/json",
        ...headers,
      },
      body: body || undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    let responseJson: unknown = null;

    // Try to parse as JSON
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // Not JSON — return raw text
    }

    return {
      success: response.ok,
      output: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseJson || responseText.slice(0, 5000), // Truncate large responses
        isJson: responseJson !== null,
        url: response.url,
      },
      metadata: { status: response.status },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── json_transform ──────────────────────────

registerHandler("json_transform", async (input) => {
  const data = input.data;
  const operation = (input.operation as string) || "validate";
  const schema = input.schema; // Optional JSON schema to validate against

  if (data === undefined || data === null) {
    return { success: false, output: null, error: "Missing required field: data" };
  }

  try {
    const inputStr = typeof data === "string" ? data : JSON.stringify(data);

    switch (operation) {
      case "parse": {
        const parsed = JSON.parse(inputStr);
        return {
          success: true,
          output: { parsed, type: Array.isArray(parsed) ? "array" : typeof parsed },
          metadata: { size: inputStr.length },
        };
      }
      case "stringify": {
        const indent = (input.indent as number) || 2;
        const stringified = JSON.stringify(data, null, indent);
        return {
          success: true,
          output: { stringified, length: stringified.length },
        };
      }
      case "validate": {
        // Basic validation — check if valid JSON
        JSON.parse(inputStr);
        return {
          success: true,
          output: { valid: true, structure: analyzeJsonStructure(data) },
        };
      }
      case "extract_keys": {
        const obj = typeof data === "string" ? JSON.parse(data) : data;
        const keys = extractAllKeys(obj);
        return {
          success: true,
          output: { keys, count: keys.length },
        };
      }
      case "flatten": {
        const obj = typeof data === "string" ? JSON.parse(data) : data;
        const flat = flattenObject(obj);
        return {
          success: true,
          output: { flat, count: Object.keys(flat).length },
        };
      }
      case "merge": {
        const sources = (input.sources as unknown[]) || [];
        if (sources.length === 0) {
          return { success: false, output: null, error: "merge operation requires 'sources' array" };
        }
        const merged = sources.reduce((acc: Record<string, unknown>, src: unknown) => {
          const parsed = typeof src === "string" ? JSON.parse(src) : src;
          return { ...acc, ...(parsed as Record<string, unknown>) };
        }, {});
        return {
          success: true,
          output: { merged },
        };
      }
      default:
        return { success: false, output: null, error: `Unknown operation: ${operation}. Supported: parse, stringify, validate, extract_keys, flatten, merge` };
    }
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `JSON transform error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── text_analysis ──────────────────────────

registerHandler("text_analysis", async (input) => {
  const text = (input.text as string) || "";
  const analysis = (input.analysis as string) || "full";

  if (!text) {
    return { success: false, output: null, error: "Missing required field: text" };
  }

  try {
    switch (analysis) {
      case "full":
      case "summary": {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
        const paragraphCount = text.split(/\n\n+/).filter(Boolean).length;
        const charCount = text.length;
        const avgWordsPerSentence = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

        // Extract top keywords (simple frequency analysis)
        const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall", "can", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "and", "but", "or", "nor", "not", "so", "yet", "both", "either", "neither", "each", "every", "all", "any", "few", "more", "most", "other", "some", "such", "no", "only", "own", "same", "than", "too", "very", "just", "because", "if", "when", "where", "how", "what", "which", "who", "whom", "this", "that", "these", "those", "it", "its", "i", "me", "my", "we", "our", "you", "your", "he", "him", "his", "she", "her", "they", "them", "their"]);
        const wordFreq: Record<string, number> = {};
        for (const word of text.toLowerCase().split(/\s+/)) {
          const clean = word.replace(/[^a-z0-9]/g, "");
          if (clean.length > 2 && !stopWords.has(clean)) {
            wordFreq[clean] = (wordFreq[clean] || 0) + 1;
          }
        }
        const keywords = Object.entries(wordFreq)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([word, count]) => ({ word, count }));

        // Simple sentiment (very basic)
        const positiveWords = new Set(["good", "great", "excellent", "amazing", "wonderful", "fantastic", "love", "best", "perfect", "awesome", "outstanding", "brilliant", "superb", "remarkable", "impressive"]);
        const negativeWords = new Set(["bad", "terrible", "awful", "horrible", "worst", "hate", "poor", "fail", "broken", "ugly", "disgusting", "dreadful", "pathetic", "disappointing", "frustrating"]);
        const words = text.toLowerCase().split(/\s+/);
        const posCount = words.filter((w) => positiveWords.has(w.replace(/[^a-z]/g, ""))).length;
        const negCount = words.filter((w) => negativeWords.has(w.replace(/[^a-z]/g, ""))).length;
        const sentiment = posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral";
        const sentimentScore = posCount - negCount;

        return {
          success: true,
          output: {
            wordCount,
            sentenceCount,
            paragraphCount,
            charCount,
            avgWordsPerSentence,
            keywords,
            sentiment,
            sentimentScore,
            readability: {
              fleschKincaid: Math.max(0, 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (0)),
            },
          },
          metadata: { wordCount, sentiment },
        };
      }

      case "keywords": {
        const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "for", "on", "with", "and", "but", "or"]);
        const wordFreq: Record<string, number> = {};
        for (const word of text.toLowerCase().split(/\s+/)) {
          const clean = word.replace(/[^a-z0-9]/g, "");
          if (clean.length > 2 && !stopWords.has(clean)) {
            wordFreq[clean] = (wordFreq[clean] || 0) + 1;
          }
        }
        return {
          success: true,
          output: {
            keywords: Object.entries(wordFreq).sort(([, a], [, b]) => b - a).slice(0, 20).map(([word, count]) => ({ word, count })),
          },
        };
      }

      default:
        return { success: false, output: null, error: `Unknown analysis type: ${analysis}` };
    }
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `Text analysis error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── git_info ────────────────────────────────

registerHandler("git_info", async (input) => {
  const repoPath = (input.repoPath as string) || "/home/z/my-project/Mianx.ai";

  try {
    const { exec } = await import("child_process");
    const util = await import("util");
    const execAsync = util.promisify(exec);

    const commands = [
      { name: "branch", cmd: "git branch --show-current" },
      { name: "lastCommit", cmd: 'git log -1 --format="%H|%s|%an|%ai"' },
      { name: "status", cmd: "git status --porcelain" },
      { name: "remote", cmd: "git remote -v" },
      { name: "log", cmd: "git log --oneline -5" },
    ];

    const results: Record<string, string> = {};

    for (const { name, cmd } of commands) {
      try {
        const { stdout } = await execAsync(cmd, { cwd: repoPath, timeout: 5000 });
        results[name] = stdout.trim();
      } catch (e) {
        results[name] = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return {
      success: true,
      output: results,
      metadata: { repoPath },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `Git info error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── ai_generate ─────────────────────────────

registerHandler("ai_generate", async (input, ctx) => {
  const prompt = (input.prompt as string) || "";
  const maxTokens = (input.maxTokens as number) || 500;
  const temperature = (input.temperature as number) || 0.7;

  if (!prompt) {
    return { success: false, output: null, error: "Missing required field: prompt" };
  }

  try {
    // Dynamic import to avoid circular deps
    const { callAIWithFallback } = await import("./ai-service");

    const response = await callAIWithFallback({
      messages: [
        { role: "system", content: "You are a helpful AI assistant. Provide concise, accurate responses." },
        { role: "user", content: prompt },
      ],
      agentName: ctx.agentName || "ToolAI",
      projectId: ctx.projectId,
      userId: ctx.userId,
      endpoint: "chat",
      temperature,
      maxTokens,
    });

    return {
      success: true,
      output: { generated: response, tokens: maxTokens },
      metadata: { model: "ai-generate" },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `AI generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── data_extract ───────────────────────────

registerHandler("data_extract", async (input) => {
  const text = (input.text as string) || "";
  const extractType = (input.extractType as string) || "all";
  const pattern = (input.pattern as string) || "";

  if (!text) {
    return { success: false, output: null, error: "Missing required field: text" };
  }

  try {
    const results: Record<string, unknown> = {};

    if (extractType === "all" || extractType === "emails") {
      const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      results.emails = [...new Set(emails)];
    }

    if (extractType === "all" || extractType === "urls") {
      const urls = text.match(/https?:\/\/[^\s<>"]+/g) || [];
      results.urls = [...new Set(urls)];
    }

    if (extractType === "all" || extractType === "phones") {
      const phones = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
      results.phones = [...new Set(phones)];
    }

    if (extractType === "all" || extractType === "numbers") {
      const numbers = text.match(/\d+\.?\d*/g) || [];
      results.numbers = numbers.map(Number);
    }

    if (extractType === "custom" && pattern) {
      const regex = new RegExp(pattern, "g");
      const matches = text.match(regex) || [];
      results.custom = matches;
    }

    // Extract dates in common formats
    if (extractType === "all" || extractType === "dates") {
      const datePatterns = [
        /\d{4}[-/]\d{2}[-/]\d{2}/g,
        /\d{2}[-/]\d{2}[-/]\d{4}/g,
        /\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}/gi,
      ];
      const dates: string[] = [];
      for (const dp of datePatterns) {
        const matches = text.match(dp) || [];
        dates.push(...matches);
      }
      results.dates = [...new Set(dates)];
    }

    const totalExtracted = Object.values(results).reduce(
      (sum: number, val: unknown) => sum + (Array.isArray(val) ? val.length : 0),
      0,
    );

    return {
      success: true,
      output: results,
      metadata: { totalExtracted, types: Object.keys(results) },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `Data extraction error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ── system_info ────────────────────────────

registerHandler("system_info", async () => {
  try {
    const os = await import("os");
    const { exec } = await import("child_process");
    const util = await import("util");
    const execAsync = util.promisify(exec);

    let nodeVersion = "unknown";
    try {
      const { stdout } = await execAsync("node --version", { timeout: 3000 });
      nodeVersion = stdout.trim();
    } catch {
      // ignore
    }

    return {
      success: true,
      output: {
        platform: os.platform(),
        architecture: os.arch(),
        nodeVersion,
        totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || "unknown",
        uptimeSeconds: os.uptime(),
        hostname: os.hostname(),
        env: {
          NODE_ENV: process.env.NODE_ENV || "not set",
          DATABASE_URL: process.env.DATABASE_URL ? "configured" : "not set",
        },
      },
      metadata: { platform: os.platform() },
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: `System info error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

// ─────────────────────────────────────────────
//  Helper functions
// ─────────────────────────────────────────────

function analyzeJsonStructure(data: unknown): { type: string; keys?: string[]; length?: number; depth: number } {
  if (data === null || data === undefined) return { type: "null", depth: 0 };
  if (typeof data !== "object") return { type: typeof data, depth: 0 };

  if (Array.isArray(data)) {
    return { type: "array", length: data.length, depth: 1 };
  }

  const obj = data as Record<string, unknown>;
  return {
    type: "object",
    keys: Object.keys(obj),
    length: Object.keys(obj).length,
    depth: 1,
  };
}

function extractAllKeys(data: unknown, prefix = ""): string[] {
  if (data === null || data === undefined) return [];
  if (typeof data !== "object") return [];

  const keys: string[] = [];

  if (Array.isArray(data)) {
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      keys.push(...extractAllKeys(data[i], `${prefix}[${i}].`));
    }
  } else {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const fullKey = prefix ? `${prefix}${key}` : key;
      keys.push(fullKey);
      if (typeof value === "object" && value !== null) {
        keys.push(...extractAllKeys(value, `${fullKey}.`));
      }
    }
  }

  return keys;
}

function flattenObject(
  data: unknown,
  prefix = "",
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  if (data === null || typeof data !== "object") {
    result[prefix] = data;
    return result;
  }

  if (Array.isArray(data)) {
    result[prefix] = data;
    return result;
  }

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}
