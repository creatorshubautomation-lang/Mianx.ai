# MIANX.AI CORE --- DATA PLATFORM & DATABASE ARCHITECTURE SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Data Platform & Database Architecture\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Purpose:** Define the shared data foundation for Mianx.ai Core and
every current and future Domain OS.

------------------------------------------------------------------------

# 1. Purpose

Mianx.ai is a multi-tenant operating-system platform. Its data
architecture must therefore support:

-   Multiple organizations
-   Multiple domains
-   Multiple brands
-   Multiple branches/sites
-   Strong tenant isolation
-   Shared Core entities
-   Domain-specific entities
-   AI memory and knowledge
-   Events and workflows
-   Auditability
-   Analytics
-   High operational reliability

The target foundation is:

``` text
PostgreSQL
   │
   ├── Core Data
   ├── Tenant Data
   ├── Domain Data
   ├── AI Data
   ├── Workflow/Event Data
   └── Audit Data

Redis
   ├── Cache
   ├── Rate Limits
   ├── Short-lived State
   └── Coordination

Object Storage
   ├── Documents
   ├── Images
   ├── Reports
   └── AI Artifacts
```

------------------------------------------------------------------------

# 2. Data Constitution

1.  PostgreSQL is the system of record for transactional business data.
2.  Every tenant-owned record has an explicit organization scope.
3.  Tenant isolation is enforced server-side and at the database layer
    where appropriate.
4.  Domain data must connect to Core organization context.
5.  AI memory must retain tenant/domain scope.
6.  Audit records are append-oriented and tamper-resistant.
7.  Cache is never the source of truth.
8.  Object storage is not the source of relational business truth.
9.  Destructive schema changes require migrations and review.
10. Data access must follow least privilege.

------------------------------------------------------------------------

# 3. Logical Architecture

``` text
                    MIANX DATA PLATFORM
                           │
              ┌────────────┼────────────┐
              │            │            │
           Core DB      Domain DB     AI DB Data
              │            │            │
              └────────────┼────────────┘
                           │
                      PostgreSQL
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        Redis         Object Storage    Analytics
```

This is a logical separation. Initial implementation may use one
PostgreSQL cluster/database with clear schemas and ownership boundaries.

------------------------------------------------------------------------

# 4. Core vs Domain Data

## Core data

Shared across domains:

``` text
organizations
organization_members
users
roles
permissions
subscriptions
plans
features
integrations
workflow_definitions
workflow_runs
events
audit_logs
notifications
files
```

## Domain data

Owned by a domain:

``` text
poultry_farms
poultry_sheds
poultry_flocks
poultry_feed_records
poultry_health_records
```

Domain tables must reference Core organization context.

------------------------------------------------------------------------

# 5. Organization Hierarchy

Recommended logical hierarchy:

``` text
Platform
  ↓
Organization
  ↓
Brand / Business Unit
  ↓
Location / Branch / Site
  ↓
Domain
  ↓
Operational Resources
```

Not every domain requires every hierarchy level.

For Poultry:

``` text
Organization
  ↓
Farm
  ↓
Shed
  ↓
Flock
```

------------------------------------------------------------------------

# 6. Organization

Conceptual table:

``` text
organizations
```

Possible fields:

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

Organization is the primary tenant boundary.

------------------------------------------------------------------------

# 7. Organization Membership

``` text
organization_members
```

Possible fields:

``` text
id
organization_id
user_id
status
role_id
created_at
updated_at
```

A user may belong to multiple organizations.

Membership determines whether the user may operate inside an
organization.

------------------------------------------------------------------------

# 8. Roles and Permissions

Core authorization entities:

``` text
roles
permissions
role_permissions
organization_members
```

Permissions should be granular enough for domains.

Example:

``` text
poultry.flock.read
poultry.flock.write
poultry.mortality.write
poultry.purchase.approve
```

------------------------------------------------------------------------

# 9. Domain Registration

Core should know which domains are enabled for an organization.

Conceptual:

``` text
organization_domains
```

Fields:

``` text
id
organization_id
domain_key
status
configuration
enabled_at
created_at
updated_at
```

This supports:

``` text
organization
 ├── poultry = active
 ├── restaurant = inactive
 └── retail = active
```

------------------------------------------------------------------------

# 10. Multi-Brand / Multi-Branch

Optional Core entities:

``` text
brands
locations
```

Relationships:

``` text
organization
 ├── brand A
 │    ├── location 1
 │    └── location 2
 └── brand B
      └── location 3
```

Domains may use or ignore these layers according to their requirements.

------------------------------------------------------------------------

# 11. Tenant Isolation

Every tenant-owned table should normally include:

``` text
organization_id
```

Example:

``` text
poultry_flocks
 ├── id
 ├── organization_id
 ├── farm_id
 └── ...
```

Never depend only on application code to remember tenant filtering.

------------------------------------------------------------------------

# 12. Row Level Security

PostgreSQL Row Level Security should be considered a major
defense-in-depth mechanism for tenant data.

Conceptually:

``` text
request
 ↓
trusted tenant context
 ↓
PostgreSQL session context
 ↓
RLS policy
 ↓
allowed rows
```

RLS must be designed carefully with the application authentication
model.

------------------------------------------------------------------------

# 13. Cross-Tenant Protection

The following must be tested:

``` text
Organization A cannot read B
Organization A cannot update B
Organization A cannot delete B
Organization A cannot infer sensitive B data
Organization A cannot trigger B workflow
Organization A cannot access B files
Organization A cannot access B AI memory
```

Cross-tenant tests are mandatory.

------------------------------------------------------------------------

# 14. Foreign Keys

Use foreign keys for important relational integrity.

Examples:

``` text
poultry_flocks.organization_id
 → organizations.id

poultry_flocks.farm_id
 → poultry_farms.id
```

Foreign keys should reflect actual lifecycle rules.

------------------------------------------------------------------------

# 15. Delete Strategy

Not every business record should be physically deleted.

Use explicit lifecycle states where appropriate:

``` text
active
inactive
archived
cancelled
deleted
```

For sensitive/audited business records, prefer controlled archival or
soft-delete semantics where required.

------------------------------------------------------------------------

# 16. IDs

Use a consistent ID strategy across the platform.

Requirements:

-   globally safe uniqueness
-   API-safe representation
-   no accidental tenant leakage through sequential IDs
-   predictable indexing behavior

The exact identifier technology should be standardized before
implementation.

------------------------------------------------------------------------

# 17. Timestamps

Standard timestamps:

``` text
created_at
updated_at
```

Use timezone-aware timestamps.

Business events may additionally require:

``` text
occurred_at
effective_at
```

Do not confuse record creation time with business-event time.

------------------------------------------------------------------------

# 18. Money

Never store financial values as floating point.

Use an exact representation appropriate for the currency model.

Typical conceptual model:

``` text
amount
currency
```

Financial calculations require deterministic rounding rules.

------------------------------------------------------------------------

# 19. Units and Measurements

Domains such as Poultry require explicit units.

Examples:

``` text
kg
g
litre
unit
bird
percentage
currency
```

A value should never be stored without knowing its unit when the unit
affects meaning.

------------------------------------------------------------------------

# 20. JSON / Flexible Attributes

JSON fields can be useful for:

``` text
configuration
provider metadata
optional domain attributes
AI metadata
integration payloads
```

Do not use JSON as an excuse to avoid proper relational modeling for
important business entities.

------------------------------------------------------------------------

# 21. Prisma Architecture

Prisma can be used as the application data-access layer.

Conceptual:

``` text
Application
    ↓
Domain Service
    ↓
Prisma
    ↓
PostgreSQL
```

Prisma models should reflect Core and domain ownership clearly.

------------------------------------------------------------------------

# 22. Migration Discipline

Every schema change should use a controlled migration.

Migration process:

``` text
Design
 ↓
Migration
 ↓
Review
 ↓
Test
 ↓
Apply
 ↓
Verify
```

Never make undocumented production schema changes.

