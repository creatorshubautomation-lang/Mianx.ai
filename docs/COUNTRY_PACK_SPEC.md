# Mianx.ai Country Pack Contract

A Country Pack localizes a domain-independent Mianx deployment without changing Core.

## Required Areas

- locale and supported languages
- currency and money formatting
- timezone
- date/number formatting
- tax configuration
- payment providers
- communication providers
- local integrations
- compliance configuration

## Contract

```text
Country Pack
  ↓
Locale Provider
Currency Provider
Tax Provider
Payment Provider
Communication Provider
Compliance Provider
Integration Registry
```

Providers must expose typed contracts and explicit version information.

## Safety

Country-specific legal, tax, financial, or regulatory behavior must never be generated
as an unverified assumption. Rules must be versioned, sourced/configured, auditable and,
where appropriate, require human review.

## Activation

A country pack is activated per organization/tenant and may be overridden only through
explicit organization policy. Existing tenant data must not be silently reformatted or
migrated without a migration plan.
