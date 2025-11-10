# Maestroverse Setup Guide

Complete step-by-step guide to setting up the Maestroverse development environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js and npm**
   - Version: Node.js 18+ and npm 9+
   - Download: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version  # Should be v18.x.x or higher
     npm --version   # Should be 9.x.x or higher
     ```

2. **Docker and Docker Compose** (Recommended)
   - Docker Desktop for Mac/Windows
   - Docker Engine + Docker Compose for Linux
   - Download: https://docs.docker.com/get-docker/
   - Verify installation:
     ```bash
     docker --version
     docker-compose --version
     ```

3. **PostgreSQL 15** (Only if not using Docker)
   - Download: https://www.postgresql.org/download/
   - Or install via package manager:

     ```bash
     # macOS
     brew install postgresql@15

     # Ubuntu/Debian
     sudo apt install postgresql-15

     # Windows
     # Use installer from postgresql.org
     ```

4. **Git**
   - Any recent version
   - Download: https://git-scm.com/downloads

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd maestroverse
```

### Step 2: Install Dependencies

Install all dependencies for the monorepo:

```bash
npm install
```

This will install dependencies for:

- Root workspace
- Server
- All frontend applications (hub, careerlink, collabspace)
- Shared utilities

---

## Configuration

### Step 1: Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

### Step 2: Configure .env File

Open `.env` and configure the following:

```env
# Database Configuration
DATABASE_URL="postgresql://maestro:maestro123@localhost:5432/maestroverse"

# Server Configuration
NODE_ENV=development
PORT=3001

# JWT Authentication (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Auto-elevated admins (comma-separated emails)
ROOT_ADMIN_EMAILS=you@maestro.edu

# OAuth2 Mock SSO
SSO_CLIENT_ID=maestro-sso-client
SSO_CLIENT_SECRET=maestro-sso-secret
SSO_CALLBACK_URL=http://localhost:3001/auth/callback

# Frontend URL
FRONTEND_URL=http://localhost:3005

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# WebSocket Configuration
WS_PORT=3001

# CORS Origins
CORS_ORIGINS=http://localhost:3005
```

**Important Security Notes:**

- ⚠️ **Change `JWT_SECRET` in production to a long, random string**
- ⚠️ **Never commit `.env` to version control**
- ⚠️ **Use environment-specific `.env` files for different environments**

---

## Database Setup

### Option A: Using Docker (Recommended)

This is the easiest method as it handles PostgreSQL and Redis automatically.

1. **Start the stack (web + API + data stores):**

   ```bash
   npm run dev
   ```

2. **Wait for services to be ready** (about 30 seconds)

   ```bash
   docker-compose ps
   ```

   All services should show "Up" status.

3. **Run database migrations:**

   ```bash
   npm run db:migrate
   ```

4. **Generate Prisma client:**

   ```bash
   docker-compose exec server npx prisma generate
   ```

5. **Seed the database:**

   ```bash
   npm run db:seed
   ```

6. **Verify everything is running:**
   ```bash
   docker-compose logs -f
   ```

### Option B: Local Setup (Without Docker)

If you prefer to run services locally:

1. **Start PostgreSQL:**

   ```bash
   # macOS (if installed via Homebrew)
   brew services start postgresql@15

   # Linux
   sudo systemctl start postgresql

   # Windows
   # Start from Services or pg_ctl
   ```

2. **Create database:**

   ```bash
   createdb maestroverse
   ```

   Or via psql:

   ```sql
   CREATE DATABASE maestroverse;
   CREATE USER maestro WITH PASSWORD 'maestro123';
   GRANT ALL PRIVILEGES ON DATABASE maestroverse TO maestro;
   ```

3. **Navigate to server directory:**

   ```bash
   cd server
   ```

4. **Run migrations:**

   ```bash
   npx prisma migrate deploy
   ```

5. **Generate Prisma client:**

   ```bash
   npx prisma generate
   ```

6. **Seed the database:**
   ```bash
   npm run seed
   ```

---

## Running the Application

### With Docker

From the project root:

```bash
npm run dev          # Starts the web container (and its dependencies)
npm run db:migrate   # Applies migrations inside the server container
npm run db:seed      # Optional demo data
```

Access the stack at:

- **Unified Maestroverse UI:** http://localhost:3005
- **API + WebSocket Server:** http://localhost:3001
- **API Health Check:** http://localhost:3001/health

### Without Docker

Use two terminals:

```bash
# Terminal 1: start the API (port 3001)
npm run dev --workspace=server

# Terminal 2: start the unified web frontend (port 3000)
npm run dev --workspace=apps/web
```

---

## Logging In

After seeding, use these demo credentials:

| Name  | Email             | Password    | Major            |
| ----- | ----------------- | ----------- | ---------------- |
| Alice | alice@maestro.edu | password123 | Computer Science |
| Bob   | bob@maestro.edu   | password123 | Software Eng.    |
| Carol | carol@maestro.edu | password123 | Design & Tech    |

---

## Verifying the Setup

### 1. Check API Health

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-XX-XXTXX:XX:XX.XXXZ"
}
```

### 2. Test Authentication

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername": "alice@maestro.edu", "password": "password123"}'
```

Should return user data and a JWT token.

### 3. Access Frontends

- Visit http://localhost:3005
- Login with demo credentials
- Explore the Hub, CareerLink, and CollabSpace sections via the global navigation

### 4. Check Database

Using Prisma Studio:

```bash
npm run db:studio
```

Opens at http://localhost:5555 - browse all database records.

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:** `Port 3000, 3001, or 3005 is already in use`

**Solution:**

```bash
# Find process using the port (example for 3001)
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use different ports in .env
```

#### 2. Database Connection Failed

**Error:** `Can't reach database server at localhost:5432`

**Docker:**

```bash
# Restart PostgreSQL container
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

**Local:**

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL
brew services start postgresql@15  # macOS
sudo systemctl start postgresql    # Linux
```

#### 3. Prisma Migration Errors

**Error:** `Migration failed` or `Database schema is not in sync`

**Solution:**

```bash
cd server

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Or just regenerate client
npx prisma generate
```

#### 4. JWT Token Errors

**Error:** `Invalid token` or `TokenExpiredError`

**Solution:**

- Clear browser localStorage
- Check `JWT_SECRET` in `.env` matches across all services
- Re-login to get a fresh token

#### 5. Module Not Found Errors

**Error:** `Cannot find module 'xyz'`

**Solution:**

```bash
# Clean install
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf server/node_modules
npm install

# Or use npm ci for clean install
npm ci
```

#### 6. Docker Issues

**Container won't start:**

```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: Deletes database data)
docker-compose down -v

# Rebuild and restart
docker-compose up --build -d
```

**Check container logs:**

```bash
docker-compose logs -f [service-name]
# Examples:
docker-compose logs -f server
docker-compose logs -f postgres
docker-compose logs -f hub
```

### Getting Help

1. **Check logs:**
   - Docker: `docker-compose logs -f`
   - Local: Check terminal output

2. **Verify environment:**
   - Node version: `node --version`
   - npm version: `npm --version`
   - Docker version: `docker --version`

3. **Database status:**

   ```bash
   # With Docker
   docker-compose exec postgres pg_isready

   # Local
   pg_isready -d maestroverse
   ```

4. **Open an issue:**
   - Include error messages
   - Include system information
   - Include steps to reproduce

---

## Next Steps

After successful setup:

1. **Explore the codebase:**
   - [Server Routes](../server/src/routes)
   - [Frontend Pages](../apps/hub/pages)
   - [Shared Components](../shared/components)

2. **Read the documentation:**
   - [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
   - [API Documentation](../README.md#api-documentation)

3. **Start developing:**
   - Make changes to code
   - Hot reload is enabled for all services
   - Test your changes in real-time

4. **Run database operations:**

   ```bash
   # View data in Prisma Studio
   cd server && npm run prisma:studio

   # Create new migration
   cd server && npx prisma migrate dev --name your_migration_name

   # Reset and reseed
   cd server && npx prisma migrate reset
   ```

Happy coding! 🚀
