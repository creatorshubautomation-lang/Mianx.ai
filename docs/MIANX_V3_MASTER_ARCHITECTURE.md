# Mianx.ai V3 — Master Architecture Document

> **"The Agentic AI Operating System for Modern Teams"**
> Version 3.0 | Last updated: June 2025

---

## 1. Vision

Mianx.ai V3 is an **Agentic AI Operating System** that transforms how teams work by turning natural language goals into verified, auditable outcomes through autonomous agent workflows. Rather than requiring users to orchestrate tools and workflows manually, V3 introduces a mission-driven paradigm: users express intent, the system understands, plans, delegates to AI agents, executes with full observability, and verifies results against measurable success criteria.

The system treats every piece of work as a **Mission** — a goal-oriented unit that flows through Understanding → Planning → Task Graph → Agent/Workflow/Human Execution → Verification → Outcome Assessment. Every action is logged, every decision is explainable, and every outcome is evidence-backed.

---

## 2. Execution Flow

The end-to-end execution flow describes how a user's intent becomes a verified outcome.

```
User
  ↓ expresses goal
Goal
  ↓ parsed into mission
Mission
  ↓ AI-powered understanding
Understanding
  ↓ task decomposition
Planning
  ↓ DAG of tasks with dependencies
Task Graph
  ↓ agent/workflow/human selection
Agent / Workflow / Human
  ↓ capabilities invoked via skills
Skills
  ↓ tool invocation with validation
Tools
  ↓ external service calls
Integrations
  ↓ actual work performed
Execution
  ↓ events, metrics, telemetry
Observation
  ↓ 10 verification types
Verification
  ↓ evidence-based decision
Success / Outcome / Repair / Replan
```

**Stage details:**

- **User → Goal**: User types a natural language intent ("Build a dashboard for Q3 sales").
- **Goal → Mission**: System creates a Mission record with extracted title, constraints, budget, and success criteria.
- **Mission → Understanding**: The goal is analyzed to identify domain, required capabilities, and complexity.
- **Understanding → Planning**: Keyword and pattern-based task decomposition generates a directed acyclic graph (DAG) of `MissionTask` records.
- **Planning → Task Graph**: Tasks are persisted with dependency arrays, agent assignments, and verification configs.
- **Task Graph → Agent/Workflow/Human**: Each task is assigned to the optimal executor based on risk level, autonomy policy, and capability matching.
- **Agent → Skills → Tools**: Agents invoke Skills (HOW), which activate Tools (WHAT), in service of the Mission (WHY).
- **Execution → Observation**: Every state transition emits an Event with correlation IDs for distributed tracing.
- **Observation → Verification**: The Verification Engine runs 10 verification types against task outputs.
- **Verification → Decision**: Passed verifications feed Outcome Engine; failures trigger Repair or Replan.

---

## 3. System Layers

Mianx.ai V3 is organized into six horizontal layers, each with clear boundaries and responsibilities.

| Layer | Responsibility | Key Components |
|-------|---------------|----------------|
| **Experience** | UI rendering, navigation, user interaction | Next.js 16, React 19, shadcn/ui, Framer Motion, Zustand stores |
| **Application Core** | API routes, request handling, DTOs, routing | Next.js API routes, api-response envelope, hash-based SPA router |
| **Intelligence** | AI orchestration, agent management, skill resolution | Agent Workforce, Mission Engine, Tool Registry, Skill System |
| **Automation** | Workflow execution, event processing, job scheduling | Workflow Engine, Event Store, Outbox pattern, Job queue |
| **Data** | Persistence, queries, transactions, schema management | Prisma v6, SQLite (dev) / PostgreSQL (prod), seed data |
| **Integration** | External service connections, API keys, webhooks | Integration model, ApiKey model, tool adapters |

---

## 4. Core Systems

### 4.1 Mission Engine

The central orchestration service. Manages the full mission lifecycle: `createMissionFromGoal` → `planMission` → `executeMission` → `verifyTask` → `completeMission`. Generates task plans via keyword-based analysis (build, analyze, deploy patterns). Tracks budget, emits correlated events, and manages task dependencies as a DAG. Handles failure via `handleTaskFailure` with error classification and max 3 retries. Supports `replanMission` for regenerating plans after repeated failures.

