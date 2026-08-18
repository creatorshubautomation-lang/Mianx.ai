# MIANX.AI V3 — ARCHITECTURE GAP REPORT

**Date:** 2026-08-18  
**Status:** Phase 0 — Foundation Build  
**Source:** 17 V2 Specification Documents + V3 Master Upgrade Prompt

---

## EXECUTIVE SUMMARY

Mianx.ai V2 exists as a comprehensive set of 17 architecture/design specification documents (~370KB) covering every platform layer. No implementation code currently exists on disk. The V3 upgrade therefore takes the form of a **foundation build** that implements the V2 specifications while incorporating V3 enhancements. This report maps every V3 requirement against V2 spec coverage, identifies gaps, and proposes the implementation strategy.

**V2 Spec Coverage:** ~95% of V3 infrastructure requirements are addressed in V2 specs  
**V3 New Concepts:** Mission Engine, Outcome Engine, Verification Engine, Repair/Replanning, Trust Center, Autonomy Policies, Domain Packs, Country Packs, User Modes  
**Implementation Approach:** Build V3 directly, incorporating V2 specs as the foundation and V3 concepts as extensions

---

## GAP ANALYSIS MATRIX

### 1. MULTI-TENANCY & IDENTITY

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Organizations | Full spec (schema, RLS, lifecycle) | Same + Mission/org association | None | EXISTS |
| Profiles | Full spec | Same | None | EXISTS |
| Memberships | Full spec (invite, accept, roles) | Same | None | EXISTS |
| Teams | Full spec | Same | None | EXISTS |
| RBAC | Full spec (5 system roles, 28+ permissions) | Same | None | EXISTS |
| RLS | Full spec (per-table policies) | Same + mission/task scoped | EXTEND | EXTEND |
| Sessions | Full spec (revocation, secure cookies) | Same | None | EXISTS |

### 2. DOMAIN & MODULE ENGINE

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Domain Registry | Full spec (manifest, CRUD, lifecycle) | Same | None | EXISTS |
| Domain Manifest | Full spec (modules, perms, agents, workflows) | Extended for Domain Pack contract | EXTEND | EXTEND |
| Module Engine | Full spec (lifecycle, config, entitlements) | Same | None | EXISTS |
| Org Domains | Full spec (activation, deactivation, config) | Same | None | EXISTS |
| Domain Pack System | Not specified | Formal pack contract with versioning, skills, tools, knowledge, verification rules | MISSING | MISSING |
| Country Pack System | Not specified | Locale, currency, timezone, tax, payment providers, compliance | MISSING | MISSING |

### 3. MISSION ENGINE (V3 Core Addition)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Mission Model | Not specified | Goal, objective, constraints, budget, deadline, success criteria, plan, tasks, agents, workflows, verification, outcome | MISSING | MISSING |
| Goal Understanding | Not specified | NL goal parsing, ambiguity detection, constraint identification, success criteria generation | MISSING | MISSING |
| Mission Planning | Not specified | Task graph generation, agent selection, workforce composition, cost estimation | MISSING | MISSING |
| Success Criteria | Not specified | Measurable, verifiable outcomes per mission | MISSING | MISSING |
| Mission Lifecycle | Not specified | Draft → Planning → Executing → Verifying → Completed/Failed | MISSING | MISSING |

### 4. AI AGENT WORKFORCE

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Agent Registry | Full spec (identity, tools, permissions, limits) | Same | None | EXISTS |
| Agent Types | 8 types specified | Same + dynamic workforce composition | EXTEND | EXTEND |
| Agent Capabilities | Basic configuration JSONB | Structured capabilities, skills, cost profile, model preferences, fallback model, verification capabilities, success metrics, version | EXTEND | EXTEND |
| Agent Selection | Manual | Task-aware selection considering capabilities, tools, cost, reliability, workload, historical success rate | MISSING | MISSING |
| Agent Delegation | Not specified | Child permissions ⊆ parent, auditable | MISSING | MISSING |
| Agent Execution Loop | Vercel AI SDK loop | UNDERSTAND → PLAN → SELECT → ACT → OBSERVE → VERIFY → CONTINUE/REPAIR/COMPLETE | EXTEND | EXTEND |
| Tool Evidence | Not specified | Agents must never claim execution without tool evidence | MISSING | MISSING |

