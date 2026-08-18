# MIANX.AI CORE --- AI ENGINE & AGENT RUNTIME SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** AI Engine & Agent Runtime\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Purpose:** Define the AI brain of Mianx.ai and the secure runtime
through which every domain can use AI.

------------------------------------------------------------------------

# 1. Purpose

Mianx.ai AI Core is a platform service, not a collection of isolated
chatbots.

``` text
MIANX.AI CORE
      ↓
AI ENGINE
      ↓
Model Router
      ↓
Agent Runtime
      ↓
Tools
      ↓
Business Services
      ↓
Data / Workflows / Integrations
```

The same AI foundation must support:

-   Mianx internal agents
-   Customer assistants
-   Domain agents
-   Workflow agents
-   Analytics agents
-   Autonomous operational agents

------------------------------------------------------------------------

# 2. AI Constitution

1.  AI is a controlled platform capability.
2.  AI never bypasses authorization.
3.  Every tool has an explicit contract.
4.  Every tool execution is organization-scoped.
5.  High-risk actions may require human approval.
6.  AI actions are auditable.
7.  AI usage and cost are measurable.
8.  Model providers remain replaceable.
9.  Domain agents are extensions of the Core Agent Engine.
10. Tenant knowledge must never cross organization boundaries.

------------------------------------------------------------------------

# 3. AI Architecture

``` text
                         MIANX AI CORE
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
      Model Router        Agent Runtime       Knowledge
          │                   │                   │
       Models              Tools             Retrieval
          │                   │                   │
     Providers          Permissions          Memory
                              │
                         Governance
                              │
                           Audit
                              │
                        Usage / Cost
```

------------------------------------------------------------------------

# 4. Provider Abstraction

Applications should not directly hard-code provider-specific logic.

Preferred:

``` text
Application
    ↓
Mianx AI Provider Layer
    ↓
Model Router
    ↓
Provider / Model
```

The current AI SDK supports a standardized language-model interface and
provider registries for multiple providers. The platform can therefore
keep provider selection behind a Mianx abstraction.
citeturn0search4turn0search5

------------------------------------------------------------------------

# 5. Model Router

The Model Router decides which model should handle a request.

Conceptual inputs:

``` text
task_type
agent
organization
domain
latency_requirement
quality_requirement
cost_budget
capabilities
availability
```

Output:

``` text
selected_model
provider
routing_reason
fallback_policy
```

Example:

``` text
Simple classification
    → economical model

Complex business analysis
    → reasoning-capable model

Vision task
    → vision-capable model
```

Model IDs will be resolved from current provider/Gateway availability
rather than hard-coded from memory. AI Gateway provides dynamic model
discovery. citeturn0search9

------------------------------------------------------------------------

# 6. Model Policy

Every model configuration should define:

``` text
provider
model_id
capabilities
cost_class
latency_class
status
```

Do not allow arbitrary model IDs from untrusted client input.

------------------------------------------------------------------------

# 7. Fallback Strategy

Conceptual:

``` text
Primary Model
     ↓
Failure / unavailable
     ↓
Fallback Model
     ↓
Retry policy
     ↓
Safe failure
```

Fallback must respect:

-   Organization entitlement
-   Agent permissions
-   Data handling requirements
-   Cost limits
-   Model capability requirements

------------------------------------------------------------------------

# 8. Agent Definition

Every Mianx agent has:

``` text
Agent
├── id
├── organization scope
├── domain scope
├── instructions
├── model policy
├── tools
├── permissions
├── memory policy
├── knowledge policy
├── approval policy
├── limits
├── status
└── audit configuration
```

------------------------------------------------------------------------

# 9. Agent Runtime

The runtime is responsible for:

``` text
Request
 ↓
Context assembly
 ↓
Authorization
 ↓
Model selection
 ↓
Agent execution
 ↓
Tool calls
 ↓
Tool authorization
 ↓
Tool results
 ↓
Next model step
 ↓
Approval if required
 ↓
Final response
 ↓
Audit + usage
```

The current AI SDK recommends `ToolLoopAgent` for reusable multi-step
agents that use tools in a loop. citeturn0search0turn0search6

------------------------------------------------------------------------

# 10. Agent Loop

Conceptually:

``` text
User Request
      ↓
LLM
      ↓
Decision
 ┌────┴─────┐
 │          │
Text      Tool Call
 │          │
 │      Authorization
 │          ↓
 │      Tool Execution
 │          ↓
 │      Tool Result
 │          ↓
 └──────→ LLM
             ↓
          Continue
             ↓
           Final
```

