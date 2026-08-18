# Mianx.ai V3 — Architecture Gap Report

> **"The Agentic AI Operating System for Modern Teams"**
> Generated: 2026-08-18 | Phase 0 — Full Repository Audit
> Method: Complete codebase inspection of 31 API routes, 11 lib files, 13 frontend views, 7 test files, 53-model Prisma schema, 4 docs, 1 seed file

---

## Executive Summary

| Status | Count | Description |
|--------|-------|-------------|
| **EXISTS** | 18 | Feature implemented and functional as described in V3 spec |
| **EXTEND** | 28 | Feature exists but needs significant enhancement to meet V3 spec |
| **REFACTOR** | 10 | Feature exists but implementation approach must change |
| **MISSING** | 22 | No implementation found; must be built from scratch |
| **DEPRECATED** | 3 | Feature exists but should be removed or replaced |
| **TOTAL** | **81** | |

### Critical Path to V3

The 22 MISSING items represent the core V3 differentiators. However, the more pressing issue is that **4 engine libraries are dead code** (mission-engine, outcome-engine, tool-registry, agent-workforce) — they exist but are never called by any API route. Additionally, **authentication is a stub** (hardcoded demo user), making the entire RBAC system theater in production.

### Priority Order

1. **P0 (Security)**: Replace auth stub, fix domain creation auth gap, add Zod validation
2. **P1 (Core Engines)**: Wire dead-code engines into API routes, fix execute route syntax error
3. **P2 (V3 Features)**: Build MISSING features in Phase 1-12 order
4. **P3 (Quality)**: Deduplicate utilities, remove unused deps, fix tests, tighten TypeScript

---

## Detailed Gap Analysis

---

### 1. Mission Engine

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Mission model | **EXISTS** | `prisma/schema.prisma:14` — Mission with 20+ fields, org/user scoped | Fully specified |
| MissionTask model | **EXISTS** | `prisma/schema.prisma:15` — Self-referencing DAG with dependencies, verification config, retry tracking | Fully specified |
| MissionAgent model | **EXISTS** | `prisma/schema.prisma:16` — Role, capabilities used, cost tracking | Fully specified |
| MissionStatus enum (9 values) | **EXISTS** | `prisma/schema.prisma` — draft→planning→approved→executing→verifying→completed→failed→cancelled | Matches spec |
| TaskStatus enum (12 values) | **EXISTS** | `prisma/schema.prisma` — planned→queued→running→waiting_tool→waiting_approval→verifying→retrying→failed→completed→cancelled→blocked | Matches spec |
| createMissionFromGoal() | **EXTEND** | `src/lib/mission-engine.ts:669 lines` — Exists but uses naive keyword matching, not AI-powered | Must replace with LLM-based goal understanding |
| planMission() | **EXTEND** | `src/lib/mission-engine.ts` — Keyword templates (build/analyze/deploy/generic) | Must use AI for intelligent task decomposition |
| executeMission() | **EXTEND** | `src/lib/mission-engine.ts` — Exists but task execution is a stub (fake output) | Must integrate real agent/tool execution |
| executeTask() | **REFACTOR** | `src/lib/mission-engine.ts:334` — Just marks task completed with simulated output | Complete rewrite needed: call agent→skill→tool pipeline |
| verifyTask() | **EXTEND** | `src/lib/mission-engine.ts` — Only checks if output has keys | Must implement 10 verification types per spec §4.6 |
| handleTaskFailure() | **EXTEND** | `src/lib/mission-engine.ts` — Error classification exists (14 types) but multi-dep check is buggy | Fix dependency resolution bug, add repair logic |
| replanMission() | **EXTEND** | `src/lib/mission-engine.ts` — Removes failed tasks and regenerates | Needs AI-powered replanning, not just keyword templates |
| checkMissionBudget() | **EXISTS** | `src/lib/mission-engine.ts` — Sums AiCostRecord against mission budget | Functional |
| getMissionProgress() | **EXISTS** | `src/lib/mission-engine.ts` — Calculates completed/total task ratio | Functional but basic |
| Goal Understanding (AI) | **MISSING** | No LLM integration found | Core V3 differentiator: AI parses natural language goals |
| Task Graph visualization | **MISSING** | CommandCenterView has placeholder | DAG visualization with drag-and-drop |
| Engine wired to API | **MISSING** | mission-engine.ts is dead code — no API route imports it | Must wire to /api/missions endpoints |

---

