# MIANX.AI CORE --- DATABASE & TENANCY SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Core Database & Tenancy Specification\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Database Direction:** PostgreSQL / Supabase\
**Primary Principle:** Secure tenant isolation first; optimize for
multi-domain reuse.

------------------------------------------------------------------------

# 1. Purpose

This document defines the database foundation for Mianx.ai Core.

It covers:

-   Multi-tenancy
-   Organizations
-   Users and memberships
-   Teams
-   Roles and permissions
-   Domains
-   Modules
-   Subscriptions and entitlements
-   AI agents
-   Workflows and events
-   Audit logs
-   Files and knowledge
-   Indexing strategy
-   Row-Level Security (RLS)
-   Data ownership boundaries

This is a **pre-implementation specification**. Exact migrations will be
written only after the model and access matrix are reviewed.

------------------------------------------------------------------------

# 2. Database Principles

## 2.1 Tenant isolation is mandatory

Every tenant-owned resource must have a clear path back to an
organization.

For most tenant-owned tables:

``` text
organization_id → organizations.id
```

## 2.2 Database security is not optional

Tenant isolation must not depend only on frontend filtering or
application code.

PostgreSQL RLS will be part of the security boundary.

## 2.3 Core and Domain data stay separated

Mianx Core owns platform data.

Domains own industry-specific data.

Example:

``` text
CORE
organizations
memberships
roles
permissions
domains
modules
subscriptions
agents
workflows
audit_logs

POULTRY DOMAIN
farms
sheds
flocks
feed_records
mortality_records
...
```

## 2.4 Avoid premature generic tables

We will not put every future domain into a giant generic `business_data`
table.

Where relational structure matters, use real typed tables.

## 2.5 Foreign keys are first-class

Relationships must be enforced at the database level wherever
appropriate.

------------------------------------------------------------------------

# 3. Tenancy Model

The primary tenant is an **Organization**.

``` text
Mianx Platform
      │
      ├── Organization A
      │      ├── Users
      │      ├── Teams
      │      ├── Domains
      │      ├── Modules
      │      └── Business Data
      │
      └── Organization B
             ├── Users
             ├── Teams
             ├── Domains
             ├── Modules
             └── Business Data
```

Organization A must never be able to access Organization B's data.

------------------------------------------------------------------------

# 4. Organization Hierarchy

The initial hierarchy is:

``` text
Organization
    ↓
Business / Brand
    ↓
Branch / Location
    ↓
Department / Team
    ↓
Users
```

Not every customer needs every level.

The Core must therefore support optional hierarchy rather than forcing
every organization to create brands, branches and departments.

------------------------------------------------------------------------

# 5. Core Entity Map

``` text
                         organizations
                               │
                ┌──────────────┼──────────────┐
                │              │              │
          memberships        teams        domains
                │                             │
              users                         modules
                                               │
                                        organization_modules

organizations
      │
      ├── subscriptions
      ├── usage_records
      ├── agents
      ├── workflows
      ├── events
      ├── notifications
      ├── integrations
      ├── files
      ├── knowledge
      └── audit_logs
```

------------------------------------------------------------------------

# 6. Organizations

## Table: `organizations`

Purpose: Represents a customer/business tenant.

Core fields:

``` text
id
name
slug
status
timezone
locale
currency
created_at
updated_at
```

Recommended status values:

``` text
active
suspended
archived
```

### Rules

-   `id` is the primary key.
-   `slug` must be unique.
-   Organization-owned resources reference this table.
-   Deletion strategy must protect against accidental cascading data
    loss.

------------------------------------------------------------------------

# 7. User Identity

Authentication identity is handled by the authentication system.

Mianx Core should maintain application-level profile/membership data
separately.

## Table: `profiles`

Conceptual fields:

``` text
id
display_name
avatar_url
locale
timezone
created_at
updated_at
```

The identity ID should map safely to the authenticated user identity.

Do not use user-editable profile metadata as the source of authorization
truth.

------------------------------------------------------------------------

# 8. Memberships

## Table: `organization_memberships`

Purpose: Connects users to organizations.

Fields:

``` text
id
organization_id
user_id
status
joined_at
created_at
updated_at
```

Constraints:

``` text
UNIQUE (organization_id, user_id)
```

Possible statuses:

``` text
invited
active
suspended
removed
```

This table is the primary basis for organization access.

------------------------------------------------------------------------

# 9. Teams

## Table: `teams`

Purpose: Groups members inside an organization.

Fields:

``` text
id
organization_id
name
description
created_at
updated_at
```

## Table: `team_members`

Fields:

``` text
team_id
membership_id
created_at
```