The runtime must have explicit stopping conditions.

------------------------------------------------------------------------

# 11. Tool System

Tools are the bridge between AI reasoning and real business actions.

Examples:

``` text
get_flock_metrics
get_inventory
create_alert
create_purchase_order
send_notification
generate_report
```

A tool definition should include:

``` text
tool_key
description
input_schema
output_schema
required_permission
organization_scope
risk_level
approval_requirement
```

------------------------------------------------------------------------

# 12. Tool Contract

Every tool should have a typed input and output contract.

Conceptual:

``` text
Tool
├── name
├── input schema
├── output schema
├── permissions
├── executor
└── audit metadata
```

The LLM should never directly execute SQL.

The LLM requests a tool; the trusted server executes the authorized
operation.

------------------------------------------------------------------------

# 13. Tool Authorization

Before every tool execution:

``` text
Agent
 ↓
Organization
 ↓
Required Permission
 ↓
Target Resource
 ↓
Policy Check
 ↓
Execute / Deny
```

If denied:

``` text
DENY
 ↓
AUDIT
 ↓
SAFE ERROR
```

------------------------------------------------------------------------

# 14. Tool Risk Levels

Recommended:

``` text
LOW
MEDIUM
HIGH
CRITICAL
```

Examples:

### LOW

Read dashboard metrics.

### MEDIUM

Create an internal alert.

### HIGH

Create a purchase order.

### CRITICAL

Approve payment, delete important data, or send an externally
consequential instruction.

------------------------------------------------------------------------

# 15. Human Approval

High-risk operations may use:

``` text
AI proposes
    ↓
Approval Request
    ↓
Human reviews
    ↓
Approved / Rejected
    ↓
Tool executes
```

The approval itself must be auditable.

------------------------------------------------------------------------

# 16. Agent Memory

Memory is divided into:

``` text
User Memory
Organization Memory
Agent Memory
Conversation Memory
Operational Memory
```

Every memory item must have:

``` text
organization_id
scope
owner
visibility
retention policy
```

------------------------------------------------------------------------

# 17. Memory Isolation

Never retrieve memory using only:

``` text
memory_id
```

Retrieval must include tenant and authorization scope.

Conceptually:

``` text
organization_id
+
agent/user scope
+
memory policy
```

------------------------------------------------------------------------

# 18. Conversation Context

Conversation context may include:

``` text
messages
user identity
organization
active domain
active module
authorized tools
relevant memory
relevant knowledge
current workflow
```

Only authorized context is passed to the model.

------------------------------------------------------------------------

# 19. Context Assembly

``` text
Request
 ↓
Identity
 ↓
Organization
 ↓
Domain
 ↓
Permissions
 ↓
Conversation
 ↓
Memory
 ↓
Knowledge
 ↓
Tool availability
 ↓
Model Context
```

Context assembly is a security boundary.

------------------------------------------------------------------------

# 20. Knowledge Retrieval

Knowledge pipeline:

``` text
Source
 ↓
Ingestion
 ↓
Normalization
 ↓
Chunking
 ↓
Embedding / Indexing
 ↓
Authorization Filter
 ↓
Retrieval
 ↓
Context
```

The authorization filter must occur before tenant data is supplied to
the agent.

------------------------------------------------------------------------

# 21. Structured Business Data

AI should not rely only on vector search for operational facts.

Example:

``` text
"What is today's flock mortality?"
```

should normally use an authorized structured business tool/query rather
than relying on a stale document embedding.

------------------------------------------------------------------------

# 22. AI + Business Tools

Preferred:

``` text
Agent
 ↓
Business Tool
 ↓
Domain Service
 ↓
Database
```

Not:

``` text
Agent
 ↓
Raw SQL
```

This keeps business rules and authorization inside trusted application
services.

------------------------------------------------------------------------

# 23. Domain Agents

Domains register specialized agents.

Example:

``` text
Poultry
 ├── Farm Manager Agent
 ├── Flock Monitoring Agent
 ├── Feed Optimization Agent
 ├── Health Assistant Agent
 └── Sales Analyst Agent
```

The domain provides:

``` text
instructions
tools
permissions
knowledge
workflows
```

The Core provides the runtime.

------------------------------------------------------------------------

# 24. Agent Templates

Mianx can provide reusable agent templates.

Example:

``` text
Business Analyst Agent
Operations Agent
Sales Agent
Finance Assistant
Customer Support Agent
```