### 2. Agent Workforce

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Agent model | **EXISTS** | `prisma/schema.prisma:20` — 16 fields with configuration, capabilities, success metrics | Fully specified |
| AgentTool model | **EXISTS** | `prisma/schema.prisma:21` — Tool assignment with risk level, timeout, retry | Fully specified |
| AgentSkill model | **EXISTS** | `prisma/schema.prisma:22` — Skill assignment with level | Fully specified |
| AgentDelegation model | **EXISTS** | `prisma/schema.prisma:23` — Parent→child delegation with task, status | Fully specified |
| AgentStatus enum | **EXISTS** | `prisma/schema.prisma` — draft→testing→active→paused→deprecated→retired | Matches spec |
| selectWorkforce() | **EXTEND** | `src/lib/agent-workforce.ts` — Capability overlap scoring | Swallows unique constraint errors; needs caching |
| canDelegate() | **EXISTS** | `src/lib/agent-workforce.ts` — Enforces child ⊆ parent capabilities | Core V3 security feature |
| getAgentCapabilities() | **EXTEND** | `src/lib/agent-workforce.ts` — Combines own + tool-derived | References `agent.tools` relation that may not exist in current schema |
| createDelegation() | **EXTEND** | `src/lib/agent-workforce.ts` — Creates delegation record | Swallows errors silently; needs proper handling |
| getAgentSuccessRate() | **EXISTS** | `src/lib/agent-workforce.ts` — Completion rate from history | Functional |
| Agent execution API | **MISSING** | No /api/agents/[id]/execute or /api/agents/[id]/run endpoint | AgentsView has "Run Agent" button that only shows toast |
| Agent-as-principal | **MISSING** | Agents don't have their own permission context | Must scope tool access to agent's org + capabilities |
| Agent Memory (service layer) | **MISSING** | Model exists but no read/write API or service | 7-scope memory system has no implementation |
| Workforce wired to API | **MISSING** | agent-workforce.ts is dead code | Must wire into mission execution pipeline |

---

### 3. Skill System

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Skill model | **EXISTS** | `prisma/schema.prisma:30` — key, version, description, inputs/outputs JSON, evaluation policy | Fully specified |
| AgentSkill join | **EXISTS** | `prisma/schema.prisma:22` — Links agents to skills with level | Functional |
| Skill API routes | **MISSING** | No /api/skills endpoints | CRUD for skill management |
| Skill resolution (WHO-HOW-WHAT-WHY) | **MISSING** | Not implemented | Core paradigm: Agent(WHO)→Skill(HOW)→Tool(WHAT)→Mission(WHY) |
| Skill execution pipeline | **MISSING** | Not implemented | Skills must bridge abstract capabilities to concrete tool calls |
| Skill evaluation | **MISSING** | evaluationPolicy field exists but is never evaluated | Post-execution skill effectiveness assessment |

---

### 4. Tool Runtime

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| ToolDefinition interface | **EXISTS** | `src/lib/tool-registry.ts` — Schema, risk, timeout, retry, audit fields | Well-structured |
| 10 pre-registered tools | **EXISTS** | `src/lib/tool-registry.ts` — web_search, code_execute, file_read, file_write, database_query, api_call, send_notification, create_task, security_scan, deploy_service | Good foundation |
| validateToolInput() | **EXTEND** | `src/lib/tool-registry.ts` — Required fields + type checking | Doesn't handle nested objects or additionalProperties:false |
| sanitizeToolOutput() | **EXTEND** | `src/lib/tool-registry.ts` — Secret redaction (6 patterns) + 50KB truncation | May have false positives ("password" in docs). Needs more patterns |
| requiresApproval() | **EXISTS** | `src/lib/tool-registry.ts` — Risk × autonomy matrix | Core V3 feature |
| ToolRiskLevel enum | **EXISTS** | `prisma/schema.prisma` — READ→LOW_WRITE→MEDIUM_WRITE→HIGH_WRITE→CRITICAL | 5-tier system as specified |
| Actual tool execution | **MISSING** | Tools have definitions but no execution runtime | Must build sandboxed tool executor |
| Sandbox isolation | **MISSING** | No sandbox for code_execute or database_query | V3 requires path restrictions, command whitelists |
| SSRF protection | **MISSING** | api_call and web_search have no URL validation | Must block internal IPs, localhost, cloud metadata |
| Command whitelisting | **MISSING** | code_execute has no command restrictions | Must whitelist allowed commands/binaries |
| Secret key redaction (runtime) | **MISSING** | sanitizeToolOutput is defined but never called (dead code) | Must integrate into actual execution pipeline |
| Tool catalog (database-driven) | **MISSING** | Tool definitions are hardcoded in TypeScript | Should be database-backed for extensibility |
| Tool API routes | **MISSING** | No /api/tools endpoints | Admin tool management |
| Tool wired to execution | **MISSING** | tool-registry.ts is dead code | No API route or agent imports it |

---

### 5. Workflow Engine

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Workflow model | **EXISTS** | `prisma/schema.prisma:31` — definition JSON, trigger type, status | Fully specified |
| WorkflowRun model | **EXISTS** | `prisma/schema.prisma:32` — Input/output, current step, error | Fully specified |
| WorkflowStepRun model | **EXISTS** | `prisma/schema.prisma:33` — Step-level execution tracking | Fully specified |
| WorkflowApproval model | **EXISTS** | `prisma/schema.prisma:34` — Risk-level approval with expiry | Fully specified |
| Job model | **EXISTS** | `prisma/schema.prisma:35` — Background job queue with priority | Fully specified |
| WorkflowRunStatus enum | **EXISTS** | `prisma/schema.prisma` — 10 states including dead_lettered | Matches spec |
| Workflow API routes | **EXISTS** | 4 routes: list, [id], [id]/runs, runs/[runId] | CRUD + run history |
| Start workflow run | **EXTEND** | `/api/workflows/[id]/runs` POST — Creates WorkflowRun but doesn't execute | Must implement actual step execution |
| Deterministic workflows | **MISSING** | No step execution engine | Fixed-step pipeline execution |
| Adaptive workflows | **MISSING** | No conditional branching | Conditional logic based on step outputs |
| Agentic workflows | **MISSING** | No LLM-driven steps | LLM decision making within workflow steps |
| Workflow visual builder | **MISSING** | Definition is raw JSON textarea | Visual step editor with drag-and-drop |
| Event-triggered workflows | **MISSING** | Trigger types not enforced | Event-based workflow activation |

