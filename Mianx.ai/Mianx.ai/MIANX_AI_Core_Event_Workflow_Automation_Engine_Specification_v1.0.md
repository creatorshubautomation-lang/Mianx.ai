# MIANX.AI CORE --- EVENT, WORKFLOW & AUTOMATION ENGINE SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Event, Workflow & Automation Engine\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Purpose:** Define the deterministic automation backbone connecting
business events, workflows, AI decisions, approvals, jobs and actions
across every Mianx domain.

------------------------------------------------------------------------

# 1. Purpose

The Automation Engine turns Mianx.ai from a system that stores and
analyzes business data into a system that can safely operate the
business.

Core model:

``` text
Business Event
      ↓
Trigger
      ↓
Workflow
      ↓
Conditions
      ↓
AI / Rules
      ↓
Approval if required
      ↓
Action
      ↓
Event
      ↓
Audit / Metrics
```

The engine must work across:

-   Mianx Core
-   Poultry
-   Restaurant
-   Retail
-   Manufacturing
-   Logistics
-   Future domains

------------------------------------------------------------------------

# 2. Automation Constitution

1.  Every workflow has an owner and scope.
2.  Every workflow execution is tenant-isolated.
3.  Events are immutable facts.
4.  Actions are authorized operations.
5.  AI can participate in workflows but cannot bypass authorization.
6.  High-risk actions can require human approval.
7.  Every execution has a traceable run ID.
8.  Retries must be safe and controlled.
9.  Idempotency is mandatory for side-effecting actions.
10. Failed workflows must be observable and recoverable.

------------------------------------------------------------------------

# 3. Architecture

``` text
                     MIANX CORE
                         │
                 EVENT / AUTOMATION
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     Event Bus        Workflow Engine   Scheduler
        │                │                │
     Events          Workflow Runs     Jobs
        │                │                │
        └────────────────┼────────────────┘
                         │
                  Rules / AI Decision
                         │
                     Approval
                         │
                      Actions
                         │
              Domain / Core Services
                         │
                    Business Data
```

------------------------------------------------------------------------

# 4. Event Definition

An event represents something that happened.

Examples:

``` text
flock.created
flock.weight.recorded
mortality.recorded
inventory.low
purchase.created
payment.received
customer.order.created
workflow.completed
agent.action.completed
```

Events are facts, not commands.

------------------------------------------------------------------------

# 5. Event Contract

Every event should have a stable envelope.

Conceptual:

``` text
event_id
event_type
event_version
organization_id
domain_id
source_type
source_id
actor_type
actor_id
correlation_id
causation_id
occurred_at
payload
metadata
```

Important:

``` text
event_id
```

must be globally unique within the event system.

------------------------------------------------------------------------

# 6. Event Versioning

Events must be versioned.

Example:

``` text
poultry.flock.created.v1
poultry.flock.created.v2
```

Consumers must know which contract they consume.

Breaking event changes require a new version rather than silently
changing an existing contract.

------------------------------------------------------------------------

# 7. Tenant Isolation

Every tenant-owned event must carry:

``` text
organization_id
```

The event consumer must preserve the same organization scope.

Never allow a workflow triggered by Organization A's event to execute
against Organization B data.

------------------------------------------------------------------------

# 8. Domain Events

Domains publish their own business events.

Example:

``` text
Poultry
 ├── farm.created
 ├── shed.created
 ├── flock.created
 ├── flock.weight.recorded
 ├── mortality.recorded
 ├── feed.consumption.recorded
 └── vaccination.completed
```

Core events remain domain-neutral.

------------------------------------------------------------------------

# 9. Event Sources

Events may originate from:

``` text
User action
AI agent
API
Integration
Scheduled job
Workflow
Database-backed business service
System
```

Every event should identify its source actor where appropriate.

------------------------------------------------------------------------

# 10. Commands vs Events

### Event

``` text
flock.created
```

Means:

> A flock was created.

### Command

``` text
create_flock
```

Means:

> Someone is requesting creation of a flock.

Commands are authorized requests.

Events are recorded facts.

Do not confuse the two.

------------------------------------------------------------------------

# 11. Event Publishing

Business services should publish events after successful state
transitions.

Preferred pattern:

``` text
Validate
 ↓
Authorize
 ↓
Transaction
 ↓
State Change
 ↓
Reliable Event Publication
```

Event publication must not create a false event for a transaction that
failed.

------------------------------------------------------------------------

# 12. Transactional Outbox

