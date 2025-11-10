-- AlterTable: Enhance RefreshToken security with device tracking and token rotation
-- This migration adds:
-- 1. Device tracking (deviceId)
-- 2. Token hashing (rename token -> tokenHash)
-- 3. Last used timestamp for anomaly detection
-- 4. Token rotation chain (replacedByTokenId)

-- Step 1: Add new columns
ALTER TABLE "RefreshToken" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "RefreshToken" ADD COLUMN "replacedByTokenId" TEXT;

-- Step 2: Rename token to tokenHash (existing tokens are already stored, we'll hash them in code)
ALTER TABLE "RefreshToken" RENAME COLUMN "token" TO "tokenHash";

-- Step 3: Set deviceId for existing tokens (use 'legacy-device' as default)
UPDATE "RefreshToken" SET "deviceId" = 'legacy-device-' || "id" WHERE "deviceId" IS NULL;

-- Step 4: Make deviceId NOT NULL now that all rows have values
ALTER TABLE "RefreshToken" ALTER COLUMN "deviceId" SET NOT NULL;

-- Step 5: Drop old indexes that referenced 'token'
DROP INDEX IF EXISTS "RefreshToken_token_key";

-- Step 6: Create new indexes
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_deviceId_idx" ON "RefreshToken"("deviceId");
CREATE INDEX "RefreshToken_lastUsedAt_idx" ON "RefreshToken"("lastUsedAt");
CREATE UNIQUE INDEX "RefreshToken_userId_deviceId_key" ON "RefreshToken"("userId", "deviceId");

-- Step 7: Add foreign key for token rotation
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedByTokenId_fkey"
  FOREIGN KEY ("replacedByTokenId") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
