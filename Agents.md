# MIANX.AI — Project Guardian Agents.md

> **This file is the living constitution of the Mianx.ai codebase.**
> Every AI agent, developer, or CI pipeline that touches this project MUST read and obey these rules.
> Violation of any rule below is a CRITICAL defect that must be fixed before merging.

---

## 1. PROJECT IDENTITY

- **Name:** Mianx.ai — The Agentic AI Operating System for Modern Teams
- **Version:** 3.0.0 (V3 Architecture)
- **Framework:** Next.js 16 + React 19 + App Router
- **Language:** TypeScript 5 (strict mode)
- **Database:** Prisma 6 + SQLite (dev) / PostgreSQL (production)
- **Auth:** NextAuth v4
- **State:** Zustand 5
- **Styling:** Tailwind CSS v4 + shadcn/ui + Radix primitives
- **Testing:** Vitest 4
- **Package Manager:** Bun

---

## 2. ABSOLUTE INVARIANTS (NEVER BREAK)

### 2.1 Prisma Schema Rules

1. **`prisma/schema.prisma` MUST always pass `npx prisma validate`**
2. Every model MUST have proper `@relation` fields with correct `fields` and `references`
3. Every enum value MUST be lowercase_snake_case (e.g., `not_started`, `in_progress`)
4. JSON fields MUST use `String @default("{}")` — NEVER use unsupported function calls like `@default(for_now())` or `@default(bogus(...))`
5. Relation syntax MUST use `references: [id]` — NEVER `relations: [id]`
6. Cascade deletes MUST use `onDelete: Cascade` — NEVER Chinese characters or other keywords
7. Every model MUST have a proper `@@map("table_name")` if the table name differs from the model name
8. Run `npx prisma validate && npx prisma format` after ANY schema change
9. The `Profile` model is the user model — NEVER rename it to `User` (NextAuth compatibility)

### 2.2 TypeScript Rules

1. **`npx tsc --noEmit` MUST produce ZERO errors in `src/`** (excluding `examples/`, `skills/`)
2. NEVER use `as any` without a TODO comment explaining why
3. NEVER use `// @ts-ignore` or `// @ts-nocheck`
4. All API routes MUST use proper `RouteContext` type: `{ params: Promise<{ id: string }> }`
5. All API response bodies MUST go through `api-response.ts` helpers (`success`, `error`, `created`, `noContent`)
6. NEVER import `ApiError` type from `types.ts` into `api-response.ts` — use alias `ApiError as ApiErrorType`
7. Always use `PermissionKey[]` type for permission arrays — NEVER raw string arrays

### 2.3 API Route Rules

1. Every API route file MUST be at `src/app/api/[resource]/route.ts`
2. Dynamic segments MUST use proper bracket syntax: `[id]`, `[memberId]`, `[taskId]`
3. NEVER create directories with typos (e.g., `emberId]` instead of `[memberId]`)
4. Every route MUST use `withErrorHandler()` wrapper for consistent error handling
5. Every mutating route (POST/PUT/PATCH/DELETE) MUST call `getUserIdFromRequest()` and `requireOrgMember()`
6. Permission checks MUST use `requirePermission(userId, orgId, [Permissions.SOMETHING])`
7. Request bodies MUST be parsed with `requireBody<T>(request)` — NEVER raw `request.json()`
8. All responses MUST use the standard envelope: `{ data, request_id, meta?, error? }`

### 2.4 File Structure Rules

1. Core source code lives in `src/` ONLY
2. Library code goes in `src/lib/` — ONE file per concern, NO `-v2.ts` duplicates
3. API routes go in `src/app/api/` following REST conventions
4. Components go in `src/components/` — organized by feature
5. NEVER leave `.backup` files in the repository
6. NEVER commit `node_modules/`, `.next/`, or generated Prisma client files
7. Scripts go in `scripts/` directory

---

## 3. ARCHITECTURE RULES

### 3.1 Multi-Organization Architecture

- Every resource (Mission, Agent, Workflow, etc.) MUST have `organizationId`
- Every API MUST filter by `organizationId` — NEVER leak cross-org data
- Membership is tracked via `OrganizationMembership` with roles
- The `OrganizationMembership` has a compound unique: `@@unique([organizationId, userId])`

### 3.2 RBAC Authorization

- Permission keys are defined in `src/lib/authorization.ts` as `Permissions` constant
- Keys use format: `resource:action` (e.g., `org:view`, `agent:create`, `mission:execute`)
- The `PermissionKey` type is derived from the `Permissions` object
- Default roles: `owner`, `admin`, `member`, `viewer`, `billing`
- Owner has ALL permissions. Viewer has only VIEW permissions.
- Always use `requirePermission()` for authorization — NEVER implement custom checks

### 3.3 Mission Engine

- Missions have Tasks (with parent-child hierarchy via `TaskHierarchy` relation)
- Tasks can be assigned to Agents (via `TaskAgent` relation)
- Outcomes track measurable objectives with baseline/target/current metrics
- Verifications validate task completion (schema, test, build, security, etc.)
- WorkflowApprovals handle human-in-the-loop for risky operations

