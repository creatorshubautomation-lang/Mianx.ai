# MIANX.AI CORE --- DATA PLATFORM, TENANT ISOLATION & DATABASE ARCHITECTURE SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Data Platform, Tenant Isolation & Database Architecture\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Purpose:** Define the shared data foundation for Mianx.ai Core and
every Domain OS, with strong tenant isolation, clear domain boundaries,
scalable PostgreSQL architecture, governed AI data, and operational
resilience.

------------------------------------------------------------------------

# 1. Purpose

Mianx.ai is a multi-tenant, multi-domain SaaS platform.

The data architecture must support:

``` text
Mianx Platform
   ↓
Organizations / Tenants
   ↓
Brands / Sites / Branches
   ↓
Domains
   ↓
Domain Modules
   ↓
Business Data
```

The same foundation must support:

``` text
Poultry OS
Restaurant OS
Retail OS
Future Domain OSs
```

without creating a separate database architecture for every domain.

------------------------------------------------------------------------

# 2. Data Constitution

1.  Tenant isolation is a security boundary.
2.  Domain boundaries must be explicit.
3.  Every tenant-owned record must have an enforceable ownership path.
4.  Application authorization and database authorization complement each
    other.
5.  RLS is defense in depth, not a replacement for application
    authorization.
6.  Cross-tenant queries are prohibited unless explicitly part of
    trusted platform operations.
7.  AI data follows the same tenant and domain boundaries.
8.  Sensitive data is minimized and protected.
9.  Schema changes are migration-controlled.
10. Backups and disaster recovery are part of the architecture, not
    afterthoughts.

------------------------------------------------------------------------

# 3. Recommended Core Stack

Conceptual foundation:

``` text
PostgreSQL
   ├── Core relational data
   ├── RLS
   ├── Transactions
   ├── JSONB where justified
   ├── Full-text/search capabilities
   └── pgvector where justified

Redis
   ├── Cache
   ├── Short-lived state
   ├── Rate limiting
   └── Queue/supporting coordination

Object Storage
   ├── Documents
   ├── Images
   ├── Exports
   └── Large files

Analytics / Warehouse
   └── Long-term analytical workloads
```

PostgreSQL remains the system of record for transactional business data.

Supabase provides managed PostgreSQL plus related services; its current
documentation confirms that each project provides a full PostgreSQL
database, with RLS available as the database-level authorization
mechanism. citeturn0search1turn0search0

------------------------------------------------------------------------

# 4. Database Philosophy

Use PostgreSQL for authoritative transactional state.

Do not turn PostgreSQL into:

``` text
temporary cache
large binary-file store
unbounded event archive
uncontrolled AI transcript warehouse
```

Use specialized storage where it provides a clear operational advantage.

------------------------------------------------------------------------

# 5. Logical Architecture

``` text
                 MIANX DATA PLATFORM
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
       CORE DATA     DOMAIN DATA   PLATFORM DATA
          │             │             │
          ↓             ↓             ↓
     PostgreSQL     PostgreSQL      PostgreSQL
          │
     ┌────┼─────┐
     ↓    ↓     ↓
   Redis Files  AI/Search
```

------------------------------------------------------------------------

# 6. Physical Database Strategy

Initial recommendation:

``` text
One PostgreSQL platform
+
logical isolation by organization/domain
```

This is simpler and more efficient for the initial multi-tenant SaaS.

As scale or regulatory requirements grow, selected workloads may move
to:

``` text
separate database
separate cluster
read replica
warehouse
region-specific deployment
```

Do not prematurely create one database per customer.

------------------------------------------------------------------------

# 7. Tenant Hierarchy

Recommended hierarchy:

``` text
Platform
  ↓
Organization
  ↓
Brand
  ↓
Location / Branch / Site
  ↓
Domain
  ↓
Resource
```

Not every domain needs every hierarchy level.

For example:

``` text
Poultry
Organization
 └── Farm
      └── House
           └── Flock
```

Restaurant:

``` text
Organization
 └── Brand
      └── Branch
           └── Restaurant Operations
```

------------------------------------------------------------------------

# 8. Organization

Organization is the primary commercial and security tenant.

Conceptual:

``` text
organizations
 ├── id
 ├── name
 ├── status
 ├── default_locale
 ├── default_currency
 ├── created_at
 └── updated_at
```