### 4.2 Agent Workforce

Manages agent selection, delegation, and capability resolution. `selectWorkforce` scores agents by capability overlap with mission requirements. `canDelegate` enforces that child agents only receive capabilities that are a subset of the parent's. `getAgentCapabilities` combines agent's own capabilities with tool-derived capabilities. `getAgentSuccessRate` computes completion rate from historical task assignments.

### 4.3 Skill System

Defines the WHO-HOW-WHAT-WHY paradigm for agent execution:
- **WHO** = Agent — the entity performing work
- **HOW** = Skill — the method/capability applied (stored as `Skill` records with inputs, outputs, evaluation policies)
- **WHAT** = Tool — the concrete implementation invoked (registered in the Tool Registry)
- **WHY** = Mission — the goal providing context and success criteria

Skills bridge the gap between abstract agent capabilities and concrete tool invocations.

### 4.4 Tool Runtime

Centralized registry of tool definitions (`ToolDefinition` interface) with 10 pre-registered tools: web_search, code_execute, file_read, file_write, database_query, api_call, send_notification, create_task, security_scan, deploy_service. Each tool declares an input schema, output schema, required permissions, risk level (READ/LOW_WRITE/MEDIUM_WRITE/HIGH_WRITE/CRITICAL), timeout, retry policy, and audit behavior. `validateToolInput` performs structural validation. `sanitizeToolOutput` redacts secrets and truncates large outputs (50KB limit). `requiresApproval` determines if a tool call needs human-in-the-loop based on risk level and organization autonomy policy.

### 4.5 Workflow Engine

Supports three workflow paradigms:
- **Deterministic**: Fixed-step pipelines with defined inputs/outputs per step (`WorkflowStepRun` records).
- **Adaptive**: Conditional branching based on step outputs and external signals.
- **Agentic**: LLM-driven decision making within workflow steps, with tool access.

Workflows are versioned via `definition` JSON, support manual/event triggers, and maintain full run history. Failed runs can be dead-lettered for inspection.

### 4.6 Verification Engine

Mission completion requires evidence. Supports 10 verification types defined in the `VerificationType` enum:
1. `schema_validation` — structural correctness of output
2. `test` — automated test execution
3. `typecheck` — type safety verification
4. `lint` — code quality checks
5. `build` — build success verification
6. `security` — security scan results
7. `accessibility` — a11y compliance checks
8. `business_rule` — domain-specific rule evaluation
9. `artifact_check` — artifact existence and integrity
10. `metric_threshold` — numerical metric validation

Each `Verification` record stores config, result, evidence array, and pass/fail status.

### 4.7 Repair & Replanning

When tasks fail, the system classifies errors using `FailureClassification` (14 types: validation_error, authorization_error, not_found, conflict, rate_limited, timeout, transient_external_error, permanent_external_error, ai_error, approval_timeout, policy_violation, verification_failed, budget_exceeded, unknown). Retries are capped at `maxRetries` (default 3). Critical failures (authorization, policy, budget) automatically create `WorkflowApproval` requests for human intervention. After exhausting retries, `replanMission` removes failed tasks and regenerates plans chained to the last completed task.

### 4.8 Outcome Engine

Tracks measurable mission objectives through `Outcome` records. Each outcome has: objective, baseline (starting metrics), target (desired metrics), currentResult (live metrics), progress (0-100%), confidence (0-1), and status (not_started → in_progress → near_target → achieved / missed / failed). `assessOutcomeStatus` computes progress as average fraction of distance traveled from baseline to target across all metrics. Regression below baseline triggers `missed` status.

### 4.9 Trust Center

Provides transparent execution summaries for all mission and workflow activity. Exposes the Trust Center view (`/trust-center`) showing event timelines, agent actions, verification results, and approval decisions. All data is drawn from the `Event`, `Verification`, and `WorkflowApproval` stores.

### 4.10 Autonomy Policies

Organization-scoped `AutonomyPolicy` with three levels:
- **Conservative**: HIGH_WRITE and CRITICAL tools require human approval before execution.
- **Balanced** (default): Only CRITICAL tools require human approval.
- **Autonomous**: No tool requires approval; the organization assumes all risk.