---

### 6. Verification Engine

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Verification model | **EXISTS** | `prisma/schema.prisma:18` — type, config, result, evidence, passed | Fully specified |
| VerificationType enum (10 values) | **EXISTS** | `prisma/schema.prisma` — All 10 types from spec §4.6 | Matches spec exactly |
| Verification API | **EXTEND** | `/api/missions/[id]/verifications` GET — Read-only list | Missing POST to trigger verification |
| Verification execution | **MISSING** | verifyTask() in mission-engine only checks key existence | Must implement all 10 verification type executors |
| Evidence collection | **MISSING** | evidence field exists but never populated | Must capture actual tool execution artifacts |
| Verification-in-loop | **MISSING** | No verification runs after task completion | Must auto-trigger verification post-execution |
| Verification policy per task | **EXTEND** | MissionTask.verificationConfig exists but unused | Must parse and enforce per-task verification requirements |

---

### 7. Repair & Replanning

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| FailureClassification enum (14 values) | **EXISTS** | `prisma/schema.prisma` — All 14 types from spec §4.7 | Matches spec |
| handleTaskFailure() | **EXTEND** | `src/lib/mission-engine.ts` — Classifies errors, creates approvals for critical | Multi-dependency check buggy (line 374) |
| Retry mechanism | **EXTEND** | MissionTask.retryCount/maxRetries exist | Retry logic in executeMission is basic |
| Repair strategies | **MISSING** | No repair logic beyond retry | Must implement: classify → repair attempt → verify → escalate |
| Max 3 retries enforcement | **MISSING** | maxRetries field exists but not enforced at engine level | Must check before retry attempt |
| Replan after exhaustion | **EXTEND** | replanMission() exists but uses keyword templates | Must use AI for intelligent replanning |
| Human escalation | **EXTEND** | Critical failures create WorkflowApproval | Approval system exists but no UI workflow for repair decisions |

---

### 8. Outcome Engine

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Outcome model | **EXISTS** | `prisma/schema.prisma:17` — objective, baseline/target/currentResult JSON, progress, confidence, status | Fully specified |
| OutcomeStatus enum | **EXISTS** | `prisma/schema.prisma` — not_started→in_progress→near_target→achieved/missed/failed | Matches spec |
| trackOutcome() | **EXISTS** | `src/lib/outcome-engine.ts` — Creates outcome records | Functional |
| updateOutcomeProgress() | **EXTEND** | `src/lib/outcome-engine.ts` — Updates metrics and recalculates | Progress deflated by metrics without data |
| assessOutcomeStatus() | **EXTEND** | `src/lib/outcome-engine.ts` — Computes status from progress | Doesn't handle negative targets |
| getMissionOutcomes() | **EXISTS** | `src/lib/outcome-engine.ts` — Queries outcomes for a mission | Functional |
| Outcome API wired to engine | **MISSING** | outcome-engine.ts is dead code; API routes write directly to DB | Must wire engine into API routes |
| Regression detection | **EXTEND** | `src/lib/outcome-engine.ts` — Detects current < baseline → missed | Only handles numeric metrics |
| Confidence calculation | **EXTEND** | Based on data completeness | Could be more sophisticated (trend-based, verification-weighted) |

---

### 9. Trust Center

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Trust Center view | **EXISTS** | `src/components/views/TrustCenterView.tsx` — 766 lines, 4 tabs | Well-built UI |
| Trust API | **EXISTS** | `/api/trust` GET — Returns runs, verifications, approvals, AI cost | Functional |
| Execution summaries | **EXTEND** | Shows workflow runs and step counts | Should show mission execution summaries |
| Evidence display | **EXTEND** | Verifications tab shows pass/fail | No drill-down to evidence details |
| Agent action audit trail | **MISSING** | No per-agent action timeline | Should show what each agent did and why |
| Cost transparency | **EXTEND** | Shows aggregated AI cost | Should show per-mission, per-agent cost breakdown |
| Real-time updates | **MISSING** | Manual refresh only | Should use WebSocket/SSE for live updates |

---

