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

## 0. Platform Overview (current state as of 2026-08-15)

**Mianx.ai** is an "Agentic Software House" SaaS platform — clients submit
project briefs and 24 specialized AI agents autonomously design, develop,
write content, market, test, and support the project. The entire workflow
from brief to deliverable is powered by real LLM API calls.

### Tech Stack
| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Runtime | Bun |
| UI | shadcn/ui (30+ Radix primitives) + Tailwind CSS 4 |
| Animations | Framer Motion |
| Database ORM | Prisma 6 (SQLite local / PostgreSQL production) |
| Auth | NextAuth.js v4 (Credentials + JWT, 30-day sessions) |
| AI | 5 Providers — Z.ai GLM, Google Gemini, Groq, OpenAI, Anthropic |
| Payments | Stripe (4 plans: Free/$49/$199/$499) |
| i18n | Custom 3-language system (English, Urdu, Roman Urdu) |
| State | Zustand (SPA-style client-side routing) |
| Email | Resend (best-effort transactional) |
| Charts | Recharts |

### Architecture
- **Single-Page Application** on Next.js — all routes resolve to `/` with
  client-side view switching via Zustand state (`useApp().view`). No
  file-system routing for pages. No deep linking, no SSR/SSG benefits.
- **162 total files** across `src/`, `prisma/`, `public/`, and config.
- **24 agents** across 6 teams in `AGENT_CATALOG` (`src/lib/agents.ts`).
- **17+ API routes** under `src/app/api/`.
- **22 Prisma models** across 3 schema files (PostgreSQL + SQLite).

### Pages (18 views)
**Public (11):** Home, Services, Agents, Pricing, About, Use Cases, Contact,
Templates, API Docs, Academy, Marketplace
**Dashboard (7):** Overview, Projects List, New Project Wizard (4-step),
Project Detail (chat/tasks/deliverables), Deliverables, Support, Settings,
Admin Panel

