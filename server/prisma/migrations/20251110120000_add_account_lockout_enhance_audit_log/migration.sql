-- Create AccountLockout table for account lockout tracking
CREATE TABLE "AccountLockout" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLockout_pkey" PRIMARY KEY ("id")
);

-- Create unique index on identifier
CREATE UNIQUE INDEX "AccountLockout_identifier_key" ON "AccountLockout"("identifier");

-- Create indexes for efficient querying
CREATE INDEX "AccountLockout_identifier_idx" ON "AccountLockout"("identifier");
CREATE INDEX "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");

-- Enhance AuditLog table with new fields
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "event" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "details" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing AuditLog records to use action as event if event is null
UPDATE "AuditLog" SET "event" = "action" WHERE "event" IS NULL;

-- Create new indexes on AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX IF NOT EXISTS "AuditLog_severity_idx" ON "AuditLog"("severity");
CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
