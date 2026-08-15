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
- **Function:** `teamAgentResponse()` in `ai-service.ts` (~line 690)
- When a project has multiple assigned agents, each one is called via
  `Promise.all(...)` — **independently, in parallel, with no visibility
  into each other's responses.** There is no planner, no delegation, no
  agent reading another agent's output before responding. The `@Atlas
  will handle the backend` text some agents produce is roleplay, not a
  real handoff.
- Agent selection: @mentions → keyword-based team detection → lead agent
  fallback. Max 3 agents respond per message.
- Each agent gets team context (who else is on the team) but not other
  agents' actual output.

### 1.5 Memory
- **File:** `src/lib/agent-memory.ts`
- `extractMemoriesFromMessage()` uses **hardcoded regexes** to pull out a
  handful of fact types from user messages:
  1. Color preference (red, blue, green, etc.)
  2. Brand voice (professional, casual, friendly, etc.)
  3. Tech stack (react, next.js, vue, etc.)
  4. Font preference (serif, sans-serif, etc.)
  5. Budget ($N)
  6. Deadline (today, tomorrow, next week, etc.)
- Anything not matching one of these ~6 regex patterns is invisible to
  the memory system (e.g., "I hate long paragraphs" = not captured).
- Memory is scoped per-project only (`projectId + agentId + key`);
  no cross-project client memory.
- `getMemoryContext()` builds a string injected into agent prompts.

### 1.6 Deliverable generation
- **Route:** `src/app/api/deliverables/route.ts`
- **Function:** `generateDeliverable()` in `ai-service.ts`
- One LLM call → raw text → parsed into files via `zip-generator.ts` →
  JSZip creates actual ZIP → base64-encoded into DB as `Deliverable`.
- **No verification step.** Whatever the model writes is what gets
  delivered — there is no lint, compile, or test pass before a
  "production-ready" deliverable is saved.
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
3. **Multi-agent is fake coordination** — `teamAgentResponse()` uses
   `Promise.all()` for parallel independent calls. No planner, no
   sequential handoff, no agent visibility into other agents' output.
4. **No deliverable verification** — LLM output saved as "production-ready"
   without lint, compile, or test pass.

### Architectural
5. **SPA anti-pattern on Next.js** — entire app on single `/` route with
   Zustand state-based "routing". No deep linking, no browser back/forward,
   no SEO for sub-pages, no SSR/SSG benefits.
6. **In-memory rate limiter** — per-instance only, not cross-instance.
   On Vercel serverless, limits are effectively per-instance.
7. **Duplicate schema files** — `schema.prisma` and `schema.postgres.prisma`
   are identical. Schema changes must be applied to all 3 files.
8. **Unused dependencies** — `z-ai-web-dev-sdk` and `next-intl` installed
   but completely unused in the codebase.
9. **"POWER MODE" is prompt theater** — 702 lines of instructions claiming
   "Cursor-level capability" with zero backing implementation.

### Incomplete Features
10. **Academy** — DB models + view exist but no full CRUD API.
11. **Marketplace** — `CustomAgent` model with create/browse but "download"
    just copies system prompt, not actual reusable functionality.
12. **White-label** — `WhiteLabelConfig` DB model exists but no UI or API.
13. **Notifications** — Model + API exist but no real-time system (no
    WebSocket/SSE). `NotificationBell` component likely polls.
14. **Agent Activity** — `AgentActivity` model with `isLive` flag suggests
    real-time streaming that doesn't exist yet.
15. **Hardcoded marketing stats** — "1,200+ projects", "98% satisfaction"
    on Home page are static, not from DB.

---

## 3. Roadmap — making the agents actually powerful

Four phases, ordered by effort-to-impact ratio. **Do not start a phase
before the previous one is stable and deployed.** Each phase has a
concrete "done" definition — don't consider a phase complete until its
acceptance criteria are met, not just "code written."

### Phase 1 — Model routing (highest ROI, lowest effort) — **PENDING**
**Goal:** Stop using fast/cheap models for tasks that need real reasoning,
without blowing up cost on tasks that don't.

- [ ] Add a `taskTier: "fast" | "quality"` parameter to
      `callAIWithFallback()` and `generateDeliverable()` in `ai-service.ts`.
- [ ] Define a second model per provider for the `"quality"` tier:
      | Provider | Fast Model (current) | Quality Model (new) |
      |---|---|---|
      | zai | `glm-4-flash` | `glm-4-plus` (or latest) |
      | gemini | `gemini-1.5-flash` | `gemini-2.5-pro` |
      | groq | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile` |
      | openai | `gpt-4o-mini` | `gpt-4o` |
      | anthropic | `claude-3-haiku-20240307` | `claude-sonnet-4-5-20250514` |
