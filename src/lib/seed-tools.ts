// Mianx.ai — Phase 4: Tool Registry Seed
//
// Seeds the database with default tool definitions.
// Run with: npx tsx scripts/seed-tools.ts
// Or import and call seedDefaultTools() from your code.
//
// This script is idempotent — it uses upsert so it can be run multiple times.

import { db } from "@/lib/db";

interface SeedTool {
  name: string;
  displayName: string;
  description: string;
  category: "FILE" | "CODE" | "GIT" | "DATABASE" | "WEB" | "DEPLOY" | "AI" | "SYSTEM";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  inputSchema: string;
  handler: string;
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  requireApproval: boolean;
  allowedAgents: string[];
  allowedPlans: string[];
  costPerCall: number;
}

const DEFAULT_TOOLS: SeedTool[] = [
  // ── WEB ──────────────────────────────────────
  {
    name: "web_search",
    displayName: "Web Search",
    description: "Search the web using SerpAPI or DuckDuckGo fallback. Returns search results with titles, URLs, and snippets.",
    category: "WEB",
    riskLevel: "LOW",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
        maxResults: { type: "number", description: "Max results to return (default: 5)" },
      },
      required: ["query"],
    }),
    handler: "web_search",
    timeoutMs: 15000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: ["Insight", "Pulse", "Sage", "Nova", "Aria", "Lyra", "Zen"],
    allowedPlans: [],
    costPerCall: 0.005,
  },
  {
    name: "http_request",
    displayName: "HTTP Request",
    description: "Make HTTP/HTTPS requests to external APIs and web services. Supports GET, POST, PUT, DELETE methods with custom headers.",
    category: "WEB",
    riskLevel: "MEDIUM",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        url: { type: "string", description: "Target URL (http/https only)" },
        method: { type: "string", description: "HTTP method (default: GET)" },
        headers: { type: "object", description: "Custom headers" },
        body: { type: "string", description: "Request body (for POST/PUT)" },
        timeout: { type: "number", description: "Timeout in ms (default: 10000)" },
      },
      required: ["url"],
    }),
    handler: "http_request",
    timeoutMs: 15000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: [],
    allowedPlans: ["STARTER", "PRO", "ENTERPRISE"],
    costPerCall: 0.001,
  },

  // ── CODE ─────────────────────────────────────
  {
    name: "code_verify",
    displayName: "Code Verification",
    description: "Static code analysis — checks for security issues, best practices violations, console.log statements, hardcoded secrets, and TypeScript type safety issues.",
    category: "CODE",
    riskLevel: "LOW",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        code: { type: "string", description: "Source code to analyze" },
        language: { type: "string", description: "Programming language (default: auto)" },
      },
      required: ["code"],
    }),
    handler: "code_verify",
    timeoutMs: 10000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: ["Zen", "Atlas", "Lens", "Shield", "Cipher"],
    allowedPlans: [],
    costPerCall: 0.002,
  },
  {
    name: "code_execute",
    displayName: "Code Execution",
    description: "Safely execute JavaScript/TypeScript code in a sandboxed environment. Only pure functions allowed — no file system or process access.",
    category: "CODE",
    riskLevel: "HIGH",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to execute" },
        language: { type: "string", description: "Language (javascript or typescript)" },
      },
      required: ["code"],
    }),
    handler: "code_execute",
    timeoutMs: 5000,
    retryable: false,
    maxRetries: 1,
    requireApproval: true,
    allowedAgents: ["Zen", "Atlas", "Shield"],
    allowedPlans: ["PRO", "ENTERPRISE"],
    costPerCall: 0.01,
  },

  // ── FILE ─────────────────────────────────────
  {
    name: "file_read",
    displayName: "File Read",
    description: "Read file contents from safe directories. Returns content, size, and last modified timestamp.",
    category: "FILE",
    riskLevel: "MEDIUM",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute file path to read" },
      },
      required: ["path"],
    }),
    handler: "file_read",
    timeoutMs: 5000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: ["Zen", "Atlas", "Echo", "Sage"],
    allowedPlans: [],
    costPerCall: 0.001,
  },
  {
    name: "file_write",
    displayName: "File Write",
    description: "Write content to files in safe directories. Creates parent directories if needed.",
    category: "FILE",
    riskLevel: "HIGH",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute file path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    }),
    handler: "file_write",
    timeoutMs: 10000,
    retryable: true,
    maxRetries: 2,
    requireApproval: true,
    allowedAgents: ["Zen", "Atlas"],
    allowedPlans: ["PRO", "ENTERPRISE"],
    costPerCall: 0.002,
  },

  // ── AI ────────────────────────────────────────
  {
    name: "ai_generate",
    displayName: "AI Text Generation",
    description: "Generate text using AI models. Supports configurable temperature and token limits. Useful for content creation, summarization, and analysis.",
    category: "AI",
    riskLevel: "MEDIUM",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt for AI generation" },
        maxTokens: { type: "number", description: "Max tokens (default: 500)" },
        temperature: { type: "number", description: "Temperature 0-1 (default: 0.7)" },
      },
      required: ["prompt"],
    }),
    handler: "ai_generate",
    timeoutMs: 30000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: [],
    allowedPlans: [],
    costPerCall: 0.01,
  },

  // ── SYSTEM ────────────────────────────────────
  {
    name: "system_info",
    displayName: "System Information",
    description: "Get platform and runtime information including OS, Node.js version, memory, CPU, and environment configuration.",
    category: "SYSTEM",
    riskLevel: "LOW",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {},
      required: [],
    }),
    handler: "system_info",
    timeoutMs: 5000,
    retryable: true,
    maxRetries: 1,
    requireApproval: false,
    allowedAgents: ["Orion", "Atlas"],
    allowedPlans: [],
    costPerCall: 0.0,
  },

  // ── GIT ──────────────────────────────────────
  {
    name: "git_info",
    displayName: "Git Repository Info",
    description: "Get git repository information including current branch, last commit, status, remote URLs, and recent commit history.",
    category: "GIT",
    riskLevel: "MEDIUM",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Path to git repository (default: /home/z/my-project/Mianx.ai)" },
      },
      required: [],
    }),
    handler: "git_info",
    timeoutMs: 10000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: ["Zen", "Atlas", "Orion"],
    allowedPlans: ["STARTER", "PRO", "ENTERPRISE"],
    costPerCall: 0.001,
  },

  // ── DATABASE ─────────────────────────────────
  {
    name: "json_transform",
    displayName: "JSON Transform",
    description: "Parse, validate, stringify, extract keys, flatten, or merge JSON data. Supports multiple transformation operations.",
    category: "DATABASE",
    riskLevel: "LOW",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        data: { description: "JSON data or string to transform" },
        operation: { type: "string", description: "Operation: parse, stringify, validate, extract_keys, flatten, merge" },
        sources: { type: "array", description: "Array of sources for merge operation" },
        indent: { type: "number", description: "Indentation for stringify (default: 2)" },
      },
      required: ["data"],
    }),
    handler: "json_transform",
    timeoutMs: 5000,
    retryable: true,
    maxRetries: 2,
    requireApproval: false,
    allowedAgents: [],
    allowedPlans: [],
    costPerCall: 0.0,
  },

  // ── FILE (Text Processing) ───────────────────
  {
    name: "text_analysis",
    displayName: "Text Analysis",
    description: "Analyze text for word count, readability, keywords, sentiment, and structural patterns. Supports summary and keywords-only modes.",
    category: "FILE",
    riskLevel: "LOW",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        text: { type: "string", description: "Text to analyze" },
        analysis: { type: "string", description: "Analysis type: full, keywords (default: full)" },
      },
      required: ["text"],
    }),
    handler: "text_analysis",
    timeoutMs: 5000,
    retryable: true,
    maxRetries: 1,
    requireApproval: false,
    allowedAgents: ["Lyra", "Sage", "Echo", "Flux", "Insight"],
    allowedPlans: [],
    costPerCall: 0.001,
  },

  // ── WEB (Data Extraction) ───────────────────
  {
    name: "data_extract",
    displayName: "Data Extractor",
    description: "Extract structured data from unstructured text — emails, URLs, phone numbers, dates, numbers, or custom regex patterns.",
    category: "WEB",
    riskLevel: "LOW",
    inputSchema: JSON.stringify({
      type: "object",
      properties: {
        text: { type: "string", description: "Text to extract data from" },
        extractType: { type: "string", description: "Type: all, emails, urls, phones, numbers, dates, custom" },
        pattern: { type: "string", description: "Custom regex pattern (for extractType: custom)" },
      },
      required: ["text"],
    }),
    handler: "data_extract",
    timeoutMs: 5000,
    retryable: true,
    maxRetries: 1,
    requireApproval: false,
    allowedAgents: [],
    allowedPlans: [],
    costPerCall: 0.001,
  },
];

