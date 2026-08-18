# MIANX.AI CORE --- BILLING, SUBSCRIPTION & ENTITLEMENT PLATFORM SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Billing, Subscription & Entitlement Platform\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Purpose:** Define the commercial SaaS foundation that controls plans,
subscriptions, domains, modules, usage, AI consumption, limits, trials,
billing lifecycle and customer entitlements.

------------------------------------------------------------------------

# 1. Purpose

Mianx.ai must be commercially capable before individual Domain OS
products scale.

The billing platform therefore belongs to **Mianx.ai Core**.

``` text
Customer
   ↓
Organization
   ↓
Subscription
   ↓
Plan
   ↓
Entitlements
   ↓
Domains / Modules / Features
   ↓
Usage
   ↓
Billing
```

The goal is to make every domain commercially configurable without
creating a separate billing system.

------------------------------------------------------------------------

# 2. Commercial Constitution

1.  Billing is a Core platform capability.
2.  Subscription status determines commercial access.
3.  Authorization still determines security access.
4.  Entitlement determines whether a capability is commercially enabled.
5.  Feature flags are not billing.
6.  Usage metering must be independent from UI display.
7.  AI usage and AI cost must be measurable.
8.  Domain products must be packageable independently or together.
9.  Upgrade/downgrade must preserve data safely.
10. Billing failures must have controlled grace and suspension behavior.

------------------------------------------------------------------------

# 3. Commercial Model

Mianx.ai can sell:

``` text
Platform
Domains
Modules
Users / Seats
Usage
AI Consumption
Integrations
Add-ons
Services
```

Example:

``` text
Mianx Core
   +
Poultry OS
   +
Advanced Analytics
   +
AI Workforce
   +
Additional Users
```

------------------------------------------------------------------------

# 4. Core Commercial Entities

Conceptual entities:

``` text
plans
plan_versions
subscriptions
subscription_items
entitlements
features
feature_limits
usage_meters
usage_records
invoices
payments
credits
coupons
trials
billing_events
```

------------------------------------------------------------------------

# 5. Plan

A plan defines a commercial package.

Example:

``` text
Starter
Growth
Professional
Enterprise
```

A plan should define:

``` text
name
description
billing model
included features
included domains
limits
usage allowances
seat allowances
AI allowance
```

------------------------------------------------------------------------

# 6. Plan Versioning

Never mutate historical commercial meaning silently.

Use:

``` text
Plan
 ↓
Plan Version
```

Example:

``` text
Poultry Growth v1
Poultry Growth v2
```

Existing subscriptions may remain attached to their current version
until migrated.

------------------------------------------------------------------------

# 7. Features

Features represent capabilities.

Examples:

``` text
poultry.dashboard
poultry.flock_management
poultry.procurement
poultry.ai_assistant
advanced.analytics
api.access
whatsapp.integration
```

Features are reusable commercial building blocks.

------------------------------------------------------------------------

# 8. Entitlements

Entitlements answer:

> Is this organization commercially allowed to use this capability?

Possible states:

``` text
enabled
disabled
limited
trial
expired
suspended
```

Authorization answers whether the user may use it.

Entitlement answers whether the organization has purchased it.

Both checks may be required.

------------------------------------------------------------------------

# 9. Entitlement Resolution

Conceptual:

``` text
Request
 ↓
Organization
 ↓
Subscription
 ↓
Plan
 ↓
Entitlement
 ↓
User Permission
 ↓
Policy
 ↓
Allow / Deny
```

This creates a clean separation between:

``` text
commercial access
security access
operational policy
```

------------------------------------------------------------------------

# 10. Domain Entitlements

Example:

``` text
organization
 ├── Poultry OS = enabled
 ├── Restaurant OS = disabled
 └── Retail OS = trial
```

This allows Mianx to sell multiple domain products under one platform
account.

------------------------------------------------------------------------

# 11. Module Entitlements

A domain can contain modules.

Example:

``` text
Poultry OS
 ├── Farm Management = enabled
 ├── Flock Management = enabled
 ├── Procurement = enabled
 ├── Advanced Analytics = disabled
 └── AI Workforce = trial
```

------------------------------------------------------------------------

# 12. Feature Limits

Entitlements may include limits.

Examples:

``` text
users <= 5
farms <= 3
active_flocks <= 100
api_calls <= 10,000/month
ai_tokens <= configured allowance
storage <= 20 GB
```

Limits should be machine-readable.

------------------------------------------------------------------------

# 13. Usage Metering

Usage should be captured independently from billing presentation.

Conceptual:

``` text
usage_meter
 ↓
usage_event
 ↓
aggregation
 ↓
billing calculation
```

Examples:

``` text
api.requests
ai.tokens
ai.runs
storage.bytes
messages.sent
orders.processed
users.active
```