The policy is checked via `requiresApproval()` in the Tool Runtime before any tool invocation.

### 4.11 Human-in-the-Loop

Controlled via four risk levels on `WorkflowApproval` records:
- **LOW**: Read-only actions, auto-approvable in balanced/autonomous mode.
- **MEDIUM**: Write operations with limited blast radius, require approval in conservative mode.
- **HIGH**: Significant write operations (deploy, delete), always require approval.
- **CRITICAL**: Destructive or high-cost operations, always require approval with 24h expiration.

Approvals track requestedBy, approvedBy, decision, reason, and expiration.

### 4.12 Memory

Multi-scope memory system via `AgentMemory` model with 7 scopes:
- **session**: Ephemeral, single browser session
- **conversation**: Per-conversation context window
- **user**: Cross-session user preferences and history
- **organization**: Shared organizational knowledge
- **domain**: Domain-specific knowledge and patterns
- **agent**: Per-agent learned behaviors and preferences
- **operational**: System-level operational knowledge (runtime configs, learned optimizations)

Each memory record has content, metadata JSON, and optional source tracking.

### 4.13 Domain Pack System

Domain Packs are self-contained capability bundles consisting of a `Domain` (manifest, version, status) and associated `Module` records. Domains are activated per-organization via `OrganizationDomain` with configuration overrides. Modules extend domains with specific functionality. Manifest is stored as JSON (`manifest` field), enabling structured capability declarations, dependency specifications, and version compatibility requirements.

### 4.14 Country Pack System

Built into the `Organization` model with three locale fields: `timezone` (default UTC), `locale` (default en), and `currency` (default USD). These fields propagate to billing (Invoice currency), user profiles (Profile locale/timezone), and notifications. Country-specific compliance is handled at the integration layer through configurable `Integration` records per organization.

---

## 5. Multi-Tenancy

All data is organization-scoped. Every primary entity includes an `organizationId` foreign key. Tenant isolation is enforced at the application layer through:

- **Organization membership**: `OrganizationMembership` links profiles to organizations with status tracking (invited → active → suspended → removed).
- **RBAC**: 5 default roles (Owner, Admin, Member, Viewer, Billing Manager) with 27 permission keys across 8 resource categories.
- **Permission checking**: Server-side `requirePermission()` and `requireOrgMember()` guards on every API route. Permissions are resolved through Membership → MembershipRole → Role → RolePermission → Permission chain.
- **Team scoping**: Teams provide sub-organization grouping via `Team` and `TeamMember` records.

**Permission categories (27 keys):**

| Category | Permissions |
|----------|------------|
| Organization | org:view, org:manage, org:delete, org:settings, org:billing, org:members:manage |
| Agents | agent:view, agent:create, agent:update, agent:delete, agent:run |
| Missions | mission:view, mission:create, mission:update, mission:delete, mission:execute, mission:approve |
| Workflows | workflow:view, workflow:create, workflow:update, workflow:delete, workflow:run |
| Domains | domain:view, domain:manage |
| Integrations | integration:view, integration:manage |
| Audit | audit:view |
| Approvals | approval:view, approval:decide |
| Billing | billing:view, billing:manage |

---

## 6. Billing

Full billing and subscription platform with the following models:

- **Plans & Versions**: `Plan` with `PlanVersion` records supporting versioned feature sets, domain inclusions, limits, usage allowances, seat allowances, and AI allowances.
- **Subscriptions**: `Subscription` links an organization to a plan version with lifecycle management (trialing → active → past_due → grace_period → paused → cancelled → expired → suspended).
- **Entitlements**: `Entitlement` records track per-feature/per-resource access with status (enabled/disabled/limited/trial/expired/suspended) and numeric limits.
- **Usage Metering**: `UsageMeter` defines metrics (key, unit, aggregation, period). `UsageRecord` tracks consumption with idempotency keys to prevent double-counting.
- **AI Cost Tracking**: `AiCostRecord` captures per-run token counts (input/output/total), estimated and actual costs, model, and provider for granular AI spend visibility.
- **Invoices & Credits**: `Invoice` with line items, subtotal/discount/tax/total. `Credit` with promotional/bonus types, expiration, and priority-based consumption.
- **Trials**: `Trial` with duration, feature overrides, usage limits, and conversion tracking.