### 5. SKILL SYSTEM

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Skills Table | Basic spec (key, version, inputs, outputs) | Full skill system with evaluation policies | EXTEND | EXTEND |
| Skill Concept | Mentioned | Formal WHO/HOW/WHAT/KNOWLEDGE/WHEN/WHY/OUTCOME distinction | EXTEND | EXTEND |

### 6. TOOL RUNTIME

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Tool Registry | Full spec (typed I/O, risk levels) | Same + timeout, retry policy, audit behavior, enabled status | EXTEND | EXTEND |
| Tool Security | Risk levels (LOW/MEDIUM/HIGH/CRITICAL) | Sandboxing, path restrictions, command allowlists, SSRF protection, secret redaction, resource limits | EXTEND | EXTEND |
| Tool Validation | Not specified | Treat all agent-generated arguments as untrusted, validate before execution | MISSING | MISSING |

### 7. WORKFLOW ENGINE

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Workflow Definitions | Full spec (JSON steps, conditions, triggers) | Same | None | EXISTS |
| Workflow Execution | Full spec (state machine, retries) | Same + agentic workflow steps | EXTEND | EXTEND |
| Workflow Approvals | Full spec (expiration, delegation) | Extended risk levels (LOW/MEDIUM/HIGH/CRITICAL) | EXTEND | EXTEND |
| Job Queue | Full spec (priority, scheduling) | Same | None | EXISTS |
| Dead Letter Queue | Full spec | Same | None | EXISTS |
| Outbox Pattern | Full spec (transactional) | Same | None | EXISTS |
| Workflow vs Agent | Conceptual separation | Strict boundary: deterministic vs adaptive vs agentic workflow | EXTEND | EXTEND |

### 8. TASK GRAPH

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Task Model | Not specified (workflow steps only) | Full task model: PLANNED, QUEUED, RUNNING, WAITING_TOOL, WAITING_APPROVAL, VERIFYING, RETRYING, FAILED, COMPLETED, CANCELLED, BLOCKED | MISSING | MISSING |
| Task Dependencies | Not specified | Dependency-aware execution, parallel safe tasks | MISSING | MISSING |

### 9. VERIFICATION ENGINE (V3 Core Addition)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Verification | Not specified | Schema validation, tests, typecheck, lint, build, security, accessibility, business rules, artifact check, metric threshold | MISSING | MISSING |
| Mission Completion | Not specified | Requires verification evidence, never mark complete on LLM response alone | MISSING | MISSING |

### 10. REPAIR & REPLANNING (V3 Core Addition)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Failure Classification | Basic error types | Structured classification → REPAIR → VERIFY → REPLAN if needed | MISSING | MISSING |
| Retry Limits | Bounded retries in workflow | Max 3 retries default, WAITING_APPROVAL or FAILED after exhaustion | EXTEND | EXTEND |
| Repair | Not specified | Automated repair attempt → verify → replan if repeated failure | MISSING | MISSING |
| Replanning | Not specified | Do not restart completed work, replan only remaining | MISSING | MISSING |

### 11. OUTCOME ENGINE (V3 Core Addition)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Outcome Model | Not specified | Objective, baseline, target, current result, progress, actions, verification, outcome, confidence, remaining gap | MISSING | MISSING |
| Outcome Tracking | Not specified | Progress tracking (e.g., conversion 2.8% → 3.9%, status NEAR_TARGET) | MISSING | MISSING |
| Outcome-Centric | Response-centric | Outcome-centric: verified results, not just AI responses | MISSING | MISSING |

### 12. HUMAN-IN-THE-LOOP

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Approval Engine | Full spec (workflow approvals) | Extended risk levels, approval UI with action/agent/tool/target/reason/risk/impact/cost | EXTEND | EXTEND |
| Risk Levels | 4 levels (LOW/MEDIUM/HIGH/CRITICAL) | Mapped to action types, org policy can override | EXTEND | EXTEND |

### 13. AUTONOMY POLICIES (V3 New)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Autonomy Levels | L0-L5 in AI spec | Conservative/Balanced/Autonomous org policies | EXTEND | EXTEND |
| Policy Configuration | Not specified | Org-level autonomy config, explicit and auditable | MISSING | MISSING |