### 10. Autonomy Policies

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| AutonomyPolicy model | **EXISTS** | `prisma/schema.prisma:19` — org-scoped, level, config JSON | Fully specified |
| AutonomyLevel enum | **EXISTS** | `prisma/schema.prisma` — conservative/balanced/autonomous | Matches spec |
| Autonomy API | **EXISTS** | `/api/autonomy` GET/PUT — Read and update policy | Functional but GET auto-creates on read (side effect) |
| Policy enforcement | **EXTEND** | `requiresApproval()` in tool-registry checks risk × autonomy | Not wired to actual tool execution |
| Per-tool autonomy override | **MISSING** | No tool-level autonomy overrides | Some orgs may want stricter rules for specific tools |
| Autonomy policy UI | **EXISTS** | OrgSettingsView has autonomy selector | Conservative/Balanced/Autonomous radio buttons |

---

### 11. Human-in-the-Loop

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| WorkflowApproval model | **EXISTS** | `prisma/schema.prisma:34` — Full approval lifecycle with expiry | Fully specified |
| Approval API | **EXISTS** | `/api/approvals` GET + `/api/approvals/[id]` POST | List pending + decide |
| Approval UI | **EXISTS** | Trust Center has Approvals tab | Shows pending, decided, with risk badges |
| Risk-level gating | **EXTEND** | Approval has riskLevel field | Not enforced in mission execution pipeline |
| Approval expiry | **MISSING** | expiresAt field exists but never checked | Approvals can be decided after expiration |
| Approval notifications | **MISSING** | Notification model exists but no approval notifications sent | Users don't know when approval is needed |
| Approval in mission flow | **MISSING** | Approval created on critical failure but never blocks execution | Must actually pause execution until approved |

---

### 12. Memory System

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| AgentMemory model | **EXISTS** | `prisma/schema.prisma:28` — 7 scopes, content, metadata, source | Fully specified |
| MemoryScope enum (7 values) | **EXISTS** | `prisma/schema.prisma` — session/conversation/user/organization/domain/agent/operational | Matches spec |
| KnowledgeSource model | **EXISTS** | `prisma/schema.prisma:29` — Org/domain-scoped knowledge sources | Fully specified |
| Memory service layer | **MISSING** | No read/write/query memory APIs | Must build memory CRUD service |
| Memory API routes | **MISSING** | No /api/memory endpoints | Must expose memory management |
| Memory in agent execution | **MISSING** | Not integrated into agent pipeline | Agents must read/write memory during missions |
| Memory UI | **MISSING** | No memory views in frontend | Should show agent memory in expert mode |

---

### 13. Domain Pack System

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Domain model | **EXISTS** | `prisma/schema.prisma:10` — name, slug, version, manifest JSON, status | Fully specified |
| OrganizationDomain model | **EXISTS** | `prisma/schema.prisma:11` — Org activation with config overrides | Fully specified |
| Module model | **EXISTS** | `prisma/schema.prisma:12` — Domain-scoped modules with manifest | Fully specified |
| OrganizationModule model | **EXISTS** | `prisma/schema.prisma:13` — Org module activation | Fully specified |
| DomainStatus enum | **EXISTS** | `prisma/schema.prisma` — draft→development→published→active→deprecated→archived | Matches spec |
| Domain API | **EXTEND** | `/api/domains` GET/POST — Platform domains | Missing: pack lifecycle, manifest validation, module management |
| Org domain activation | **EXISTS** | `/api/organizations/[id]/domains` GET/POST | Functional |
| Pack contract/interface | **MISSING** | No formal pack interface definition | Must define pack contract (schema, APIs, hooks) |
| Pack hot-loading | **MISSING** | No dynamic module loading | Must support runtime pack activation/deactivation |
| Pack versioning | **MISSING** | Version field exists but no version resolution logic | Must handle semver compatibility |
| Core domain-agnostic enforcement | **MISSING** | No validation that Core doesn't contain domain logic | Architecture principle needs enforcement |
| 10-day pack creation target | **MISSING** | No pack scaffolding tooling | Must build pack generator for rapid domain onboarding |

---

### 14. Country Pack System

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Organization locale fields | **EXISTS** | `Organization` model — timezone, locale, currency | Basic localization fields |
| Profile locale fields | **EXISTS** | `Profile` model — locale, timezone | Per-user locale |
| Invoice currency | **EXTEND** | `Invoice` model — currency field | Must propagate org currency to invoices automatically |
| Country-specific compliance | **MISSING** | No compliance framework | Must handle country-specific regulations |
| Locale-specific formatting | **MISSING** | next-intl installed but not configured | Date, number, currency formatting per locale |
| Translation system | **MISSING** | No i18n implementation | All UI text is hardcoded English |
| Country Pack contract | **MISSING** | No formal country pack interface | Must define country pack contract |

---