------------------------------------------------------------------------

# 14. Usage Event

A usage event may contain:

``` text
id
organization_id
meter_key
quantity
unit
source
occurred_at
idempotency_key
metadata
```

Usage events should be safely deduplicated.

------------------------------------------------------------------------

# 15. Idempotent Metering

Billing must never double-charge because the same event was processed
twice.

Use an idempotency key or equivalent deduplication mechanism.

``` text
Usage Event
 ↓
Deduplication
 ↓
Accepted
 ↓
Aggregation
```

------------------------------------------------------------------------

# 16. AI Usage

AI usage should be measured separately.

Possible meters:

``` text
ai.requests
ai.input_tokens
ai.output_tokens
ai.total_tokens
ai.tool_calls
ai.agent_runs
ai.embedding_usage
```

------------------------------------------------------------------------

# 17. AI Cost Tracking

Mianx needs internal AI cost visibility.

Conceptual:

``` text
AI Request
 ↓
Model
 ↓
Provider
 ↓
Usage
 ↓
Estimated / actual cost
 ↓
Organization attribution
```

This allows:

``` text
customer revenue
-
AI cost
=
AI gross margin visibility
```

------------------------------------------------------------------------

# 18. AI Budget Controls

Organizations may have:

``` text
monthly AI budget
daily AI limit
per-agent limit
per-user limit
per-domain limit
```

When a limit is reached:

``` text
warn
 ↓
restrict
 ↓
require upgrade / approval
```

The exact behavior is configurable.

------------------------------------------------------------------------

# 19. Seats

Seat-based billing may include:

``` text
licensed seats
active seats
invited seats
additional seats
```

The product must clearly define which count is billable.

------------------------------------------------------------------------

# 20. Add-ons

Add-ons allow customers to purchase capabilities without changing the
entire plan.

Examples:

``` text
Extra AI
Extra storage
Extra users
Advanced analytics
Premium integration
Additional domain
```

------------------------------------------------------------------------

# 21. Trials

Trial model:

``` text
Trial Started
 ↓
Trial Active
 ↓
Trial Ending
 ↓
Converted
OR
Expired
```

Trial configuration may include:

``` text
duration
features
usage limits
seat limits
conversion behavior
```

------------------------------------------------------------------------

# 22. Trial Entitlements

Trial features should be represented as normal entitlements with a trial
state.

This avoids creating a second feature-access system.

------------------------------------------------------------------------

# 23. Subscription Lifecycle

Recommended states:

``` text
trialing
active
past_due
grace_period
paused
cancelled
expired
suspended
```

State transitions must be explicit.

------------------------------------------------------------------------

# 24. Subscription Activation

Activation flow:

``` text
Plan Selected
 ↓
Checkout / Commercial Confirmation
 ↓
Payment Confirmation
 ↓
Subscription Created
 ↓
Entitlements Generated
 ↓
Domain Enabled
 ↓
Customer Ready
```

Do not grant permanent paid access based solely on a client-side success
page.

------------------------------------------------------------------------

# 25. Upgrade

Upgrade should normally be immediate or follow configured commercial
rules.

Flow:

``` text
Current Plan
 ↓
Select New Plan
 ↓
Calculate Difference
 ↓
Payment / Billing Adjustment
 ↓
Update Subscription
 ↓
Update Entitlements
 ↓
Audit
```

------------------------------------------------------------------------

# 26. Downgrade

Downgrade requires special care.

If the customer currently exceeds the new limits:

``` text
Current usage > new limit
```

Options may include:

``` text
block downgrade
schedule downgrade
allow downgrade but restrict new creation
request cleanup
```

Never silently delete customer data to satisfy a lower plan.

------------------------------------------------------------------------

# 27. Cancellation

Cancellation should define:

``` text
immediate
end-of-period
scheduled cancellation
```

Customer data retention must be separate from subscription cancellation.

------------------------------------------------------------------------

# 28. Payment Failure

Payment failure lifecycle:

``` text
Payment Failed
 ↓
Retry
 ↓
Past Due
 ↓
Grace Period
 ↓
Restricted
 ↓
Suspended
```

The exact timeline is a commercial policy.

------------------------------------------------------------------------

# 29. Grace Period

During grace:

``` text
existing data remains accessible
critical read operations may continue
new premium actions may be restricted
billing reminders are shown
```

Do not destroy customer data because of a temporary payment failure.

------------------------------------------------------------------------

# 30. Suspension

Suspension may restrict:

``` text
new operational writes
premium modules
AI usage
API access
automation
```

Read-only access may be retained depending on policy.

------------------------------------------------------------------------

# 31. Entitlement Enforcement

Every premium operation should be checked through a common entitlement
service.

Conceptual:

``` text
EntitlementService.can(
    organization,
    feature,
    quantity/context
)
```

This prevents domain-specific billing logic from being scattered across
applications.

------------------------------------------------------------------------

# 32. Feature Access Contract

A feature check can return:

``` text
allowed
reason
limit
current_usage
remaining
reset_at
```

Example:

``` text
AI usage:
allowed = true
remaining = 72,000 tokens
reset_at = next billing cycle
```

------------------------------------------------------------------------

# 33. Commercial vs Security Checks

Always separate:

``` text
Entitlement
+
Authorization
+
Policy
```

Example:

``` text
Customer purchased Procurement
BUT
employee lacks purchase.approve permission
```

Result:

``` text
DENY
```

If:

``` text
employee has permission
BUT
Procurement not included in plan
```

Result:

``` text
DENY
```

------------------------------------------------------------------------

# 34. Billing Events

Core billing events may include:

``` text
subscription.created
subscription.activated
subscription.upgraded
subscription.downgraded
subscription.cancelled
payment.succeeded
payment.failed
invoice.created
invoice.paid
invoice.failed
trial.started
trial.ended
entitlement.changed
usage.threshold.reached
```

All events should be versioned.

------------------------------------------------------------------------

# 35. Invoices

Invoice data should contain:

``` text
invoice_id
organization_id
subscription_id
period_start
period_end
line_items
subtotal
discount
tax
total
currency
status
issued_at
due_at
paid_at
```

Historical invoices must remain reproducible.

------------------------------------------------------------------------

# 36. Invoice Line Items

Line items can represent:

``` text
base plan
domain
module
seats
usage
AI
add-ons
credits
discounts
tax
```

------------------------------------------------------------------------

# 37. Credits

Credits may be used for:

``` text
AI credits
usage credits
promotional credits
service credits
```

Credit rules must define:

``` text
amount
currency/unit
expiration
priority
applicability
```

------------------------------------------------------------------------

# 38. Coupons / Discounts

Discounts may be:

``` text
percentage
fixed amount
trial extension
specific feature
specific plan
specific billing period
```

Discount abuse prevention should be considered.

------------------------------------------------------------------------

# 39. Tax

Billing architecture should support:

``` text
tax jurisdiction
tax rate
tax amount
tax ID where required
```

Tax calculation can be implemented through a dedicated provider or
jurisdiction-specific service later.

------------------------------------------------------------------------

# 40. Payment Provider Boundary

Payment processing should be abstracted behind a billing provider
interface.

``` text
Mianx Billing
      ↓
Payment Provider Adapter
      ↓
External Provider
```

This avoids coupling the whole platform to one provider.

------------------------------------------------------------------------

# 41. Payment Security

Mianx should avoid storing raw payment credentials where possible.

Prefer provider-hosted or tokenized payment mechanisms.

Sensitive payment data must remain outside ordinary application logs and
AI context.

------------------------------------------------------------------------

# 42. Billing Webhooks

External billing providers may send events.

Flow:

``` text
Provider
 ↓
Webhook
 ↓
Signature Verification
 ↓
Idempotency
 ↓
Billing Event
 ↓
Subscription Update
 ↓
Entitlement Update
```

Never trust an unsigned billing webhook.

------------------------------------------------------------------------

# 43. Billing Reconciliation

Periodic reconciliation should compare:

``` text
Mianx subscription state
vs
payment provider state
```

Differences should create reconciliation tasks rather than silently
changing customer state.

------------------------------------------------------------------------

# 44. Usage Thresholds

Usage can trigger:

``` text
warning
80%
90%
100%
overage
restriction
```

Notifications should be configurable.

------------------------------------------------------------------------

# 45. Overage

Mianx may support:

``` text
hard limit
soft limit
automatic overage billing
prepaid credits
```

Each meter must explicitly declare its behavior.

Never accidentally create unlimited billable usage.

------------------------------------------------------------------------

# 46. Domain Packaging

The commercial system should support:

``` text
Core
Core + Poultry
Core + Restaurant
Core + Retail
Core + Poultry + Restaurant
Enterprise Multi-Domain
```

This is a major strategic advantage of the Mianx architecture.

------------------------------------------------------------------------

# 47. Poultry Commercial Example

Example package:

``` text
MIANX CORE
+
POULTRY STARTER
```

Includes:

``` text
Farm Management
Shed Management
Flock Management
Basic Reports
Basic AI Assistant
```

Growth package:

``` text
Everything in Starter
+
Advanced Analytics
Procurement
Inventory
AI Workforce
Automation
```

Enterprise:

``` text
Everything in Growth
+
Multi-site
Advanced Governance
API
Custom integrations
Advanced AI
Dedicated support
```

These are architectural examples; final pricing and packaging are
commercial decisions.

------------------------------------------------------------------------

