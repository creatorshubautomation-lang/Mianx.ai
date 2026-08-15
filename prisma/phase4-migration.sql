-- Phase 4 Migration: Deeper Memory & Context
-- Date: 2026-08-15
--
-- Schema changes:
--   1. AgentMemory: added `clientId` (nullable) and `source` columns
--   2. New table: ClientMemory (cross-project client preferences)

-- PostgreSQL migration:

-- 1. Add clientId column to AgentMemory
ALTER TABLE "AgentMemory" ADD COLUMN "clientId" TEXT;
CREATE INDEX "AgentMemory_clientId_idx" ON "AgentMemory"("clientId");

-- 2. Add source column to AgentMemory (defaults to "regex" for existing rows)
ALTER TABLE "AgentMemory" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'regex';

-- 3. Create ClientMemory table
CREATE TABLE "ClientMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "sourceProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMemory_userId_key_key" UNIQUE ("userId", "key")
);

CREATE INDEX "ClientMemory_userId_idx" ON "ClientMemory"("userId");

-- SQLite migration (for local dev):

-- PRAGMA table_info("AgentMemory");
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with DEFAULT well in all versions.
-- For SQLite, use db push (npx prisma db push) which handles this automatically.
-- The Phase 4 schema changes are:
--   - AgentMemory: +clientId (TEXT, nullable), +source (TEXT, default "regex")
--   - New table: ClientMemory