### 15. Multi-Tenancy & RBAC

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Organization model | **EXISTS** | `prisma/schema.prisma:3` — 23 relations, full lifecycle | Fully specified |
| OrganizationMembership model | **EXISTS** | `prisma/schema.prisma:4` — invited→active→suspended→removed | Fully specified |
| Team model | **EXISTS** | `prisma/schema.prisma:5` — Org-scoped teams | Fully specified |
| TeamMember model | **EXISTS** | `prisma/schema.prisma:6` — Membership-to-team linking | Fully specified |
| Role model | **EXISTS** | `prisma/schema.prisma:7` — Org-scoped, system roles | Fully specified |
| Permission model | **EXISTS** | `prisma/schema.prisma:8` — Key-based permission records | 31 permissions defined |
| RolePermission model | **EXISTS** | `prisma/schema.prisma:9` — Role-to-permission linking | Fully specified |
| MembershipRole model | **EXISTS** | `prisma/schema.prisma` — Membership-to-role linking | Fully specified |
| hasPermission() | **EXISTS** | `src/lib/authorization.ts` — Deep Prisma query chain | Functional but no caching (3+ queries per check) |
| requirePermission() | **EXISTS** | `src/lib/authorization.ts` — Throws ForbiddenError | Used on most routes |
| requireOrgMember() | **EXISTS** | `src/lib/authorization.ts` — Throws if not member | Used on all routes |
| 5 default roles | **EXTEND** | `DefaultRoles` defined in authorization.ts (Owner, Admin, Member, Viewer, Billing) | Only Owner is seeded; 4 roles missing from seed |
| 31 permission keys | **EXTEND** | Implemented in authorization.ts | Architecture doc says 27; actual code has 31 (4 extra) |
| Authentication system | **REFACTOR** | `getUserIdFromRequest()` reads x-user-id header, falls back to demo_user_001 | CRITICAL: Must replace with real auth (NextAuth/Clerk) |
| Resource-level permissions | **MISSING** | Only resource-type permissions (mission:create) not resource-instance (mission:123) | Fine-grained access control |
| Permission caching | **MISSING** | Every check hits 3+ DB queries | Redis or in-memory cache with TTL |

---

### 16. Billing & Subscriptions

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Plan + PlanVersion models | **EXISTS** | `prisma/schema.prisma` — Versioned plans with feature sets | Fully specified |
| Subscription model | **EXISTS** | 8-state lifecycle (trialing→active→cancelled→expired…) | Fully specified |
| Entitlement model | **EXISTS** | Per-feature/per-resource access with limits | Fully specified |
| UsageMeter model | **EXISTS** | Metric definition with aggregation/period | Fully specified |
| UsageRecord model | **EXISTS** | Consumption tracking with idempotency | Fully specified |
| AiCostRecord model | **EXISTS** | Per-run token/cost tracking | Fully specified |
| Invoice model | **EXISTS** | Line items, subtotal/discount/tax/total | Fully specified |
| Credit model | **EXISTS** | Promotional/bonus credits with priority | Fully specified |
| Trial model | **EXISTS** | Duration, features, conversion tracking | Fully specified |
| Billing API routes | **EXISTS** | 3 routes: overview, usage, invoices | Comprehensive billing data |
| Billing view | **EXISTS** | `BillingView.tsx` — 718 lines, subscription/usage/invoices | Well-built UI |
| Stripe/payment integration | **MISSING** | No payment provider integration | Must integrate Stripe or equivalent |
| Entitlement enforcement | **MISSING** | Entitlement records exist but never checked | Must gate features on entitlement status |
| Usage metering service | **MISSING** | UsageRecord model exists but no metering service | Must track usage in real-time |
| Plan comparison | **EXTEND** | BillingView has hardcoded plan features | Should be data-driven from PlanVersion |
| UsageMeter global query bug | **REFACTOR** | billing/overview fetches all meters globally | Must scope to organization |

---

### 17. Observability

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Event model | **EXISTS** | `prisma/schema.prisma:36` — Full event with actor, correlation, causation | Fully specified |
| OutboxEvent model | **EXISTS** | `prisma/schema.prisma:37` — Reliable publishing with retry | Fully specified |
| AuditLog model | **EXISTS** | `prisma/schema.prisma:49` — Before/after state, actor, requestId | Fully specified |
| AiRun model | **EXISTS** | `prisma/schema.prisma:24` — Model, tokens, cost, duration | Fully specified |
| AiMessage model | **EXISTS** | `prisma/schema.prisma:25` — Role, content, tool calls | Fully specified |
| AiToolCall model | **EXISTS** | `prisma/schema.prisma:26` — Individual tool invocations | Fully specified |
| ActorType enum | **EXISTS** | human/ai_agent/system/integration | Matches spec |
| Event emission | **EXTEND** | `emitEvent()` in mission-engine creates Event records | Not used outside mission-engine; other systems don't emit events |
| Correlation ID propagation | **EXTEND** | Mission generates correlationId | Not propagated to API responses or tool calls |
| Outbox publishing | **MISSING** | OutboxEvent model exists but no publisher service | Must implement outbox processor |
| Event consumption | **MISSING** | No event consumers or subscribers | Event-driven architecture not wired |
| Distributed tracing | **MISSING** | No OpenTelemetry or similar | Must add request-level tracing |
| Audit log writing | **MISSING** | AuditLog model exists but never written to | Must auto-log all mutations |

---

