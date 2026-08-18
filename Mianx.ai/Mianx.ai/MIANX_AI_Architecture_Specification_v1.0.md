# MIANX.AI --- ARCHITECTURE SPECIFICATION v1.0

**Product:** Mianx.ai\
**Architecture:** Multi-Tenant, Multi-Domain, AI-Native Business
Operating System\
**Status:** Foundation Architecture\
**Version:** 1.0\
**Principle:** Build the Core once. Build unlimited Business OS products
on top.

------------------------------------------------------------------------

## 0. Architecture Constitution

Mianx.ai Core is not designed for one business domain.

Core provides common business capabilities. Poultry, Restaurant, Retail,
Manufacturing and future domains are extensions of Mianx.ai Core.

``` text
                 MIANX.AI
                     │
              ┌──────┴──────┐
              │             │
           CORE OS       AI CORE
              │             │
       ┌──────┼──────┐      │
       │      │      │      │
    Identity Tenant Security AI
    Users    Domain  Billing Agents
    Roles    Modules API     Memory
    Teams    Workflow Files  Knowledge
              │             │
              └──────┬──────┘
                     │
               DOMAIN ENGINE
                     │
          ┌──────────┼──────────┐
          │          │          │
       Poultry   Restaurant   Retail
          │          │          │
       Modules    Modules    Modules
```

------------------------------------------------------------------------

# 1. System Layers

Mianx.ai is divided into six primary layers:

### Layer 1 --- Experience

-   Web App
-   Admin Console
-   AI Workspace
-   Domain dashboards
-   Mobile/PWA later

### Layer 2 --- Application/Core

-   Organizations
-   Users
-   Teams
-   Roles
-   Permissions
-   Domains
-   Modules
-   Settings
-   Billing

### Layer 3 --- Intelligence

-   AI Gateway/Router
-   Agents
-   Tools
-   Memory
-   Knowledge
-   AI governance
-   AI cost/usage

### Layer 4 --- Automation

-   Events
-   Jobs
-   Workflows
-   Triggers
-   Actions
-   Schedules
-   Approvals

### Layer 5 --- Data

-   PostgreSQL
-   Storage
-   Vector/knowledge data where required
-   Cache
-   Audit/event data

### Layer 6 --- Integration

-   APIs
-   Webhooks
-   External services
-   Messaging
-   Payments
-   Third-party systems

------------------------------------------------------------------------

# 2. Technology Baseline

Current baseline:

  -----------------------------------------------------------------------
  Area                                Direction
  ----------------------------------- -----------------------------------
  Frontend                            Next.js + React + TypeScript

  Backend                             Next.js server-side architecture +
                                      dedicated services only where
                                      justified

  Database                            PostgreSQL / Supabase

  Auth                                Supabase Auth

  Storage                             Supabase Storage

  AI                                  Provider-agnostic Mianx AI
                                      abstraction

  AI application layer                Vercel AI SDK where appropriate

  Deployment                          Vercel-oriented

  API                                 Typed application/API layer

  Security                            PostgreSQL RLS + application
                                      authorization

  Background work                     Queue/workflow infrastructure based
                                      on actual workload
  -----------------------------------------------------------------------

Exact package versions and current APIs will be verified when the
project is created rather than hard-coded into this architecture
document.

------------------------------------------------------------------------

# 3. Multi-Tenant Architecture

Every tenant-owned resource has a clear organization ownership boundary.

``` text
organization_id
      ↓
every tenant-owned resource
```

Core hierarchy:

``` text
Mianx Platform
    ↓
Organization
    ↓
Brand / Business
    ↓
Branch / Location
    ↓
Department / Team
    ↓
Users
```

The architecture supports: - Single-business customers - Multi-branch
businesses - Multi-brand businesses - Enterprise organizations -
Multiple domains inside one organization

------------------------------------------------------------------------

# 4. Identity Architecture

``` text
User
 │
 ├── Profile
 ├── Membership
 │      ↓
 │   Organization
 │      ↓
 │   Role
 │      ↓
 │   Permissions
 │
 └── Sessions
```

A user may belong to multiple organizations. The active organization
determines the operating context.

------------------------------------------------------------------------

# 5. Authorization Architecture

Authorization is layered:

``` text
Authentication
      ↓
Organization Membership
      ↓
Role
      ↓
Permission
      ↓
Resource Ownership
      ↓
Action
```

Example permissions:

``` text
poultry.flock.view
poultry.flock.create
poultry.flock.update
poultry.flock.delete
poultry.sale.create
finance.report.view
```

AI agents use the same authorization system.

**AI is not an administrator by default.**

------------------------------------------------------------------------

# 6. Domain Architecture

A domain is a self-contained business capability package.

Conceptually:

``` text
/domain
   /poultry
      manifest
      modules
      permissions
      workflows
      agents
      dashboards
      migrations
```

Later:

``` text
/domain
   /poultry
   /restaurant
   /retail
   /manufacturing
```

The Core should not contain poultry-specific business rules.

