# Mianx.ai Current Security Audit

Date: 2026-08-26
PR: #3

## Verified directly

- Production Supabase project is reachable with authenticated database access.
- Migrations 001–005 are present.
- Migration 006 performance indexes were applied directly and verified.
- Production counts: User 1, Agent 24, AgentMemory 0, Notification 8, Subscription 0.
- V3 tables exist and are empty in the current production dataset.
- `_rate_limits` exists.
- Public RLS policy count is 0; public/anon/authenticated table grants are not present in the current grant query. Prisma server-side access remains the intended access path.

## Fixes applied during this audit

- Removed arbitrary `session.update()` object merging into the NextAuth JWT. Client-controlled session data can no longer overwrite `userId`, `email`, or `displayName`.
- Tool execution now verifies any supplied `agentId` belongs to the requested organization before execution/logging.
- Tool approval responses no longer return the full `requestedAction` payload.
- Production migration 006 was applied and verified.

## Remaining high-priority work

1. Make registration user + organization + RBAC seeding atomic in one transaction and eliminate slug race conditions.
2. Complete a route-by-route IDOR/tenant authorization review, especially tool/integration execution paths.
3. Design tenant-aware RLS policies if direct Supabase client access is intended; do not add generic policies blindly while Prisma uses the server role.
4. Add regression tests for JWT update tampering and cross-organization agentId rejection.
5. Complete runtime smoke tests on the current Vercel deployment after it becomes Ready.

PR #3 remains open until these gates are independently verified.