A domain can specialize a template.

``` text
Operations Agent
      ↓
Poultry Operations Agent
```

------------------------------------------------------------------------

# 25. Agent Lifecycle

``` text
draft
 ↓
configured
 ↓
testing
 ↓
active
 ↓
paused
 ↓
deprecated
```

Production agents require:

-   Valid tools
-   Valid permissions
-   Valid model policy
-   Valid knowledge scope
-   Valid approval policy

------------------------------------------------------------------------

# 26. Agent Execution Limits

Every agent may have:

``` text
max_steps
max_tool_calls
max_execution_time
max_token_budget
max_cost
allowed_models
allowed_tools
```

Limits should be enforced server-side.

------------------------------------------------------------------------

# 27. Loop Control

Agents must not be allowed to run indefinitely.

The runtime should stop on:

``` text
final response
max steps
timeout
budget exceeded
approval required
fatal tool error
policy violation
```

The current AI SDK supports explicit stopping conditions for multi-step
agents. citeturn0search8

------------------------------------------------------------------------

# 28. AI Cost Control

Track:

``` text
organization
agent
model
provider
request
input usage
output usage
tool usage
duration
estimated cost
```

This supports:

-   Customer usage limits
-   Internal cost control
-   Profitability analysis
-   AI billing
-   Abuse detection

------------------------------------------------------------------------

# 29. AI Usage Record

Conceptual:

``` text
ai_usage_records
```

Fields may include:

``` text
id
organization_id
agent_id
model
provider
input_units
output_units
tool_calls
duration_ms
estimated_cost
created_at
```

Exact provider-specific usage fields remain implementation-dependent.

------------------------------------------------------------------------

# 30. AI Audit

Every consequential AI action should be traceable.

Audit:

``` text
organization
agent
user/requester
model
tool
resource
action
result
approval
timestamp
```

For sensitive operations, preserve enough metadata to reconstruct what
happened without unnecessarily storing sensitive content.

------------------------------------------------------------------------

# 31. AI Safety Policy

The AI runtime must enforce:

``` text
Authorization
Tool allowlist
Resource scope
Rate limits
Cost limits
Approval rules
Data handling
Audit
```

Prompt instructions alone are not a security mechanism.

------------------------------------------------------------------------

# 32. Prompt Injection Defense

External content must be treated as untrusted.

Examples:

``` text
uploaded document
web page
customer message
email
supplier note
```

Untrusted content must not be allowed to redefine:

-   System policy
-   Agent permissions
-   Tool permissions
-   Organization identity
-   Approval requirements

------------------------------------------------------------------------

# 33. Tool Output Safety

Tool output should be treated as data, not executable instructions.

Example:

``` text
Database result
 ↓
Tool result
 ↓
Agent context
```

The model may interpret the result, but the result cannot grant itself
permissions.

------------------------------------------------------------------------

# 34. Secrets

AI agents must never receive raw secrets such as:

``` text
database passwords
service-role keys
API secret keys
private signing keys
```

Tools perform secret-backed operations server-side.

------------------------------------------------------------------------

# 35. Multi-Tenant AI Boundary

Every AI request must carry a trusted context:

``` text
organization_id
user_id
domain_id
agent_id
```

The client must not be able to override the trusted tenant context.

------------------------------------------------------------------------

# 36. AI Gateway / Provider Strategy

Mianx can use an AI Gateway/provider abstraction so applications do not
need to know the provider-specific transport.

The current AI SDK supports a global provider approach and provider
registries for multi-provider model access.
citeturn0search1turn0search5

Mianx's architecture should still keep a separate internal Model Router
so that:

``` text
Mianx Policy
      ↓
AI Gateway / Provider Layer
      ↓
Selected Model
```

This preserves business-level routing control.

------------------------------------------------------------------------

# 37. Observability

AI observability should include:

``` text
request count
latency
tool calls
failures
token/usage metrics
estimated cost
agent success/failure
approval rate
```

Agent runs should have a traceable execution ID.

------------------------------------------------------------------------

# 38. AI Execution ID

Every AI run should have:

``` text
ai_run_id
```

This connects:

``` text
User request
 ↓
Agent run
 ↓
Model calls
 ↓
Tool calls
 ↓
Approvals
 ↓
Final result
 ↓
Audit
 ↓
Usage
```

This becomes extremely valuable for debugging and billing.

------------------------------------------------------------------------

# 39. Error Handling

AI errors should be classified.

Examples:

``` text
MODEL_UNAVAILABLE
MODEL_TIMEOUT
TOOL_DENIED
TOOL_FAILED
APPROVAL_REQUIRED
BUDGET_EXCEEDED
CONTEXT_LIMIT
POLICY_VIOLATION
KNOWLEDGE_UNAVAILABLE
```

Do not expose internal secrets or stack traces to customers.

------------------------------------------------------------------------

# 40. AI Workflow Relationship

AI agents and deterministic workflows are complementary.

Use AI for:

``` text
interpretation
reasoning
classification
recommendation
planning
natural language interaction
```

Use deterministic workflows for:

``` text
strict business rules
financial controls
scheduled execution
compliance-sensitive processes
repeatable state transitions
```

Preferred pattern:

``` text
AI
 ↓
Decision / Proposal
 ↓
Deterministic Workflow
 ↓
Validated Action
```

------------------------------------------------------------------------

# 41. AI Approval Relationship

For high-risk operations:

``` text
Agent
 ↓
Proposal
 ↓
Approval
 ↓
Workflow
 ↓
Tool
 ↓
Database
```

This prevents an LLM from becoming an uncontrolled transaction engine.

------------------------------------------------------------------------

# 42. AI Agent Registry

Core registry:

``` text
agents
agent_tools
agent_permissions
agent_memory_policies
agent_knowledge_policies
```

Domain registration adds:

``` text
domain agent
module agent
domain tools
domain knowledge
```

------------------------------------------------------------------------

# 43. AI Platform Roles

Future Mianx internal AI workforce can use the same engine.

Examples:

``` text
AI CEO
AI CTO
AI COO
AI CFO
AI CMO
AI CHRO
```

These are not special hard-coded systems.

They are agent configurations using:

``` text
Core Agent Runtime
+
Core Tools
+
Permissions
+
Knowledge
+
Workflows
```

------------------------------------------------------------------------

# 44. Poultry AI Example

``` text
Mianx Poultry OS
      ↓
Flock Monitoring Agent
      ↓
get_flock_metrics
      ↓
poultry.flock.view
      ↓
Authorized Farm
      ↓
Analyze
      ↓
If abnormal:
      ↓
create_alert
      ↓
poultry.alert.create
```

For a purchase recommendation:

``` text
Feed Optimization Agent
      ↓
Analyze feed usage
      ↓
Recommend purchase
      ↓
Human approval
      ↓
Purchase workflow
```

------------------------------------------------------------------------

# 45. AI Definition of Done

AI Core is ready when:

``` text
✓ Model abstraction exists
✓ Model routing exists
✓ Agent registry exists
✓ Agent runtime exists
✓ Tools have typed contracts
✓ Tool permissions work
✓ Tenant context is trusted
✓ Memory is tenant-scoped
✓ Knowledge retrieval is authorization-aware
✓ High-risk approvals work
✓ Execution limits work
✓ Usage is tracked
✓ Cost is tracked
✓ AI runs are traceable
✓ AI actions are audited
✓ Prompt injection is treated as a security concern
✓ Secrets are protected
✓ Cross-tenant AI tests pass
```

------------------------------------------------------------------------

# 46. Implementation Order

Build AI Core in this order:

``` text
1. AI provider abstraction
2. Model registry/router
3. Agent registry
4. Tool registry
5. Tool authorization
6. Agent runtime
7. Execution limits
8. AI run tracking
9. Usage/cost tracking
10. Memory
11. Knowledge retrieval
12. Approval system
13. Audit integration
14. Observability
15. Domain agent integration
```

Do not build dozens of autonomous agents before the runtime is stable.

------------------------------------------------------------------------

# 47. Next Technical Deliverable

Next document:

# MIANX.AI CORE --- EVENT, WORKFLOW & AUTOMATION ENGINE SPECIFICATION v1.0

It will define:

-   Event bus
-   Event contracts
-   Domain events
-   Workflow definitions
-   Workflow execution
-   Triggers
-   Conditions
-   Actions
-   AI actions
-   Human approvals
-   Queues/jobs
-   Retries
-   Idempotency
-   Scheduling
-   Failure handling
-   Workflow audit
-   How Poultry automation plugs into Core

------------------------------------------------------------------------

# Final AI Principle

> **Mianx AI should not merely answer questions. It should safely
> understand, decide, propose, execute and learn within explicit
> business boundaries.**

``` text
Knowledge
    +
Reasoning
    +
Tools
    +
Permissions
    +
Workflows
    +
Human Approval
    =
Mianx AI Workforce
```