Every tenant-owned business record should have a reliable path back to
an organization.

------------------------------------------------------------------------

# 9. Organization Membership

Separate:

``` text
User
```

from:

``` text
Organization Membership
```

Conceptual:

``` text
users
organizations
organization_members
```

Membership contains:

``` text
user_id
organization_id
role
status
```

A user may belong to multiple organizations.

------------------------------------------------------------------------

# 10. Domain Registry

Mianx Core owns the domain registry.

Conceptual:

``` text
domains
 ├── id
 ├── key
 ├── name
 ├── version
 ├── status
 └── configuration
```

Examples:

``` text
poultry
restaurant
retail
```

------------------------------------------------------------------------

# 11. Organization Domain Activation

A tenant may activate selected domains.

``` text
organization_domains
 ├── organization_id
 ├── domain_id
 ├── status
 ├── configuration
 └── activated_at
```

This connects:

``` text
Billing
+
Entitlements
+
Domain Access
```

------------------------------------------------------------------------

# 12. Domain Data Boundary

Domain-owned tables should clearly belong to their domain.

Example:

``` text
poultry_farms
poultry_houses
poultry_flocks
poultry_feed_batches
```

Restaurant:

``` text
restaurant_branches
restaurant_menu_items
restaurant_orders
restaurant_tables
```

Avoid generic tables that become impossible to reason about.

------------------------------------------------------------------------

# 13. Core vs Domain Tables

Core tables:

``` text
organizations
users
organization_members
domains
organization_domains
subscriptions
entitlements
audit_logs
integrations
ai_agents
ai_runs
```

Domain tables:

``` text
poultry_flocks
poultry_farms
restaurant_orders
retail_products
```

Core should not own domain-specific business rules.

------------------------------------------------------------------------

# 14. Tenant Isolation Model

Primary model:

``` text
organization_id
```

Every tenant-owned table should either:

1.  contain `organization_id`, or
2.  have an unambiguous foreign-key path to a table containing
    `organization_id`.

For high-risk tables, direct organization ownership is preferred.

------------------------------------------------------------------------

# 15. Tenant Isolation Enforcement

Use multiple layers:

``` text
Frontend
 ↓
API Authorization
 ↓
Service Authorization
 ↓
Data Access Layer
 ↓
PostgreSQL RLS
```

No single layer should be considered the only protection.

Supabase's current guidance explicitly recommends RLS for exposed tables
and emphasizes that grants and RLS are separate controls: grants
determine whether a role can reach an object, while RLS determines which
rows are accessible. citeturn0search12turn0search0

------------------------------------------------------------------------

# 16. RLS Strategy

For tables exposed through a client-facing Data API:

``` text
Enable RLS
+
Create explicit policies
+
Grant least privilege
```

Supabase currently recommends enabling RLS on tables in exposed schemas
and using policies for row-level authorization.
citeturn0search0turn0search12

------------------------------------------------------------------------

# 17. RLS Policy Model

Conceptually:

``` text
Authenticated User
       ↓
Organization Membership
       ↓
Organization ID
       ↓
Allowed Resource
```

Example policy logic:

``` text
user belongs to organization
AND
row.organization_id = organization
```

Do not use authentication alone as authorization.

------------------------------------------------------------------------

# 18. RLS and UPDATE

Update authorization must check both:

``` text
existing row access
+
new row ownership
```

In PostgreSQL RLS this means using appropriate `USING` and `WITH CHECK`
conditions for updates. Supabase's current RLS guidance explicitly calls
this out. citeturn0search0

------------------------------------------------------------------------

# 19. Authorization Data

Authorization data should come from trusted sources.

Do not use user-editable profile metadata as the authoritative source
for authorization.

Supabase specifically warns that user-editable `raw_user_meta_data`
should not be used for authorization decisions; authorization metadata
belongs in trusted application-level data. citeturn18file0

------------------------------------------------------------------------

# 20. Service-Level Access

Backend services may need elevated access for trusted operations.

Rules:

``` text
Service access
≠
frontend access
```

Secrets and service credentials must remain server-side.

Supabase documents that service-role/secret keys bypass RLS and
therefore must never be exposed in frontend applications.
citeturn0search11

------------------------------------------------------------------------

# 21. Database Schema Organization