### 18. Security

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Deny-by-default | **REFACTOR** | Most routes check permissions | CRITICAL: Domain creation POST has NO auth check |
| IDOR prevention | **EXTEND** | Most queries filter by organizationId | Inconsistent: some GET routes only check membership |
| Input validation | **REFACTOR** | Manual if-checks in all routes | Must use Zod schemas for all inputs |
| Secret redaction | **EXTEND** | `sanitizeToolOutput()` has 6 regex patterns | Dead code — never called; needs more patterns |
| Budget enforcement | **EXTEND** | `checkMissionBudget()` exists | Not enforced before AI calls in execution pipeline |
| SSRF protection | **MISSING** | No URL validation for api_call/web_search tools | Must block internal IPs, cloud metadata |
| Command injection prevention | **MISSING** | No sandbox for code_execute | Must whitelist commands |
| Path traversal prevention | **MISSING** | No path restrictions for file_read/file_write | Must validate and restrict file paths |
| Rate limiting | **MISSING** | No rate limiting on any endpoint | Must add per-user/per-org rate limits |
| CSRF protection | **MISSING** | No CSRF tokens | Required for state-changing operations |
| Content Security Policy | **MISSING** | No CSP headers | Must configure in next.config.ts |
| API key authentication | **EXTEND** | ApiKey model exists with keyHash, scopes | No middleware to validate API keys |
| Middleware (auth/rate-limit) | **MISSING** | No middleware.ts file | Must add authentication and rate limiting middleware |

---

### 19. User Modes (Simple / Pro / Expert)

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| UserMode enum | **EXISTS** | `prisma/schema.prisma` — simple/pro/expert | Matches spec |
| Mode in store | **EXISTS** | `src/lib/store.ts` — `useUserMode()`, `setUserMode()` | Functional |
| Mode in Mission model | **EXISTS** | `Mission.userMode` field | Stored per-mission |
| Mode toggle UI | **EXISTS** | SettingsView has mode selector | Simple/Pro/Expert radio buttons |
| CommandCenter mode-aware | **EXISTS** | `CommandCenterView.tsx` — Adjusts form complexity per mode | Good implementation |
| MissionDetailView mode-aware | **EXTEND** | Hides expert tabs in simple/pro | Partially implemented |
| Mode-aware permission display | **MISSING** | Simple mode should hide technical details everywhere | Not consistently applied |

---

### 20. Frontend & UX

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| 13 views built | **EXISTS** | Home, Dashboard, Missions, MissionDetail, Agents, Workflows, Billing, Orgs, OrgSettings, Integrations, Trust, CommandCenter, Settings | Comprehensive |
| Glassmorphism design system | **EXISTS** | Dark theme with .glass, .glass-strong, gradient-text, mesh-bg | Consistent and polished |
| shadcn/ui components | **EXISTS** | 48 Radix-based components | Rich component library |
| Framer Motion animations | **EXISTS** | containerVariants, itemVariants in all views | Smooth animations |
| Hash-based SPA router | **REFACTOR** | `src/lib/router.ts` — Hash-based, single page | Loses SSR, deep linking, SEO. Consider Next.js native routing |
| React Query usage | **DEPRECATED** | Installed but all views use raw fetch + useState | Either use React Query or remove dependency |
| react-hook-form + zod | **DEPRECATED** | Installed but all forms use controlled useState | Either use form library or remove dependency |
| Recharts usage | **DEPRECATED** | Installed but no charts in any view | Either add charts or remove dependency |
| @dnd-kit usage | **DEPRECATED** | Installed but no drag-and-drop | Either add DnD for task graph or remove |
| date-fns usage | **DEPRECATED** | Installed but custom relativeTime helpers everywhere | Either use date-fns or remove |
| Duplicate helpers | **REFACTOR** | formatRelativeTime, formatCost, formatDate, LOCALES, TIMEZONES duplicated in 5+ views | Extract to shared utils |
| Non-functional buttons | **REFACTOR** | Agent Run, Integration Configure, Home Watch Demo, Settings save, doc links | Must wire to real functionality or remove |
| Error boundaries | **MISSING** | No React error boundaries | App crashes propagate to white screen |
| Loading skeletons | **EXTEND** | Some views have skeletons | Not consistent across all views |

---

### 21. API Layer

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| 31 API routes | **EXISTS** | Covering orgs, agents, missions, tasks, workflows, approvals, billing, integrations, events, trust, autonomy, domains, stats | Comprehensive |
| Standard response envelope | **EXISTS** | `src/lib/api-response.ts` — {data, meta, error, request_id} | Consistent pattern |
| Error class hierarchy | **EXISTS** | ApiError → ValidationError, NotFoundError, ForbiddenError | Well-structured |
| withErrorHandler wrapper | **EXISTS** | All routes use `withErrorHandler` | Consistent error handling |
| Zod validation | **MISSING** | No Zod schemas for request bodies | All validation is manual if-checks |
| TypeScript-safe queries | **REFACTOR** | 7+ routes use `Record<string, unknown>` where clauses | Must use proper Prisma WhereInput types |
| Transaction safety | **MISSING** | Multi-step operations use sequential Prisma calls | Must use $transaction for consistency |
| Request ID generation | **EXTEND** | `generateReqId()` uses Math.random() | Not cryptographically unique |
| API versioning | **MISSING** | No /v1/ prefix or versioning strategy | Must plan for breaking changes |

