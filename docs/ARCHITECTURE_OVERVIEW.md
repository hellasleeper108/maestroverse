# Maestroverse Architecture Overview

## System Architecture

Maestroverse is a Dockerised monorepo with a **single** Next.js frontend (`apps/web`) that renders the Hub, CareerLink, and CollabSpace experiences via route groups. That unified UI talks to a shared Express API and real-time layer, backed by PostgreSQL and Redis.

```
┌────────────────────────────────────────────────────────────┐
│                   Unified Web Frontend                      │
│          Next.js (apps/web) • Docker port 3005              │
│  - Hub UI  •  CareerLink UI  •  CollabSpace UI              │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│              Shared Components & Utilities                  │
│  - `shared/components` (design system, nav, etc.)          │
│  - `shared/utils` (API client, helpers)                     │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│                  Backend API + WebSocket Layer              │
│         Express.js + Socket.IO • Port 3001 (Docker)         │
│  Routes: /api/auth, /api/users, /api/hub, /api/careerlink,  │
│          /api/collabspace, /api/search                      │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│                 Data Persistence & Messaging                │
│   PostgreSQL 15 (5432) • Redis 7 (6379) • Prisma ORM        │
└────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Applications

The unified frontend (`apps/web`) is a single Next.js 14 application with:
- **Framework:** Next.js 14 with React 18
- **Styling:** TailwindCSS powering the cyberpunk theme shared across modules
- **Routing:** Next.js route groups for Hub, CareerLink, and CollabSpace sections
- **State Management:** React hooks (useState, useEffect)
- **API Communication:** Shared API client utility
- **Real-time:** Socket.IO client for WebSocket connections

### Backend Server

Single Express.js server handling all API requests:
- **Framework:** Express.js
- **Authentication:** JWT-based token authentication
- **WebSocket:** Socket.IO for real-time features
- **Validation:** Zod schema validation
- **Security:** Helmet, CORS, rate limiting
- **File Uploads:** express-fileupload middleware

### Database Layer

**PostgreSQL with Prisma ORM:**
- Type-safe database queries
- Automated migrations
- Relationship management
- Optimized indexes for performance

**Redis (Optional):**
- Session storage
- Cache layer
- Real-time pub/sub

## Data Models

### Core Models

**User** - Central authentication and profile
- Shared across all modules
- Contains: email, username, password, profile info
- Relations to: posts, projects, portfolios, threads, etc.

**Notification** - Unified notification system
- Types: LIKE, COMMENT, MESSAGE, EVENT, MENTION, CONNECTION
- Delivered via WebSocket in real-time

### Student Hub Models

- **Post** - Social media posts with content and media
- **Comment** - Comments on posts
- **Like** - Post likes
- **Group** - Student organizations and clubs
- **Event** - Campus events and activities
- **Message** - Direct messages between users

### CareerLink Models

- **Portfolio** - User professional profile
- **Project** - Academic/personal projects showcase
- **Connection** - Professional networking connections
  - Status: PENDING, ACCEPTED, REJECTED

### CollabSpace Models

- **Course** - Academic courses
- **Thread** - Discussion forum threads
- **ThreadReply** - Replies to threads
- **StudyGroup** - Course-specific study groups
- **Resource** - Shared study materials
- **ResourceVote** - Upvotes/downvotes for resources

## Authentication Flow

```
1. User Registration/Login
   └─> POST /api/auth/register or /api/auth/login
       └─> Server validates credentials
           └─> bcrypt password hashing
               └─> Generate JWT token
                   └─> Return token + user data

2. Authenticated Requests
   └─> Client includes: Authorization: Bearer <token>
       └─> Middleware verifies JWT
           └─> Decode userId from token
               └─> Fetch user from database
                   └─> Attach user to req.user
                       └─> Proceed to route handler

3. WebSocket Authentication
   └─> Client connects with auth.token
       └─> Server verifies JWT
           └─> Attach user to socket.user
               └─> Join user-specific rooms
```

## Real-time Communication

### WebSocket Architecture

**User Rooms:**
- Each user joins `user:{userId}` room for personal notifications
- Enables targeted message delivery

**Group/Course Rooms:**
- Users join `group:{groupId}` or `course:{courseId}` rooms
- Enables broadcast to specific communities

**Events:**
- **Messaging:** Direct messages with delivery confirmation
- **Notifications:** Real-time notification push
- **Presence:** Online/offline status updates
- **Feed Updates:** Live post updates in groups

## API Design Patterns

### RESTful Principles

- **GET** - Retrieve resources
- **POST** - Create new resources
- **PUT** - Update existing resources
- **DELETE** - Remove resources

### Response Format

```json
{
  "data": { ... },        // Success response data
  "error": "message",     // Error message (if applicable)
  "meta": { ... }         // Pagination, counts, etc.
}
```

### Error Handling

- **400** - Bad request (validation errors)
- **401** - Unauthorized (authentication required)
- **403** - Forbidden (insufficient permissions)
- **404** - Not found
- **500** - Internal server error

## Security Measures

### Authentication
- JWT tokens with configurable expiration
- Secure password hashing with bcrypt (10 rounds)
- Token-based API authentication

### Data Protection
- SQL injection prevention via Prisma ORM
- XSS protection with input sanitization
- CORS configuration for allowed origins
- Helmet.js security headers

### Authorization
- Role-based access control (STUDENT, FACULTY, ADMIN)
- Resource ownership verification
- Private group access control

## Performance Optimizations

### Database
- Indexed fields for frequent queries
- Efficient relation loading with Prisma
- Connection pooling
- Query optimization with selective field loading

### Caching
- Redis for session storage
- API response caching
- Static asset caching

### Frontend
- Next.js automatic code splitting
- Image optimization
- Lazy loading of components
- Client-side caching of API responses

## Deployment Architecture

### Development
```
localhost:3005  → Unified Maestroverse web app (Docker)
localhost:3001  → API / WebSocket server
localhost:5432  → PostgreSQL
localhost:6379  → Redis
```

### Production (Recommended)
```
app.maestro.edu       → Unified web frontend (behind CDN)
api.maestro.edu       → API Server (load balanced)
db.internal           → PostgreSQL (private network)
cache.internal        → Redis (private network)
```

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers (can run multiple instances)
- Load balancer distribution
- Redis for shared session state

### Database Scaling
- Read replicas for query distribution
- Connection pooling
- Indexed queries for performance

### CDN Integration
- Static asset delivery
- Frontend application hosting
- Global edge caching

## Monitoring & Logging

### Application Logs
- Morgan HTTP request logging
- Error stack traces in development
- Structured logging in production

### Metrics
- API response times
- Database query performance
- WebSocket connection counts
- User activity analytics

### Health Checks
- `/health` endpoint for uptime monitoring
- Database connection verification
- Redis availability check

## Future Enhancements

### Planned Features
- Email notifications
- Mobile applications (React Native)
- Advanced search with Elasticsearch
- Video/audio chat integration
- AI-powered recommendations
- Analytics dashboard

### Technical Improvements
- Microservices architecture
- GraphQL API layer
- Server-side rendering optimization
- Progressive Web App (PWA)
- CI/CD pipeline
- Automated testing suite