Recommended logical grouping:

``` text
core
identity
billing
audit
integration
ai
analytics
poultry
restaurant
retail
```

Whether these become PostgreSQL schemas or naming conventions is an
implementation decision, but ownership must remain explicit.

------------------------------------------------------------------------

# 22. IDs

Use globally unique identifiers.

Recommended default:

``` text
UUID
```

or another collision-resistant identifier strategy.

Avoid exposing sequential database IDs where they create unnecessary
enumeration risk.

------------------------------------------------------------------------

# 23. Foreign Keys

Use foreign keys for important relational integrity.

Examples:

``` text
organization_members.organization_id
→ organizations.id

poultry_flocks.organization_id
→ organizations.id
```

Do not rely only on application code for critical referential integrity.

------------------------------------------------------------------------

# 24. Delete Strategy

Do not blindly cascade-delete business data.

Define per entity:

``` text
hard delete
soft delete
archive
retention
anonymization
```

Financial/audit records may require different lifecycle rules from
temporary operational data.

------------------------------------------------------------------------

# 25. Timestamps

Important tables should normally include:

``` text
created_at
updated_at
```

Additional lifecycle timestamps may include:

``` text
deleted_at
archived_at
activated_at
completed_at
```

Store timestamps consistently in UTC at the persistence layer.

------------------------------------------------------------------------

# 26. Concurrency

Critical business updates should use appropriate concurrency controls.

Options:

``` text
transactions
row locks
optimistic versioning
unique constraints
idempotency
```

Example:

``` text
inventory update
+
concurrent order
```

must not silently produce impossible inventory state.

------------------------------------------------------------------------

# 27. Transactions

Use transactions for atomic business changes.

Example:

``` text
Create Purchase Request
+
Create Audit Record
+
Create Outbox Event
```

All can be committed atomically where appropriate.

------------------------------------------------------------------------

# 28. JSONB

JSONB is allowed for:

``` text
flexible configuration
provider payloads
domain-specific metadata
integration settings
AI metadata
```

Do not use JSONB as an excuse to avoid modeling stable relational
fields.

------------------------------------------------------------------------

# 29. Database Constraints

Use database constraints for invariants.

Examples:

``` text
NOT NULL
UNIQUE
CHECK
FOREIGN KEY
```

Business invariants that must never be violated should be enforced as
close to the data as practical.

------------------------------------------------------------------------

# 30. Indexing

Index based on actual query patterns.

Common multi-tenant index:

``` text
(organization_id, created_at)
```

Domain examples:

``` text
(organization_id, farm_id)
(organization_id, status)
(organization_id, branch_id, created_at)
```

Do not create indexes for every column.

------------------------------------------------------------------------

# 31. RLS Performance

RLS can affect query performance, especially on large tables.

Design policies and indexes together.

Supabase's current documentation specifically recommends indexing
columns used by RLS policies and optimizing policy expressions for
performance. citeturn0search0

------------------------------------------------------------------------

# 32. Partitioning

Partition only when data volume and access patterns justify it.

Potential candidates:

``` text
high-volume events
telemetry
audit history
transaction history
large time-series data
```

Partition keys might include:

``` text
time
organization
domain
```

Do not partition every table prematurely.

------------------------------------------------------------------------

# 33. Read Scaling

As demand grows:

``` text
Primary
 ↓
Read Replicas
 ↓
Analytics / Warehouse
```

Transactional writes remain on the authoritative primary.

------------------------------------------------------------------------

# 34. Analytics Boundary

Do not run heavy analytical workloads against the transactional database
indefinitely.

Architecture:

``` text
PostgreSQL
 ↓
CDC / ETL / Events
 ↓
Analytics Store / Warehouse
```

Operational dashboards may still use optimized transactional queries for
low-volume needs.

------------------------------------------------------------------------

# 35. Redis

Redis is not the source of truth.

Use it for:

``` text
cache
rate limiting
short-lived sessions/state
distributed coordination
queue support
temporary AI state
```

Never treat cached state as authoritative business records.

------------------------------------------------------------------------

# 36. Cache Rules

Every cache should define:

``` text
key
scope
TTL
invalidation
fallback
```

Tenant-sensitive cache keys must include tenant scope where required.

Example:

``` text
org:{organization_id}:dashboard:{period}
```

