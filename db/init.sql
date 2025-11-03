-- Maestroverse Database Initialization
-- This script is run when the PostgreSQL container first starts

-- Create database if not exists (handled by Docker environment)
-- Database: maestroverse

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create indexes for performance (Prisma creates these, but listed here for reference)
-- These will be created by Prisma migrations

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE maestroverse TO maestro;

-- Set timezone
SET TIME ZONE 'UTC';

-- Note: Schema is managed by Prisma migrations
-- Run: npx prisma migrate deploy
-- Then: npm run seed