------------------------------------------------------------------------

# 7. Domain Manifest

Every domain should describe itself through a manifest containing:

-   name
-   slug
-   version
-   description
-   modules
-   permissions
-   agents
-   workflows
-   dashboards
-   settings

Example:

``` text
Poultry
 ├── Farm
 ├── Shed
 ├── Flock
 ├── Feed
 └── Sales
```

This lets the Core discover what a domain provides.

------------------------------------------------------------------------

# 8. Module Architecture

``` text
Domain
  ↓
Module
  ↓
Features
  ↓
Actions
```

Modules support: - Activation - Deactivation - Permissions -
Configuration - Subscription entitlements - Dependencies

Example:

``` text
Poultry
 ├── Farm
 ├── Flock
 ├── Feed
 ├── Sales
 └── Finance
```

------------------------------------------------------------------------

# 9. AI Architecture

AI is a first-class platform service.

``` text
                    AI CORE
                       │
          ┌────────────┼────────────┐
          │            │            │
       Router        Agents       Memory
          │            │            │
       Models        Tools       Knowledge
                       │
                 Permissions
                       │
                  Governance
                       │
                     Audit
```

### AI Router

Applications should use the Mianx AI abstraction rather than being
hard-coded to one model provider.

``` text
Application
    ↓
Mianx AI Layer
    ↓
Model Router
    ↓
Provider / Model
```

------------------------------------------------------------------------

# 10. Agent Architecture

Every agent has:

``` text
Agent
├── Identity
├── Instructions
├── Model configuration
├── Tools
├── Permissions
├── Memory
├── Knowledge
├── Workflows
├── Limits
└── Audit
```

Example:

``` text
Poultry Farm Manager Agent

Tools:
- get_flock_metrics
- get_feed_usage
- get_mortality
- create_alert

Permissions:
- poultry.flock.view
- poultry.feed.view
- poultry.alert.create
```

The agent cannot arbitrarily access finance data.

------------------------------------------------------------------------

# 11. AI Memory

Memory is separated into:

-   User Memory
-   Organization Memory
-   Agent Memory
-   Conversation Memory
-   Domain Knowledge

This separation helps prevent cross-tenant knowledge leakage.

------------------------------------------------------------------------

# 12. Knowledge Architecture

Knowledge sources include:

-   Documents
-   Business records
-   Structured database data
-   Domain documentation
-   User-provided information
-   External integrations

Pipeline:

``` text
Source
 ↓
Ingestion
 ↓
Processing
 ↓
Indexing
 ↓
Retrieval
 ↓
AI Context
```

------------------------------------------------------------------------

# 13. Event Architecture

Core business actions emit events.

Examples:

``` text
payment.created
payment.overdue
inventory.low
workflow.started
workflow.completed
agent.action.completed
```

Events can trigger: - Automation - AI - Notifications - Analytics -
Integrations - Audit

------------------------------------------------------------------------

# 14. Workflow Architecture

``` text
Trigger
 ↓
Condition
 ↓
Step
 ↓
Action
 ↓
Condition
 ↓
Action
 ↓
Completion
```

Workflows support: - Human actions - AI actions - System actions -
Delays - Schedules - Retries - Approvals

A specific workflow runtime will be selected after evaluating actual
requirements and infrastructure.

------------------------------------------------------------------------

# 15. Audit Architecture

Every meaningful mutation should be traceable.

Audit records should capture, where applicable:

-   Actor
-   Resource
-   Action
-   Organization
-   Timestamp
-   Before/After
-   Source
-   Result

Actor types: - Human - AI Agent - System - Integration

------------------------------------------------------------------------

# 16. Billing Architecture

Separate:

**Subscription → Entitlements → Usage**

Example:

``` text
Plan
 ↓
Entitlements
 ↓
Organization
 ↓
Usage
 ↓
Limits / Billing
```

This allows plans such as Basic, Pro, Business and Enterprise without
embedding plan logic into individual domains.

------------------------------------------------------------------------

# 17. AI Usage & Cost

Track: - Organization AI usage - Agent usage - Model usage - Usage
units/tokens - Estimated cost - Tool usage - Workflow usage

This enables AI quotas, cost controls, customer billing and internal
profitability analysis.

------------------------------------------------------------------------

# 18. Platform Command Center

Mianx owner/admin console:

``` text
Mianx Command Center

├── Organizations
├── Users
├── Domains
├── Modules
├── Subscriptions
├── Revenue
├── AI Usage
├── AI Cost
├── Workflows
├── Integrations
├── Security
├── Audit
├── System Health
└── Platform Settings
```

------------------------------------------------------------------------

# 19. Client Experience

``` text
Login
  ↓
Mianx Workspace
  ↓
Organization
  ↓
Active Domains
  ↓
Domain Dashboard
  ↓
Modules
  ↓
Data + Automation + AI
```

The client should experience Mianx.ai as one unified platform.

------------------------------------------------------------------------

# 20. UI Architecture

