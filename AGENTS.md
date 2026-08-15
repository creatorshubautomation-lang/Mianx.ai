# AGENTS.md — Mianx.ai Agent System

This file documents how Mianx.ai's AI agent system actually works today, and
lays out a concrete, ordered roadmap to close the gap between what the
agents *claim* to do ("Cursor-level capability") and what they *actually*
do (single LLM text completions with no tools, no verification, no real
coordination).

Anyone (human or AI coding agent) picking up work on the agent system
should read this file first — it's the source of truth for both "how it
works now" and "what to build next."

---

## 1. How the agent system works today

### 1.1 Agent definitions
- **File:** `src/lib/agents.ts`
- 24 agents across 6 teams (`AGENT_CATALOG`), each just a name/role/
  description/capabilities list + a `systemPrompt` string.
- Agents are **not** independent processes or objects — they're prompt
  templates. "Calling an agent" means: pick its `systemPrompt`, send it to
  an LLM with the conversation, get text back.

### 1.2 The "POWER MODE" prompt layer
- **File:** `src/lib/agent-power.ts` (702 lines)
- Wraps each agent's base prompt with `BASE_CAPABILITIES` text instructing
  the model to act "Cursor-level," generate complete multi-file code, tag
  other agents with `@AgentName`, etc.
- **This is prompt engineering only.** None of these instructions are
  backed by actual capability — there is no code execution, no file
  system access, no multi-file write tool. The model just writes text that
  *looks like* multiple files in one response.

### 1.3 AI provider layer
- **File:** `src/lib/ai-service.ts` (803 lines)
- `PROVIDERS` array (top of file) lists 5 providers in priority order,
  each with a `defaultModel`. **All current defaults are budget/fast-tier
  models**, not reasoning-grade:
  | Priority | Provider | Model |
  |---|---|---|
  | 1 | zai | `glm-4-flash` |
  | 2 | gemini | `gemini-1.5-flash` |
  | 3 | groq | `llama-3.1-8b-instant` |
  | 4 | openai | `gpt-4o-mini` |
  | 5 | anthropic | `claude-3-haiku-20240307` |
- `callAIWithFallback()` tries providers in order, falling through on
  failure or exhausted quota (see fail-closed quota check added in the
  security audit).
- **No function calling / tool schemas exist anywhere in this file** —
  confirmed by grep for `tool_use`, `function_call`, `tools:`. Every call
  is a plain chat completion.