------------------------------------------------------------------------

# 37. Object Storage

Store large binary objects outside PostgreSQL.

Examples:

``` text
images
documents
PDFs
exports
attachments
AI artifacts
```

Database stores metadata and secure object references.

------------------------------------------------------------------------

# 38. Object Storage Isolation

Object paths should be tenant-aware.

Example:

``` text
organizations/{org_id}/documents/{object_id}
```

Access should be controlled with:

``` text
authorization
signed URLs
expiry
object policies
```

------------------------------------------------------------------------

# 39. Search

Search architecture may combine:

``` text
PostgreSQL full-text search
+
dedicated search engine where justified
```

Start with PostgreSQL where it is sufficient.

Do not introduce another search system without a real workload
requirement.

------------------------------------------------------------------------

# 40. Vector Data

Mianx AI may use vector embeddings for:

``` text
knowledge retrieval
semantic search
memory retrieval
document search
```

PostgreSQL with pgvector is an appropriate initial option where the
workload fits.

Supabase currently supports `pgvector` as a Postgres extension; current
platform guidance also notes that explicit extension version pinning is
deprecated in favor of the platform's default extension versions.
citeturn0search1turn0search13

------------------------------------------------------------------------

# 41. Vector Isolation

Every vector record must preserve authorization scope.

Conceptually:

``` text
embedding
 ├── organization_id
 ├── domain
 ├── source_id
 ├── visibility
 └── embedding
```

Similarity search must apply tenant/domain filters before returning
usable context.

------------------------------------------------------------------------

# 42. AI Memory Storage

Memory should be separated logically into:

``` text
session
conversation
user
organization
domain
agent
```

Each record should include scope and ownership metadata.

------------------------------------------------------------------------

# 43. AI Knowledge Storage

Knowledge records should preserve:

``` text
source
organization
domain
document
version
visibility
chunk
embedding
metadata
```

The model should be able to trace important answers back to authorized
sources.

------------------------------------------------------------------------

# 44. AI Data Retention

Define separate retention policies for:

``` text
conversation history
agent runs
tool calls
memory
knowledge documents
embeddings
AI cost telemetry
```

Do not retain everything forever by default.

------------------------------------------------------------------------

# 45. Audit Data

Audit logs are separate from ordinary application logs.

Audit records should capture important:

``` text
actor
organization
action
resource
before/after where appropriate
timestamp
request_id
```

Audit records should have controlled retention and access.

------------------------------------------------------------------------

# 46. Sensitive Data

Classify data:

``` text
Public
Internal
Confidential
Restricted
```

Restricted information may include:

``` text
credentials
financial secrets
private customer information
security material
tokens
```

Sensitive values must not appear in ordinary logs.

------------------------------------------------------------------------

# 47. Secrets

Secrets belong in a secrets-management system, not normal business
tables.

Examples:

``` text
API keys
OAuth refresh tokens
database credentials
encryption keys
webhook secrets
```

Applications should retrieve secrets securely at runtime.

------------------------------------------------------------------------

# 48. Encryption

Use encryption:

``` text
in transit
at rest
```

For highly sensitive application fields, consider application-level
encryption where justified.

Key management must be separate from encrypted data.

------------------------------------------------------------------------

# 49. Database Backups

Backups should be:

``` text
automated
monitored
tested
retained
protected
```

A backup that has never been restored is not a proven recovery
mechanism.

Supabase documents daily database backups and point-in-time recovery on
paid plans; however, storage objects are not included in database
backups, so object-storage backup strategy must be handled separately.
citeturn0search1

------------------------------------------------------------------------

# 50. Disaster Recovery

Define:

``` text
RPO
RTO
backup frequency
restore procedure
failover strategy
regional recovery
```

Different data classes may have different targets.

------------------------------------------------------------------------

# 51. Restore Testing

At planned intervals:

``` text
Backup
 ↓
Restore
 ↓
Integrity checks
 ↓
Application verification
 ↓
Document result
```

Recovery testing belongs in the production operations process.

------------------------------------------------------------------------

# 52. Migration Strategy

All production schema changes should be migration-controlled.

Process:

``` text
Migration
 ↓
Review
 ↓
Test
 ↓
Staging
 ↓
Production
```

Avoid manual production schema changes that cannot be reproduced.

------------------------------------------------------------------------

