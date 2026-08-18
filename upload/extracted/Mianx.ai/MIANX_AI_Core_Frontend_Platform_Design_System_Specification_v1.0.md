# MIANX.AI CORE --- FRONTEND PLATFORM & DESIGN SYSTEM SPECIFICATION v1.0

**Product:** Mianx.ai\
**Document:** Frontend Platform & Design System\
**Version:** 1.0\
**Status:** Architecture / Pre-Implementation\
**Purpose:** Define the shared frontend foundation used by Mianx.ai
Core, every domain OS, every module, and the Mianx Command Center.

------------------------------------------------------------------------

# 1. Purpose

Mianx.ai must have one frontend platform rather than separate UI systems
for every domain.

``` text
MIANX.AI FRONTEND PLATFORM
        │
        ├── App Shell
        ├── Design System
        ├── Navigation
        ├── Permissions
        ├── Dashboard Engine
        ├── AI Workspace
        └── Domain UI Framework
                │
        ┌───────┼────────┬──────────┐
        │       │        │          │
     Poultry Restaurant Retail   Future Domains
```

The domain owns its business screens.

The Core owns the shared experience.

------------------------------------------------------------------------

# 2. Frontend Constitution

1.  One Mianx design language.
2.  One reusable component system.
3.  Domain UIs must use Core primitives.
4.  UI permissions must reflect backend authorization.
5.  The frontend must never be the final security boundary.
6.  Every screen must handle loading, empty, error and permission
    states.
7.  Responsive behavior is designed from the beginning.
8.  Accessibility is a platform requirement.
9.  Internationalization and RTL must be architecture-ready.
10. AI interfaces are first-class platform components.

------------------------------------------------------------------------

# 3. Application Shell

The standard Mianx application shell:

``` text
┌──────────────────────────────────────────────────────┐
│ Mianx Logo │ Organization │ Domain │ Search │ User  │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│ Navigation │              Main Workspace             │
│            │                                         │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
│ Status / notifications / contextual actions          │
└──────────────────────────────────────────────────────┘
```

The shell must support:

-   desktop
-   tablet
-   mobile
-   collapsed navigation
-   domain-aware navigation
-   permission-aware navigation

------------------------------------------------------------------------

# 4. Global Header

The global header may contain:

``` text
Mianx
Organization Switcher
Domain Switcher
Global Search
AI Assistant
Notifications
Help
User Menu
```

The header must remain consistent across domains.

------------------------------------------------------------------------

# 5. Organization Switcher

For users with multiple organizations:

``` text
Organization A
Organization B
Organization C
```

Switching organization must:

1.  Verify membership.
2.  Update trusted application context.
3.  Refresh permissions.
4.  Refresh domain availability.
5.  Prevent stale tenant data from remaining visible.

------------------------------------------------------------------------

# 6. Domain Switcher

Example:

``` text
Poultry OS
Restaurant OS
Retail OS
Manufacturing OS
```

The domain switcher should show only domains the organization is
entitled and authorized to use.

A domain change should establish a new domain context without changing
organization identity.

------------------------------------------------------------------------

# 7. Navigation Model

Navigation hierarchy:

``` text
Organization
   ↓
Domain
   ↓
Module
   ↓
Page
   ↓
Resource
```

Example:

``` text
Poultry
 ├── Dashboard
 ├── Farms
 ├── Flocks
 ├── Feed
 ├── Health
 ├── Inventory
 ├── Procurement
 └── Reports
```

------------------------------------------------------------------------

# 8. Permission-Aware Navigation

Navigation items can be hidden or disabled based on permissions.

However:

> Hiding a UI item is not authorization.

The backend remains authoritative.

Frontend behavior:

``` text
Permission
   ↓
Navigation visibility
   ↓
Action visibility
   ↓
Backend authorization
```

------------------------------------------------------------------------

# 9. App Routes

Routes should represent product hierarchy.

Conceptual:

``` text
/org/{organization}/
/org/{organization}/{domain}/
/org/{organization}/{domain}/{module}/
```

The implementation should avoid exposing sensitive internal IDs
unnecessarily.

------------------------------------------------------------------------

# 10. Dashboard Framework

Dashboards are configurable compositions of widgets.

``` text
Dashboard
 ├── KPI Cards
 ├── Charts
 ├── Tables
 ├── Alerts
 ├── Tasks
 ├── AI Insights
 └── Quick Actions
```

Dashboards may be:

-   Core dashboards
-   Domain dashboards
-   Module dashboards
-   Role dashboards
-   Personal dashboards

