// Mianx.ai — Web Search Tool (Phase 2)
//
// Provides a web search capability for specific agents (Insight/Pulse for
// marketing research, Sage for SEO content). Uses a search API to fetch
// real-time information and feeds results back into the agent's context.
//
// Currently supports:
//   - SerpAPI (Google Search) — SERP_API_KEY env var
//   - Fallback: returns a "search unavailable" message
//
// All tool calls are logged to AgentToolCall for admin visibility.

import { logToolCall } from "@/lib/tool-logger";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResult {
  query: string;
  results: SearchResult[];
  totalResults: number;
  toolUsed: string;
  durationMs: number;
}

// ─────────────────────────────────────────────
//  Agent → search gate mapping
// ─────────────────────────────────────────────

/**
 * Only specific agents are allowed to use web search.
 * This prevents cost runaway — search API calls cost money and
// add latency to chat responses.
 */
const SEARCH_ENABLED_AGENTS = new Set([
  "Insight",  // Marketing Strategist — market research
  "Pulse",    // Growth Marketer — trend analysis
  "Sage",     // SEO Content Strategist — SEO research
  "Nova",     // Social Media Manager — social trends
  "Aria",     // Brand Designer — brand research
  "Lyra",     // Content Strategist — content research
]);

export function canAgentSearch(agentName: string): boolean {
  return SEARCH_ENABLED_AGENTS.has(agentName);
}

// ─────────────────────────────────────────────
//  Search implementations
// ─────────────────────────────────────────────

/**
 * Method 1: SerpAPI (Google Search API)
 * Requires SERP_API_KEY env var.
 */
async function searchWithSerpAPI(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERP_API_KEY not configured");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "5"); // top 5 results
  url.searchParams.set("engine", "google");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`SerpAPI returned ${response.status}`);
  }

  const data = await response.json();
  const organic = data.organic_results || [];

  return organic.slice(0, 5).map((r: Record<string, string>) => ({
    title: r.title || "",
    url: r.link || "",
    snippet: r.snippet || "",
  }));
}

/**
 * Method 2: DuckDuckGo instant answer API (free, no key needed)
 * Very basic — returns at most 1-2 results. Good for fallback.
 */
async function searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo API returned ${response.status}`);
  }

  const data = await response.json();
  const results: SearchResult[] = [];

  if (data.Abstract) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || "",
      snippet: data.Abstract,
    });
  }

  // Add related topics as additional results
  const topics = data.RelatedTopics || [];
  for (const topic of topics.slice(0, 4)) {
    if (topic.Text) {
      results.push({
        title: topic.Text.slice(0, 80),
        url: topic.FirstURL || "",
        snippet: topic.Text,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
//  Main search function
// ─────────────────────────────────────────────

/**
 * Execute a web search. Tries SerpAPI first, falls back to DuckDuckGo.
 * All calls are logged to AgentToolCall.
 */
export async function webSearch(
  query: string,
  opts?: {
    provider?: string;
    agentName?: string;
    projectId?: string;
    userId?: string;
  },
): Promise<WebSearchResult> {
  const startTime = Date.now();
  const provider = opts?.provider || "unknown";
  const agentName = opts?.agentName;
  const projectId = opts?.projectId;
  const userId = opts?.userId;

  let results: SearchResult[] = [];
  let toolUsed = "none";
  let searchError: string | null = null;

  // Try SerpAPI first (higher quality)
  try {
    results = await searchWithSerpAPI(query);
    toolUsed = "serpapi";
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log(`[web-search] SerpAPI failed: ${err}, trying DuckDuckGo`);

    // Fall back to DuckDuckGo
    try {
      results = await searchWithDuckDuckGo(query);
      toolUsed = "duckduckgo";
    } catch (e2) {
      searchError = e2 instanceof Error ? e2.message : String(e2);
      toolUsed = "unavailable";
    }
  }

  const result: WebSearchResult = {
    query,
    results,
    totalResults: results.length,
    toolUsed,
    durationMs: Date.now() - startTime,
  };

  await logToolCall({
    provider,
    toolName: "web_search",
    agentName,
    projectId,
    userId,
    input: { query },
    output: {
      totalResults: result.totalResults,
      toolUsed: result.toolUsed,
      error: searchError,
      results: results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet.slice(0, 100) })),
    },
    status: results.length > 0 ? "success" : "failed",
    durationMs: result.durationMs,
  });

  return result;
}

/**
 * Format search results into a context string for injection into agent prompts.
 * Agents don't call webSearch directly — this formats results for prompt injection.
 */
export function formatSearchContext(results: WebSearchResult): string {
  if (results.totalResults === 0) {
    return `[Web Search Results for "${results.query}": No results found. Tool used: ${results.toolUsed}]`;
  }

  const formatted = results.results
    .map((r, i) => `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`)
    .join("\n\n");

  return `[Web Search Results for "${results.query}" (${results.totalResults} results, via ${results.toolUsed}):\n\n${formatted}]`;
}
