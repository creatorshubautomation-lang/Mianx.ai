-- Mianx.ai production invariant: User.passwordHash must remain NOT NULL.
-- Preflight verified zero NULL passwordHash rows in production before applying.
-- Additive constraint tightening; no existing data is modified.
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