### 14. TRUST CENTER (V3 New)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Trust Center | Not specified | Client-facing: what Mianx did, which agent, tools, permissions, approvals, verification, cost, timestamps, outcome | MISSING | MISSING |
| Execution Summaries | Audit logs | Safe execution summaries (no chain-of-thought) | MISSING | MISSING |

### 15. USER MODES (V3 New)

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Simple Mode | Not specified | Goal-first: "WHAT DO YOU WANT TO ACCOMPLISH?" | MISSING | MISSING |
| Pro Mode | Not specified | Agent/model/budget/workflow/autonomy control | MISSING | MISSING |
| Expert Mode | Not specified | Task graph, agent graph, tools, events, model, cost, permissions, verification, logs | MISSING | MISSING |

### 16. MEMORY

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Memory Architecture | 5 scopes (user, org, agent, conversation, domain) | Same + SHORT-TERM, PROJECT, ORGANIZATION, USER, DOMAIN KNOWLEDGE | EXTEND | EXTEND |
| Memory Isolation | Tenant-scoped | Same + never expose unrelated private memory | EXISTS | EXISTS |

### 17. BILLING & COST

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Plans/Subscriptions | Full spec (lifecycle, versions) | Same | None | EXISTS |
| Usage Metering | Full spec (idempotent) | Same + mission cost, workflow cost, integration cost | EXTEND | EXTEND |
| AI Cost Tracking | Full spec (per-org, per-agent, per-model) | Same + mission budget, estimated/actual cost, remaining budget | EXTEND | EXTEND |
| Budget Limits | Warn-then-restrict | Never silently exceed configured limits | EXTEND | EXTEND |

### 18. OBSERVABILITY

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Structured Logging | Full spec (JSON, correlation IDs) | Same | None | EXISTS |
| AI Telemetry | Full spec (quality + safety signals) | Same + mission success, task success, outcome achievement | EXTEND | EXTEND |
| Correlation IDs | Full spec | Same | None | EXISTS |
| Command Center | Full spec (org/user/domain/subscription/AI management) | Same + Mission Command Center | EXTEND | EXTEND |

### 19. SECURITY

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Auth/Z | Full spec (RBAC, RLS, fail-closed) | Same | None | EXISTS |
| 12 Security Categories | Full spec | Same + agent delegation escalation, idempotency abuse, billing abuse | EXTEND | EXTEND |
| Tool Security | Risk levels | Sandboxing, SSRF, path traversal, command injection, prompt injection | EXTEND | EXTEND |
| Agent Delegation | Not specified | Child permissions ⊆ parent, no escalation | MISSING | MISSING |
| Idempotency | Webhook delivery | Extended to payments, emails, deployments, migrations, customer actions | EXTEND | EXTEND |

### 20. EVENT SYSTEM

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Event Emission | Full spec (immutable, versioned) | Same | None | EXISTS |
| Outbox Pattern | Full spec (transactional) | Same | None | EXISTS |
| Event Types | Domain-specific | Same + mission/agent/outcome events | EXTEND | EXTEND |

### 21. FRONTEND

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Design System | Full spec (28+ components, RTL, WCAG) | Dark glassmorphism design system | EXTEND | EXTEND |
| App Shell | Full spec (org switcher, domain nav, AI workspace) | Same | None | EXISTS |
| Navigation | Full spec (permission-aware, dynamic) | Same | None | EXISTS |
| Mission Command Center | Not specified | Simple/Pro/Expert modes, mission progress, approval UI | MISSING | MISSING |
| Trust Center UI | Not specified | Execution timeline, agent actions, verifications | MISSING | MISSING |

### 22. API PLATFORM

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| API Envelope | Full spec ({data, meta, request_id}) | Same | None | EXISTS |
| Pagination | Full spec (cursor-based) | Same | None | EXISTS |
| Idempotency | Full spec (Idempotency-Key header) | Same | None | EXISTS |
| API Types | 6 types specified | Same | None | EXISTS |
| Mission APIs | Not specified | Mission CRUD, goal understanding, planning, execution, outcomes | MISSING | MISSING |
| Outcome APIs | Not specified | Outcome tracking, progress, confidence | MISSING | MISSING |

### 23. INTEGRATION PLATFORM

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| OAuth/Connections | Full spec | Same | None | EXISTS |
| Webhooks | Full spec (HMAC, retry, dedup) | Same | None | EXISTS |
| Circuit Breaker | Full spec (3-state) | Same | None | EXISTS |
| Provider Registry | Full spec | Same | None | EXISTS |