------------------------------------------------------------------------

# 11. Dashboard Widget Contract

Each widget should define:

``` text
widget_id
title
description
data_source
permissions
size
refresh_policy
loading_state
empty_state
error_state
```

Widgets must not directly bypass domain services.

------------------------------------------------------------------------

# 12. Design Tokens

Mianx should maintain semantic design tokens.

Categories:

``` text
color
typography
spacing
radius
border
shadow
motion
z-index
breakpoints
```

Prefer semantic tokens:

``` text
background.default
surface.default
text.primary
text.secondary
border.default
action.primary
status.success
status.warning
status.error
```

rather than hard-coding raw values throughout components.

------------------------------------------------------------------------

# 13. Typography

Define a shared typography scale:

``` text
Display
Heading 1
Heading 2
Heading 3
Body Large
Body
Body Small
Caption
Label
```

Typography must support:

-   readable hierarchy
-   localization
-   variable text lengths
-   RTL languages

------------------------------------------------------------------------

# 14. Color System

Color tokens should communicate meaning consistently.

Core semantic groups:

``` text
Primary
Secondary
Neutral
Success
Warning
Danger
Info
```

Domain colors may exist as accents but must not redefine the global
semantic meanings.

------------------------------------------------------------------------

# 15. Spacing

Use a consistent spacing scale.

Example conceptual values:

``` text
xs
sm
md
lg
xl
2xl
```

Components should use tokens rather than arbitrary margins.

------------------------------------------------------------------------

# 16. Component Architecture

Core component layers:

``` text
Foundation
 ↓
Primitive Components
 ↓
Composite Components
 ↓
Pattern Components
 ↓
Domain Components
 ↓
Pages
```

Example:

``` text
Button
 ↓
Action Group
 ↓
Toolbar
 ↓
Flock Toolbar
 ↓
Flock Management Page
```

------------------------------------------------------------------------

# 17. Core Components

Initial component library:

``` text
Button
IconButton
Input
Textarea
Select
Combobox
Checkbox
Radio
Switch
DatePicker
Form
Card
Badge
Avatar
Table
Tabs
Accordion
Dialog
Drawer
Dropdown
Tooltip
Toast
Alert
Breadcrumb
Pagination
Command Menu
Skeleton
Empty State
Error State
```

------------------------------------------------------------------------

# 18. Data Table

Business systems require powerful tables.

Table capabilities:

-   sorting
-   filtering
-   pagination
-   column visibility
-   search
-   row selection
-   bulk actions
-   export
-   responsive behavior
-   permission-aware actions

------------------------------------------------------------------------

# 19. Forms

Forms must have:

``` text
validation
labels
help text
error messages
loading state
success state
dirty-state handling
confirmation for destructive operations
```

Server validation remains authoritative.

------------------------------------------------------------------------

# 20. Resource Pages

Standard resource page structure:

``` text
Breadcrumb
Page Header
 ├── Title
 ├── Status
 └── Actions

Filters / Toolbar

Main Content

Pagination / Summary
```

Detail pages:

``` text
Header
Tabs
Overview
Activity
Related Data
AI Insights
Audit
```

------------------------------------------------------------------------

# 21. Loading States

Every asynchronous surface needs a deliberate loading state.

Use:

``` text
Skeleton
Spinner
Progress
Optimistic UI
```

depending on the interaction.

Avoid blank screens during data loading.

------------------------------------------------------------------------

# 22. Empty States

Empty states should explain:

``` text
What is empty
Why it may be empty
What the user can do next
```

Example:

``` text
No flocks yet.

Create your first flock to start monitoring production.

[Create Flock]
```

------------------------------------------------------------------------

# 23. Error States

Errors must be actionable.

Prefer:

``` text
What happened
What can be done
Retry
Contact/support path
Request ID when useful
```

Do not expose raw stack traces.

------------------------------------------------------------------------

# 24. Destructive Actions

Destructive actions require stronger interaction patterns.

Examples:

``` text
Delete
Deactivate
Cancel
Archive
Disconnect integration
```

Use confirmation where the consequence is material.

High-risk actions may also require backend approval.

------------------------------------------------------------------------

# 25. Responsive Architecture

Breakpoints should be tokenized.

Conceptual:

``` text
mobile
tablet
desktop
large desktop
```

Responsive behavior should change layout, not simply shrink everything.

------------------------------------------------------------------------

# 26. Mobile Navigation

On mobile:

``` text
Header
 ↓
Context
 ↓
Primary content
 ↓
Bottom/slide navigation
```

The exact pattern depends on product complexity.

Critical operational actions should remain easy to reach.

------------------------------------------------------------------------

# 27. Accessibility

Mianx UI should target strong accessibility practices.

Requirements include:

-   keyboard navigation
-   visible focus
-   semantic HTML
-   labels
-   accessible names
-   screen-reader support
-   sufficient contrast
-   reduced-motion support
-   accessible error messages

------------------------------------------------------------------------

# 28. Localization

Frontend must support:

``` text
language
locale
date format
number format
currency
timezone
```

Do not hard-code user-visible strings inside reusable components.

------------------------------------------------------------------------

# 29. RTL Readiness

The system must support RTL layouts.

This is important for languages such as Urdu and Arabic.

Use logical layout properties where possible:

``` text
margin-inline
padding-inline
inset-inline
```

rather than left/right assumptions.

------------------------------------------------------------------------

# 30. Theme System

Support:

``` text
Light
Dark
System
```

Theme values should use semantic tokens.

Components must remain readable and accessible in every theme.

------------------------------------------------------------------------

# 31. AI Workspace

AI is a platform feature.

Possible layout:

``` text
┌─────────────────────────────────────────────┐
│ AI Assistant                                │
├─────────────────────────────────────────────┤
│ Conversation                                │
│                                             │
│ User: Analyze today's flock performance     │
│                                             │
│ AI: Reviewing authorized farm data...       │
│                                             │
├─────────────────────────────────────────────┤
│ Context │ Attachments │ Tools │ Send        │
└─────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 32. AI Context Display

When appropriate, the UI can expose:

``` text
Active organization
Active domain
Data sources used
Actions proposed
Approval required
Execution status
```

Do not expose hidden system prompts or secrets.

------------------------------------------------------------------------

# 33. AI Action UI

For consequential AI actions:

``` text
AI Recommendation
      ↓
Proposed Action
      ↓
Review
      ↓
Approve
      ↓
Executing
      ↓
Completed
```

The UI should make the difference between:

``` text
recommendation
```

and:

``` text
executed action
```

clear.

------------------------------------------------------------------------

# 34. AI Tool/Workflow Status

Useful states:

``` text
Thinking / processing
Retrieving data
Running analysis
Waiting for approval
Executing action
Completed
Failed
```

Avoid implying certainty when the system is still processing.

------------------------------------------------------------------------

# 35. Command Center

Mianx Super Admin requires a dedicated Command Center.

Possible areas:

``` text
Organizations
Domains
Modules
Users
Subscriptions
Usage
AI Costs
Integrations
System Health
Audit
Feature Flags
Incidents
```

This is platform administration, not tenant business UI.

------------------------------------------------------------------------

# 36. Domain UI Framework

A domain package should be able to register:

``` text
domain navigation
dashboards
pages
widgets
forms
tables
actions
AI panels
workflows
```

The domain must use Core components.

------------------------------------------------------------------------

# 37. Domain UI Manifest

Conceptual:

``` text
Domain UI Manifest
├── navigation
├── dashboards
├── routes
├── widgets
├── actions
├── permissions
└── feature flags
```

The frontend should not render inaccessible modules merely because they
exist in a manifest.

------------------------------------------------------------------------

# 38. Poultry UI Example

``` text
Poultry OS
│
├── Dashboard
├── Farms
│   ├── Farm List
│   └── Farm Detail
├── Sheds
├── Flocks
│   ├── Active Flocks
│   ├── Flock Detail
│   ├── Weight
│   └── Mortality
├── Feed
├── Health
├── Inventory
├── Procurement
├── Reports
└── AI Assistant
```

All of these use the Mianx Core UI system.

------------------------------------------------------------------------

# 39. Frontend State Architecture

Separate state by responsibility:

``` text
Server State
UI State
Form State
URL State
Session/Identity State
AI Conversation State
```

Do not place all application state into one global store.

------------------------------------------------------------------------

# 40. Data Fetching

Prefer a clear server-data strategy with:

``` text
caching
revalidation
loading states
error handling
mutation handling
optimistic updates where safe
```

The UI should not duplicate business logic already owned by domain
services.

------------------------------------------------------------------------

# 41. Security

Frontend security principles:

``` text
Never trust client permissions
Never store secrets
Never construct unauthorized tenant context
Never expose sensitive server responses unnecessarily
Never assume hidden UI equals denied access
```

Security enforcement remains server-side.

------------------------------------------------------------------------

# 42. Observability

Frontend should capture:

``` text
navigation errors
API failures
slow interactions
JavaScript errors
AI interaction failures
important user-flow metrics
```

Avoid collecting unnecessary sensitive user content.

------------------------------------------------------------------------

# 43. Performance

Platform targets should include:

``` text
fast initial render
code splitting
lazy domain modules
optimized assets
minimal client JavaScript
efficient data fetching
virtualized large tables where necessary
```

A user opening Poultry OS should not download unrelated Restaurant OS
code unnecessarily.

------------------------------------------------------------------------

# 44. Domain Code Splitting

Preferred:

``` text
Core Shell
   ↓