Constraint:

``` text
UNIQUE (team_id, membership_id)
```

------------------------------------------------------------------------

# 10. Roles

Roles belong to an organization or are system-defined.

## Table: `roles`

Conceptual fields:

``` text
id
organization_id nullable
name
slug
description
is_system
created_at
updated_at
```

A system role may have no organization ID.

An organization-specific custom role belongs to one organization.

------------------------------------------------------------------------

# 11. Permissions

## Table: `permissions`

Permissions describe actions on resources.

Fields:

``` text
id
key
description
created_at
```

Example:

``` text
organization.view
organization.update

domain.view
domain.manage

user.view
user.invite

poultry.flock.view
poultry.flock.create
poultry.flock.update

finance.report.view
```

Permission keys should be stable identifiers.

------------------------------------------------------------------------

# 12. Role Permissions

## Table: `role_permissions`

Fields:

``` text
role_id
permission_id
created_at
```

Constraint:

``` text
UNIQUE (role_id, permission_id)
```

------------------------------------------------------------------------

# 13. Membership Roles

## Table: `membership_roles`

Fields:

``` text
membership_id
role_id
created_at
```

Constraint:

``` text
UNIQUE (membership_id, role_id)
```

This allows one user membership to have multiple roles.

------------------------------------------------------------------------

# 14. Domain Registry

## Table: `domains`

Purpose: Global registry of available Mianx domains.

Fields:

``` text
id
name
slug
version
description
status
manifest
created_at
updated_at
```

Examples:

``` text
poultry
restaurant
retail
manufacturing
logistics
```

The domain registry is platform-level.

------------------------------------------------------------------------

# 15. Organization Domains

## Table: `organization_domains`

Purpose: Activates a domain for a specific organization.

Fields:

``` text
id
organization_id
domain_id
status
configuration
activated_at
created_at
updated_at
```

Constraint:

``` text
UNIQUE (organization_id, domain_id)
```

This is a key multi-domain relationship.

Example:

``` text
ABC Holdings
 ├── Poultry → active
 └── Restaurant → active
```

------------------------------------------------------------------------

# 16. Modules

## Table: `modules`

Purpose: Global registry of modules.

Fields:

``` text
id
domain_id
name
slug
version
description
manifest
status
created_at
updated_at
```

Relationship:

``` text
Domain
   ↓
Modules
```

------------------------------------------------------------------------

# 17. Organization Modules

## Table: `organization_modules`

Purpose: Controls module activation for an organization.

Fields:

``` text
id
organization_id
module_id
status
configuration
activated_at
created_at
updated_at
```

Constraint:

``` text
UNIQUE (organization_id, module_id)
```

This enables feature/module entitlements.

------------------------------------------------------------------------

# 18. Settings

Settings should support multiple scopes.

Conceptually:

``` text
platform
organization
domain
module
user
```

A future settings table can contain:

``` text
id
organization_id nullable
scope_type
scope_id
key
value
created_at
updated_at
```

Sensitive configuration should not be stored as plain application data
when a secure secret store is more appropriate.

------------------------------------------------------------------------

# 19. AI Agents

## Table: `agents`

Fields:

``` text
id
organization_id
domain_id nullable
name
slug
description
status
configuration
created_at
updated_at
```

Important rule:

An organization-owned agent must belong to exactly one organization.

A platform/system agent may be global where appropriate.

------------------------------------------------------------------------

# 20. Agent Tools

## Table: `agent_tools`

Fields:

``` text
id
agent_id
tool_key
configuration
enabled
created_at
updated_at
```

Tools must not bypass authorization.

The tool execution layer must verify the acting agent's permissions.

------------------------------------------------------------------------

# 21. Agent Permissions

Agents should be associated with permissions through the same
authorization concepts used by users.

Conceptually:

``` text
agent
  ↓
agent_roles / agent_permissions
  ↓
permissions
```

The final implementation may reuse a common principal/role model if that
simplifies authorization without weakening security.

------------------------------------------------------------------------

# 22. Agent Memory

Memory should remain organization-scoped.

Conceptual entity:

``` text
agent_memories
```

Important ownership:

``` text
organization_id
agent_id
```

Never allow retrieval based only on a globally unique vector/document
ID.

Tenant scope must be part of the retrieval authorization.

------------------------------------------------------------------------

# 23. Knowledge

Knowledge sources can include:

-   Documents
-   Business records
-   Structured data
-   Domain documentation
-   External sources

Conceptual tables:

``` text
knowledge_sources
knowledge_documents
knowledge_chunks
```

Tenant-owned knowledge must include organization ownership.

------------------------------------------------------------------------