### API Routes (17 endpoints)
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin` | GET | Platform stats (clients, projects, revenue, agents) |
| `/api/admin/ai-usage` | GET | AI provider usage/cost dashboard |
| `/api/admin/tickets` | GET/PATCH | Admin support ticket management |
| `/api/agents` | GET | Agent catalog (auto-seeds from code if DB empty) |
| `/api/ai/analyze` | POST | Analyze brief → recommend agents + tasks (rate-limited 10/min) |
| `/api/auth/[...nextauth]` | * | NextAuth login/session |
| `/api/auth/register` | POST | User signup (first user = ADMIN, rest = CLIENT) |
| `/api/auth/forgot-password` | POST | Token-based password reset |
| `/api/auth/reset-password` | POST | Password reset with token |
| `/api/chat` | GET/POST | Multi-agent team chat (rate-limited 20/min) |
| `/api/deliverables` | GET/POST | AI deliverable generation + ZIP (rate-limited 10/min) |
| `/api/health` | GET | Health check |
| `/api/notifications` | GET/PATCH | User notifications |
| `/api/projects` | GET/POST/PATCH | Project CRUD with validation |
| `/api/session` | GET/PATCH | User profile |
| `/api/stripe/checkout` | POST | Create Stripe checkout session |
| `/api/stripe/webhook` | POST | Stripe subscription lifecycle (idempotent) |
| `/api/stripe/portal` | GET | Billing portal session |
| `/api/support` | GET/POST/PATCH | Support ticket CRUD |
| `/api/marketplace/agents` | GET/POST | Custom AI agent marketplace |
| `/api/upload` | POST | File upload |
| `/api/analytics` | GET | Project analytics |
| `/api/agent-activity` | GET | Real-time agent activity feed |
| `/api/auto-execute` | POST | Trigger agent auto-execution |
| `/api/agent-memory` | GET | Agent memory for a project |
| `/api/courses` | GET | Academy courses |
| `/api/courses/enroll` | POST | Course enrollment |

### Database Models (22 total)
User, Agent, Project, ProjectAgent, Task, Message, Deliverable, Subscription,
WebhookEvent, Activity, AiProviderUsage, AiProviderConfig, PasswordReset,
SupportTicket, AgentMemory, Notification, AgentActivity, Course, Lesson,
Enrollment, CustomAgent, WhiteLabelConfig

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
- `POWER_MODE` config: `maxTokens: 4000`, `temperature: 0.4`.

### 1.3 AI provider layer
- **File:** `src/lib/ai-service.ts` (803 lines)
- `PROVIDERS` array (top of file) lists 5 providers in priority order,
  each with a `defaultModel`. **All current defaults are budget/fast-tier
  models**, not reasoning-grade:
  | Priority | Provider | Model | Free Credits |
  |---|---|---|---|
  | 1 | zai (Z.ai GLM) | `glm-4-flash` | $18 |
  | 2 | gemini (Google) | `gemini-1.5-flash` | $50 |
  | 3 | groq (Fast) | `llama-3.1-8b-instant` | $20 |
  | 4 | openai (GPT) | `gpt-4o-mini` | $5 |
  | 5 | anthropic (Claude) | `claude-3-haiku-20240307` | $5 |
- `callAIWithFallback()` tries providers in order, falling through on
  failure or exhausted quota (see fail-closed quota check).
- Provider-specific API formats: OpenAI-compatible (zai, groq, openai),
  Gemini native, Anthropic native — each handled separately in `callProvider()`.
- **No function calling / tool schemas exist anywhere in this file** —
  confirmed by grep for `tool_use`, `function_call`, `tools:`. Every call
  is a plain chat completion.
- `z-ai-web-dev-sdk` is in `package.json` but **completely unused** in the
  AI service — all calls use raw `fetch()`.

### 1.4 "Multi-agent" chat
- **Function:** `teamAgentResponse()` in `ai-service.ts` (~line 755)
- **Phase 3 (2026-08-15):** Now supports two orchestration modes:
  - **Parallel mode (legacy):** When a simple query is detected, agents
    respond via `Promise.all(...)` — independently, in parallel. Used for
    quick questions and single-team responses.
  - **Sequential mode (new):** When complex multi-step tasks are detected,
    an orchestrator agent runs first via `generateOrchestrationPlan()` in
    `orchestrator.ts`, producing a JSON plan with ordered steps. Each step
    executes sequentially, with each agent receiving the *actual prior
    agent's output* in its prompt (not just team names).
- **Auto-detection:** Mode is chosen by `detectMode()` based on:
  - Agent count (3+ → sequential), team diversity, message keywords
    ("build", "create", "design and code", etc.), and message length.
  - Can be explicitly overridden via the `mode` parameter.
- **Fallback:** If sequential orchestration fails, automatically falls
  back to parallel mode.
- Agent selection: @mentions → keyword-based team detection → lead agent
  fallback. Max 3 agents respond per message in parallel; max 5 steps
  in sequential mode.
- Each agent gets team context (who else is on the team) and, in
  sequential mode, the actual text output of the previous step.

### 1.5 Memory
- **File:** `src/lib/agent-memory.ts`
- **Phase 4 (2026-08-15):** Memory extraction upgraded from hardcoded regex
  to LLM-based structured output.
  - `extractMemoriesFromMessage()` now uses a fast-tier LLM call with a
    structured-output prompt to extract preferences, decisions, feedback,
    and facts as JSON: `{memoryType, key, value, confidence}[]`.
  - Falls back to legacy regex extraction if LLM call fails.
  - Skips very short messages (< 15 chars) and code-heavy messages.
  - Low-confidence memories (< 0.5) are discarded.
- **ClientMemory model (new):** High-confidence preferences (>= 0.8)
  are automatically promoted to `ClientMemory` table, persisting across
  all projects for a given client. `getMemoryContext()` now returns both
  project-level and client-level memories.
- **AgentMemory model updated:** Added `clientId` (nullable, for cross-project
  scope) and `source` column ("regex" or "llm").
- **Background extraction:** Memory extraction is now fire-and-forget
  (`extractMemoriesInBackground()`) — non-blocking, runs after chat
  response is sent. Uses `setImmediate()` to yield to event loop first.
- **Chat history relevance cutoff:** `getRelevantChatHistory()` limits
  prompt context to most recent N messages (default 20) with a lightweight
  summary of older messages, preventing token explosion on long projects.
- Memory is scoped per-project by default (`projectId + agentId + key`),
  with optional cross-project scope via `clientId`. `getMemoryContext()`
  builds a string injected into agent prompts.

### 1.6 Deliverable generation
- **Route:** `src/app/api/deliverables/route.ts`
- **Function:** `generateDeliverable()` in `ai-service.ts`
- One LLM call → raw text → parsed into files via `zip-generator.ts` →
  JSZip creates actual ZIP → base64-encoded into DB as `Deliverable`.
- **Phase 2: Code verification.** For code-type deliverables, `code-verify.ts`
  runs `tsc --noEmit` syntax check. If errors found, feeds back to model
  for one retry. If retry also fails, flags as "unverified".
- **Phase 3: QA auto-review.** For code-type deliverables, Lens (Code Reviewer)
  runs an automatic mandatory code review pass. Results logged to
  `AgentToolCall` table and `Activity` table. Deliverable description
  includes QA status (PASSED or issues flagged).
- Deliverables have metadata: title, fileType, contentEncoding, mimeType,
  fileName, fileSize.

### 1.7 Authentication & Security
- **File:** `src/lib/auth.ts`
- Credentials provider only (email + password), bcrypt 12 rounds.
- JWT sessions, 30-day `maxAge`.
- First registered user = ADMIN, rest = CLIENT.
- JWT callback re-fetches role from DB on every check — role changes
  take effect without re-login.
- **Middleware** (`src/middleware.ts`): edge-level block on `/api/admin/*`
  for non-admin users (defense-in-depth with per-route checks).
- **Password reset** via `PasswordReset` model + Resend email.
- **Input validation** on all API routes (whitelist fields, length limits,
  type checks).
- **IDOR protection** on project/message/deliverable access (ownership checks).

### 1.8 Stripe Payments
- **Files:** `src/lib/stripe.ts`, `/api/stripe/checkout/`, `/api/stripe/webhook/`
- 4 plans: Free ($0), Starter ($49/mo), Pro ($199/mo), Enterprise ($499/mo).
- Monthly or yearly billing (20% discount on yearly).
- Checkout uses inline `price_data` (no pre-created Products).
- Webhook handler: idempotent via `WebhookEvent` table (Stripe event.id as PK).
- Handles: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.

### 1.9 Rate Limiting
- **File:** `src/lib/rate-limit.ts`
- In-memory token bucket, per-instance only.
- **Not global** on serverless (Vercel) — each function instance has its
  own memory.
- Current limits:
  - `/api/chat`: 20 req/min per user
  - `/api/ai/analyze`: 10 req/min per user
  - `/api/deliverables`: 10 req/min per user

### 1.10 Known constraints from the security audit (read before changing this system)
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

## 2. Known Issues & Tech Debt (updated 2026-08-15)

### Critical
1. **`ignoreBuildErrors: true`** in `next.config.ts` — silences ALL
   TypeScript errors including auth, payments, and DB code. The TODO
   comment explicitly acknowledges this is dangerous.
2. **All AI models are budget/fast-tier** — no reasoning-grade models.
   Deliverables generated with `glm-4-flash` or `claude-3-haiku` are
   lower quality than what `gpt-4o` or `claude-sonnet-4-5` would produce.
3. **Multi-agent coordination improved (Phase 3)** — `teamAgentResponse()` now
   supports sequential orchestration with real handoff. An orchestrator plans
   the execution order, and each agent receives prior agent output. However,
   parallel mode (no real coordination) is still used for simple queries.
   Full agent-to-agent tool calling remains a future enhancement.
4. **Deliverable verification improved (Phase 2+3)** — Code deliverables now
   get `tsc --noEmit` syntax check (Phase 2) and mandatory Lens code review
   (Phase 3). However, there is still no runtime test execution — reviews
   are static analysis only.

### Architectural
5. **SPA anti-pattern on Next.js** — entire app on single `/` route with
   Zustand state-based "routing". **Improved (2026-08-16):** Deep linking
   added via `src/lib/router.ts` — browser back/forward and direct URL
   access now work. SSR/SSG benefits still not utilized.
6. **In-memory rate limiter upgraded (2026-08-16)** — Now supports
   Upstash Redis via `@upstash/ratelimit` for true global limits on
   Vercel serverless. Falls back to in-memory when env vars not set.
7. **Duplicate schema files resolved (2026-08-16)** — `schema.postgres.prisma`
   deleted. Only `schema.prisma` (PostgreSQL) and `schema.sqlite.prisma`
   (SQLite) remain. Schema changes now need to be applied to 2 files.
8. **Unused dependencies removed (2026-08-16)** — `z-ai-web-dev-sdk` and
   `next-intl` removed from `package.json`.
9. **"POWER MODE" is prompt theater** — 702 lines of instructions claiming
   "Cursor-level capability" with zero backing implementation.

### Incomplete Features
10. **Academy** — DB models + view exist but no full CRUD API.
11. **Marketplace** — `CustomAgent` model with create/browse but "download"
    just copies system prompt, not actual reusable functionality.
12. **White-label resolved (2026-08-16)** — `GET/POST /api/whitelabel` API
    + settings UI added to SettingsView (admin-only). Supports brand name,
    colors, custom domain, and white-label toggle.
13. **Notifications upgraded (2026-08-16)** — SSE endpoint
    `/api/notifications/stream` added. `NotificationBell` uses `EventSource`
    with exponential backoff reconnect instead of 30s polling.
14. **Agent Activity** — `AgentActivity` model with `isLive` flag suggests
    real-time streaming that doesn't exist yet.
15. **Hardcoded marketing stats resolved (2026-08-16)** — Stats now via
    `src/lib/platform-stats.ts` (env-var driven) and `GET /api/stats`
    (three-tier: DB → env vars → defaults). Home page uses dynamic values.

---

## 3. Roadmap — making the agents actually powerful

Four phases, ordered by effort-to-impact ratio. **Do not start a phase
before the previous one is stable and deployed.** Each phase has a
concrete "done" definition — don't consider a phase complete until its
acceptance criteria are met, not just "code written."

### Phase 1 — Model routing (highest ROI, lowest effort) — **DONE** (2026-08-15)
**Goal:** Stop using fast/cheap models for tasks that need real reasoning,
without blowing up cost on tasks that don't.

- [x] Add a `taskTier: "fast" | "quality"` parameter to
      `callAIWithFallback()` and `generateDeliverable()` in `ai-service.ts`.
- [x] Define a second model per provider for the `"quality"` tier:
      | Provider | Fast Model (current) | Quality Model (new) |
      |---|---|---|
      | zai | `glm-4-flash` | `glm-4-plus` (or latest) |
      | gemini | `gemini-1.5-flash` | `gemini-2.5-pro` |
      | groq | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile` |
      | openai | `gpt-4o-mini` | `gpt-4o` |
      | anthropic | `claude-3-haiku-20240307` | `claude-sonnet-4-5-20250514` |
- [x] Add `qualityModel` field to `ProviderConfig` interface.
- [x] Update `callProvider()` to accept optional model override.
- [x] Update `callAIWithFallback()` to accept `taskTier` and select model.
- [x] Route by call site:
      - `/api/chat` (conversational replies) → `"fast"` tier — low latency
        matters more than depth for back-and-forth chat.
      - `/api/deliverables` (code/content generation) → `"quality"` tier —
        this is the output clients actually keep.
      - `/api/ai/analyze` (brief → task breakdown) → `"quality"` tier —
        errors here cascade into wrong agent assignments for the whole
        project.
- [x] Add `tier` field to `AiProviderUsage` model (new optional field,
      `"fast" | "quality"`, default `"fast"`).
- [x] Add `tier` column to all 3 Prisma schema files + manual SQL migration.
- [x] Update `logUsage()` to record which tier was used.
- [x] Update admin usage dashboard (`/api/admin/ai-usage`) to show
      cost-per-tier breakdown.
- [x] Re-verify the fail-closed quota check still applies per (provider,
      tier) combination, not just per provider.

**Done when:** a deliverable generated through `/api/deliverables` uses a
quality-tier model by default, current provider/cost tracking still
works, per-user rate limits are unchanged, and admin dashboard shows
tier breakdown.

### Phase 2 — Real tool-use (turns "writes text" into "does things") — **DONE** (2026-08-15)
**Goal:** Give agents actual capabilities backed by tool calls, starting
with the two highest-value tools.

- [x] **Code verification tool.** Before a code deliverable is saved:
      run generated TypeScript/JS through a syntax check using the
      existing `typescript` devDependency in `package.json` (no new
      dependency needed). Steps:
      1. Extract code blocks from LLM output
      2. Run `tsc --noEmit` via child_process (with timeout)
      3. If syntax error: feed error back to model for one retry
      4. If retry also fails: flag deliverable as "unverified" in metadata
      5. Log verification result to `AgentToolCall` table
      **Implementation:** `src/lib/code-verify.ts` — extracts code blocks,
      writes to temp dir, runs tsc, feeds errors back on retry.
      Integrated into `/api/deliverables` POST handler.
- [x] **Web search tool**, gated to specific agents/tasks (e.g. Insight/
      Pulse for marketing research, Sage for SEO content) — wire through
      whichever provider's native tool-calling/search API is in use
      (check each provider's current tool-calling support before
      building a custom abstraction).
      **Implementation:** `src/lib/web-search-tool.ts` — supports SerpAPI
      (primary) + DuckDuckGo (free fallback). Gated to 6 agents: Insight,
      Pulse, Sage, Nova, Aria, Lyra. Integrated into `autoAgentResponse()`
      and `teamAgentResponse()` in `ai-service.ts`.
- [x] Add `AgentToolCall` model to all 3 Prisma schema files:
      **Implementation:** Model added to `schema.prisma`,
      `schema.postgres.prisma`, and `schema.sqlite.prisma`. Production
      migration in `phase2-migration.sql`.
- [x] Both tools must respect the existing rate limits and per-user AI
      cost quotas — a tool call that itself calls an LLM (e.g. a
      search-and-summarize step) counts against the same budget.
      **Note:** Code verification uses tsc (no LLM cost). Web search uses
      external APIs (SerpAPI/DuckDuckGo), not LLM calls, so no AI quota
      impact. Both respect existing per-user rate limits on their parent
      endpoints (`/api/deliverables` and `/api/chat`).
- [x] Log tool calls to admin dashboard alongside raw LLM calls.
      **Implementation:** `src/lib/tool-logger.ts` provides `logToolCall()`
      and `runTool()` helpers. Admin dashboard (`/api/admin/ai-usage`)
      now returns `toolCallStats` and `tierBreakdown` alongside existing
      `providers` and `recentLogs`.

**Done when:** at least one agent (start with a Dev-team agent like Zen or
Atlas) can produce a deliverable that has actually been syntax-checked,
and the admin dashboard shows tool-call counts alongside LLM-call counts.

### Phase 3 — Real multi-agent orchestration — **DONE** (2026-08-15)
**Goal:** Replace the parallel-independent-calls pattern in
`teamAgentResponse()` with actual sequential planning and handoff.

- [x] Introduce a lightweight "Project Lead" role (can reuse an existing
      agent like Atlas, or add a new orchestrator-only prompt) that runs
      *first* when a multi-agent response is needed: it reads the
      request, decides which agents are actually needed and in what
      order, and produces a short plan (JSON):
      ```json
      {
        "plan": "Build a landing page",
        "steps": [
          {"agent": "Aria", "task": "define brand colors and typography"},
          {"agent": "Kairo", "task": "design UI components based on Aria's output"},
          {"agent": "Zen", "task": "implement Kairo's design in React code"}
        ]
      }
      ```
      **Implementation:** `src/lib/orchestrator.ts` — `generateOrchestrationPlan()`
      uses a dedicated orchestrator system prompt to generate JSON plans.
      The orchestrator is aware of available agents and their specialties.
- [x] Change `teamAgentResponse()` from `Promise.all(...)` (parallel,
      blind) to a sequential pipeline: each agent's prompt includes the
      *actual* prior agent's output (not just team context), so "Atlas
      will handle the backend" is followed by Atlas's real output being
      passed into the next agent's prompt.
      **Implementation:** `sequentialTeamResponse()` in `ai-service.ts` calls
      `executeSequentialPlan()` from orchestrator.ts. Each step receives
      prior agent output (truncated to 2000 chars) in the prompt.
- [x] Add `orchestrationMode` option: `"parallel"` (current, for simple
      queries) vs `"sequential"` (new, for complex multi-step tasks).
      Use keyword detection or user @mention count to auto-select.
      **Implementation:** `detectMode()` in `ai-service.ts` auto-detects based on:
      - 3+ agents → sequential
      - 2+ agents from different teams + sequential keywords → sequential
      - Long messages (>200 chars) + multi-team → sequential
      - Otherwise → parallel (backward compatible)
      Mode can also be explicitly passed via the `mode` parameter.
- [x] Wire QA-team agents (Shield, Lens) as a **mandatory final step**
      for code deliverables — not just agents the client can optionally
      message, but a review pass that runs automatically on every
      code deliverable and can request a revision before it's marked
      complete.
      **Implementation:** In `/api/deliverables/route.ts`, after code generation
      and verification, Lens (Code Reviewer) runs an automatic review using
      quality-tier LLM. Review result (PASS/NEEDS_REVISION) is logged to
      `AgentToolCall` table and `Activity` table. Deliverable description
      includes QA status.
- [x] This will increase LLM calls per request — re-check rate limits
      (`src/lib/rate-limit.ts`) and per-user quota math (Phase 1's tier
      routing) account for N calls per deliverable, not 1.
      **Implementation:** Max 5 orchestration steps + 1 plan = 6 calls per
      orchestrated chat message. With 20/min rate limit on /api/chat,
      this allows ~3 orchestrated messages/min. QA review adds 1 call
      to /api/deliverables (already rate-limited at 10/min). All calls
      still respect fail-closed quota checks from Phase 1.
- [x] Log orchestration plan and each step to `Activity` table for
      visibility in the project activity feed.
      **Implementation:** `logOrchestrationActivity()` in `orchestrator.ts`
      logs `ORCHESTRATION_PLAN_CREATED`, `ORCHESTRATION_STEP_COMPLETED`,
      `ORCHESTRATION_STEP_FAILED` actions. Chat route logs
      `ORCHESTRATED_CHAT_MESSAGE` for orchestrated responses.
      Deliverable QA logs `QA_REVIEW_PASSED`/`QA_REVIEW_FAILED`.

**Done when:** a multi-agent project response is visibly sequential in
the activity log (plan → agent A output → agent B sees A's output → QA
review), not N independent messages that happen to arrive together.

### Phase 4 — Deeper memory & context — **DONE** (2026-08-15)
**Goal:** Move from regex keyword-matching to model-driven, structured
memory extraction, and extend memory beyond a single project.

- [x] Replace `extractMemoriesFromMessage()`'s regex patterns with a
      structured-output LLM call (JSON schema: `{memoryType, key, value,
      confidence}[]`) run on each message — same `saveMemory()` upsert
      target, just a smarter extraction step. Keep this on the `"fast"`
      tier from Phase 1 — extraction doesn't need premium reasoning.
      **Implementation:** `extractMemoriesFromMessage()` in
      `src/lib/agent-memory.ts` now calls a fast-tier LLM with a
      structured-output system prompt. Falls back to regex extraction
      if LLM call fails. Low-confidence memories (< 0.5) are discarded.
      Extraction is logged to `AgentToolCall` table via `tool-logger.ts`.
- [x] Add `clientId` column to `AgentMemory` model (nullable) for
      cross-project memory alongside existing `projectId` scope.
      **Implementation:** Added `clientId String?` to `AgentMemory` in all
      3 Prisma schema files + `source` column ("regex" | "llm").
      SQL migration in `prisma/phase4-migration.sql`.
- [x] Add `ClientMemory` model (or extend AgentMemory) for client-level
      preferences that persist across projects.
      **Implementation:** New `ClientMemory` model in all 3 Prisma schemas.
      `promoteToClientMemory()` automatically promotes high-confidence
      preferences (>= 0.8) from AgentMemory to ClientMemory.
      `getClientMemories()` fetches cross-project memories.
      `getMemoryContext()` now includes both project and client memories.
- [x] For projects with long chat histories, stop stuffing the entire
      history into every prompt — add a simple relevance cutoff (most
      recent N messages + memory summary) now, and only reach for real
      embeddings/vector search if that proves insufficient in practice.
      **Implementation:** `getRelevantChatHistory()` returns most recent 20
      messages (configurable) with a lightweight topic summary of older
      messages. Available for use by any code that builds prompt context.
- [x] Add memory extraction as a background task (fire-and-forget after
      chat message save) to avoid adding latency to the chat response.
      **Implementation:** `extractMemoriesInBackground()` uses
      `setImmediate()` for fire-and-forget execution. Chat route uses
      this instead of `await extractMemoriesFromMessage()`.

**Done when:** a preference mentioned in free-form text that doesn't
match any of the old regex patterns (e.g. "I hate long paragraphs, keep
copy punchy") is captured as a memory and shows up in
`getMemoryContext()` for a later message. Cross-project preferences
carry to new projects.

---

## 4. Infrastructure & Cleanup Tasks (independent of phases)

These can be done in parallel with any phase:

- [x] **Fix `ignoreBuildErrors: true`** in `next.config.ts` — run
  `npx tsc --noEmit`, fix or `@ts-expect-error`-annotate real errors,
  then remove the flag. **DONE (2026-08-16):** Fixed all 19 TypeScript
  errors across 7 files. Set `ignoreBuildErrors: false`. Edge cases
  annotated with `@ts-expect-error`.
- [x] **Remove unused dependencies** — `z-ai-web-dev-sdk` and `next-intl`
  from `package.json`. **DONE (2026-08-16):** Ran `bun remove`. Updated
  `AboutView.tsx` to list "Google Gemini" instead of "z-ai-web-dev-sdk" in
  the tech stack display.
- [x] **Consolidate duplicate schemas** — `schema.prisma` and
  `schema.postgres.prisma` are identical. **DONE (2026-08-16):** Deleted
  `schema.postgres.prisma`. No references found in codebase. Kept
  `schema.prisma` (PostgreSQL) and `schema.sqlite.prisma` (SQLite).
- [x] **Replace in-memory rate limiter** with Upstash Redis
  (`@upstash/ratelimit`) for true global limits on Vercel serverless.
  **DONE (2026-08-16):** Rewrote `src/lib/rate-limit.ts` to export
  async `rateLimit()` that tries Upstash first (slidingWindow
  algorithm), falls back to in-memory on error or missing env vars.
  Updated all 7 API route files (8 call sites) to use `await`.
  Activate with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- [x] **Add SPA deep linking** — use `window.history.pushState` + URL
  hash or query params so browser back/forward works and views are
  shareable. **DONE (2026-08-16):** Created `src/lib/router.ts` with
  `pushView()`, `replaceView()`, `pathToView()`, and `initRouter()`.
  All 30+ navigation calls across 20+ components updated to use
  `navigate()` instead of raw `setView()`. Browser back/forward and
  direct URL access now work (e.g., `/dashboard/projects/:id`).
- [x] **Seed WhiteLabelConfig API + UI** — DB model exists, needs API route
  and settings page. **DONE (2026-08-16):** Created
  `GET/POST /api/whitelabel` with field whitelisting, hex color
  validation, and ADMIN-only gate for `isWhiteLabel`. Added White
  Label settings section to SettingsView with brand name, color
  pickers, custom domain, and toggle. Admin-only visibility.
- [x] **Add real-time notifications** — replace polling with WebSocket or
  Server-Sent Events for the `NotificationBell`. **DONE (2026-08-16):**
  Created `GET /api/notifications/stream` SSE endpoint (polls DB
  every 2s, heartbeats every 30s). Replaced 30s polling in
  `NotificationBell.tsx` with `EventSource` + exponential backoff
  reconnect. Added `notifyUser()` helper in `src/lib/notification-helper.ts`.
- [x] **Replace hardcoded marketing stats** — Home page "1,200+ projects"
  etc. should query from DB or at least be configurable via env vars.
  **DONE (2026-08-16):** Created `src/lib/platform-stats.ts` (env-var
  driven with defaults) and `GET /api/stats` endpoint (three-tier:
  real DB counts → env vars → defaults). Home page uses dynamic stats.

---

## 5. Ground rules for anyone implementing this

- **This project uses Prisma with `db push`, not `prisma migrate`.** See
  `package.json` scripts: `db:push` uses `--accept-data-loss`. There is
  no `migrations/` folder.
- **Every new AI call path needs:** a per-user rate limit, input length
  validation, and to respect the fail-closed quota check pattern already
  established in `ai-service.ts`.
- **Every schema change needs a corresponding entry in all remaining Prisma
  schema files** (after consolidation: `schema.prisma` and
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
- **The in-memory rate limiter is per-instance** — don't assume it's a
  global limit on serverless (Vercel). Plan to replace with Upstash Redis.
- **All provider API formats differ** — zai/groq/openai use OpenAI-compatible
  format, Gemini uses native format, Anthropic uses its own format. Any
  changes to `callProvider()` must handle all 3 formats.
- **Cost tracking uses hardcoded per-1M-token rates** in `PROVIDERS` —
  these may become stale. Consider fetching actual costs from provider
  APIs or making rates configurable.