Load selected domain
   ↓
Load selected modules
```

Example:

``` text
User enters Poultry
      ↓
Poultry bundle loads
      ↓
User opens Procurement
      ↓
Procurement module loads
```

------------------------------------------------------------------------

# 45. Feature Flags

Feature flags can control:

``` text
new UI
beta modules
AI features
domain capabilities
experiments
rollouts
```

Flags must not replace authorization.

------------------------------------------------------------------------

# 46. Design System Governance

Every shared component should have:

``` text
owner
version
documentation
usage examples
accessibility requirements
states
variants
tests
```

Breaking component changes require deliberate versioning/migration.

------------------------------------------------------------------------

# 47. Design-to-Code Relationship

Preferred source flow:

``` text
Design Tokens
      ↓
Figma Design System
      ↓
Component Specification
      ↓
Code Components
      ↓
Visual QA
```

Design and implementation should share the same semantic vocabulary.

------------------------------------------------------------------------

# 48. Component States

Interactive components should define:

``` text
default
hover
focus
active
disabled
loading
error
selected
```

Not every component needs every state, but state behavior must be
explicit.

------------------------------------------------------------------------

# 49. Frontend Testing

Testing layers:

``` text
Unit
Component
Integration
Accessibility
Visual regression
End-to-end
```

Critical business flows should have end-to-end coverage.

Examples:

``` text
Organization switching
Domain switching
Permission denial
Create flock
Record mortality
AI recommendation
Approval
Purchase action
```

------------------------------------------------------------------------

# 50. Frontend Definition of Done

Frontend Core is ready when:

``` text
✓ App shell exists
✓ Organization context works
✓ Domain context works
✓ Navigation is permission-aware
✓ Design tokens exist
✓ Component library exists
✓ Dashboard framework exists
✓ Forms and tables are standardized
✓ Loading/empty/error states exist
✓ Responsive behavior exists
✓ Accessibility baseline exists
✓ Localization is architecture-ready
✓ RTL is architecture-ready
✓ Theme system exists
✓ AI workspace exists
✓ Command Center foundation exists
✓ Domain UI manifests exist
✓ Code splitting exists
✓ Feature flags exist
✓ Frontend observability exists
✓ Critical E2E flows pass
```

------------------------------------------------------------------------

# 51. Implementation Order

Build in this order:

``` text
1. App shell
2. Design tokens
3. Typography / theme
4. Primitive components
5. Composite components
6. Navigation
7. Organization context
8. Domain context
9. Permission-aware UI
10. Forms / tables
11. Dashboard engine
12. AI workspace
13. Command Center
14. Domain UI manifest
15. Responsive/mobile
16. Accessibility
17. Localization / RTL
18. Observability
19. Testing / visual QA
20. Poultry frontend implementation
```

------------------------------------------------------------------------

# 52. Final Frontend Principle

> **Mianx.ai should feel like one operating system, even when the user
> moves between completely different business domains.**

``` text
ONE CORE
   ↓
ONE DESIGN SYSTEM
   ↓
ONE APP SHELL
   ↓
MANY DOMAIN OSs
   ↓
MANY MODULES
   ↓
ONE CONSISTENT USER EXPERIENCE
```

------------------------------------------------------------------------

# 53. Next Technical Deliverable

Next:

# MIANX.AI CORE --- DATA PLATFORM & DATABASE ARCHITECTURE SPECIFICATION v1.0

It will define:

-   PostgreSQL architecture
-   Multi-tenant data model
-   Core tables
-   Domain tables
-   Tenant isolation
-   Row Level Security
-   Prisma architecture
-   Migrations
-   Indexing
-   Audit data
-   Event data
-   AI memory data
-   File/object storage
-   Redis/cache boundaries
-   Data lifecycle
-   Backup/recovery
-   Analytics architecture
-   How Poultry data plugs into the Core data platform