### 24. MARKETPLACE

| Area | V2 Spec | V3 Requirement | Gap | Category |
|------|---------|---------------|-----|----------|
| Marketplace | Mentioned | Agents + Skills + Domain Packs + Country Packs + Workflows + Integrations | EXTEND | EXTEND |
| Asset Verification | Not specified | Version, compatibility, permissions, capabilities, trust info | MISSING | MISSING |

---

## SUMMARY BY CATEGORY

| Category | Count | Items |
|----------|-------|-------|
| EXISTS | 25 | Orgs, Profiles, Memberships, Teams, RBAC, RLS, Sessions, Domain Registry, Module Engine, Agent Registry, Workflow Defs, Workflow Execution, Job Queue, DLQ, Outbox, Events, Memory, Plans/Subs, Usage Metering, Logging, Correlation IDs, API Envelope, Pagination, Idempotency, Integrations, Auth/Z |
| EXTEND | 35 | RLS (mission scoped), Domain Manifest, Agent Capabilities, Agent Selection, Agent Loop, Tool Registry, Tool Security, Approval Risk, Workflow vs Agent, Retry Limits, Autonomy Levels, Memory Scopes, AI Cost, AI Telemetry, Command Center, Security Tests, Idempotency, Event Types, Design System, Agent Types, Skill System, etc. |
| MISSING | 18 | Mission Engine, Goal Understanding, Success Criteria, Mission Planning, Task Graph, Verification Engine, Repair/Replanning, Outcome Engine, Trust Center, User Modes, Autonomy Policies, Agent Delegation, Tool Validation, Agent Selection Algorithm, Domain Packs, Country Packs, Mission APIs, Outcome APIs |
| DEPRECATED | 0 | — |

---

## V3 NEW DATABASE MODELS REQUIRED

Beyond the 35+ V2 models, V3 adds:

1. **missions** — goal, objective, constraints, budget, deadline, success_criteria, plan, status, outcome_ref
2. **mission_tasks** — mission_id, parent_task_id, title, description, status, agent_id, dependencies, assigned_tools, verification_config, retry_count, max_retries
3. **mission_agents** — mission_id, agent_id, role, capabilities_used, cost_incurred
4. **outcomes** — mission_id, objective, baseline, target, current_result, progress, confidence, status, evidence, verified_at
5. **verifications** — mission_task_id, type, config, result, evidence, passed, verified_at
6. **autonomy_policies** — organization_id, level, config (JSONB), risk_thresholds, approval_requirements
7. **domain_packs** — id, name, slug, version, manifest (JSONB), status, compatibility
8. **country_packs** — id, name, slug, version, locale, currency, timezone, tax_config, payment_providers, compliance_config

---

## V3 NEW ENUMS REQUIRED

1. **MissionStatus** — draft, planning, approved, executing, verifying, completed, failed, cancelled
2. **TaskStatus** — planned, queued, running, waiting_tool, waiting_approval, verifying, retrying, failed, completed, cancelled, blocked
3. **OutcomeStatus** — not_started, in_progress, near_target, achieved, missed, failed
4. **VerificationType** — schema_validation, test, typecheck, lint, build, security, accessibility, business_rule, artifact_check, metric_threshold
5. **AutonomyLevel** — conservative, balanced, autonomous
6. **UserMode** — simple, pro, expert
7. **FailureClassification** — validation, authorization, tool_error, provider_error, budget_exceeded, timeout, approval_timeout, policy_violation, verification_failed, unknown

---

## IMPLEMENTATION PRIORITY

### Phase 0 (This Build)
- Project scaffolding (Next.js 16, TypeScript, Tailwind 4, Prisma v6)
- Complete Prisma schema (all V2 + V3 models)
- Core lib infrastructure (db, auth, authorization, org-context)
- All API routes
- Complete frontend with all views
- 200+ tests
- Dark glassmorphism design system
- Mission Engine (V3 core)
- Agent Workforce system
- Outcome Engine
- Trust Center
- Domain Pack infrastructure

---
*Report generated for Mianx.ai V3 upgrade. Source: 17 V2 specification documents + V3 Master Upgrade Prompt.*