For important business events, use an outbox pattern.

Conceptually:

``` text
Database Transaction
 ├── Business Change
 └── Outbox Event
          ↓
       Publisher
          ↓
       Event Bus
```

This prevents:

``` text
Database succeeded
BUT
event publishing failed
```

from silently losing the event.

------------------------------------------------------------------------

# 13. Event Bus

The event bus is the delivery layer between producers and consumers.

Responsibilities:

-   Delivery
-   Retry
-   Consumer isolation
-   Ordering where required
-   Dead-letter handling
-   Observability

The initial implementation can use a database-backed queue/outbox
approach and evolve as scale requires.

------------------------------------------------------------------------

# 14. Workflow Definition

A workflow describes what should happen when a trigger occurs.

Conceptual:

``` text
workflow
├── trigger
├── conditions
├── steps
├── approvals
├── error policy
├── retry policy
├── timeout policy
└── permissions
```

------------------------------------------------------------------------

# 15. Workflow Example

Poultry mortality alert:

``` text
mortality.recorded
        ↓
Check mortality threshold
        ↓
IF abnormal
        ↓
Analyze flock context
        ↓
AI recommendation
        ↓
Create alert
        ↓
Notify farm manager
```

------------------------------------------------------------------------

# 16. Workflow Triggers

Supported trigger categories:

``` text
event trigger
schedule trigger
manual trigger
API trigger
webhook trigger
workflow trigger
AI trigger
```

Examples:

``` text
When flock mortality is recorded
Every morning at 08:00
When inventory reaches threshold
When customer order is created
```

------------------------------------------------------------------------

# 17. Conditions

Conditions determine whether a workflow continues.

Examples:

``` text
mortality_rate > threshold
inventory_quantity < reorder_level
order_total > approval_limit
customer.segment == "VIP"
```

Conditions should be deterministic whenever possible.

------------------------------------------------------------------------

# 18. AI Decision Steps

AI can be used where interpretation or reasoning is valuable.

Example:

``` text
Event
 ↓
Deterministic condition
 ↓
AI analysis
 ↓
Recommendation
 ↓
Action
```

AI should not silently change workflow permissions.

------------------------------------------------------------------------

# 19. AI Output Contract

AI workflow steps should preferably produce structured outputs.

Conceptual:

``` text
decision
confidence
reason
recommended_action
risk_level
requires_approval
```

The workflow engine validates the output before using it.

Never execute arbitrary model text as an action.

------------------------------------------------------------------------

# 20. Workflow Actions

Actions can include:

``` text
create_record
update_record
send_notification
send_email
send_message
create_task
start_workflow
call_integration
generate_report
invoke_ai_agent
request_approval
```

Every action must have an authorization contract.

------------------------------------------------------------------------

# 21. Action Authorization

Before an action executes:

``` text
Workflow
 ↓
Organization
 ↓
Actor / System Principal
 ↓
Required Permission
 ↓
Resource Scope
 ↓
Execute
```

The workflow engine must not become an authorization bypass.

------------------------------------------------------------------------

# 22. Human Approval

Approval step:

``` text
Workflow
 ↓
Proposed Action
 ↓
Approval Request
 ↓
Human Review
 ┌───────────────┐
 │               │
Approve         Reject
 │               │
 ↓               ↓
Execute         Stop
```

Approval records must contain:

``` text
approval_id
workflow_run_id
organization_id
requested_action
requested_by
approved_by
decision
timestamp
reason
```

------------------------------------------------------------------------

# 23. Approval Expiration

Approvals may have:

``` text
expires_at
```

An expired approval must not authorize execution.

------------------------------------------------------------------------

# 24. Workflow State

A workflow run can have:

``` text
queued
running
waiting
waiting_approval
completed
failed
cancelled
timed_out
dead_lettered
```

State transitions must be controlled.

------------------------------------------------------------------------

# 25. Workflow Run

Every execution gets:

``` text
workflow_run_id
```

Conceptual fields:

``` text
id
workflow_id
organization_id
trigger_event_id
status
input
output
current_step
started_at
completed_at
error
created_at
updated_at
```

------------------------------------------------------------------------

# 26. Step Execution

Each step should have a traceable execution record.

Conceptual:

``` text
workflow_step_runs
```

Fields:

``` text
id
workflow_run_id
step_id
status
attempt
input
output
error
started_at
completed_at
```

This allows debugging and replay.

------------------------------------------------------------------------