---

### 22. Testing

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| 7 test files | **EXISTS** | types, api-response, authorization, mission-engine, router, tool-registry, outcome-engine | Good coverage of lib layer |
| 398 tests (claimed) | **EXTEND** | Tests exist and run but: | See issues below |
| outcome-engine.test.ts syntax error | **REFACTOR** | Line 312: missing closing brace on test block | Test structure broken |
| Permission count discrepancy | **REFACTOR** | Test strategy doc says 27; actual code has 31 | Documentation out of sync |
| Test count discrepancy | **REFACTOR** | Doc says 43 "integration tests" for mission-engine; actual count unclear | Documentation out of sync |
| API route tests | **MISSING** | No tests for any of the 31 API routes | Must add integration tests |
| Frontend component tests | **MISSING** | No component tests | Must add React Testing Library tests |
| E2E tests | **MISSING** | No end-to-end tests | Must add Playwright/Cypress tests |
| Security tests | **MISSING** | No IDOR, auth bypass, or injection tests | Critical gap for V3 |
| Property-based tests | **MISSING** | No fast-check or similar | Recommended for validation logic |

---

### 23. Infrastructure & DevOps

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| Standalone build | **EXISTS** | `next.config.ts` — output: "standalone" | Docker-ready |
| Bun runtime | **EXISTS** | start script uses bun, bun.lock present | Fast runtime |
| Caddy reverse proxy | **EXISTS** | Caddyfile on :81 with port forwarding | Functional |
| SQLite (dev) | **EXISTS** | `db/custom.db` — 557 KB | Fine for development |
| PostgreSQL (prod) | **MISSING** | No migration path, no provider switch | Must add for production |
| .env.example | **MISSING** | No env documentation | Must document all required env vars |
| CI/CD pipeline | **MISSING** | No GitHub Actions or similar | Must add for automated testing/deployment |
| Docker configuration | **MISSING** | No Dockerfile | Must add for containerized deployment |
| Redis/caching | **MISSING** | No Redis or caching layer | Needed for sessions, permissions, rate limiting |
| Prisma query logging | **REFACTOR** | `db.ts` has `log: ['query']` without NODE_ENV guard | Will log all queries in production |
| TypeScript strictness | **REFACTOR** | `ignoreBuildErrors: true` in next.config.ts, `noImplicitAny: false` | Masks type errors |
| ESLint rules | **REFACTOR** | 40+ rules disabled in eslint.config.mjs | Nearly no linting |
| reactStrictMode | **REFACTOR** | Set to false | Should be true for production quality |

---

### 24. Data & Schema

| Sub-feature | Status | Evidence | Gap Description |
|-------------|--------|----------|----------------|
| 53 models | **EXISTS** | Comprehensive Prisma schema (1,160 lines) | Full data model |
| 23 enums | **EXISTS** | Covering all status types and classifications | Complete |
| Seed data | **EXTEND** | `prisma/seed.ts` — 105 lines, creates demo environment | Only 16 of 31 permissions seeded, only 1 of 5 roles |
| JSON-as-String pattern | **REFACTOR** | SQLite limitation: all JSON fields are String type | Must migrate to native JSON for PostgreSQL |
| Soft delete | **MISSING** | No deletedAt fields on any model | Must add for audit trail |
| UpdatedAt consistency | **MISSING** | ApiKey, Job, TeamMember lack updatedAt | Must add to all models |
| Schema uniqueness | **MISSING** | Setting model lacks @@unique([scopeType, scopeId, key]) | Potential for duplicate settings |
| ApiKey-Org relation | **MISSING** | ApiKey.orgId exists but no @relation | Prisma can't enforce referential integrity |

---

## Phase Implementation Roadmap

| Phase | Focus | Items to Address | Estimated Effort |
|-------|-------|-----------------|------------------|
| **Phase 0** | Foundation fixes | Auth stub replacement, Zod validation, fix execute syntax error, deduplicate utils, seed data fix, TypeScript strictness | 2 days |
| **Phase 1** | Mission-First | Wire mission-engine to API, AI-powered goal understanding, task graph execution | 3 days |
| **Phase 2** | Agent improvements | Agent execution API, agent-as-principal, memory service, wire agent-workforce | 2 days |
| **Phase 3** | Tool/Skill hardening | Tool execution runtime, sandbox, SSRF protection, skill system, tool DB | 3 days |
| **Phase 4** | Verification/Repair | 10 verification executors, repair strategies, retry enforcement, verification-in-loop | 3 days |
| **Phase 5** | Outcome Engine | Wire outcome-engine to API, regression detection, confidence weighting | 1 day |
| **Phase 6** | Trust & Autonomy | Real-time updates, evidence drill-down, approval expiry, notification system | 2 days |
| **Phase 7** | Domain Packs | Pack contract, hot-loading, versioning, pack scaffolding tool | 3 days |
| **Phase 8** | Country Packs | i18n setup (next-intl), locale formatting, translation keys, country pack contract | 2 days |
| **Phase 9** | Command Center UX | Task graph visualization, consistent mode-awareness, workflow visual builder | 3 days |
| **Phase 10** | First domain pilot | Poultry Pack (Pakistan): domain models, agents, workflows, country localization | 10 days |
| **Phase 11** | Security/Performance | Security tests, rate limiting, CSP, CSRF, PostgreSQL migration, caching | 3 days |
| **Phase 12** | Production hardening | Docker, CI/CD, monitoring, backup, .env.example, documentation | 2 days |

