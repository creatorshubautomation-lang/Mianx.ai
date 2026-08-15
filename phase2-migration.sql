-- Phase 2 Migration: Agent Tool Calls + Tier Column
-- Run this on production PostgreSQL after deploying Phase 2 code.
-- The repo uses `prisma db push` locally but production needs manual SQL.

-- The tier column on AiProviderUsage was added in Phase 1.
-- If not already present:
-- ALTER TABLE "AiProviderUsage" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'fast';
-- CREATE INDEX "AiProviderUsage_tier_idx" ON "AiProviderUsage"("tier");

-- Phase 2: AgentToolCall table (tool usage tracking)
CREATE TABLE IF NOT EXISTS "AgentToolCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "agentName" TEXT,
  "projectId" TEXT,
  "userId" TEXT,
  "input" TEXT,
  "output" TEXT,
  "status" TEXT NOT NULL DEFAULT 'success',
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AgentToolCall_provider_createdAt_idx" ON "AgentToolCall"("provider", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentToolCall_projectId_idx" ON "AgentToolCall"("projectId");
CREATE INDEX IF NOT EXISTS "AgentToolCall_userId_createdAt_idx" ON "AgentToolCall"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentToolCall_toolName_idx" ON "AgentToolCall"("toolName");