/**
 * Seed default tools into the database.
 * Uses upsert so it's safe to run multiple times.
 */
export async function seedDefaultTools(): Promise<{ created: number; updated: number; errors: string[] }> {
  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (const tool of DEFAULT_TOOLS) {
    try {
      // Try to find existing tool
      const existing = await db.toolDefinition.findUnique({
        where: { name: tool.name },
      });

      if (existing) {
        // Update existing tool (preserve enabled state from DB)
        await db.toolDefinition.update({
          where: { name: tool.name },
          data: {
            displayName: tool.displayName,
            description: tool.description,
            category: tool.category,
            riskLevel: tool.riskLevel,
            inputSchema: tool.inputSchema,
            handler: tool.handler,
            timeoutMs: tool.timeoutMs,
            retryable: tool.retryable,
            maxRetries: tool.maxRetries,
            requireApproval: tool.requireApproval,
            allowedAgents: JSON.stringify(tool.allowedAgents),
            allowedPlans: JSON.stringify(tool.allowedPlans),
            costPerCall: tool.costPerCall,
            // Don't change enabled status — admin may have disabled it
          },
        });
        results.updated++;
      } else {
        // Create new tool
        await db.toolDefinition.create({
          data: {
            name: tool.name,
            displayName: tool.displayName,
            description: tool.description,
            category: tool.category,
            riskLevel: tool.riskLevel,
            inputSchema: tool.inputSchema,
            handler: tool.handler,
            timeoutMs: tool.timeoutMs,
            retryable: tool.retryable,
            maxRetries: tool.maxRetries,
            requireApproval: tool.requireApproval,
            allowedAgents: JSON.stringify(tool.allowedAgents),
            allowedPlans: JSON.stringify(tool.allowedPlans),
            costPerCall: tool.costPerCall,
            enabled: true,
          },
        });
        results.created++;
      }
    } catch (error) {
      results.errors.push(`${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`[seed-tools] Seeded ${results.created} new tools, updated ${results.updated} existing tools, ${results.errors.length} errors`);
  return results;
}

// Allow running as script
if (typeof require !== "undefined" && require.main === module) {
  seedDefaultTools()
    .then((result) => {
      console.log("Done:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
