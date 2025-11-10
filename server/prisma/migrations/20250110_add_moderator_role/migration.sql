-- Add MODERATOR role to UserRole enum
-- Check if MODERATOR already exists before adding (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'MODERATOR'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
    ) THEN
        ALTER TYPE "UserRole" ADD VALUE 'MODERATOR';
    END IF;
END $$;
