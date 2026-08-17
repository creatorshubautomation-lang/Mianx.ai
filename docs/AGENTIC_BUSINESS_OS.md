# Mianx.ai — Agentic Business Operating System

## Product North Star

Mianx is not primarily an AI chatbot, an agent marketplace, or a collection of assistants.
It is an **Agentic Business Operating System** that turns a business goal into a governed,
verifiable outcome.

> **Tell Mianx what you want. Mianx figures out how to get it done.**

The platform must be simple for clients and extremely capable underneath.

## Core Execution Model

```text
USER GOAL
   ↓
MISSION
   ↓
UNDERSTAND + CONSTRAIN
   ↓
PLAN
   ↓
TASK GRAPH
   ↓
AGENT / WORKFLOW / HUMAN SELECTION
   ↓
SKILLS
   ↓
TOOLS + INTEGRATIONS
   ↓
EXECUTE → OBSERVE → VERIFY
   ↓             ↓
   └──── FAIL → REPAIR → REPLAN ────┘
                 ↓
              OUTCOME
                 ↓
        MEMORY + OPTIMIZATION
```

The existing Mission Engine, Agent Loop, Tool Registry/Executor, Approval Engine,
Verification, Memory, Workflow Engine, Authorization, Billing, Events and Jobs are
building blocks of this architecture. They must be extended and composed, not duplicated.

## Architectural Boundaries

### Agent
Adaptive reasoning and decision-making.

### Skill
Reusable capability that describes how a class of work is performed.

### Tool
A controlled executable capability. Tool arguments are untrusted input and must be
validated and authorized before execution.

### Workflow
Deterministic business orchestration: triggers, conditions, steps and state transitions.

### Agentic Workflow
A deterministic workflow containing bounded adaptive agent decisions.

### Mission
The client-facing high-level objective. A Mission owns success criteria, constraints,
budget, plan, task graph, approvals, verification and final outcome.

### Outcome
The verified business result. A model response is never sufficient evidence of completion.

## Domain Pack Architecture

A domain must be installable/configurable without changing Mianx Core.

```text
Domain Pack
├── manifest
├── entities
├── modules
├── skills
├── agents
├── workflows
├── tools
├── knowledge
├── dashboards
├── reports
├── verification rules
└── integrations
```

The first domain should validate the architecture with a real customer workflow. Domain
logic must not leak into Core through `if domain === ...` branching.

## Country Pack Architecture

Country localization must be independent from domain logic.

```text
Country Pack
├── locale
├── languages
├── currency
├── timezone
├── date/number formats
├── tax configuration
├── payment providers
├── communication providers
├── local integrations
└── compliance configuration
```

Country-specific legal/compliance behavior must be explicit, versioned and reviewable.
The platform must not silently infer or invent regulatory requirements.

## Ten-Day Domain Launch Contract

The 10-day goal is a **repeatable engineering target**, not a blanket promise for every
industry. It becomes realistic only when Core and the pack contracts are stable.

1. Domain discovery + entity model
2. Modules + schema
3. Skills + agents
4. Workflows + automation
5. Tools + integrations
6. Knowledge + policies
7. Dashboards + reports
8. Permissions + verification + security tests
9. Pilot workflow with real data
10. Production-ready Domain Pack

## Client Experience

Default UX must be goal-first:

> What do you want to accomplish?

Users should not need to understand agents, tools, models, or workflow graphs to get
value. Simple Mode is the default; Pro and Expert modes expose progressively more control.

## Trust Requirements

Every autonomous action must be:

- authorized
- scoped to the organization/resource
- risk classified
- auditable
- budget aware
- observable
- verifiable
- resumable/idempotent where applicable

High-risk actions require human approval unless an explicit organization policy grants
that autonomy level.

The UI must show safe execution summaries, never private chain-of-thought.

## Outcome-First Completion

Never mark a mission complete because an LLM says `done`.

Completion requires evidence from the configured verification rules, for example:

- tests passed
- business rule satisfied
- expected artifact exists
- integration action succeeded
- required approval completed
- target metric reached or explicitly accepted

## Non-Negotiable Engineering Rules

1. Preserve existing working capabilities.
2. Reuse existing engines before adding new ones.
3. Do not create parallel Mission, Agent Loop, Tool, Approval or Workflow systems.
4. Keep Core domain-agnostic.
5. Keep country localization modular.
6. Validate all LLM structured output.
7. Treat agent-generated tool input as untrusted.
8. Never expose secrets or private chain-of-thought to models/users.
9. Long-running missions must be asynchronous, resumable and cancellable.
10. State transitions must be validated and auditable.
11. Production/destructive operations must be permission- and approval-gated.
12. Every major feature requires tests and security verification.

## Current Evolution Target

The immediate objective is to evolve the existing V2 platform from a strong Agentic AI
foundation into this architecture without a rewrite:

**V2 Foundation → Mission-first UX → Domain Packs → Country Packs → Outcome Engine →
Autonomous Business OS**