- [ ] Add `qualityModel` field to `ProviderConfig` interface.
- [ ] Update `callProvider()` to accept optional model override.
- [ ] Update `callAIWithFallback()` to accept `taskTier` and select model.
- [ ] Route by call site:
      - `/api/chat` (conversational replies) → `"fast"` tier — low latency
        matters more than depth for back-and-forth chat.
      - `/api/deliverables` (code/content generation) → `"quality"` tier —
        this is the output clients actually keep.
      - `/api/ai/analyze` (brief → task breakdown) → `"quality"` tier —
        errors here cascade into wrong agent assignments for the whole
        project.
- [ ] Add `tier` field to `AiProviderUsage` model (new optional field,
      `"fast" | "quality"`, default `"fast"`).
- [ ] Add `tier` column to all 3 Prisma schema files + manual SQL migration.
- [ ] Update `logUsage()` to record which tier was used.
- [ ] Update admin usage dashboard (`/api/admin/ai-usage`) to show
      cost-per-tier breakdown.
- [ ] Re-verify the fail-closed quota check still applies per (provider,
      tier) combination, not just per provider.

**Done when:** a deliverable generated through `/api/deliverables` uses a
quality-tier model by default, current provider/cost tracking still
works, per-user rate limits are unchanged, and admin dashboard shows
tier breakdown.

### Phase 2 — Real tool-use (turns "writes text" into "does things") — **PENDING**
**Goal:** Give agents actual capabilities backed by tool calls, starting
with the two highest-value tools.

- [ ] **Code verification tool.** Before a code deliverable is saved:
      run generated TypeScript/JS through a syntax check using the
      existing `typescript` devDependency in `package.json` (no new
      dependency needed). Steps:
      1. Extract code blocks from LLM output
      2. Run `tsc --noEmit` via child_process (with timeout)
      3. If syntax error: feed error back to model for one retry
      4. If retry also fails: flag deliverable as "unverified" in metadata
      5. Log verification result to `AgentToolCall` table
- [ ] **Web search tool**, gated to specific agents/tasks (e.g. Insight/
      Pulse for marketing research, Sage for SEO content) — wire through
      whichever provider's native tool-calling/search API is in use
      (check each provider's current tool-calling support before
      building a custom abstraction).
- [ ] Add `AgentToolCall` model to all 3 Prisma schema files:
      ```prisma
      model AgentToolCall {
        id          String   @id @default(cuid())
        provider    String
        toolName    String       // "code_verify" | "web_search" | ...
        agentName   String?
        projectId   String?
        userId      String?
        input       String?      // JSON
        output      String?      // JSON
        status      String       // "success" | "failed" | "skipped"
        durationMs  Int?
        createdAt   DateTime @default(now())

        @@index([provider, createdAt])
        @@index([projectId])
      }
      ```
- [ ] Both tools must respect the existing rate limits and per-user AI
      cost quotas — a tool call that itself calls an LLM (e.g. a
      search-and-summarize step) counts against the same budget.
- [ ] Log tool calls to admin dashboard alongside raw LLM calls.

**Done when:** at least one agent (start with a Dev-team agent like Zen or
Atlas) can produce a deliverable that has actually been syntax-checked,
and the admin dashboard shows tool-call counts alongside LLM-call counts.

### Phase 3 — Real multi-agent orchestration — **PENDING**
**Goal:** Replace the parallel-independent-calls pattern in
`teamAgentResponse()` with actual sequential planning and handoff.

