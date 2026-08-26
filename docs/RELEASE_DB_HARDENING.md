# Production DB hardening recorded for PR #3

Production Supabase migration state was verified and the following hardening was applied:

- `_rate_limits` exists and supports the atomic UPSERT used by the application.
- Public `anon` and `authenticated` roles have no direct privileges on application tables, sequences, or functions.
- Default privileges for future public-schema tables, sequences, and functions are also revoked from `anon` and `authenticated`.
- `User.passwordHash` is nullable in production to match the Prisma schema; existing password hashes were preserved (1 populated, 0 null).
- `User.timezone` remains NOT NULL with default `UTC`.

The corresponding SQL is tracked in `prisma/migrations/004_revoke_public_table_grants.sql` and `prisma/migrations/005_align_user_passwordhash_nullability.sql` on the integration branch.