### 3.4 Domain Pack System

- Domains are industry-specific plugin packages (e.g., Healthcare, Finance)
- Organizations activate domains via `OrganizationDomain`
- Domains contain Modules, Agents, Workflows, and KnowledgeSources
- Domain activation is controlled by entitlements/billing

### 3.5 Tool Registry

- Tools are defined in `src/lib/tool-registry.ts` with `ToolDefinition` interface
- Every tool has a `riskLevel` (READ, LOW_WRITE, MEDIUM_WRITE, HIGH_WRITE, CRITICAL)
- HIGH_WRITE and CRITICAL tools require approval via `WorkflowApproval`
- Tool outputs are sanitized based on risk level
- Tools require specific permissions via `requiredPermissions: PermissionKey[]`

---

## 4. TESTING RULES

1. **ALL 487+ tests MUST pass** — run `npx vitest run` before any commit
2. Test files MUST be co-located: `src/lib/foo.test.ts` for `src/lib/foo.ts`
3. Tests MUST use Vitest (`describe`, `it`, `expect`, `vi`)
4. If a test helper needs `beforeEach`, it MUST be imported from `vitest`
5. Mock functions that accept optional params MUST declare them as optional
6. NEVER skip tests — fix the code instead

---

## 5. BUILD VERIFICATION CHECKLIST

Before ANY commit or PR, run these commands and verify ALL pass:

```bash
# 1. Prisma schema validation
npx prisma validate

# 2. TypeScript compilation (zero errors in src/)
npx tsc --noEmit 2>&1 | grep -v 'examples/\|skills/' | grep 'error TS'
# Must return EMPTY

# 3. All tests pass
npx vitest run
# Must show: "Tests X passed (X)" with ZERO failures

# 4. Next.js build
npx next build
# Must complete successfully
```

---

## 6. COMMON PITFALLS (NEVER DO THESE)

| # | Mistake | Why It Breaks | Correct Approach |
|---|---------|---------------|------------------|
| 1 | Import `ApiError` type and export `ApiError` class in same file | TS2395 merge conflict | Alias the import: `import type { ApiError as ApiErrorType }` |
| 2 | Use `body.status as any` for Prisma enum fields | Runtime type mismatch | Import enum type and cast properly: `body.status as MembershipStatus` |
| 3 | Create dynamic route dirs with typos | 404s, route not matched | Double-check bracket syntax: `[memberId]` not `emberId]` |
| 4 | Use `Object.values(Permissions)` where `PermissionKey[]` is expected | TS2322 type error | Cast explicitly or use `Object.values(Permissions) as PermissionKey[]` |
| 5 | Call `assessOutcomeStatus()` with wrong parameter shape | TS2345 type error | Pass `{ baseline, target, current }` — all `Record<string, number>` |
| 6 | Declare `const arr = []` then push typed items | TS infers `never[]` | Type explicitly: `const arr: Array<Type> = []` |
| 7 | Forget to export `parseHash` from router.ts | TS2459 module error | Mark as `export function parseHash()` |
| 8 | Use `beforeEach` in tests without importing from vitest | TS2304 not found | Add `beforeEach` to vitest import |
| 9 | Leave v1/v2 duplicate files | Confusion, dead code | Keep ONLY the current version, delete old files |
| 10 | Modify Prisma schema without running validate | Schema becomes invalid | Always run `npx prisma validate && npx prisma format` |

---

## 7. KEY FILE INDEX

| File | Purpose | Lines |
|------|---------|-------|
| `prisma/schema.prisma` | Complete database schema (42 models, 20 enums) | ~1160 |
| `src/lib/types.ts` | All TypeScript types, DTOs, utility functions | ~648 |
| `src/lib/api-response.ts` | Standard API response envelope + error classes | ~239 |
| `src/lib/authorization.ts` | RBAC permissions, role definitions, access checks | ~333 |
| `src/lib/db.ts` | Prisma client singleton | ~10 |
| `src/lib/store.ts` | Zustand global store (auth, app, org, mission, UI) | ~200 |
| `src/lib/router.ts` | Hash-based SPA client router | ~152 |
| `src/lib/mission-engine.ts` | Mission planning, task execution, completion | ~400 |
| `src/lib/outcome-engine.ts` | Outcome tracking, progress assessment | ~181 |
| `src/lib/verification-engine.ts` | Multi-type verification (schema, test, build, security) | ~696 |
| `src/lib/tool-registry.ts` | Tool definitions, risk levels, approval gating | ~300 |
| `src/lib/tool-executor.ts` | Tool execution with sanitization | ~200 |
| `src/lib/agent-workforce.ts` | Agent delegation and workforce management | ~150 |
| `src/lib/domain-pack-service.ts` | Domain Pack activation and configuration | ~200 |
| `src/lib/skill-service.ts` | Skill assignment to agents | ~100 |
| `src/lib/memory-service.ts` | Agent memory storage and retrieval | ~100 |
| `src/lib/validation.ts` | Input validation schemas (Zod) | ~248 |
| `src/lib/security.test.ts` | Security test suite (SSRF, path traversal, etc.) | ~300 |
| `src/middleware.ts` | Next.js middleware (auth, rate limiting, headers) | ~62 |
| `src/app/layout.tsx` | Root layout with providers | ~80 |
| `src/app/page.tsx` | SPA entry point with hash router | ~150 |
| `src/app/globals.css` | Global styles + Tailwind v4 | ~300 |
| `prisma/seed.ts` | Database seeder (demo org, agents, missions) | ~373 |

