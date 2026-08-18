# V3 Migration Plan — V2 Specs to V3 Implementation

> Migrating from the V2 specification documents to the V3 implemented codebase.

---

## 1. V2 → V3 Changes

### Schema Extensions

The V3 Prisma schema introduces six new enums and five new models beyond the V2 foundation:

| New Enum | Purpose |
|----------|---------|
| `FailureClassification` | 14-type error taxonomy for repair/replan decisions |
| `VerificationType` | 10 verification types for evidence-based completion |
| `OutcomeStatus` | 6-state outcome lifecycle (not_started → achieved/missed/failed) |
| `AutonomyLevel` | 3-tier autonomy control (conservative/balanced/autonomous) |
| `UserMode` | 3 user experience tiers (simple/pro/expert) |
| `ActorType` | 4 event actor types (human/ai_agent/system/integration) |

| New Model | Purpose |
|-----------|---------|
| `Mission` + `MissionTask` + `MissionAgent` | Goal-driven execution with task graphs and agent assignment |
| `Outcome` | Measurable objective tracking with baseline/target/progress |
| `Verification` | Evidence-backed verification results per task |
| `AutonomyPolicy` | Organization-scoped autonomy configuration |
| `WorkflowApproval` | Human-in-the-loop approval requests with risk levels |

### New Service Layers

- **Mission Engine** (`src/lib/mission-engine.ts`): Full mission lifecycle — create, plan, execute, verify, replan, complete, budget check.
- **Agent Workforce** (`src/lib/agent-workforce.ts`): Agent selection by capability scoring, delegation guards, capability resolution.
- **Tool Registry** (`src/lib/tool-registry.ts`): 10-tool catalog with schema validation, risk-based approval, output sanitization.
- **Outcome Engine** (`src/lib/outcome-engine.ts`): Objective tracking, progress computation, status assessment.
- **Authorization** (`src/lib/authorization.ts`): RBAC with 27 permissions, 5 roles, server-side permission assertions.

### New API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/missions` | GET, POST | List/create missions |
| `/api/missions/[id]` | GET, PATCH, DELETE | Mission CRUD |
| `/api/missions/[id]/execute` | POST | Trigger mission execution |
| `/api/missions/[id]/tasks` | GET, POST | List/create mission tasks |
| `/api/missions/[id]/tasks/[taskId]` | GET, PATCH, DELETE | Task CRUD |
| `/api/missions/[id]/verifications` | GET, POST | Verification management |
| `/api/outcomes` | GET | List outcomes |
| `/api/outcomes/[id]` | GET, PATCH | Outcome details and progress updates |
| `/api/autonomy` | GET, PATCH | Organization autonomy policy |
| `/api/approvals` | GET | List pending approvals |
| `/api/approvals/[id]` | PATCH | Decide on approval request |
| `/api/billing/overview` | GET | Subscription and plan summary |
| `/api/billing/usage` | GET | Usage meter aggregation |
| `/api/billing/invoices` | GET | Invoice history |
| `/api/events` | GET | Event timeline query |
| `/api/trust` | GET | Trust center execution summaries |

### New Frontend Views

- `MissionDetailView`: Task graph, agent assignments, verification results, timeline
- `TrustCenterView`: Execution transparency, event logs, approval history
- `CommandCenterView`: System-wide operational overview
- `BillingView`: Subscription, usage, invoices, plan management
- `SettingsView`: User preferences, mode selection

---

## 2. Database

### RolePermission Primary Key Fix

The `RolePermission` model uses `@@unique([roleId, permissionId])` as its composite unique constraint with a `cuid()` primary key. This differs from a pure join table approach but enables direct referencing. For PostgreSQL production, this adds an `id` column alongside the unique constraint.

### New Models in Schema

All V3 models (Mission, MissionTask, MissionAgent, Outcome, Verification, AutonomyPolicy, WorkflowApproval) are already defined in `prisma/schema.prisma` and deployed to the SQLite development database via `prisma db push`.

### Production Migration

For production deployment on PostgreSQL:
1. Switch `datasource db { provider = "postgresql" }` in `schema.prisma`
2. Set `DATABASE_URL` to the PostgreSQL connection string
3. Run `prisma migrate dev --name v3_initial` to generate the migration
4. Run `prisma migrate deploy` on production
5. Run `prisma db seed` to populate initial roles, permissions, and demo data

---

## 3. Backward Compatibility

V3 is a **pure extension** of V2. All V2 specification concepts are preserved:

- **Identity & Organization**: Profile, Organization, Membership, Team — unchanged
- **Authorization**: Role, Permission, RolePermission, MembershipRole — unchanged, extended with V3 permission keys
- **Domain & Module Engine**: Domain, Module, OrganizationDomain, OrganizationModule — unchanged
- **AI Agents**: Agent, AgentTool, AgentSkill, AgentDelegation — unchanged
- **Workflows**: Workflow, WorkflowRun, WorkflowStepRun — unchanged, extended with WorkflowApproval
- **Events & Observability**: Event, OutboxEvent, AuditLog — unchanged
- **Billing**: Plan, Subscription, Entitlement, UsageRecord, Invoice, Credit, Trial — unchanged

No existing V2 API contracts are broken. New V3 routes are additive. Existing V2 frontend views remain functional.

---

## 4. Deployment Strategy

### Staged Rollout

- **Phase 1 — Core Infrastructure**: Mission Engine, Tool Registry, Authorization (current state). Schema deployed, services implemented, unit tested.
- **Phase 2 — Intelligence Layer**: Agent Workforce integration, Skill System, outcome tracking, verification engine execution.
- **Phase 3 — Automation Layer**: Workflow Engine enhancements, event-driven task scheduling, outbox publisher.
- **Phase 4 — Production Hardening**: PostgreSQL migration, NextAuth integration, real AI provider connections, monitoring dashboards.

### Feature Flags

New V3 features are gated behind organization-level `Setting` records with `scopeType: 'organization'`:
- `missions.enabled` — Enable mission engine for the organization
- `missions.expert_mode` — Enable expert mode UI
- `autonomy.custom` — Allow custom autonomy policies (vs. plan defaults)
- `billing.ai_cost_tracking` — Enable per-run AI cost recording
- `verifications.auto` — Enable automatic verification after task completion

Settings are checked at the API route level before processing V3-specific requests.