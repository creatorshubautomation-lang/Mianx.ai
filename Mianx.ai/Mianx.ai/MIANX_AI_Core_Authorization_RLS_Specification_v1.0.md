# MIANX.AI CORE --- AUTHORIZATION & RLS SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Authorization & Row-Level Security Specification\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Security Principle:** Authentication proves identity; authorization
proves what that identity may access.

------------------------------------------------------------------------

# 1. Purpose

This document defines the authorization model for Mianx.ai Core.

It covers:

-   Authentication vs authorization
-   Organization membership
-   Roles
-   Permissions
-   Resource ownership
-   RLS
-   AI agent authorization
-   Background/system access
-   Service-role boundaries
-   Security testing
-   Cross-tenant isolation

This document is the security bridge between the Database & Tenancy
Specification and production migrations.

------------------------------------------------------------------------

# 2. Security Constitution

Mianx.ai follows these rules:

1.  **Every protected action requires authorization.**
2.  **Tenant isolation is enforced at the database boundary.**
3.  **Frontend checks are UX controls, not security controls.**
4.  **`authenticated` does not mean authorized.**
5.  **AI agents are principals and must have explicit permissions.**
6.  **Service-role access is privileged and never belongs in public
    clients.**
7.  **Authorization data must not come from user-editable metadata.**
8.  **Every security-sensitive mutation must be auditable.**
9.  **RLS policies must be tested as real security controls.**
10. **Cross-tenant access must fail closed.**

------------------------------------------------------------------------

# 3. Authentication vs Authorization

``` text
Authentication
    ↓
Who are you?
    ↓
Authorization
    ↓
What may you do?
    ↓
Resource ownership
    ↓
Which exact data may you access?
```

Example:

A logged-in user may be authenticated but still have no permission to
delete a flock.

------------------------------------------------------------------------

# 4. Authorization Context

Every protected request should resolve:

``` text
actor
organization
roles
permissions
resource
action
```

Conceptually:

``` text
Request
 ↓
Authenticated Identity
 ↓
Active Organization
 ↓
Membership
 ↓
Roles
 ↓
Permissions
 ↓
Resource Ownership
 ↓
Action
```

------------------------------------------------------------------------

# 5. Organization Membership

The primary organization authorization check is membership.

Conceptual rule:

``` text
user → active membership → organization
```

A user must have an active membership to access organization-owned
resources.

Possible membership states:

``` text
invited
active
suspended
removed
```

Only `active` membership grants normal organization access.

------------------------------------------------------------------------

# 6. Roles

Roles are collections of permissions.

Examples:

``` text
Owner
Admin
Manager
Staff
Viewer
AI Operator
```

Roles can be:

-   System-defined
-   Organization-defined

A custom organization role must remain inside its organization.

------------------------------------------------------------------------

# 7. Permission Model

Permission format:

``` text
<domain>.<resource>.<action>
```

Examples:

``` text
organization.view
organization.update

user.view
user.invite

poultry.flock.view
poultry.flock.create
poultry.flock.update
poultry.flock.delete

finance.report.view
finance.report.export
```

Permission keys should remain stable even if UI labels change.

------------------------------------------------------------------------

# 8. Permission Actions

Recommended baseline actions:

``` text
view
create
update
delete
manage
approve
export
execute
configure
```

Not every resource needs every action.

------------------------------------------------------------------------

# 9. Effective Permission

A principal's effective permission is determined by:

``` text
Active Membership
      +
Assigned Role
      +
Role Permission
      +
Resource Scope
```

No role assignment means no permission.

Default behavior is deny.

------------------------------------------------------------------------

# 10. Resource Ownership

A tenant-owned resource should resolve to an organization.

Preferred pattern:

``` text
resource.organization_id
```

For nested resources:

``` text
flock
 ↓
farm
 ↓
organization
```

The authorization system must verify the complete ownership path.

Do not assume that because a user can access a farm, they can access
every globally referenced resource.

------------------------------------------------------------------------

# 11. RLS Core Principle

For tenant-owned tables:

``` text
authenticated user
        ↓
active organization membership
        ↓
row.organization_id
```

The RLS policy should allow the row only when the membership check
succeeds.

------------------------------------------------------------------------

# 12. RLS Policy Structure

Conceptual SELECT policy:

``` sql
CREATE POLICY "organization members can read"
ON some_table
FOR SELECT
TO authenticated
USING (
  user_has_org_access((select auth.uid()), organization_id)
);
```

This is illustrative architecture, not final production SQL.

------------------------------------------------------------------------

# 13. UPDATE Security

An UPDATE must protect both:

``` text
USING
+
WITH CHECK
```

Conceptually:

``` sql
USING (
  user_has_org_access((select auth.uid()), organization_id)
)
WITH CHECK (
  user_has_org_access((select auth.uid()), organization_id)
)
```

This prevents a permitted user from moving a row into another
organization.

------------------------------------------------------------------------

# 14. INSERT Security

For tenant-owned inserts:

``` text
authenticated user
      ↓
authorized organization
      ↓
new row.organization_id
```

The policy must validate that the user is allowed to insert into the
specified organization.

Never trust a client-provided `organization_id` without authorization
validation.

------------------------------------------------------------------------

# 15. DELETE Security

Delete requires:

``` text
active membership
+
required permission
+
resource ownership
```

High-value business data should generally prefer controlled
archive/deactivation workflows over unrestricted deletes.

------------------------------------------------------------------------

# 16. Role Permission Enforcement

Application layer:

``` text
requirePermission(
  actor,
  organization,
  "poultry.flock.update"
)
```

Database layer:

``` text
RLS
 ↓
organization boundary
```

Both layers can exist.

The application layer gives clear business authorization errors.

The database layer provides defense in depth.

------------------------------------------------------------------------

# 17. RLS and Business Permissions

RLS should primarily establish **who can reach which tenant rows**.

Fine-grained business permissions can be enforced through:

``` text
Application authorization
+
carefully designed database authorization helpers
```

Do not duplicate a huge business permission engine inside every RLS
expression.

Keep policy logic understandable and testable.

------------------------------------------------------------------------

# 18. AI Agents as Principals

AI agents must be treated as controlled actors.

``` text
AI Agent
   ↓
Organization
   ↓
Roles / Permissions
   ↓
Tools
   ↓
Resources
```

An agent cannot automatically inherit Owner/Admin privileges.

------------------------------------------------------------------------

# 19. AI Tool Authorization

Every AI tool execution must verify:

``` text
agent identity
organization
requested tool
required permission
target resource
```

Example:

``` text
Poultry Farm Agent
      ↓
get_flock_metrics
      ↓
poultry.flock.view
      ↓
Organization A
      ↓
Flock 123
```

If authorization fails:

``` text
DENY
AUDIT
RETURN SAFE ERROR
```

------------------------------------------------------------------------

# 20. AI Write Operations

AI writes are more sensitive than reads.

Examples:

``` text
create purchase
approve payment
update flock
send message
delete record
```

Use explicit permissions.

For high-risk actions, support:

``` text
AI proposes
   ↓
Human approval
   ↓
Execution
```

------------------------------------------------------------------------

# 21. Agent-to-Agent Access

Agents should not automatically inherit permissions from another agent.

Example:

``` text
Farm Manager Agent
Finance Agent
Sales Agent
```

Each has its own authorization boundary.

An agent may call another agent only through an explicitly permitted
capability.

------------------------------------------------------------------------

# 22. Cross-Domain Authorization

If an organization has:

``` text
Poultry
Restaurant
Retail
```

a Poultry agent should not automatically access Restaurant data.

Required:

``` text
Agent
 ↓
Domain permission
 ↓
Resource permission
 ↓
Organization ownership
```

------------------------------------------------------------------------

# 23. System and Background Jobs

Background processes are privileged actors.

Examples:

``` text
Workflow Worker
Cron Job
Queue Consumer
Integration Worker
```

They must have narrowly defined capabilities.

Do not give every worker unrestricted database access.

------------------------------------------------------------------------

# 24. Service Role Boundary

The Supabase service role / secret key is privileged.

Rules:

-   Never expose it in browser code.
-   Never put it in `NEXT_PUBLIC_*` variables.
-   Never send it to an AI model.
-   Never store it in client-visible configuration.
-   Use it only in trusted server-side execution where necessary.

Prefer normal authenticated/RLS access when privileged bypass is not
required.

------------------------------------------------------------------------

# 25. SECURITY DEFINER

`SECURITY DEFINER` functions must not be used as a shortcut around RLS.

If genuinely required:

-   Keep the function out of exposed schemas where possible.
-   Explicitly verify the caller.
-   Restrict execute privileges.
-   Minimize the function's authority.
-   Review it as security-sensitive code.

Default preference:

``` text
SECURITY INVOKER
```

------------------------------------------------------------------------

# 26. JWT and Metadata

Do not use user-editable metadata as authorization truth.

Unsafe pattern:

``` text
user_metadata.role
```

Authorization truth should come from controlled server/database
structures.

JWT claims can become stale, so sensitive authorization should not
assume claims are instantly refreshed after every permission change.

------------------------------------------------------------------------

# 27. Views

Views must be reviewed as security boundaries.

Where supported, use invoker-security semantics for exposed views.

Do not assume a view automatically inherits the same RLS behavior as a
base table.

Every exposed view must have a deliberate access design.

------------------------------------------------------------------------

# 28. Storage Authorization

File access must follow the same organization boundary as database
records.

Recommended conceptual path:

``` text
organizations/{organization_id}/files/{file_id}
```

The storage policy must verify the caller's organization access.

File metadata and object storage permissions must agree.

------------------------------------------------------------------------

# 29. Authorization Helper

The system should have a small, well-tested authorization primitive
conceptually equivalent to:

``` text
user_has_org_access(user_id, organization_id)
```