---

## 8. API ROUTE MAP (52 routes)

### Organizations
- `GET/POST /api/organizations`
- `GET/PATCH/DELETE /api/organizations/[id]`
- `GET/POST /api/organizations/[id]/members`
- `GET/PATCH/DELETE /api/organizations/[id]/members/[memberId]`
- `GET/POST /api/organizations/[id]/domains`

### Missions
- `GET/POST /api/missions`
- `GET/PUT/DELETE /api/missions/[id]`
- `POST /api/missions/[id]/plan`
- `POST /api/missions/[id]/execute`
- `POST /api/missions/[id]/replan`
- `GET /api/missions/[id]/progress`
- `POST /api/missions/[id]/complete`
- `GET/POST /api/missions/[id]/tasks`
- `GET/PUT/DELETE /api/missions/[id]/tasks/[taskId]`
- `POST /api/missions/[id]/tasks/[taskId]/execute`
- `POST /api/missions/[id]/tasks/[taskId]/verify`
- `GET /api/missions/[id]/verifications`

### Agents
- `GET/POST /api/agents`
- `GET/PUT/DELETE /api/agents/[id]`
- `GET/POST /api/agents/[id]/capabilities`
- `GET/POST /api/agents/[id]/delegations`
- `POST /api/agents/[id]/execute`
- `GET/PUT /api/agents/[id]/memory`

### Workflows
- `GET/POST /api/workflows`
- `GET/PUT/DELETE /api/workflows/[id]`
- `GET/POST /api/workflows/[id]/runs`
- `GET /api/workflows/runs/[runId]`

### Outcomes
- `GET/POST /api/outcomes`
- `GET/PUT /api/outcomes/[id]`

### Approvals
- `GET/POST /api/approvals`
- `PATCH /api/approvals/[id]`

### Other
- `GET /api/tools` — List available tools
- `POST /api/tools/execute` — Execute a tool (with approval gating)
- `GET/POST /api/skills` — List/assign skills
- `GET/POST /api/packs` — Domain Pack marketplace
- `POST /api/packs/[domainId]/activate` — Activate a domain pack
- `GET/POST /api/events` — Event log
- `POST /api/events/emit` — Emit domain event
- `GET /api/stats` — Dashboard statistics
- `GET /api/billing/overview` — Billing summary
- `GET /api/billing/invoices` — Invoice list
- `GET /api/billing/usage` — Usage records
- `GET/POST /api/integrations` — List/create integrations
- `GET/PUT/DELETE /api/integrations/[id]`
- `GET/PATCH /api/autonomy` — Organization autonomy policy
- `GET /api/trust` — Trust center data
- `GET /api/route` — API route discovery
- `GET /api/i18n/countries` — Country list
- `GET /api/i18n/format` — Format helpers

---

## 9. OWNER vs REGULAR USER BEHAVIOR

### Mianx.ai Owner (Full Access)
- Has `owner` role in the organization
- Can access ALL permissions including `ORG_DELETE`, `BILLING_MANAGE`
- Can manage members, roles, billing, and all resources
- Sees billing section, can change plans, view invoices
- Can approve/reject high-risk tool executions
- Can modify organization settings including dangerous operations

### Regular User (Limited Access)
- Has `member` or `viewer` role
- Can VIEW resources and CREATE missions/agents
- Cannot delete organizations, manage billing, or modify roles
- `viewer` role: read-only access to everything
- `member` role: can create and execute missions, run agents
- Permission checks in `requirePermission()` enforce these boundaries

---

## 10. PRE-COMMIT GATE

Every commit MUST satisfy:

```bash
npx prisma validate && \
npx tsc --noEmit 2>&1 | grep -c 'error TS' | xargs -I{} sh -c 'test {} -eq 0' && \
npx vitest run --reporter=verbose 2>&1 | tail -1 | grep -q 'passed' && \
echo 'ALL GATES PASSED'
```

If ANY gate fails, DO NOT COMMIT. Fix the issue first.

---

## 11. EMERGENCY RECOVERY

If the project is in a broken state:

1. Run `npx prisma validate` — if it fails, the schema is corrupted
2. Run `npx tsc --noEmit` — if errors in `src/`, fix them using this document's rules
3. Run `npx vitest run` — if tests fail, read the error and fix the source
4. Run `npx next build` — if build fails, check for missing imports or type errors
5. If all else fails, check `git log --oneline -5` and `git diff` to find what broke

---

*Last updated: 2026-08-18*
*Maintained by: Mianx.ai Engineering*
*Status: ACTIVE — This file is the single source of truth for project integrity.*