------------------------------------------------------------------------

# 23. Indexing

Indexes should support actual access patterns.

Common index candidates:

``` text
organization_id
organization_id + status
organization_id + created_at
organization_id + domain_resource_id
```

Do not index every column automatically.

------------------------------------------------------------------------

# 24. Composite Indexes

Multi-tenant queries often need composite indexes.

Example:

``` text
(organization_id, created_at)
```

or:

``` text
(organization_id, status, created_at)
```

Index design should follow real query patterns.

------------------------------------------------------------------------

# 25. Unique Constraints

Tenant-scoped uniqueness should include organization scope.

Example:

``` text
UNIQUE (organization_id, slug)
```

rather than globally unique slugs when the product permits the same slug
in different organizations.

------------------------------------------------------------------------

# 26. Audit Data

Important actions should produce audit records.

Conceptual:

``` text
audit_logs
```

Fields:

``` text
id
organization_id
actor_type
actor_id
action
resource_type
resource_id
before
after
metadata
request_id
correlation_id
created_at
```

Avoid storing secrets in audit payloads.

------------------------------------------------------------------------

# 27. Event Data

Event records should support the Event/Workflow Engine.

Conceptual:

``` text
events
```

Fields:

``` text
id
event_type
event_version
organization_id
source_type
source_id
actor_type
actor_id
correlation_id
causation_id
occurred_at
payload
created_at
```

Event payloads should follow versioned contracts.

------------------------------------------------------------------------

# 28. Outbox Data

Transactional outbox records may include:

``` text
id
organization_id
event_type
payload
status
attempts
available_at
published_at
created_at
```

This supports reliable event publication.

------------------------------------------------------------------------

# 29. Workflow Data

Core workflow persistence:

``` text
workflow_definitions
workflow_runs
workflow_step_runs
workflow_approvals
workflow_jobs
```

These records must preserve organization and execution scope.

------------------------------------------------------------------------

# 30. AI Data

AI-related persistence may include:

``` text
ai_runs
ai_messages
ai_tool_calls
ai_memory
ai_knowledge_sources
ai_usage
ai_cost_records
```

All tenant-owned AI data must retain appropriate organization/domain
scope.

------------------------------------------------------------------------

# 31. AI Memory

Memory should distinguish:

``` text
conversation memory
user memory
organization memory
domain memory
operational memory
```

Not all memory should be globally visible to every agent.

Access should be governed by authorization and memory scope.

------------------------------------------------------------------------

# 32. AI Knowledge

Knowledge sources may include:

``` text
documents
policies
manuals
business records
domain knowledge
uploaded files
```

Knowledge metadata should identify:

``` text
organization_id
domain_id
source_type
source_id
visibility
version
```

------------------------------------------------------------------------

# 33. Vector / Semantic Data

If semantic search is used, vectors should remain linked to
authoritative source records.

Conceptual:

``` text
knowledge_document
      ↓
chunk
      ↓
embedding
      ↓
source reference
```

A vector result must never become the authoritative business record.

------------------------------------------------------------------------

# 34. File / Object Storage

Use object storage for:

``` text
images
PDFs
documents
exports
reports
AI-generated artifacts
```

Store metadata in PostgreSQL.

Conceptual:

``` text
files
 ├── id
 ├── organization_id
 ├── storage_key
 ├── mime_type
 ├── size
 └── metadata
```

------------------------------------------------------------------------

# 35. File Security

Files must have:

``` text
organization scope
access policy
content type validation
size limits
virus/malware scanning where appropriate
signed access URLs where appropriate
retention policy
```

Never expose unrestricted object-storage buckets for tenant files.

------------------------------------------------------------------------

# 36. Redis

Redis is for short-lived/high-speed operational state.

Appropriate uses:

``` text
cache
rate limiting
session-related ephemeral state
distributed coordination
short-lived locks
job coordination
temporary AI state
```

Redis must not become the permanent system of record.

------------------------------------------------------------------------

# 37. Cache Strategy

Cache entries should have:

``` text
key
value
TTL
scope
invalidation strategy
```

