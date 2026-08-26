-- Mianx.ai V3 — performance indexes for high-query columns
-- Additive/idempotent migration. No existing data is modified.

-- UsageRecord: queries filtered by organizationId in billing routes
CREATE INDEX IF NOT EXISTS "UsageRecord_organizationId_idx" ON "UsageRecord" ("organizationId");

-- Notification (V3Notification): user notification listing filtered by recipientUserId
CREATE INDEX IF NOT EXISTS "V3Notification_recipientUserId_idx" ON "V3Notification" ("recipientUserId");

-- Setting: lookups by scopeType + scopeId
CREATE INDEX IF NOT EXISTS "Setting_scopeType_scopeId_idx" ON "Setting" ("scopeType", "scopeId");

-- AiCostRecord: queries filtered by organizationId in stats/billing
CREATE INDEX IF NOT EXISTS "AiCostRecord_organizationId_idx" ON "AiCostRecord" ("organizationId");

-- WorkflowRun: queries filtered by organizationId in trust/stats/runs
CREATE INDEX IF NOT EXISTS "WorkflowRun_organizationId_idx" ON "WorkflowRun" ("organizationId");

-- WorkflowApproval: queries filtered by organizationId in trust/approvals
CREATE INDEX IF NOT EXISTS "WorkflowApproval_organizationId_idx" ON "WorkflowApproval" ("organizationId");

-- Event: queries filtered by organizationId and eventType
CREATE INDEX IF NOT EXISTS "Event_organizationId_idx" ON "Event" ("organizationId");
CREATE INDEX IF NOT EXISTS "Event_eventType_idx" ON "Event" ("eventType");

-- OutboxEvent: polling by status + availableAt
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_availableAt_idx" ON "OutboxEvent" ("status", "availableAt");