# 27. Idempotency

Any action that creates external or persistent side effects should have
an idempotency key.

Example:

``` text
workflow_run_id
+
step_id
+
logical_action_id
```

If the same action is retried, the system should recognize the previous
attempt.

------------------------------------------------------------------------

# 28. Retry Policy

Retryable failures may use:

``` text
attempt limit
backoff
jitter
retryable error classes
```

Example:

``` text
Attempt 1
 ↓
30 sec
 ↓
Attempt 2
 ↓
2 min
 ↓
Attempt 3
```

Do not retry permanent business errors indefinitely.

------------------------------------------------------------------------

# 29. Dead Letter Queue

After retry exhaustion:

``` text
Workflow
 ↓
Retry exhausted
 ↓
Dead Letter
 ↓
Operator review
 ↓
Retry / Fix / Cancel
```

Dead-lettered runs must remain auditable.

------------------------------------------------------------------------

# 30. Timeouts

Every workflow and long-running step should have an execution timeout.

Examples:

``` text
tool timeout
AI timeout
integration timeout
workflow timeout
approval timeout
```

Timeout behavior must be explicit.

------------------------------------------------------------------------

# 31. Scheduling

Scheduler supports:

``` text
one-time
recurring
cron-like schedules
timezone-aware schedules
```

Example:

``` text
Every day
08:00
Organization timezone
```

Schedules must remain organization-scoped.

------------------------------------------------------------------------

# 32. Queue / Job Model

Long-running work should use jobs.

Conceptual:

``` text
jobs
job_attempts
```

A job includes:

``` text
job_id
organization_id
type
payload
status
priority
scheduled_at
attempts
```

------------------------------------------------------------------------

# 33. Priority

Jobs may have:

``` text
critical
high
normal
low
```

Priority must not override security authorization.

------------------------------------------------------------------------

# 34. Concurrency

Workflows may run concurrently.

The engine must define where concurrency is safe.

Example:

``` text
Same flock
 ├── feed workflow
 └── health workflow
```

may run concurrently.

But two workflows updating the same financial settlement may require
serialization.

------------------------------------------------------------------------

# 35. Distributed Locking

For mutually exclusive operations, use a controlled lock/idempotency
mechanism.

Example:

``` text
organization_id + resource_id + operation
```

Lock scope should be as narrow as possible.

------------------------------------------------------------------------

# 36. Workflow Cancellation

Supported cancellation:

``` text
manual cancellation
system cancellation
timeout cancellation
organization suspension
```

Cancellation behavior must define whether currently running actions:

``` text
finish
cancel
rollback
```

depending on the action type.

------------------------------------------------------------------------

# 37. Compensation

Distributed operations may not support database rollback.

Use compensating actions where necessary.

Example:

``` text
Create external order
      ↓
Later failure
      ↓
Cancel external order
```

Compensation itself must be authorized and audited.

------------------------------------------------------------------------

# 38. Workflow Templates

Mianx can provide reusable workflow templates.

Examples:

``` text
Low Inventory Alert
Daily Business Summary
Approval Workflow
Customer Follow-up
Payment Reminder
```

Domains specialize templates.

Example:

``` text
Low Inventory Alert
      ↓
Poultry Feed Low Alert
```

------------------------------------------------------------------------

# 39. Domain Workflow Registration

A domain manifest may register:

``` text
workflow definitions
event types
actions
conditions
AI steps
permissions
```

The Core executes them through the same Workflow Engine.

------------------------------------------------------------------------

# 40. Poultry Automation Examples

## Feed Low

``` text
feed.inventory.updated
        ↓
quantity < threshold
        ↓
create_alert
        ↓
notify_manager
```

## Mortality Spike

``` text
mortality.recorded
        ↓
calculate mortality rate
        ↓
threshold exceeded?
        ↓
AI context analysis
        ↓
farm manager notification
```

## Weight Variance

``` text
weight.recorded
        ↓
compare expected curve
        ↓
variance detected
        ↓
AI analysis
        ↓
recommendation
```

## Purchase Approval

``` text
feed.inventory.low
        ↓
calculate requirement
        ↓
AI purchase recommendation
        ↓
approval
        ↓
purchase order
```

------------------------------------------------------------------------

# 41. Event → AI → Workflow

Preferred architecture:

``` text
Business Event
      ↓
Workflow
      ↓
AI Decision
      ↓
Structured Result
      ↓
Policy Validation
      ↓
Approval if needed
      ↓
Authorized Action
```