It should answer:

``` text
Is this identity an active member of this organization?
```

More advanced helpers may answer:

``` text
has_permission(user, organization, permission)
has_resource_access(user, resource)
```

These should remain deterministic, narrow and easy to test.

------------------------------------------------------------------------

# 30. Security Matrix

  Actor             Tenant access   Business permissions   AI permissions
  --------------- --------------- ---------------------- ----------------
  Owner                       Yes                  Broad         Optional
  Admin                       Yes             Configured         Optional
  Manager                     Yes             Configured         Optional
  Staff                       Yes                Limited         Optional
  Viewer                      Yes              Read-only         No write
  AI Agent                    Yes               Explicit         Explicit
  System Worker            Scoped               Explicit              N/A
  Integration              Scoped               Explicit              N/A

Default:

**Deny unless explicitly granted.**

------------------------------------------------------------------------

# 31. Security Test Matrix

## Test 1 --- Cross-tenant SELECT

``` text
User A → Organization B row
Expected: DENY
```

## Test 2 --- Cross-tenant UPDATE

``` text
User A → update Organization B row
Expected: DENY
```

## Test 3 --- Organization reassignment

``` text
User A → change row.organization_id to Organization B
Expected: DENY
```

## Test 4 --- Permission denial

``` text
Viewer → delete flock
Expected: DENY
```

## Test 5 --- AI denial

``` text
Poultry Agent → finance.payments.read
Expected: DENY
```

## Test 6 --- Agent cross-tenant retrieval

``` text
Agent A → retrieve Organization B knowledge
Expected: DENY
```

## Test 7 --- Suspended membership

``` text
Suspended user → organization data
Expected: DENY
```

## Test 8 --- Removed membership

``` text
Removed user → organization data
Expected: DENY
```

------------------------------------------------------------------------

# 32. Fail-Closed Principle

If authorization information is missing:

``` text
NO MEMBERSHIP → DENY
NO PERMISSION → DENY
NO ORGANIZATION → DENY
UNKNOWN RESOURCE OWNER → DENY
UNKNOWN AGENT SCOPE → DENY
```

Never turn an authorization uncertainty into an allow.

------------------------------------------------------------------------

# 33. Audit Requirements

Security-sensitive actions should generate audit records:

``` text
login/security event
permission change
role change
organization membership change
AI tool execution
AI write
data export
integration action
privileged operation
```

For AI:

``` text
actor_type = ai_agent
actor_id = agent_id
```

------------------------------------------------------------------------

# 34. Authorization Change Lifecycle

When a role/permission changes:

``` text
Change
 ↓
Persist
 ↓
Audit
 ↓
Invalidate/refresh relevant access context
 ↓
Test
```

Do not assume an already-issued token immediately contains every new
authorization state.

------------------------------------------------------------------------

# 35. RLS Performance Rules

RLS is a security boundary and must also remain performant.

Use:

-   Indexed organization foreign keys
-   Indexed membership lookup columns
-   Efficient helper functions
-   Avoid repeated expensive subqueries
-   Query-plan testing
-   Realistic test data

Security and performance must be designed together.

------------------------------------------------------------------------

# 36. Security Review Checklist

Before a table is production-ready:

``` text
□ Owner identified
□ organization_id path identified
□ SELECT policy defined
□ INSERT policy defined
□ UPDATE USING defined
□ UPDATE WITH CHECK defined
□ DELETE policy defined
□ Indexes reviewed
□ Role/permission model reviewed
□ Cross-tenant test added
□ Audit requirement reviewed
□ AI access reviewed
□ Service-role access reviewed
```

------------------------------------------------------------------------

# 37. Authorization Definition of Done

Mianx Core authorization is ready when:

``` text
✓ Membership access works
✓ Roles work
✓ Permissions work
✓ Tenant RLS works
✓ UPDATE cannot reassign ownership
✓ AI agents have explicit permissions
✓ Cross-domain access is controlled
✓ Service-role boundaries are documented
✓ Storage authorization is aligned
✓ Security-sensitive operations are audited
✓ Cross-tenant tests pass
✓ Suspended/removed users are denied
✓ Fail-closed behavior is verified
```

------------------------------------------------------------------------

# 38. Next Technical Deliverable

Next:

# MIANX.AI CORE --- DOMAIN & MODULE ENGINE SPECIFICATION v1.0

It will define:

-   Domain registration
-   Domain manifest
-   Module manifest
-   Module lifecycle
-   Activation/deactivation
-   Domain dependencies
-   Module dependencies
-   Domain permissions
-   Domain settings
-   Domain migrations
-   Domain dashboards
-   Domain AI agents
-   How Poultry plugs into Mianx Core

That document will be the direct bridge from **Mianx Core → Mianx
Poultry OS**.

------------------------------------------------------------------------

# Final Security Principle

> **No identity, human or AI, gets access because it exists. It gets
> access because the system explicitly authorizes the action within the
> correct organization and resource boundary.**