Tenant-specific cache keys must include organization context.

Example:

``` text
org:{organization_id}:dashboard:{dashboard_id}
```

------------------------------------------------------------------------

# 38. Cache Invalidation

Preferred mechanisms:

``` text
TTL
explicit invalidation
event-driven invalidation
versioned keys
```

Never assume cached data is always current.

------------------------------------------------------------------------

# 39. Analytics

Operational PostgreSQL should not necessarily handle every analytical
workload forever.

Architecture can evolve toward:

``` text
Operational DB
      ↓
Events / CDC / ETL
      ↓
Analytics Store
      ↓
BI / Reports / AI
```

Initial scale may allow reporting directly from PostgreSQL with
carefully designed queries.

------------------------------------------------------------------------

# 40. Reporting

Reports should distinguish:

``` text
operational query
analytical query
generated report
AI-generated insight
```

AI-generated insights should link back to the data used where feasible.

------------------------------------------------------------------------

# 41. Data Retention

Every data category should eventually have a retention policy.

Examples:

``` text
audit
events
workflow runs
AI logs
files
integration logs
analytics data
```

Retention must consider legal, operational and product requirements.

------------------------------------------------------------------------

# 42. Backup

PostgreSQL backup strategy should include:

``` text
automated backups
point-in-time recovery where supported
backup monitoring
restore testing
off-site/independent recovery strategy
```

A backup that has never been restored/tested should not be considered
fully reliable.

------------------------------------------------------------------------

# 43. Disaster Recovery

Define:

``` text
RPO
RTO
backup frequency
recovery ownership
failover process
restore procedure
```

Critical Mianx services need explicit recovery objectives.

------------------------------------------------------------------------

# 44. Data Encryption

Protect data:

``` text
in transit
at rest
in secret storage
```

Sensitive credentials should use dedicated secret-management mechanisms.

------------------------------------------------------------------------

# 45. Database Access

Use least privilege.

Different application roles may exist for:

``` text
application runtime
migration
analytics
background jobs
administration
read-only support
```

Do not use a single unrestricted database credential everywhere.

------------------------------------------------------------------------

# 46. Connection Management

Production database access must account for:

``` text
connection limits
pooling
timeouts
long-running queries
transaction duration
retry behavior
```

The application should avoid exhausting PostgreSQL connections.

------------------------------------------------------------------------

# 47. Transaction Boundaries

Transactions should be short and intentional.

Example:

``` text
Validate
 ↓
Transaction
 ├── Business update
 └── Outbox record
 ↓
Commit
```

Avoid holding database transactions while waiting on external APIs or
long AI operations.

------------------------------------------------------------------------

# 48. External Integrations and Data

External API calls should not occur inside long-running database
transactions.

Preferred:

``` text
Transaction
 ↓
Persist intent/job
 ↓
Commit
 ↓
Worker
 ↓
External API
 ↓
Persist result
 ↓
Event
```

------------------------------------------------------------------------

# 49. Domain Data Example --- Poultry

Conceptual:

``` text
organizations
    │
    └── poultry_farms
          │
          └── poultry_sheds
                │
                └── poultry_flocks
                      ├── weight_records
                      ├── mortality_records
                      ├── feed_records
                      ├── health_records
                      └── vaccination_records
```

Shared Core provides:

``` text
identity
organization
permissions
files
events
workflows
audit
AI
```

Poultry owns poultry-specific operational data.

------------------------------------------------------------------------

# 50. Poultry Data Isolation

A Poultry record must be reachable only through authorized organization
context.

Example:

``` text
organization_id
farm_id
shed_id
flock_id
```

All relationships must be validated.

A user must not be able to pass a valid `flock_id` from another
organization and access it.

------------------------------------------------------------------------

# 51. Data Access Layers

Recommended service boundaries:

``` text
API
 ↓
Application Service
 ↓
Domain Service
 ↓
Repository / Prisma
 ↓
PostgreSQL
```

AI and workflows should call application/domain services rather than
bypassing them.

------------------------------------------------------------------------