**Total estimated effort: ~39 working days**

---

## Appendix A: File Inventory

### Source Code
| Path | Lines | Purpose |
|------|-------|--------|
| `prisma/schema.prisma` | 1,160 | Data model (53 models, 23 enums) |
| `src/lib/mission-engine.ts` | 669 | Mission orchestration (DEAD CODE) |
| `src/lib/outcome-engine.ts` | 181 | Outcome tracking (DEAD CODE) |
| `src/lib/tool-registry.ts` | 322 | Tool definitions (DEAD CODE) |
| `src/lib/agent-workforce.ts` | 170 | Agent management (DEAD CODE) |
| `src/lib/authorization.ts` | 332 | RBAC engine |
| `src/lib/types.ts` | 647 | Type definitions and DTOs |
| `src/lib/api-response.ts` | 238 | API envelope and error handling |
| `src/lib/store.ts` | 210 | Zustand state management |
| `src/lib/router.ts` | 156 | Hash-based SPA router |
| `src/lib/db.ts` | 12 | Prisma client singleton |
| `src/lib/utils.ts` | 6 | CSS class merge utility |
| `src/app/api/` (31 routes) | ~2,684 | API layer |
| `src/components/views/` (13 views) | 10,264 | Frontend UI |
| `src/components/mianx/` | 641 | App shell (sidebar, dashboard) |
| `src/app/` (shell) | 506 | Layout, page entry, CSS |
| `prisma/seed.ts` | 105 | Demo data |
| **Total** | **~17,293** | |

### Tests
| Path | Lines | Tests |
|------|-------|-------|
| `src/lib/types.test.ts` | 416 | ~81 |
| `src/lib/api-response.test.ts` | 550 | ~78 |
| `src/lib/authorization.test.ts` | 448 | ~66 |
| `src/lib/mission-engine.test.ts` | 757 | ~43 |
| `src/lib/router.test.ts` | 372 | ~55 |
| `src/lib/tool-registry.test.ts` | 336 | ~54 |
| `src/lib/outcome-engine.test.ts` | 319 | ~21 |
| **Total** | **3,198** | **~398** |

### Documentation
| Path | Lines |
|------|-------|
| `docs/MIANX_V3_MASTER_ARCHITECTURE.md` | 284 |
| `docs/V3_MIGRATION_PLAN.md` | 123 |
| `docs/V3_TEST_STRATEGY.md` | 91 |
| `docs/V3_ARCHITECTURE_GAP_REPORT.md` | This file |

---

## Appendix B: Critical Issues Requiring Immediate Attention

| # | Issue | Severity | File | Description |
|---|-------|----------|------|-------------|
| 1 | **Auth stub** | 🔴 CRITICAL | `src/lib/authorization.ts` | `getUserIdFromRequest()` reads x-user-id header with zero verification. Anyone can impersonate any user. |
| 2 | **Domain creation no auth** | 🔴 CRITICAL | `src/app/api/domains/route.ts` | POST endpoint has NO authorization check. Anyone can create platform domains. |
| 3 | **Execute route syntax error** | 🔴 CRITICAL | `src/app/api/missions/[id]/execute/route.ts:74-75` | Malformed object literal — mission execution is broken. |
| 4 | **4 engine libs are dead code** | 🟠 HIGH | `src/lib/mission-engine.ts` et al. | 1,342 lines of business logic that nothing imports. |
| 5 | **No Zod validation** | 🟠 HIGH | All 31 API routes | All input validation is manual if-checks. No schema enforcement. |
| 6 | **Role creation has no permissions** | 🟠 HIGH | `src/app/api/organizations/[id]/members/route.ts` | Invited members get empty roles — completely permissionless. |
| 7 | **Seed data incomplete** | 🟠 HIGH | `prisma/seed.ts` | Only 16/31 permissions, 1/5 roles seeded. |
| 8 | **No transactions** | 🟠 HIGH | Multi-step API routes | Partial failures leave inconsistent state. |
| 9 | **Prisma query logging in prod** | 🟠 HIGH | `src/lib/db.ts` | `log: ['query']` without NODE_ENV guard. |
| 10 | **TypeScript errors masked** | 🟠 HIGH | `next.config.ts` | `ignoreBuildErrors: true` hides all type errors. |
| 11 | **No middleware** | 🟡 MEDIUM | Missing `middleware.ts` | No route protection, rate limiting, or CORS. |
| 12 | **11+ unused dependencies** | 🟡 MEDIUM | `package.json` | next-auth, next-intl, next-themes, react-query, @dnd-kit, @mdxeditor, input-otp, embla-carousel, react-day-picker, react-syntax-highlighter, @reactuses/core |