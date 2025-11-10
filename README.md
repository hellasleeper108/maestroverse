# Maestroverse

**An integrated experience for Maestro University students**

Maestroverse now ships as a unified Next.js application that brings the Student Hub, CareerLink, and CollabSpace together behind a single interface (and a single container) running on port **3005**. Each module lives as a dedicated section inside the app navigation, so the full experience is still available—just without juggling multiple dev servers.

## Features

### Student Hub
- User profiles with photos, majors, skills, and interests
- Social feed with posts, comments, and likes
- Direct messaging system
- Groups and clubs
- Campus events calendar
- Real-time notifications

### CareerLink
- Digital portfolio builder
- Project showcase
- Resume management
- Professional networking
- Student directory with search and filters
- Connection requests

### CollabSpace
- Course-specific discussion forums
- Study group formation and management
- Resource sharing (notes, slides, etc.)
- Upvoting system for helpful resources
- Thread-based discussions

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (React 18)
- **Styling:** TailwindCSS
- **State Management:** React Hooks
- **Real-time:** Socket.IO Client

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **ORM:** Prisma
- **Authentication:** JWT
- **Real-time:** Socket.IO
- **File Uploads:** express-fileupload

### DevOps
- **Containerization:** Docker & Docker Compose
- **Caching:** Redis
- **Process Management:** PM2 (production)
- **Code Quality:** ESLint, Prettier, Husky

## Project Structure

```
maestroverse/
├── apps/
│   ├── web/                 # Unified Next.js frontend (ports to 3005 via Docker)
│   ├── hub/                 # Legacy Hub (kept for reference)
│   ├── careerlink/          # Legacy CareerLink (kept for reference)
│   └── collabspace/         # Legacy CollabSpace (kept for reference)
├── server/                  # Backend API server (port 3001)
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Auth & validation middleware
│   │   ├── websocket/      # WebSocket handlers
│   │   └── index.js        # Server entry point
│   └── prisma/
│       └── schema.prisma   # Database schema
├── shared/                  # Shared utilities & components
│   ├── components/         # Reusable React components
│   └── utils/              # API client & helpers
├── db/                      # Database files
├── docs/                    # Documentation
└── docker-compose.yml       # Docker orchestration
```

> **Note:** Only `apps/web` is actively served in development/production. The other app directories remain for historical reference and can be removed when their code is no longer needed.

## Getting Started

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose (for containerized setup)
- PostgreSQL 15 (if running locally without Docker)

### Quick Start (Docker-first)

1. **Clone the repository**
```bash
git clone <repository-url>
cd maestroverse
```

2. **Install root dependencies (provides helper scripts)**
```bash
npm install
```

3. **Copy environment variables**
```bash
cp .env.example .env
```

4. **Add yourself as a root admin (optional but recommended)**
   Open `.env` and set `ROOT_ADMIN_EMAILS=your.email@maestro.edu` so your account is automatically promoted to `ADMIN` on login.

5. **Start the stack (web + API + data stores)**
```bash
npm run dev
```

6. **Run database migrations**
```bash
npm run db:migrate
```

7. **Seed the database with demo data (optional)**
```bash
npm run db:seed
```

8. **Access the application**
- Unified web app: http://localhost:3005
- API + WebSocket server: http://localhost:3001 / ws://localhost:3001

Need container logs? `npm run docker:logs`

Done for the day? `npm run docker:stop`

### Local Development (without Docker)

Running outside of Docker is possible, but you will need to start the API and unified web frontend separately.

1. **Install dependencies**
```bash
npm install
```

2. **Provision PostgreSQL & configure `.env`**  
Create the `maestroverse` database and update `.env` with your credentials.

3. **Run migrations and generate Prisma client**
```bash
cd server
npx prisma migrate deploy
npx prisma generate
npm run seed
cd ..
```

4. **Start the API and web app (two terminals)**
```bash
# Terminal 1 - API
npm run dev --workspace=server

# Terminal 2 - Unified web app
npm run dev --workspace=apps/web
```

5. **Access locally**
- Web app: http://localhost:3000
- API: http://localhost:3001