# 52. Read Models

For expensive dashboards, use optimized read models/materialized views
where justified.

Example:

``` text
Poultry Dashboard Read Model
```

It can aggregate:

``` text
active flocks
mortality
weight variance
feed usage
alerts
```

The read model is derived data, not the authoritative source.

------------------------------------------------------------------------

# 53. Data Consistency

Distinguish:

``` text
strong consistency
eventual consistency
derived/cache consistency
```

Financial and critical operational state should use stronger consistency
where required.

Analytics and dashboards may tolerate controlled eventual consistency.

------------------------------------------------------------------------

# 54. Concurrency

Business records that can be updated concurrently require explicit
handling.

Possible approaches:

``` text
transactions
row locks
optimistic concurrency
version columns
idempotency
```

The correct mechanism depends on the business operation.

------------------------------------------------------------------------

# 55. Schema Ownership

Every table should have a clear owner:

``` text
Core
Poultry
Restaurant
Retail
AI
Workflow
Audit
```

No domain should silently modify another domain's tables.

Cross-domain operations should go through contracts/services.

------------------------------------------------------------------------

# 56. Data Quality

Important business data should enforce:

``` text
required fields
valid ranges
foreign keys
unique constraints
units
status transitions
business invariants
```

AI should not be used as a replacement for basic data integrity.

------------------------------------------------------------------------

# 57. Data Observability

Monitor:

``` text
database health
query latency
slow queries
connection usage
cache hit rate
storage growth
event backlog
outbox backlog
failed jobs
replication/backup health
```

------------------------------------------------------------------------

# 58. Data Security Testing

Required test categories:

``` text
tenant isolation
RLS
authorization
SQL injection protection
mass assignment protection
file access isolation
API data leakage
AI memory isolation
backup access
admin access
```

------------------------------------------------------------------------

# 59. Data Definition of Done

Data Platform is ready when:

``` text
✓ Organization model exists
✓ Membership model exists
✓ Domain registration exists
✓ Tenant isolation exists
✓ RLS strategy exists
✓ Core tables defined
✓ Domain ownership defined
✓ Prisma structure defined
✓ Migration discipline defined
✓ Indexing strategy defined
✓ Audit data defined
✓ Event/outbox data defined
✓ Workflow data defined
✓ AI data defined
✓ File storage defined
✓ Redis boundaries defined
✓ Analytics path defined
✓ Backup/recovery defined
✓ Data security tests defined
✓ Poultry data can plug into Core
```

------------------------------------------------------------------------

# 60. Implementation Order

Build in this order:

``` text
1. PostgreSQL environment
2. Organization / identity schema
3. Membership / authorization schema
4. Domain registration
5. Tenant/RLS foundation
6. Core entities
7. Event/outbox tables
8. Workflow tables
9. Audit tables
10. File metadata
11. AI persistence
12. Redis boundaries
13. Domain schema framework
14. Poultry schema
15. Index optimization
16. Backup/recovery
17. Analytics/read models
18. Security and isolation tests
```

------------------------------------------------------------------------

# 61. Final Data Principle

> **Mianx.ai data must have one authoritative home, one clear owner, one
> trusted tenant boundary, and a traceable history.**

``` text
CORE
  ↓
ORGANIZATION
  ↓
DOMAIN
  ↓
BUSINESS DATA
  ↓
EVENTS / WORKFLOWS / AI
  ↓
AUDIT
  ↓
ANALYTICS
```

------------------------------------------------------------------------

# 62. Next Technical Deliverable

Next:

# MIANX.AI CORE --- SECURITY, IDENTITY & GOVERNANCE SPECIFICATION v1.0

It will define:

-   Authentication
-   Authorization
-   RBAC
-   ABAC
-   Organization membership
-   Tenant isolation
-   Sessions
-   MFA readiness
-   API security
-   AI permissions
-   Secrets
-   Audit
-   Compliance foundation
-   Data access policies
-   Admin security
-   Security incidents
-   Governance
-   Policy engine
-   How every Domain OS inherits the same security foundation