- [ ] Introduce a lightweight "Project Lead" role (can reuse an existing
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
- [ ] Change `teamAgentResponse()` from `Promise.all(...)` (parallel,
      blind) to a sequential pipeline: each agent's prompt includes the
      *actual* prior agent's output (not just team context), so "Atlas
      will handle the backend" is followed by Atlas's real output being
      passed into the next agent's prompt.
- [ ] Add `orchestrationMode` option: `"parallel"` (current, for simple
      queries) vs `"sequential"` (new, for complex multi-step tasks).
      Use keyword detection or user @mention count to auto-select.
- [ ] Wire QA-team agents (Shield, Lens) as a **mandatory final step**
      for code deliverables — not just agents the client can optionally
      message, but a review pass that runs automatically on every
      deliverable and can request a revision before it's marked
      complete.
- [ ] This will increase LLM calls per request — re-check rate limits
      (`src/lib/rate-limit.ts`) and per-user quota math (Phase 1's tier
      routing) account for N calls per deliverable, not 1.
- [ ] Log orchestration plan and each step to `Activity` table for
      visibility in the project activity feed.

**Done when:** a multi-agent project response is visibly sequential in
the activity log (plan → agent A output → agent B sees A's output → QA
review), not N independent messages that happen to arrive together.

### Phase 4 — Deeper memory & context — **PENDING**
**Goal:** Move from regex keyword-matching to model-driven, structured
memory extraction, and extend memory beyond a single project.

- [ ] Replace `extractMemoriesFromMessage()`'s regex patterns with a
      structured-output LLM call (JSON schema: `{memoryType, key, value,
      confidence}[]`) run on each message — same `saveMemory()` upsert
      target, just a smarter extraction step. Keep this on the `"fast"`
      tier from Phase 1 — extraction doesn't need premium reasoning.
      Prompt example:
      ```
      Extract client preferences from this message. Return JSON array:
      [{"memoryType": "preference|decision|feedback|fact", "key": "short_key", "value": "extracted_value", "confidence": 0.0-1.0}]
      Message: "I hate long paragraphs, keep copy punchy"
      → [{"memoryType": "preference", "key": "writing_style", "value": "concise/punchy, no long paragraphs", "confidence": 0.9}]
      ```
- [ ] Add `clientId` column to `AgentMemory` model (nullable) for
      cross-project memory alongside existing `projectId` scope.
- [ ] Add `ClientMemory` model (or extend AgentMemory) for client-level
      preferences that persist across projects.
- [ ] For projects with long chat histories, stop stuffing the entire
      history into every prompt — add a simple relevance cutoff (most
      recent N messages + memory summary) now, and only reach for real
      embeddings/vector search if that proves insufficient in practice.
- [ ] Add memory extraction as a background task (fire-and-forget after
      chat message save) to avoid adding latency to the chat response.

**Done when:** a preference mentioned in free-form text that doesn't
match any of the old regex patterns (e.g. "I hate long paragraphs, keep
copy punchy") is captured as a memory and shows up in
`getMemoryContext()` for a later message. Cross-project preferences
carry to new projects.

---

## 4. Infrastructure & Cleanup Tasks (independent of phases)

These can be done in parallel with any phase:

- [ ] **Fix `ignoreBuildErrors: true`** in `next.config.ts` — run
  `npx tsc --noEmit`, fix or `@ts-expect-error`-annotate real errors,
  then remove the flag.
- [ ] **Remove unused dependencies** — `z-ai-web-dev-sdk` and `next-intl`
  from `package.json`. Run `bun remove z-ai-web-dev-sdk next-intl`.
- [ ] **Consolidate duplicate schemas** — `schema.prisma` and
  `schema.postgres.prisma` are identical. Delete `schema.postgres.prisma`
  and update any references. Keep only `schema.prisma` (PostgreSQL) and
  `schema.sqlite.prisma` (SQLite).
- [ ] **Replace in-memory rate limiter** with Upstash Redis
  (`@upstash/ratelimit`) for true global limits on Vercel serverless.
- [ ] **Add SPA deep linking** — use `window.history.pushState` + URL hash
  or query params so browser back/forward works and views are shareable.
- [ ] **Seed WhiteLabelConfig API + UI** — DB model exists, needs API route
  and settings page.
- [ ] **Add real-time notifications** — replace polling with WebSocket or
  Server-Sent Events for the `NotificationBell`.
- [ ] **Replace hardcoded marketing stats** — Home page "1,200+ projects"
  etc. should query from DB or at least be configurable via env vars.

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
