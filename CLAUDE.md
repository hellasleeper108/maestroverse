# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Maestroverse is a unified student platform for Maestro University integrating three modules:

- **Student Hub**: Social networking, groups, events, messaging
- **CareerLink**: Professional portfolios, projects, connections
- **CollabSpace**: Course discussions, study groups, resource sharing

**Tech Stack**: Next.js 14 (frontend), Express.js (backend), PostgreSQL + Prisma (database), Socket.IO (WebSockets), Redis (caching), Docker Compose (orchestration)

## Development Commands

### Docker-Based Development (Recommended)

```bash
# Start all services (web frontend, API server, PostgreSQL, Redis)
npm run dev

# View logs from the unified web container
npm run docker:logs

# Stop all services
npm run docker:stop

# Rebuild containers after dependency changes
npm run build

# Database operations (run inside Docker)
npm run db:migrate    # Apply migrations
npm run db:seed       # Seed demo data
npm run db:studio     # Open Prisma Studio
```

### Local Development (Without Docker)

```bash
# Start API server (requires PostgreSQL running locally)
npm run dev --workspace=server

# Start web frontend (in separate terminal)
npm run dev --workspace=apps/web

# Run database migrations locally
cd server && npx prisma migrate deploy

# Generate Prisma client after schema changes
cd server && npx prisma generate

# Seed database
cd server && npm run seed
```

### Code Quality

```bash
npm run lint      # Lint all workspaces
npm run format    # Format with Prettier
```

### Running Tests

```bash
./test-verification.sh                    # Run verification suite
bash test-verification.sh                 # Alternative verification command
```

### Demo Credentials

After seeding the database, you can login with:

- Email: `alice@maestro.edu` / Password: `password123`
- Email: `bob@maestro.edu` / Password: `password123`
- Email: `carol@maestro.edu` / Password: `password123`

## Architecture

### Monorepo Structure

- **`apps/web/`**: Unified Next.js frontend (port 3005 in Docker, 3000 locally)
  - `pages/`: Next.js pages router
  - `components/`: React components
  - `lib/`: Frontend utilities
- **`server/`**: Express.js API server (port 3001)
  - `src/routes/`: API route handlers (auth, hub, careerlink, collabspace, search, admin, users)
  - `src/middleware/`: Authentication (`authenticate`, `optionalAuth`, `authorize`)
  - `src/websocket/`: Socket.IO real-time handlers
  - `src/index.js`: Server entry point with Socket.IO integration
  - `prisma/schema.prisma`: Database schema
- **`shared/`**: Shared code between frontend and backend
  - `utils/api.js`: Typed API client with auth helpers (auth, users, hub, careerlink, collabspace, search)
  - `components/`: Reusable React components

### Database Schema (Prisma)

The schema in `server/prisma/schema.prisma` defines all models across three modules:

**Core Models:**

- `User`: Central user model with relations to all features
  - Roles: STUDENT, FACULTY, ADMIN
  - Status: ACTIVE, SUSPENDED, BANNED
  - Fields include: email, username, password, profile info, skills, interests, cohort

**Student Hub:**

- `Post`, `Comment`, `Like`: Social feed system
- `Group`, `GroupMember`: Student groups/clubs
- `Event`: Campus events
- `Message`: Direct messaging
- `Notification`: Real-time notifications (types: LIKE, COMMENT, MESSAGE, EVENT, MENTION, CONNECTION, GROUP_INVITE)

**CareerLink:**

- `Portfolio`: User portfolios with resume, work experience, education (JSON fields)
- `Project`: Student projects with technologies array
- `Connection`: Professional connections (status: PENDING, ACCEPTED, REJECTED)

**CollabSpace:**

- `Course`: Academic courses with code, department
- `Thread`, `ThreadReply`: Course discussion threads
- `StudyGroup`, `StudyGroupMember`: Study groups with cohort matching
- `GroupMessage`: Study group chat
- `Resource`, `ResourceVote`: Shared course resources with voting

### Authentication & Authorization

Authentication uses JWT tokens stored in localStorage (key: `maestro_token`).

**Middleware (server/src/middleware/auth.js):**

- `authenticate`: Requires valid JWT, blocks BANNED/SUSPENDED users, auto-restores expired suspensions
- `optionalAuth`: Attaches user if token present, continues if missing
- `authorize(...roles)`: Restricts access to specific roles (e.g., `authorize('ADMIN', 'FACULTY')`)

**Root Admin Promotion:** Set `ROOT_ADMIN_EMAILS` in `.env` to auto-promote users to ADMIN role on login.

### WebSocket Architecture (server/src/websocket/index.js)

Socket.IO server integrated with Express on port 3001. Requires JWT in `socket.handshake.auth.token`.

**Room Structure:**

- `user:{userId}`: Personal room for notifications
- `group:{groupId}`: Group-specific updates
- `course:{courseId}`: Course discussion rooms
- `studygroup:{studyGroupId}`: Study group chat rooms

**Key Events:**

- Messaging: `message:send`, `message:receive`, `message:typing`
- Notifications: `notification:new`, `notification:read`, `notification:count`
- Real-time updates: `user:online`, `user:offline`, `post:update`
- Rooms: `group:join/leave`, `course:join/leave`, `studygroup:join`

**Active User Tracking:** `activeUsers` Map tracks userId -> socketId for online status and direct messaging.

### API Client Pattern (shared/utils/api.js)

All frontend API calls go through `shared/utils/api.js` which:

1. Automatically attaches JWT from localStorage
2. Handles token storage/removal (`setToken`, `removeToken`)
3. Throws errors on non-OK responses
4. Exports namespaced APIs: `auth`, `users`, `hub`, `careerlink`, `collabspace`, `search`

**Usage Example:**

```javascript
import { auth, hub } from '@/shared/utils/api';

// Login
const { token, user } = await auth.login({ emailOrUsername, password });

// Create post
const post = await hub.createPost({ content, mediaUrls });
```

### Docker Services

Defined in `docker-compose.yml`:

1. **postgres**: PostgreSQL 15 on port 5432 (credentials: maestro/maestro123)
2. **redis**: Redis 7 on port 6379
3. **server**: Express API server with hot reload (volumes mounted)
4. **web**: Next.js frontend on port 3005 (mapped from container port 3000)

All services connected via `maestro-network` bridge network. Server and web have health checks ensuring postgres/redis are ready before starting.

**Health Check Endpoint:** GET `/health` returns `{"status": "ok", "timestamp": "..."}` at `http://localhost:3001/health`

## Common Development Patterns

### Adding New API Endpoints

1. Define route in `server/src/routes/{module}.js`
2. Use `authenticate` or `authorize` middleware as needed
3. Update `shared/utils/api.js` with corresponding client method
4. Use Prisma client for database operations

### Database Migrations

After modifying `server/prisma/schema.prisma`:

```bash
cd server
npx prisma migrate dev --name describe_change
```

This generates migration SQL and updates Prisma client. For Docker:

```bash
docker-compose exec server npx prisma migrate dev --name describe_change
```

To reset the database completely:

```bash
cd server
npx prisma migrate reset
```

### File Uploads

Server uses `express-fileupload` middleware. Files saved to `uploads/` directory (mounted volume in Docker). Access via `/uploads/{filename}` endpoint.

Configuration in `.env`:

- `MAX_FILE_SIZE`: Default 10MB (10485760 bytes)
- `ALLOWED_FILE_TYPES`: MIME types (comma-separated, default: image/jpeg,image/png,image/gif,application/pdf)

### Real-Time Features

To add WebSocket functionality:

1. Add event handler in `server/src/websocket/index.js`
2. Use room structure for targeted broadcasts
3. Update frontend to emit/listen for events
4. Helper functions: `emitNotification(io, userId, notification)`, `broadcastToGroup(io, groupId, event, data)`

### Admin Features

The admin system provides comprehensive user management and moderation capabilities.

**Access:** Navigate to `/admin` (requires ADMIN role). The link appears in the navbar dropdown for admin users.

**Promoting Users to Admin:**

1. **Via Environment Variable**: Set `ROOT_ADMIN_EMAILS` in `.env` with comma-separated emails (e.g., `alice@maestro.edu,bob@maestro.edu`). These users are auto-promoted to ADMIN on login.
2. **Via Admin Console**: Existing admins can promote other users using the "Make Admin" button in the admin dashboard.

**Available Features:**

- **User Listing**: View all users with status, role, and activity information
- **Suspend User**: Temporarily suspend access (1 hour, 24 hours, or 7 days)
- **Ban User**: Permanently ban a user from the platform
- **Restore User**: Restore suspended or banned users to active status
- **Role Management**: Promote users to admin or demote back to student
- **User Deletion**: Permanently delete user accounts and associated data
- **Platform Statistics**: View counts of total, active, suspended, banned users and admins

**Backend API Endpoints** (`server/src/routes/admin.js`):

- `GET /api/admin/users` - List all users
- `POST /api/admin/users/:id/suspend` - Suspend user (body: `{ durationMinutes, reason }`)
- `POST /api/admin/users/:id/ban` - Ban user (body: `{ reason }`)
- `POST /api/admin/users/:id/restore` - Restore user to active status
- `POST /api/admin/users/:id/role` - Update user role (body: `{ role: 'STUDENT'|'FACULTY'|'ADMIN' }`)
- `DELETE /api/admin/users/:id` - Delete user account

**Frontend:** Admin dashboard at `apps/web/pages/admin/index.js`
**API Client:** Admin API functions in `shared/utils/api.js` and `apps/web/lib/api.js`

**Security Notes:**

- All admin endpoints require `authenticate` and `authorize('ADMIN')` middleware
- Admins cannot suspend, ban, change role, or delete themselves
- User suspensions auto-restore when `suspendedUntil` date passes

## Important Notes

- **Environment Variables**: Copy `.env.example` to `.env` and configure. Never commit `.env`.
- **Port Mapping**: Docker exposes web on 3005 (internal 3000), API on 3001. Local dev uses 3000 (web) and 3001 (API).
- **Legacy Apps**: `apps/hub/`, `apps/careerlink/`, `apps/collabspace/` are deprecated. Only `apps/web/` is active.
- **Prisma Generate**: After schema changes or initial setup, run `npx prisma generate` to update the client.
- **Cohort System**: Users and study groups support cohort matching (beginner, intermediate, advanced) for skill-based pairing.
- **WebSocket Authentication**: Frontend must pass JWT in socket connection: `io(url, { auth: { token } })`

## Troubleshooting

### Port Already in Use

```bash
# Find process on port 3001 (API) or 3005 (web)
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

### Reset Everything (Docker)

```bash
docker-compose down -v
docker-compose up -d
npm run db:migrate
npm run db:seed
```

### Container Logs

```bash
# View all container logs
docker-compose logs -f

# View specific service
docker-compose logs -f server
docker-compose logs -f web
```
