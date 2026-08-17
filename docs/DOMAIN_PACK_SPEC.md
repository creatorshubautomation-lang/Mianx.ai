# Mianx.ai Domain Pack Contract

A Domain Pack is a portable, versioned business capability package that runs on Mianx Core.
It must contain no fork of Core and no domain-specific branching inside shared runtime code.

## Manifest

```json
{
  "id": "example-domain",
  "version": "1.0.0",
  "name": "Example Domain",
  "coreVersion": ">=2.0.0",
  "countries": ["*"],
  "modules": [],
  "agents": [],
  "skills": [],
  "workflows": [],
  "tools": [],
  "integrations": [],
  "verificationRules": []
}
```

## Required Contract

Every pack must define:

- domain identity/version
- entities and relationships
- modules
- skills
- agent capabilities
- workflow definitions
- tool declarations and risk levels
- knowledge sources/policies
- verification rules
- permissions
- dashboards/reports
- integration requirements
- migration/seed strategy

## Pack Rules

- Version every pack independently.
- Declare compatible Core versions.
- Validate manifests before installation.
- Never execute arbitrary pack code without a controlled extension boundary.
- Apply tenant authorization to every domain resource.
- Make migrations reversible or explicitly destructive with approval.
- Keep domain data isolated by organization/tenant.
- Make country-specific behavior a Country Pack dependency, not embedded logic.

## Installation Lifecycle

```text
DISCOVER
  ↓
VALIDATE MANIFEST
  ↓
CHECK CORE COMPATIBILITY
  ↓
CHECK DEPENDENCIES
  ↓
PLAN MIGRATION
  ↓
REQUEST APPROVAL IF REQUIRED
  ↓
INSTALL
  ↓
VERIFY
  ↓
ACTIVATE
```

Installation must be idempotent and produce audit events.