# 24. Files

## Table: `files`

Conceptual fields:

``` text
id
organization_id
uploaded_by
name
storage_path
mime_type
size_bytes
metadata
created_at
updated_at
```

Storage paths should include a tenant boundary.

Example:

``` text
organizations/{organization_id}/files/{file_id}
```

The storage authorization model must match database authorization.

------------------------------------------------------------------------

# 25. Events

## Table: `events`

Conceptual fields:

``` text
id
organization_id nullable
event_type
source_type
source_id
payload
occurred_at
created_at
```

Examples:

``` text
payment.created
inventory.low
workflow.completed
agent.action.completed
```

Events must be designed for idempotent processing.

------------------------------------------------------------------------

# 26. Workflows

## Table: `workflows`

Fields:

``` text
id
organization_id
domain_id nullable
name
slug
status
definition
created_at
updated_at
```

## Table: `workflow_runs`

Fields:

``` text
id
workflow_id
organization_id
status
input
output
started_at
completed_at
error
created_at
updated_at
```

Every workflow run must remain tenant-scoped.

------------------------------------------------------------------------

# 27. Notifications

## Table: `notifications`

Conceptual fields:

``` text
id
organization_id
recipient_user_id
type
title
body
data
read_at
created_at
```

Notifications must not leak across organizations.

------------------------------------------------------------------------

# 28. Integrations

## Table: `integrations`

Conceptual fields:

``` text
id
organization_id
provider
name
status
configuration
created_at
updated_at
```

Secrets must be stored using secure secret handling rather than exposed
as ordinary configuration values.

------------------------------------------------------------------------

# 29. Billing

Core billing entities:

``` text
plans
subscriptions
entitlements
usage_records
```

Organization relationship:

``` text
organization
    ↓
subscription
    ↓
plan
    ↓
entitlements
```

Usage remains separately measurable.

------------------------------------------------------------------------

# 30. Audit Logs

## Table: `audit_logs`

Conceptual fields:

``` text
id
organization_id nullable
actor_type
actor_id
action
resource_type
resource_id
metadata
created_at
```

Actor types:

``` text
human
ai_agent
system
integration
```

AI actions must be identifiable.

------------------------------------------------------------------------

# 31. Tenant Ownership Matrix

  Entity                              Tenant-owned?   Organization scope
  ---------------------- -------------------------- --------------------
  organizations                         Root tenant                  Yes
  profiles                      No / identity-level             Indirect
  memberships                                   Yes                  Yes
  teams                                         Yes                  Yes
  roles                                   Sometimes      Yes when custom
  permissions                     Platform registry                   No
  domains                         Platform registry                   No
  organization_domains                          Yes                  Yes
  modules                  Platform/domain registry        Domain-scoped
  organization_modules                          Yes                  Yes
  agents                                        Yes                  Yes
  workflows                                     Yes                  Yes
  workflow_runs                                 Yes                  Yes
  events                                    Usually                  Yes
  notifications                                 Yes                  Yes
  files                                         Yes                  Yes
  knowledge                                     Yes                  Yes
  integrations                                  Yes                  Yes
  subscriptions                                 Yes                  Yes
  usage_records                                 Yes                  Yes
  audit_logs                                Usually                  Yes

------------------------------------------------------------------------

# 32. RLS Strategy

RLS policies must be designed around organization membership.

Conceptual authorization function:

``` text
user_has_org_access(authenticated_user, organization_id)
```

The policy pattern is:

``` text
authenticated user
      ↓
organization membership
      ↓
organization_id
      ↓
resource access
```

Example conceptual policy:

``` text
A user may SELECT a row
IF
the authenticated user has an active membership
in the row's organization.
```

This is a design pattern, not final SQL.

------------------------------------------------------------------------

# 33. RLS Rules

Every tenant-owned exposed table should answer:

1.  What organization owns this row?
2.  How does the authenticated user prove membership?
3.  What role/permission is required?
4.  Does the action require additional resource-level authorization?
5.  Can an AI agent perform the same action?
6.  What should happen to system/background jobs?

No table should be considered complete until these questions are
answered.

------------------------------------------------------------------------

# 34. RLS Performance

RLS is a security boundary, but policies must also be designed for
performance.

Guidelines:

-   Index columns used in ownership checks.
-   Index foreign keys.
-   Keep membership checks efficient.
-   Avoid unnecessarily complex policy expressions.
-   Avoid per-row expensive lookups where a stable authorization helper
    can be used.
-   Test important queries with realistic data.

Indexes should be added based on actual access patterns rather than
blindly indexing every column.

------------------------------------------------------------------------

