-- Mianx.ai V3 — distributed authentication rate limiting
-- Additive/idempotent migration. No existing application data is modified.

CREATE TABLE IF NOT EXISTS "_rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reset_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "_rate_limits_reset_at_idx"
    ON "_rate_limits" ("reset_at");