# 48. Multi-Domain Customer

A customer could eventually have:

``` text
Organization: ABC Group

Subscriptions:
 ├── Poultry OS
 ├── Restaurant OS
 └── Retail OS

Shared:
 ├── Users
 ├── Identity
 ├── Billing
 ├── AI
 ├── Integrations
 └── Governance
```

This is the core of Mianx.ai's multi-domain strategy.

------------------------------------------------------------------------

# 49. Commercial Dashboard

Customer billing UI should show:

``` text
Current Plan
Subscription Status
Renewal Date
Domains
Modules
Seats
Usage
AI Usage
Invoices
Payment Method
Upgrade / Downgrade
```

------------------------------------------------------------------------

# 50. Admin Billing Dashboard

Mianx Command Center should show:

``` text
MRR
ARR
Active subscriptions
Trials
Conversion
Churn
Past due
Suspended
Revenue by domain
Revenue by plan
AI cost
AI gross margin
Usage
```

------------------------------------------------------------------------

# 51. Billing Analytics

Important metrics:

``` text
MRR
ARR
ARPU
trial conversion
paid conversion
churn
expansion
contraction
net revenue retention
gross revenue retention
AI cost per customer
AI cost as % of revenue
```

------------------------------------------------------------------------

# 52. Commercial Observability

Monitor:

``` text
failed payments
webhook failures
entitlement mismatches
usage ingestion failures
invoice failures
subscription state mismatches
billing provider latency
reconciliation differences
```

------------------------------------------------------------------------

# 53. Entitlement Caching

Entitlements may be cached for performance.

But:

``` text
cache ≠ source of truth
```

Important subscription changes must invalidate or refresh entitlement
caches.

------------------------------------------------------------------------

# 54. Billing Data Security

Billing data must follow:

``` text
organization isolation
least privilege
audit
encrypted transport
restricted admin access
no secrets in logs
no payment secrets in AI
```

------------------------------------------------------------------------

# 55. Billing Failure Safety

A billing subsystem failure should not accidentally:

``` text
delete data
grant unlimited access
suspend every customer
double charge
double meter usage
```

Fail-safe behavior must be designed explicitly.

------------------------------------------------------------------------

# 56. Commercial Data Model

High-level:

``` text
Organization
    │
    ├── Subscription
    │      └── Plan Version
    │             └── Features
    │
    ├── Entitlements
    │
    ├── Usage
    │
    ├── Invoices
    │
    └── Payments
```

------------------------------------------------------------------------

# 57. Billing Definition of Done

Billing Core is ready when:

``` text
✓ Plans defined
✓ Plan versions defined
✓ Features defined
✓ Entitlements defined
✓ Limits defined
✓ Usage meters defined
✓ Usage idempotency defined
✓ AI usage metering defined
✓ AI cost tracking defined
✓ Trials defined
✓ Subscription lifecycle defined
✓ Upgrade defined
✓ Downgrade defined
✓ Cancellation defined
✓ Payment failure defined
✓ Invoices defined
✓ Provider boundary defined
✓ Webhooks secured
✓ Reconciliation defined
✓ Domain packaging defined
✓ Poultry commercial package possible
✓ Billing dashboards defined
```

------------------------------------------------------------------------

# 58. Implementation Order

``` text
1. Commercial entity model
2. Plans
3. Features
4. Entitlements
5. Subscription lifecycle
6. Usage meters
7. Usage ingestion
8. AI cost tracking
9. Trials
10. Invoice model
11. Payment provider abstraction
12. Billing webhooks
13. Reconciliation
14. Customer billing UI
15. Admin billing UI
16. Domain packaging
17. Billing security tests
18. Production billing controls
```

------------------------------------------------------------------------

# 59. Final Commercial Principle

> **Mianx.ai should be able to launch a new Domain OS as a commercial
> product without building a new billing system.**

``` text
ONE BILLING CORE
       ↓
ONE ENTITLEMENT ENGINE
       ↓
ONE USAGE PLATFORM
       ↓
MANY COMMERCIAL PRODUCTS
       ↓
Poultry OS
Restaurant OS
Retail OS
Future OSs
```

------------------------------------------------------------------------

# 60. Next Technical Deliverable

Next:

# MIANX.AI CORE --- OBSERVABILITY, LOGGING, MONITORING & OPERATIONS SPECIFICATION v1.0

It will define:

-   Application logging
-   Structured logs
-   Metrics
-   Tracing
-   Error tracking
-   AI observability
-   Cost observability
-   Tenant health
-   Domain health
-   Database monitoring
-   Queue/job monitoring
-   Integration monitoring
-   Security monitoring
-   Alerting
-   Incident management
-   SLO/SLA foundation
-   Mianx Command Center operational dashboard
-   Production readiness