# 53. Expand / Contract Migrations

For risky changes:

``` text
Expand
 ↓
Deploy compatible code
 ↓
Backfill
 ↓
Switch reads/writes
 ↓
Contract
```

This avoids downtime from incompatible schema changes.

------------------------------------------------------------------------

# 54. Data Backfills

Large backfills should be:

``` text
batched
resumable
observable
rate-limited
idempotent
```

Do not lock a large production table unnecessarily.

------------------------------------------------------------------------

# 55. Connection Management

Application services should use appropriate connection pooling.

For managed Supabase deployments, Supavisor provides connection pooling;
the current documentation distinguishes direct connections from pooler
modes and recommends choosing based on environment and workload.
citeturn0search8

------------------------------------------------------------------------

# 56. Prisma / Data Access Layer

If Mianx uses Prisma:

``` text
API
 ↓
Service Layer
 ↓
Repository / Data Access
 ↓
Prisma
 ↓
PostgreSQL
```

Do not allow arbitrary database access throughout application code.

Centralize:

``` text
tenant scoping
transactions
common filters
data access rules
```

------------------------------------------------------------------------

# 57. Tenant Context

The request context should establish:

``` text
user
organization
domain
location
permissions
```

The data access layer must not accept an organization ID blindly from
user input.

It should derive or validate tenant context from authenticated
authorization.

------------------------------------------------------------------------

# 58. Cross-Tenant Operations

Only trusted platform operations may intentionally cross tenant
boundaries.

Examples:

``` text
SaaS billing aggregation
platform health
global anonymized analytics
support operations
```

These operations must be:

``` text
explicit
audited
privileged
limited
```

------------------------------------------------------------------------

# 59. Platform vs Tenant Data

Separate:

``` text
Platform Data
```

from:

``` text
Tenant Business Data
```

Platform operators may see platform metrics without automatically
receiving unrestricted business data.

------------------------------------------------------------------------

# 60. Global Configuration

Some configuration is global:

``` text
feature definitions
domain catalog
system policies
model catalog
platform settings
```

Tenant overrides should be explicit:

``` text
Global Default
 ↓
Domain Default
 ↓
Organization Override
```

------------------------------------------------------------------------

# 61. Multi-Brand Data

An organization may own multiple brands.

Data model:

``` text
Organization
 ├── Brand A
 │    ├── Location
 │    └── Domain Data
 └── Brand B
      ├── Location
      └── Domain Data
```

Permissions may be organization-wide, brand-specific or
location-specific.

------------------------------------------------------------------------

# 62. Multi-Location Data

A user may have:

``` text
organization access
brand access
location access
```

Policies must support scoped permissions without creating tenant
leakage.

------------------------------------------------------------------------

# 63. Domain Data Sharing

Cross-domain sharing should occur through explicit contracts.

Example:

``` text
Restaurant
 ↓
Finance Core
```

not:

``` text
Restaurant directly reads arbitrary finance tables
```

Use:

``` text
service interfaces
events
read models
approved views
```

------------------------------------------------------------------------

# 64. Domain Data Ownership

Each domain owns its business logic and canonical data.

Example:

``` text
Poultry OS owns:
flocks
farms
feed operations
poultry workflows
```

Core may store:

``` text
organization
billing
identity
entitlements
AI infrastructure
```

------------------------------------------------------------------------

# 65. Reporting / Read Models

Cross-domain dashboards may use dedicated read models.

``` text
Domain Data
 ↓
Events / ETL
 ↓
Read Model
 ↓
Dashboard
```

This avoids tightly coupling domain databases to reporting queries.

------------------------------------------------------------------------

# 66. Event-Driven Data Integration

Use the previously defined Event Platform for:

``` text
domain changes
analytics
AI triggers
notifications
integration synchronization
```

Database remains authoritative; events communicate facts about changes.

------------------------------------------------------------------------

# 67. Data Lineage

Important analytical and AI data should preserve lineage.

Example:

``` text
AI Recommendation
 ↓
Source Records
 ↓
Source Document
 ↓
Source Version
```

This improves explainability and debugging.

------------------------------------------------------------------------

# 68. Data Quality

Critical data pipelines should monitor:

``` text
completeness
validity
uniqueness
consistency
timeliness
referential integrity
```