---

## 7. Observability

- **Event Store**: `Event` model captures all system events with eventType, eventVersion, actorType (human/ai_agent/system/integration), correlationId, causationId, and typed payload. Events are organization-scoped and optionally linked to missions and workflow runs.
- **Outbox Pattern**: `OutboxEvent` ensures reliable event publishing with pending/published/failed status, retry tracking, and scheduled availability.
- **Correlation IDs**: Every mission generates a `correlationId` that propagates through all related events, task executions, and tool calls for distributed tracing.
- **AI Telemetry**: `AiRun` captures model, provider, token counts, cost, and duration per AI invocation. `AiToolCall` tracks individual tool invocations within a run.
- **Audit Trail**: `AuditLog` records all mutating actions with before/after state snapshots, actor identification, requestId, and correlationId.
- **Cost Tracking**: Per-organization `AiCostRecord` aggregation enables real-time AI spend monitoring and budget enforcement.

---

## 8. Security

- **Deny-by-default**: All API routes require explicit permission checks. No route is accessible without an active organization membership.
- **Least privilege**: 5 roles with progressively scoped permissions. Viewers cannot mutate; Members cannot delete or manage billing.
- **Agent-as-principal**: Agents act within the permission boundary of their organization. Tool access is gated by `requiredPermissions` on each `ToolDefinition`.
- **Tool security**: 5-tier risk classification (READ → LOW_WRITE → MEDIUM_WRITE → HIGH_WRITE → CRITICAL). Higher-risk tools require human approval based on autonomy policy. Tool outputs are sanitized to redact secrets (API keys, passwords, bearer tokens, OpenAI keys, GitHub PATs, Slack tokens).
- **IDOR prevention**: Every query filters by `organizationId`. No route accepts a resource ID without verifying the caller's organization membership first.
- **Input validation**: `validateToolInput` enforces schema conformance for all tool invocations. API routes validate request bodies against DTO types.
- **Delegation bounds**: `canDelegate` ensures agents can only delegate to agents with a subset of their own capabilities.
- **Budget enforcement**: `checkMissionBudget` prevents runaway AI costs by tracking actual spend against budget limits.

---

## 9. User Modes

Mianx.ai V3 supports three user experience modes, stored per-mission via the `UserMode` enum:

- **Simple** (default): Goal-first interface. User types a goal, system handles planning, agent selection, execution, and verification. Minimal configuration exposed. Ideal for non-technical users and quick tasks.
- **Pro**: Exposes agent selection, model configuration, budget controls, and autonomy settings. Users can choose specific agents, set budgets, and adjust the autonomy level. Suitable for power users who want control without complexity.
- **Expert**: Full transparency and control. Access to the raw task graph, event timeline, execution logs, verification details, and system internals. Designed for engineers and administrators who need to debug, optimize, and audit mission execution.

The active mode is stored in the Zustand `AppState` store and can be switched at any time via `setUserMode()`.

---

## 10. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.x |
| UI Library | React | 19.x |
| Language | TypeScript | 5.x |
| Database (Dev) | SQLite | via Prisma |
| Database (Prod) | PostgreSQL | via Prisma |
| ORM | Prisma | 6.x |
| Styling | Tailwind CSS | 4.x |
| Animation | Framer Motion | 12.x |
| State Management | Zustand | 5.x |
| UI Components | shadcn/ui | Radix-based |
| Data Tables | @tanstack/react-table | 8.x |
| Data Fetching | @tanstack/react-query | 5.x |
| Forms | react-hook-form + zod | 7.x / 4.x |
| Charts | Recharts | 2.x |
| Icons | Lucide React | latest |
| Drag & Drop | @dnd-kit | 6.x / 10.x |
| Testing | Vitest | 4.x |
| Runtime | Bun | latest |
| Markdown | react-markdown | 10.x |
| Date Utilities | date-fns | 4.x |
| AI SDK | z-ai-web-dev-sdk | 0.x |
| Auth (planned) | NextAuth | 4.x |
| i18n (planned) | next-intl | 4.x |
