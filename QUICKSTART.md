# Maestroverse - Quick Start Guide

Get Maestroverse running in 5 minutes!

## Prerequisites

- Docker & Docker Compose installed
- OR Node.js 18+ and PostgreSQL 15

---

## Option 1: Docker (Recommended) ⚡

### 1. Start Everything

```bash
# Clone and enter directory
git clone <repo-url> && cd maestroverse

# Install root dependencies (gives you helper scripts)
npm install

# Copy environment file
cp .env.example .env

# Elevate your account to admin (optional)
# Edit .env and set ROOT_ADMIN_EMAILS=your.email@maestro.edu

# Start the stack (web + API + data stores)
npm run dev

# Run database migrations
npm run db:migrate

# Generate Prisma client (optional – migrations do this automatically, but helpful after schema changes)
docker-compose exec server npx prisma generate

# Seed database with demo data
npm run db:seed
```

### 2. Access the App

- **Unified Maestroverse UI:** http://localhost:3005
- **API + WebSocket:** http://localhost:3001 / ws://localhost:3001

### 3. Login

Use any of these demo accounts:

```
Email: alice@maestro.edu
Password: password123
```

**That's it!** 🎉

---

## Option 2: Local Development (Without Docker)

### 1. Install & Setup

```bash
# Clone and install
git clone <repo-url> && cd maestroverse
npm install

# Copy environment file
cp .env.example .env
```

### 2. Setup Database

```bash
# Create database
createdb maestroverse

# Run migrations and generate client
cd server
npx prisma migrate deploy
npx prisma generate
npm run seed
cd ..
```

### 3. Start the API & Web App

```bash
# Terminal 1
npm run dev --workspace=server

# Terminal 2
npm run dev --workspace=apps/web
```

### 4. Access & Login

- Web app: http://localhost:3000
- API: http://localhost:3001

---

## Verify Installation

### Check API Health

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Check Services

```bash
# If using Docker
docker-compose ps

# All services should show "Up"
```

---

## Common Commands

### Docker

```bash
# Start / stop / logs
npm run dev            # docker-compose up -d web
npm run docker:logs    # tail unified web logs
npm run docker:stop    # docker-compose down

# Exec into containers when needed
docker-compose exec server npx prisma migrate deploy
docker-compose exec postgres psql -U maestro maestroverse

# Rebuild images after dependency changes
docker-compose build web
```

### Local

```bash
# Start API
npm run dev --workspace=server

# Start unified web frontend
npm run dev --workspace=apps/web

# Prisma Studio
docker-compose exec server npx prisma studio
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 3001
lsof -i :3001
kill -9 <PID>
```

### Database Connection Error

```bash
# Docker: Restart database
docker-compose restart postgres

# Local: Check PostgreSQL is running
pg_isready
```

### Reset Everything

```bash
# Docker
docker-compose down -v
docker-compose up -d

# Local
cd server
npx prisma migrate reset
```

---

## What's Next?

1. **Explore the Apps:**
   - Create posts in Student Hub
   - Add projects in CareerLink
   - Browse courses in CollabSpace

2. **Read Documentation:**
   - [Full README](README.md)
   - [Setup Guide](docs/SETUP_GUIDE.md)
   - [Architecture](docs/ARCHITECTURE_OVERVIEW.md)

3. **Start Coding:**
   - All services support hot reload
   - Make changes and see them instantly

---

## Need Help?

Check the [Setup Guide](docs/SETUP_GUIDE.md) for detailed instructions and troubleshooting.

---

**Built for Maestro University Students** 🎓
