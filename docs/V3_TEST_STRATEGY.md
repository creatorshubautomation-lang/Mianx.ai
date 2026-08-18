# V3 Test Strategy

> Testing approach, current coverage, and future requirements for Mianx.ai V3.

---

## 1. Current Coverage

**398 tests across 7 test files, all passing.**

Tests run via Vitest 4.x with zero external dependencies (no test database, no mocked network). All logic is tested in isolation using pure function calls and in-memory state.

---

## 2. Test Categories

### Unit Tests (386 tests)
Pure function and module-level tests with no I/O:

- **Types** (`types.test.ts`): JSON field parsing, slugification, integer parsing with clamping, request ID generation.
- **API Response** (`api-response.test.ts`): Response envelope construction, error classes (BadRequestError, NotFoundError, ForbiddenError, ConflictError), error code mapping, status code derivation.
- **Router** (`router.test.ts`): Hash-based SPA navigation, view resolution, parameter extraction, back navigation, external link handling.
- **Tool Registry** (`tool-registry.test.ts`): Tool lookup, input validation (required fields, type checking, enum constraints), approval requirements per autonomy level, output sanitization (secret redaction, truncation).
- **Authorization** (`authorization.test.ts`): Permission key constants, role definitions, permission set correctness, role hierarchy (owner has all permissions, viewer is read-only).
- **Outcome Engine** (`outcome-engine.test.ts`): Progress computation, status transitions, regression detection, empty state handling, partial metric coverage.

### Integration Tests (12 tests)

- **Mission Engine** (`mission-engine.test.ts`): Full mission lifecycle with real Prisma database (SQLite). Tests create → plan → execute → complete flow, task dependency resolution, failure classification, replanning logic, and budget checking.

### Security Tests (embedded in unit tests)

Permission denial tests in `authorization.test.ts` verify that each role has exactly the expected permission set — no more, no less. Tool approval tests in `tool-registry.test.ts` verify risk-level enforcement per autonomy policy.

---

## 3. Testing Tools

| Tool | Purpose | Version |
|------|---------|---------|
| Vitest | Test runner, assertions, mocking | 4.x |
| Prisma (SQLite) | Integration test database | 6.x |
| TypeScript | Type-level correctness | 5.x |

No additional testing libraries are used. Assertions rely on Vitest's built-in `expect`. No test database fixtures library — the seed script (`prisma/seed.ts`) provides consistent test data.

---

## 4. Test Files and Counts

| File | Category | Tests |
|------|----------|-------|
| `src/lib/types.test.ts` | Unit | 81 |
| `src/lib/api-response.test.ts` | Unit | 78 |
| `src/lib/router.test.ts` | Unit | 55 |
| `src/lib/tool-registry.test.ts` | Unit | 54 |
| `src/lib/authorization.test.ts` | Unit | 66 |
| `src/lib/outcome-engine.test.ts` | Unit | 21 |
| `src/lib/mission-engine.test.ts` | Integration | 43 |
| **Total** | | **398** |

---

## 5. Security Test Requirements

The following security scenarios must be validated in tests. Current gaps are marked with an asterisk (*).

- **Cross-tenant access**: Verify that API routes serving organization-scoped resources reject requests from users in different organizations. Requires multi-organization test database setup.*
- **Permission denial**: Verify that each of the 27 permission keys is correctly enforced when missing. Currently tested at the role level; per-route enforcement tests are needed.*
- **Agent delegation limits**: Test `canDelegate` enforces subset constraint — a child agent with broader capabilities than its parent must be rejected. Currently untested.*
- **Tool input validation**: Verify that malformed, oversized, or schema-violating tool inputs are rejected with descriptive errors. Partially covered in `tool-registry.test.ts`.
- **Budget enforcement**: Verify that `checkMissionBudget` correctly blocks execution when actual cost exceeds budget. Partially covered in `mission-engine.test.ts`.
- **Output sanitization**: Verify that API keys, passwords, bearer tokens, and other secrets are redacted from tool outputs. Covered in `tool-registry.test.ts`.

---

## 6. Future Test Needs

### API Integration Tests
Test the full request → authorization → service → response cycle for each API route. Requires an HTTP test client (e.g., the built-in Next.js test utilities or `undici`) and a test database with seeded organizations, memberships, and roles.

Priority routes: missions CRUD, mission execute, approvals, billing overview.

### Frontend Component Tests
Test React component rendering, user interactions, and store integration. Requires a DOM testing environment (jsdom via Vitest) and component testing utilities. Priority components: MissionDetailView (task graph rendering), TrustCenterView (event timeline), BillingView (subscription state).

### End-to-End Tests
Full-stack tests that exercise the complete user journey: create organization → create mission → execute → verify → view outcome. Requires Playwright or Cypress with a running application instance. This is the lowest priority given the current phase (core logic and API).

### Property-Based Tests
For pure functions like `assessOutcomeStatus`, `classifyError`, and `sanitizeToolOutput`, property-based testing (e.g., fast-check) would provide stronger guarantees by testing edge cases that hand-written tests may miss.