Domain-specific data-quality rules belong to the domain.

------------------------------------------------------------------------

# 69. Data Lifecycle

Generic lifecycle:

``` text
Create
 ↓
Active
 ↓
Updated
 ↓
Archived
 ↓
Retention
 ↓
Delete / Anonymize
```

Lifecycle differs by data class and legal/business requirement.

------------------------------------------------------------------------

# 70. Tenant Offboarding

When an organization leaves Mianx:

``` text
Suspend
 ↓
Export if required
 ↓
Retention period
 ↓
Delete / Anonymize
 ↓
Remove credentials
 ↓
Verify cleanup
```

Offboarding must cover:

``` text
database
objects
AI memory
AI knowledge
vectors
integrations
webhooks
cache
search indexes
backups according to retention policy
```

------------------------------------------------------------------------

# 71. Tenant Onboarding

Provisioning should create:

``` text
organization
membership
domain activation
entitlements
default configuration
storage namespace
integration state
AI configuration
```

Avoid manually creating database structures per tenant.

------------------------------------------------------------------------

# 72. Tenant Health Data

Core operational views can combine:

``` text
database activity
API usage
workflow health
integration health
AI usage
billing
```

These are observability views, not necessarily source-of-truth business
tables.

------------------------------------------------------------------------

# 73. Scaling Path

Initial:

``` text
Single PostgreSQL platform
+
Redis
+
Object Storage
```

Growth:

``` text
Connection pooling
+
Read replicas
+
Partitioning
+
Analytics warehouse
```

Large-scale:

``` text
Regional data
+
Domain-specific clusters
+
Dedicated high-volume workloads
```

Migration should be driven by measured bottlenecks.

------------------------------------------------------------------------

# 74. Data Architecture Definition of Done

``` text
✓ Organization model
✓ Membership model
✓ Domain registry
✓ Domain activation
✓ Tenant ownership
✓ RLS strategy
✓ API grants strategy
✓ Core/domain boundaries
✓ IDs
✓ Foreign keys
✓ Constraints
✓ Index strategy
✓ Transactions
✓ Concurrency
✓ Redis role
✓ Object storage
✓ Search
✓ Vector architecture
✓ AI memory
✓ AI knowledge
✓ Audit data
✓ Data classification
✓ Secrets strategy
✓ Encryption
✓ Backups
✓ Disaster recovery
✓ Migration strategy
✓ Connection pooling
✓ Prisma/data access boundary
✓ Cross-domain contracts
✓ Data lifecycle
✓ Tenant onboarding
✓ Tenant offboarding
✓ Scaling path
```

------------------------------------------------------------------------

# 75. Implementation Order

``` text
1. Organization + membership
2. Domain registry
3. Tenant ownership model
4. Core schemas
5. Domain schemas
6. Foreign keys / constraints
7. RLS
8. Authorization data model
9. Data access layer
10. Indexes
11. Redis
12. Object storage
13. Search
14. Vector / AI storage
15. Audit
16. Migrations
17. Backups
18. Restore testing
19. Analytics boundary
20. Scaling controls
21. Tenant lifecycle automation
```

------------------------------------------------------------------------

# 76. Final Data Principle

> **One Mianx data foundation, strict tenant isolation, explicit domain
> ownership, and a controlled path from transactional data to AI,
> analytics and integrations.**

``` text
              MIANX DATA PLATFORM
                       │
                ORGANIZATION
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       POULTRY      RESTAURANT    RETAIL
          │            │            │
          └────────────┼────────────┘
                       ↓
                CORE SERVICES
                       ↓
        AI | Analytics | Integrations
```

------------------------------------------------------------------------

# 77. Next Technical Deliverable

Next:

# MIANX.AI CORE --- SECURITY, IDENTITY, RBAC/ABAC & GOVERNANCE SPECIFICATION v1.0

It will define:

-   Identity architecture
-   Authentication
-   Sessions
-   MFA
-   Organizations
-   Roles
-   Permissions
-   RBAC
-   ABAC
-   Domain permissions
-   Location/branch permissions
-   Service identities
-   AI identities
-   API authorization
-   RLS relationship
-   Secrets
-   Security policies
-   Audit
-   Security events
-   Threat model
-   Tenant isolation controls
-   Data protection
-   Admin/Super Admin security
-   Incident/security response