### 1.4 "Multi-agent" chat
- **Function:** `teamAgentResponse()` in `ai-service.ts` (~line 690)
- When a project has multiple assigned agents, each one is called via
  `Promise.all(...)` — **independently, in parallel, with no visibility
  into each other's responses.** There is no planner, no delegation, no
  agent reading another agent's output before responding. The `@Atlas
  will handle the backend` text some agents produce is roleplay, not a
  real handoff.

### 1.5 Memory
- **File:** `src/lib/agent-memory.ts`
- `extractMemoriesFromMessage()` uses **hardcoded regexes** to pull out a
  handful of fact types (color preference, brand voice, tech stack,
  budget, deadline) from user messages. Anything not matching one of ~6
  regex patterns is invisible to the memory system.
- Memory is scoped per-project only; no cross-project client memory.

### 1.6 Deliverable generation
- **Route:** `src/app/api/deliverables/route.ts`
- **Function:** `generateDeliverable()` in `ai-service.ts`
- One LLM call → raw text → optionally parsed into a ZIP
  (`src/lib/zip-generator.ts`) → saved to DB. **No verification step.**
  Whatever the model writes is what gets delivered — there is no lint,
  compile, or test pass before a "production-ready" deliverable is saved.

### 1.7 Known constraints from the security audit (read before changing this system)
- All AI-triggering endpoints (`/api/chat`, `/api/ai/analyze`,
  `/api/deliverables`) are rate-limited per user (`src/lib/rate-limit.ts`)
  — any change that increases calls-per-request (e.g. an orchestrator
  calling multiple sub-agents) must account for this.
- AI provider spend-quota checks are **fail-closed** — if the DB usage
  check errors, that provider is skipped rather than allowing unmetered
  spend. Preserve this when adding new call paths.
- User-submitted content (project briefs, chat messages) is treated as
  **untrusted data**, delimited in prompts (see `/api/ai/analyze`'s
  `<<<BRIEF>>>` markers). Any new prompt-construction code must follow
  the same pattern — never concatenate raw user input adjacent to system
  instructions without delimiters.

---

## 2. Roadmap — making the agents actually powerful

Four phases, ordered by effort-to-impact ratio. **Do not start a phase
before the previous one is stable and deployed.** Each phase has a
concrete "done" definition — don't consider a phase complete until its
acceptance criteria are met, not just "code written."

### Phase 1 — Model routing (highest ROI, lowest effort)
**Goal:** Stop using fast/cheap models for tasks that need real reasoning,
without blowing up cost on tasks that don't.

- [ ] Add a `taskTier: "fast" | "quality"` parameter to
      `callAIWithFallback()` and `generateDeliverable()` in `ai-service.ts`.
- [ ] Define a second model per provider for the `"quality"` tier, e.g.:
      - anthropic: `claude-sonnet-4-5` (or latest available Sonnet)
      - gemini: `gemini-2.5-pro` (or latest Pro tier)
      - openai: `gpt-4o` (not `-mini`)
- [ ] Route by call site:
      - `/api/chat` (conversational replies) → `"fast"` tier — low latency
        matters more than depth for back-and-forth chat.
      - `/api/deliverables` (code/content generation) → `"quality"` tier —
        this is the output clients actually keep.
      - `/api/ai/analyze` (brief → task breakdown) → `"quality"` tier —
        errors here cascade into wrong agent assignments for the whole
        project.
- [ ] Update `AiProviderConfig`/`AiProviderUsage` cost tracking to record
      which tier was used, so the admin usage dashboard
      (`/api/admin/ai-usage`) can show cost-per-tier, not just
      cost-per-provider.
- [ ] Re-verify the fail-closed quota check still applies per (provider,
      tier) combination, not just per provider.

**Done when:** a deliverable generated through `/api/deliverables` uses a
quality-tier model by default, current provider/cost tracking still
works, and per-user rate limits are unchanged.

### Phase 2 — Real tool-use (turns "writes text" into "does things")
**Goal:** Give agents actual capabilities backed by tool calls, starting
with the two highest-value tools.

- [ ] **Code verification tool.** Before a code deliverable is saved:
      run generated TypeScript/JS through a syntax check (e.g. spin up
      the existing `esbuild`/`typescript` devDependency already in
      `package.json` — no new dependency needed) and, if it fails,
      feed the error back to the model for one retry before giving up
      and flagging the deliverable as "unverified" in its metadata.
      This directly fixes the "production-ready" claim in
      `agent-power.ts` actually being true.
- [ ] **Web search tool**, gated to specific agents/tasks (e.g. Insight/
      Pulse for marketing research, Sage for SEO content) — wire through
      whichever provider's native tool-calling/search API is in use
      (check each provider's current tool-calling support before
      building a custom abstraction).
- [ ] Both tools must respect the existing rate limits and per-user AI
      cost quotas — a tool call that itself calls an LLM (e.g. a
      search-and-summarize step) counts against the same budget.
- [ ] Log tool calls to `AiProviderUsage` (or a new `AgentToolCall` table)
      so tool usage is visible in the admin dashboard, same as raw LLM
      calls are now.

**Done when:** at least one agent (start with a Dev-team agent like Zen or
Atlas) can produce a deliverable that has actually been syntax-checked,
and the admin dashboard shows tool-call counts alongside LLM-call counts.

### Phase 3 — Real multi-agent orchestration
**Goal:** Replace the parallel-independent-calls pattern in
`teamAgentResponse()` with actual sequential planning and handoff.

- [ ] Introduce a lightweight "Project Lead" role (can reuse an existing
      agent like Atlas, or add a new orchestrator-only prompt) that runs
      *first* when a multi-agent response is needed: it reads the
      request, decides which agents are actually needed and in what
      order, and produces a short plan.
- [ ] Change `teamAgentResponse()` from `Promise.all(...)` (parallel,
      blind) to a sequential pipeline: each agent's prompt includes the
      *actual* prior agent's output (not just team context), so "Atlas
      will handle the backend" is followed by Atlas's real output being
      passed into the next agent's prompt.
- [ ] Wire QA-team agents (Shield, Lens) as a **mandatory final step**
      for code deliverables — not just agents the client can optionally
      message, but a review pass that runs automatically on every
      deliverable and can request a revision before it's marked
      complete.
- [ ] This will increase LLM calls per request — re-check rate limits
      (`src/lib/rate-limit.ts`) and per-user quota math (Phase 1's tier
      routing) account for N calls per deliverable, not 1.

**Done when:** a multi-agent project response is visibly sequential in
the activity log (plan → agent A output → agent B sees A's output → QA
review), not N independent messages that happen to arrive together.

### Phase 4 — Deeper memory & context
**Goal:** Move from regex keyword-matching to model-driven, structured
memory extraction, and extend memory beyond a single project.

- [ ] Replace `extractMemoriesFromMessage()`'s regex patterns with a
      structured-output LLM call (JSON schema: `{memoryType, key, value,
      confidence}[]`) run on each message — same `saveMemory()` upsert
      target, just a smarter extraction step. Keep this on the `"fast"`
      tier from Phase 1 — extraction doesn't need premium reasoning.
- [ ] Extend memory scope: add a `clientId`-scoped memory alongside the
      existing `projectId`-scoped one, so a returning client's
      preferences carry across new projects.
- [ ] For projects with long chat histories, stop stuffing the entire
      history into every prompt — add a simple relevance cutoff (most
      recent N messages + memory summary) now, and only reach for real
      embeddings/vector search if that proves insufficient in practice.

**Done when:** a preference mentioned in free-form text that doesn't
match any of the old regex patterns (e.g. "I hate long paragraphs, keep
copy punchy") is captured as a memory and shows up in
`getMemoryContext()` for a later message.

---

## 3. Ground rules for anyone implementing this

- **Read `/mnt/skills` conventions if you're Claude Code working in this
  repo** — this project uses Prisma (no `migrations/` folder, uses
  `db push` — see `package.json` scripts), Next.js App Router API routes,
  and has an in-memory rate limiter (`src/lib/rate-limit.ts`) that is
  per-instance, not cross-instance — don't assume it's a global limit on
  serverless.
- **Every new AI call path needs:** a per-user rate limit, input length
  validation, and to respect the fail-closed quota check pattern already
  established in `ai-service.ts`.
- **Every schema change needs a corresponding entry in all three Prisma
  schema files** (`schema.prisma`, `schema.postgres.prisma`,
  `schema.sqlite.prisma`) and a manual SQL migration for production,
  since this repo has no `prisma migrate` history — see
  `security-fixes-migration.sql` in past commits for the pattern.
- **Don't trust client-declared cost/pricing/status fields** — this
  codebase had multiple mass-assignment and IDOR bugs fixed in the
  security audit (see git log for `security:` and `fix:` commits). New
  code should whitelist fields explicitly rather than spreading request
  bodies into DB writes.
- **Prefer incremental, testable changes** over a big-bang rewrite of the
  agent system — each phase above should be shippable and useful on its
  own, not blocked on the next phase.