# 35. Index Strategy

Initial high-value indexes will likely include:

``` text
organization_id
organization_id + status
organization_id + created_at
organization_id + updated_at
organization_id + slug
```

For relationship tables:

``` text
(organization_id, user_id)
(organization_id, domain_id)
(organization_id, module_id)
```

Exact indexes will be finalized after query patterns are defined.

------------------------------------------------------------------------

# 36. Unique Constraints

Examples:

``` text
organizations.slug
(organization_id, user_id)
(organization_id, domain_id)
(organization_id, module_id)
(team_id, membership_id)
(role_id, permission_id)
(membership_id, role_id)
```

Unique constraints must reflect tenant scope.

A business slug that is only unique inside an organization should not be
made globally unique accidentally.

------------------------------------------------------------------------

# 37. Deletion Strategy

We will avoid broad cascading deletes on important business data.

Preferred strategies:

-   Soft archive for major business entities
-   Explicit deletion workflows
-   Restricted foreign keys where accidental deletion is dangerous
-   Cascades only where the child has no independent meaning

Examples:

Deleting an organization should **not** accidentally destroy production
business data without an explicit lifecycle process.

------------------------------------------------------------------------

# 38. Timestamps

Core tables should normally include:

``` text
created_at
updated_at
```

Use UTC timestamps at the database/application boundary.

Display timezone is an organization/user preference.

------------------------------------------------------------------------

# 39. ID Strategy

Use stable opaque IDs rather than exposing sequential business counts as
primary identifiers.

Candidate:

``` text
UUID
```

The final ID strategy will be standardized before migrations.

Business-facing numbers such as invoice numbers, flock numbers or order
numbers are separate concepts.

------------------------------------------------------------------------

# 40. Domain Data Boundary

Poultry data must not be inserted into Core tables just because Core
exists first.

Correct:

``` text
Core:
organizations
domains
memberships

Poultry:
farms
sheds
flocks
feed_records
mortality_records
```

Incorrect:

``` text
organizations
poultry_farms
restaurant_tables
retail_products
manufacturing_batches
...
```

inside a single Core schema without domain boundaries.

------------------------------------------------------------------------

# 41. Cross-Domain Organizations

Mianx.ai must support:

``` text
Organization
 │
 ├── Poultry Domain
 │
 ├── Restaurant Domain
 │
 └── Retail Domain
```

Shared Core entities remain shared.

Domain data remains domain-owned.

AI agents only access the domains/resources they are authorized to
access.

------------------------------------------------------------------------

# 42. Database Migration Strategy

All schema changes must be migration-based.

Never rely on manually editing production databases.

Migration lifecycle:

``` text
Design
 ↓
Migration
 ↓
Local/Test
 ↓
Validation
 ↓
Review
 ↓
Production
```

Migrations should be:

-   Versioned
-   Repeatable in controlled environments
-   Reviewable
-   Reversible where practical

------------------------------------------------------------------------

# 43. Database Testing

Before Core v1 is considered ready, test:

### Tenant isolation

User A cannot read/write Organization B.

### Role isolation

User without permission cannot perform restricted action.

### AI isolation

Agent A cannot retrieve Organization B knowledge.

### Domain isolation

Poultry module does not expose Restaurant data without authorization.

### Workflow isolation

Organization A workflow cannot execute against Organization B data.

### Audit

Human and AI mutations generate appropriate audit records.

------------------------------------------------------------------------

# 44. Database Definition of Done

The database foundation is ready when:

``` text
✓ Organization model is stable
✓ Membership model is stable
✓ Role/permission model is stable
✓ Domain/module relationships are stable
✓ Tenant ownership is defined
✓ RLS policies are designed
✓ RLS tests exist
✓ Core indexes are defined
✓ Foreign keys are defined
✓ Unique constraints are defined
✓ Audit ownership is defined
✓ AI ownership is defined
✓ Workflow ownership is defined
✓ Migration strategy is established
```

------------------------------------------------------------------------

# 45. Next Step

After this specification, the next technical document should be:

# MIANX.AI CORE --- AUTHORIZATION & RLS SPECIFICATION v1.0

It will define:

-   Exact role model
-   Permission naming convention
-   Membership access
-   RLS policy architecture
-   Helper authorization functions
-   AI agent authorization
-   System/background access
-   Service-role boundaries
-   Security test matrix

Only after that should we begin writing the first production database
migrations.

------------------------------------------------------------------------

# Final Database Principle

> **Every piece of business data must have a clear owner, a clear access
> rule, and a clear audit path.**

For Mianx.ai:

**Tenant isolation is not a feature. It is the foundation.**