This is safer than:

``` text
Event
 ↓
AI
 ↓
Do whatever you want
```

------------------------------------------------------------------------

# 42. Workflow Permissions

A workflow definition should declare the capabilities it may require.

Example:

``` text
poultry.alert.create
poultry.purchase.create
notification.send
```

Activation should validate that these capabilities exist.

------------------------------------------------------------------------

# 43. Workflow Isolation

Every run must retain:

``` text
organization_id
domain_id
workflow_id
```

A workflow cannot dynamically switch organization context.

------------------------------------------------------------------------

# 44. Workflow Audit

Audit important lifecycle events:

``` text
workflow.created
workflow.updated
workflow.enabled
workflow.disabled
workflow.started
workflow.completed
workflow.failed
workflow.cancelled
approval.requested
approval.approved
approval.rejected
action.executed
```

------------------------------------------------------------------------

# 45. Observability

Track:

``` text
workflow success rate
failure rate
average duration
step duration
retry count
dead letters
approval latency
AI step latency
action failures
```

Every run should be traceable through:

``` text
workflow_run_id
correlation_id
```

------------------------------------------------------------------------

# 46. Correlation and Causation

Events should support:

``` text
correlation_id
causation_id
```

Example:

``` text
Order Created
  correlation_id = ABC

Workflow Started
  correlation_id = ABC
  causation_id = order_event

Notification Sent
  correlation_id = ABC
  causation_id = workflow_action
```

This creates an operational chain of causality.

------------------------------------------------------------------------

# 47. Failure Classification

Errors should be classified:

``` text
VALIDATION_ERROR
AUTHORIZATION_ERROR
NOT_FOUND
CONFLICT
RATE_LIMITED
TIMEOUT
TRANSIENT_EXTERNAL_ERROR
PERMANENT_EXTERNAL_ERROR
AI_ERROR
APPROVAL_TIMEOUT
POLICY_VIOLATION
UNKNOWN
```

Retry behavior is based on classification.

------------------------------------------------------------------------

# 48. Workflow Security

Never allow workflow definitions to:

-   Bypass RLS
-   Use arbitrary SQL
-   Access another tenant
-   Obtain secrets
-   Change their own permissions
-   Approve their own high-risk actions without an explicit policy

Workflow definitions are configuration, not unrestricted code.

------------------------------------------------------------------------

# 49. Workflow Definition of Done

Automation Core is ready when:

``` text
✓ Event contracts exist
✓ Tenant event scope works
✓ Outbox strategy exists
✓ Event delivery works
✓ Workflow definitions work
✓ Triggers work
✓ Conditions work
✓ Actions work
✓ AI steps work
✓ Approval steps work
✓ Idempotency works
✓ Retries work
✓ Dead-letter handling works
✓ Timeouts work
✓ Scheduling works
✓ Job execution works
✓ Cancellation works
✓ Audit works
✓ Observability works
✓ Cross-tenant tests pass
```

------------------------------------------------------------------------

# 50. Implementation Order

Build in this order:

``` text
1. Event contract
2. Event persistence / outbox
3. Event publisher
4. Event consumer
5. Workflow definition model
6. Workflow run engine
7. Step execution
8. Idempotency
9. Retry engine
10. Scheduler
11. Job queue
12. Approval engine
13. AI workflow step
14. Dead-letter handling
15. Observability
16. Domain workflow registration
```

------------------------------------------------------------------------

# 51. Final Automation Principle

> **Events tell Mianx what happened. Workflows decide what should happen
> next. AI helps reason where needed. Authorization controls what is
> allowed. Actions change the world. Audit records what happened.**

``` text
EVENT
  ↓
WORKFLOW
  ↓
RULE / AI
  ↓
APPROVAL
  ↓
ACTION
  ↓
EVENT
  ↓
AUDIT
```

This loop is the operational backbone of Mianx.ai.

------------------------------------------------------------------------

# 52. Next Technical Deliverable

Next:

# MIANX.AI CORE --- API & INTEGRATION PLATFORM SPECIFICATION v1.0

It will define:

-   API architecture
-   REST / RPC boundaries
-   API versioning
-   Tenant context
-   Authentication
-   Authorization
-   Webhooks
-   Integration adapters
-   External systems
-   API keys
-   OAuth connections
-   Rate limits
-   Idempotency
-   Webhook security
-   Integration marketplace
-   Domain API contracts
-   How Poultry connects external services