## Demo Credentials

After seeding the database, you can login with:

- **Email:** alice@maestro.edu
  **Password:** password123

- **Email:** bob@maestro.edu
  **Password:** password123

- **Email:** carol@maestro.edu
  **Password:** password123

## API Documentation

### Authentication Endpoints

**POST /api/auth/register**
- Register a new user
- Body: `{ email, username, password, firstName, lastName, major?, year? }`

**POST /api/auth/login**
- Login user
- Body: `{ emailOrUsername, password }`

**GET /api/auth/me**
- Get current user info (requires authentication)

### Student Hub Endpoints

**GET /api/hub/posts** - Get feed posts
**POST /api/hub/posts** - Create a new post
**POST /api/hub/posts/:id/like** - Like/unlike a post
**GET /api/hub/posts/:id/comments** - Get post comments
**POST /api/hub/posts/:id/comments** - Add a comment

**GET /api/hub/groups** - Get all groups
**POST /api/hub/groups** - Create a group
**POST /api/hub/groups/:id/join** - Join a group

**GET /api/hub/events** - Get upcoming events
**POST /api/hub/events** - Create an event

**GET /api/hub/messages** - Get user messages
**POST /api/hub/messages** - Send a message

### CareerLink Endpoints

**GET /api/careerlink/portfolio/:userId** - Get user portfolio
**PUT /api/careerlink/portfolio** - Update portfolio

**GET /api/careerlink/projects** - Get projects
**POST /api/careerlink/projects** - Create a project
**PUT /api/careerlink/projects/:id** - Update a project
**DELETE /api/careerlink/projects/:id** - Delete a project

**GET /api/careerlink/connections** - Get connections
**POST /api/careerlink/connections/:userId** - Send connection request
**PUT /api/careerlink/connections/:id/accept** - Accept connection

**GET /api/careerlink/browse** - Browse students

### CollabSpace Endpoints

**GET /api/collabspace/courses** - Get all courses
**GET /api/collabspace/courses/:courseId/threads** - Get course threads
**POST /api/collabspace/threads** - Create a thread
**GET /api/collabspace/threads/:id** - Get thread details
**POST /api/collabspace/threads/:id/replies** - Add a reply

**GET /api/collabspace/courses/:courseId/study-groups** - Get study groups
**POST /api/collabspace/study-groups** - Create a study group
**POST /api/collabspace/study-groups/:id/join** - Join a study group

**GET /api/collabspace/courses/:courseId/resources** - Get resources
**POST /api/collabspace/resources** - Upload a resource
**POST /api/collabspace/resources/:id/vote** - Vote on a resource

### Search Endpoints

**GET /api/search?q={query}&type={type}** - Global search
**GET /api/search/analytics** - Get platform analytics

## WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});
```

### Events

**Messaging**
- `message:send` - Send a message
- `message:receive` - Receive a message
- `message:typing` - Typing indicator

**Notifications**
- `notification:new` - New notification
- `notification:read` - Mark notification as read
- `notification:count` - Get unread count

**Real-time Updates**
- `user:online` - User came online
- `user:offline` - User went offline
- `post:update` - New post in feed
- `group:join` / `group:leave` - Join/leave group room
- `course:join` / `course:leave` - Join/leave course room

## Development

### Running Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
```

### Formatting
```bash
npm run format
```

### Database Operations

**Create a migration:**
```bash
cd server
npx prisma migrate dev --name migration_name
```

**Open Prisma Studio:**
```bash
cd server
npm run prisma:studio
```

**Reset database:**
```bash
cd server
npx prisma migrate reset
```

## Deployment

### Production Build

1. **Build all applications:**
```bash
npm run build
```

2. **Set production environment variables in `.env`:**
```env
NODE_ENV=production
DATABASE_URL=your-production-db-url
JWT_SECRET=your-secure-secret
```

3. **Run migrations:**
```bash
cd server
npx prisma migrate deploy
```

4. **Start in production mode:**
```bash
npm run start
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or contributions, please open an issue in the GitHub repository.

---

**Built with ❤️ for Maestro University Students**