Core navigation:

``` text
Mianx
│
├── Home
├── My Business
├── Domains
├── AI
├── Automations
├── Analytics
├── Integrations
├── Team
├── Billing
└── Settings
```

Domain navigation is dynamically generated from enabled modules.

------------------------------------------------------------------------

# 21. Database Architecture --- Initial Direction

### Core entities

``` text
organizations
users/profiles
memberships
teams
roles
permissions
role_permissions
domains
organization_domains
modules
organization_modules
subscriptions
entitlements
usage_records
agents
agent_tools
workflows
workflow_runs
events
notifications
integrations
audit_logs
files
knowledge
```

### Domain entities

Domain-owned tables remain inside their domain boundary.

For example, Poultry may eventually contain:

``` text
farms
sheds
flocks
feed_records
mortality_records
weight_records
medicine_records
...
```

The actual SQL schema will be finalized through an ERD and access matrix
before implementation.

------------------------------------------------------------------------

# 22. Database Security

For Supabase/Postgres:

**RLS is mandatory for tenant-owned exposed tables.**

Policies must implement actual ownership/access rules.

Authorization should not depend on user-editable profile metadata.

------------------------------------------------------------------------

# 23. API Architecture

``` text
Request
 ↓
Authentication
 ↓
Organization Context
 ↓
Authorization
 ↓
Validation
 ↓
Business Logic
 ↓
Database
 ↓
Audit/Event
 ↓
Response
```

No business endpoint should bypass authorization.

------------------------------------------------------------------------

# 24. Observability

Mianx.ai should eventually track:

-   Errors
-   Request latency
-   Database performance
-   Workflow failures
-   AI latency
-   AI usage
-   AI cost
-   Integration failures
-   Security events

Infrastructure will be introduced according to actual requirements.

------------------------------------------------------------------------

# 25. Repository Strategy

Conceptual structure:

``` text
Mianx.ai
│
├── apps/
│   └── web/
│
├── core/
│   ├── auth/
│   ├── tenancy/
│   ├── permissions/
│   ├── domains/
│   ├── modules/
│   ├── billing/
│   └── ...
│
├── ai/
│   ├── router/
│   ├── agents/
│   ├── memory/
│   ├── knowledge/
│   └── governance/
│
├── automation/
│   ├── events/
│   ├── workflows/
│   └── jobs/
│
├── domains/
│   └── poultry/       ← later
│
└── database/
```

This is conceptual until the actual repository is inspected.

------------------------------------------------------------------------

# 26. Implementation Order

## Foundation

1.  Repository
2.  Environment configuration
3.  Database
4.  Authentication
5.  Organizations
6.  Memberships
7.  Roles
8.  Permissions

## Platform

9.  Domain Engine
10. Module Engine
11. Settings
12. Notifications
13. Audit

## AI

14. AI abstraction
15. Model routing
16. Agent registry
17. Tools
18. Agent permissions
19. Memory
20. Knowledge

## Automation

21. Events
22. Workflows
23. Jobs
24. Approvals

## SaaS

25. Billing
26. Entitlements
27. Usage metering

## Operations

28. Command Center
29. Observability
30. Security hardening
31. Testing
32. Production readiness

Then:

**Phase 1 → Mianx Poultry OS**

------------------------------------------------------------------------

# 27. What We Will Not Do Yet

We will not prematurely build:

-   Full Poultry modules
-   Restaurant modules
-   Retail modules
-   Complex microservices
-   Unnecessary Kubernetes infrastructure
-   Dozens of external integrations
-   Advanced AI workforce before the Core is stable

First:

> **Strong Core.**

------------------------------------------------------------------------

# 28. Definition of Done --- Core v1

Mianx.ai Core is ready for Phase 1 when:

``` text
✓ User can register/login
✓ Organization can be created
✓ Users can join organizations
✓ Roles work
✓ Permissions work
✓ Tenant isolation works
✓ Domains can be registered/activated
✓ Modules can be activated
✓ Events work
✓ Audit works
✓ AI agents have controlled permissions
✓ AI usage is tracked
✓ Basic workflows execute
✓ Billing/entitlements have a foundation
✓ Command Center can manage the platform
✓ Security tests pass
✓ Core can accept a new domain
```

------------------------------------------------------------------------

# 29. Next Technical Deliverable

The next document is:

**MIANX.AI CORE --- DATABASE & TENANCY SPECIFICATION v1.0**

It will define:

-   ERD
-   Tables
-   Relationships
-   Primary/foreign keys
-   Indexes
-   `organization_id` strategy
-   RLS model
-   Roles/permissions
-   Audit model

Only after this specification will database implementation begin.

------------------------------------------------------------------------

## Final Principle

> **Build Mianx.ai Core once. Build unlimited Business Operating Systems
> on top of it.**

Mianx.ai Core is the foundation.

Poultry is the first building.

Restaurant, Retail, Manufacturing and future domains are additional
buildings.

**The foundation must be stronger than any individual building.**
