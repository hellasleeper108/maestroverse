# Contributing to Maestroverse

Thank you for your interest in contributing to Maestroverse! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Security Guidelines](#security-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting/derogatory comments, and personal attacks
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** installed
- **Docker & Docker Compose** installed
- **Git** installed
- Basic understanding of:
  - JavaScript/TypeScript
  - React & Next.js
  - Node.js & Express
  - PostgreSQL & Prisma
  - Docker

### Finding Issues to Work On

1. Check the [Issues](https://github.com/yourusername/maestroverse/issues) page
2. Look for issues labeled `good first issue` or `help wanted`
3. Comment on the issue to express interest and get assigned
4. If you find a bug or have a feature idea, create an issue first before working on it

## 🛠️ Development Setup

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/maestroverse.git
cd maestroverse

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/maestroverse.git
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

**Required Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://maestro:maestro123@postgres:5432/maestro?schema=public

# Redis
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OAuth (Optional - for Google/GitHub login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Frontend/Backend URLs
FRONTEND_URL=http://localhost:3005
API_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3005

# Admin (Optional)
ROOT_ADMIN_EMAILS=admin@maestro.edu
```

### 3. Start Development Environment (Docker - Recommended)

```bash
# Start all services (PostgreSQL, Redis, API server, web frontend)
npm run dev

# View logs
npm run docker:logs

# Stop services
npm run docker:stop
```

**Services will be available at:**
- **Web Frontend**: http://localhost:3005
- **API Server**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 4. Database Setup

```bash
# Apply database migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio
```

**Demo Credentials:**
- Admin: `admin@maestro.edu` / `password123`
- Moderator: `moderator@maestro.edu` / `password123`
- Faculty: `faculty@maestro.edu` / `password123`
- Student: `alice@maestro.edu` / `password123`

### 5. Alternative: Local Development (Without Docker)

```bash
# Start PostgreSQL and Redis locally (must be installed)
# Update .env with local connection strings

# Start API server
npm run dev --workspace=server

# In another terminal, start web frontend
npm run dev --workspace=apps/web
```

## 📝 Coding Standards

### Code Style

We use **ESLint** and **Prettier** for code formatting and linting.

**Before committing, always run:**

```bash
# Lint all code
npm run lint

# Format all code with Prettier
npm run format
```

### JavaScript/TypeScript Style Guidelines

#### 1. Use Modern JavaScript (ES6+)

```javascript
// ✅ Good: Use const/let
const user = await prisma.user.findUnique({ where: { id } });
let count = 0;

// ❌ Bad: Use var
var user = await prisma.user.findUnique({ where: { id } });
```

#### 2. Use Arrow Functions

```javascript
// ✅ Good: Arrow functions for callbacks
users.map(user => user.id);
router.get('/api/users', authenticate, async (req, res) => { ... });

// ❌ Bad: Traditional function expressions
users.map(function(user) { return user.id; });
```

#### 3. Destructuring

```javascript
// ✅ Good: Destructure objects
const { email, username, password } = req.body;

// ❌ Bad: Repeated object access
const email = req.body.email;
const username = req.body.username;
const password = req.body.password;
```

#### 4. Async/Await Over Promises

```javascript
// ✅ Good: Async/await
const user = await prisma.user.findUnique({ where: { id } });

// ❌ Bad: Promise chains
prisma.user.findUnique({ where: { id } }).then(user => { ... });
```

#### 5. Error Handling

```javascript
// ✅ Good: Comprehensive error handling
try {
  const user = await prisma.user.create({ data });
  res.json({ user });
} catch (error) {
  console.error('Create user error:', error);
  res.status(500).json({ error: 'Failed to create user' });
}

// ❌ Bad: No error handling
const user = await prisma.user.create({ data });
res.json({ user });
```

#### 6. Input Validation

```javascript
// ✅ Good: Validate with Zod
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const data = loginSchema.parse(req.body);

// ❌ Bad: No validation
const { email, password } = req.body;
```

### React/Next.js Guidelines

#### 1. Functional Components with Hooks

```javascript
// ✅ Good: Functional component
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return <div>{user?.name}</div>;
}

// ❌ Bad: Class component
class UserProfile extends React.Component { ... }
```

#### 2. PropTypes Validation

```javascript
// ✅ Good: PropTypes defined
import PropTypes from 'prop-types';

function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>;
}

Button.propTypes = {
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
```

#### 3. Component File Structure

```javascript
// ✅ Good structure:
// 1. Imports
// 2. Component definition
// 3. PropTypes
// 4. Export

import { useState } from 'react';
import PropTypes from 'prop-types';

function MyComponent({ prop1, prop2 }) {
  const [state, setState] = useState(null);
  return <div>...</div>;
}

MyComponent.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
};

export default MyComponent;
```

### Backend API Guidelines

#### 1. Route Structure

```javascript
// ✅ Good: Clear, RESTful routes with middleware
router.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});
```

#### 2. Use Middleware for Cross-Cutting Concerns

```javascript
// ✅ Good: Authentication and authorization via middleware
router.post('/api/admin/users/:id/ban',
  authenticate,
  requirePermission(PERMISSIONS.USER_BAN),
  async (req, res) => {
    // Handler logic here
  }
);

// ❌ Bad: Authorization logic in every handler
router.post('/api/admin/users/:id/ban', async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  // Handler logic here
});
```

#### 3. Consistent Error Responses

```javascript
// ✅ Good: Consistent error format
res.status(400).json({ error: 'Invalid input' });
res.status(401).json({ error: 'Authentication required' });
res.status(403).json({ error: 'Insufficient permissions' });
res.status(404).json({ error: 'Resource not found' });
res.status(500).json({ error: 'Internal server error' });

// ❌ Bad: Inconsistent error format
res.status(400).send('Bad request');
res.json({ message: 'Error', code: 123 });
```

### Naming Conventions

```javascript
// Variables and functions: camelCase
const userId = '123';
function getUserById(id) { ... }

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const API_BASE_URL = 'http://localhost:3001';

// Components: PascalCase
function UserProfile() { ... }
const NavBar = () => { ... };

// Files: kebab-case for utilities, PascalCase for components
// ✅ Good:
// - utils/api-client.js
// - components/UserProfile.js
// - middleware/auth.js

// Database models: PascalCase (Prisma convention)
model User { ... }
model Post { ... }
```

## 📝 Commit Guidelines

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `security`: Security fixes or improvements

**Examples:**

```bash
# Feature
feat(auth): add OAuth2 Google authentication

Implement OAuth2 authentication flow using Passport.js for Google login.
Users can now sign in with their Google accounts.

Closes #123

# Bug fix
fix(upload): prevent path traversal in file uploads

Add filename sanitization to prevent directory traversal attacks.
All uploaded files now use secure random filenames.

Security: Path traversal vulnerability

# Documentation
docs(readme): update installation instructions

Add Docker setup steps and troubleshooting section.

# Refactoring
refactor(api): extract auth logic to middleware

Move authentication checks from route handlers to reusable middleware
functions for better code organization.
```

### Commit Best Practices

1. **Make atomic commits** - One logical change per commit
2. **Write clear, descriptive messages** - Explain WHY, not just WHAT
3. **Reference issues** - Use `Closes #123` or `Fixes #456`
4. **Keep commits focused** - Don't mix feature work with refactoring
5. **Test before committing** - Ensure all tests pass

```bash
# ✅ Good: Atomic commits
git commit -m "feat(auth): add JWT token generation"
git commit -m "feat(auth): add refresh token rotation"
git commit -m "docs(auth): add authentication guide"

# ❌ Bad: Large, unfocused commit
git commit -m "Add auth, fix bugs, update docs"
```

## 🔄 Pull Request Process

### Before Submitting

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Keep your branch up to date** with main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

3. **Run all checks**:
   ```bash
   npm run lint          # ESLint
   npm run format        # Prettier
   npm test              # All tests
   ./test-verification.sh # Verification suite
   ```

4. **Update documentation** if needed

5. **Test your changes thoroughly**

### Creating the Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub

3. **Fill out the PR template** completely

4. **Request review** from maintainers

### Pull Request Requirements

✅ **Required:**
- [ ] All tests pass
- [ ] Code follows style guidelines (ESLint + Prettier)
- [ ] Commit messages follow conventional format
- [ ] Documentation updated (if needed)
- [ ] No security vulnerabilities introduced
- [ ] Breaking changes documented

✅ **For Features:**
- [ ] New tests added
- [ ] User-facing changes documented

✅ **For Bug Fixes:**
- [ ] Root cause identified
- [ ] Test added to prevent regression

### Pull Request Review Process

1. **Automated checks** must pass (linting, tests)
2. **Code review** by at least one maintainer
3. **Security review** for sensitive changes
4. **Approval** from maintainer
5. **Merge** by maintainer

### After Your Pull Request is Merged

1. **Delete your feature branch**:
   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

2. **Update your local main**:
   ```bash
   git checkout main
   git pull upstream main
   ```

## 🔒 Security Guidelines

Security is a top priority. Please follow these guidelines:

### 1. Never Commit Secrets

```bash
# ❌ Never commit:
# - .env files with real credentials
# - API keys or tokens
# - Private keys
# - Database passwords

# ✅ Use .env.example with placeholder values
JWT_SECRET=your-secret-here-change-in-production
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 2. Input Validation

```javascript
// ✅ Always validate user input
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
});

const data = userSchema.parse(req.body);
```

### 3. SQL Injection Prevention

```javascript
// ✅ Good: Use Prisma (parameterized queries)
const user = await prisma.user.findUnique({
  where: { email: req.body.email },
});

// ❌ Bad: Raw SQL with string concatenation
const user = await prisma.$queryRaw(`
  SELECT * FROM users WHERE email = '${req.body.email}'
`);
```

### 4. XSS Prevention

```javascript
// ✅ Good: React automatically escapes values
<div>{user.bio}</div>

// ⚠️ Dangerous: Only use if absolutely necessary
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

### 5. CSRF Protection

```javascript
// ✅ Use HTTP-only cookies for session tokens
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
});
```

### 6. Authentication & Authorization

```javascript
// ✅ Always check authentication
router.get('/api/users/profile', authenticate, async (req, res) => {
  // req.user is guaranteed to exist
});

// ✅ Check authorization for sensitive operations
router.delete('/api/admin/users/:id',
  authenticate,
  requireAdmin,
  async (req, res) => {
    // Only admins can reach here
  }
);
```

### 7. Rate Limiting

```javascript
// ✅ Add rate limiting to prevent abuse
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
});

router.post('/api/auth/login', loginLimiter, loginHandler);
```

### 8. File Upload Security

```javascript
// ✅ Validate file types and sizes
import { imageUploadMiddleware } from '../middleware/fileUpload.js';

router.post('/upload',
  authenticate,
  imageUploadMiddleware, // Handles validation
  async (req, res) => {
    // File is already validated and securely stored
  }
);
```

### Reporting Security Vulnerabilities

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead:
1. Email security concerns to: security@maestroverse.edu
2. Provide detailed description and reproduction steps
3. Allow time for patching before public disclosure

## 🧪 Testing Requirements

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace=server

# Run with coverage
npm test -- --coverage

# Run verification suite
./test-verification.sh
```

### Writing Tests

#### Backend Tests (Node.js)

```javascript
// server/src/__tests__/auth.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Authentication', () => {
  it('should hash passwords correctly', async () => {
    const password = 'password123';
    const hashed = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare(password, hashed);
    assert.strictEqual(isValid, true);
  });

  it('should reject invalid passwords', async () => {
    const password = 'password123';
    const hashed = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare('wrongpassword', hashed);
    assert.strictEqual(isValid, false);
  });
});
```

#### Frontend Tests (Jest/React Testing Library)

```javascript
// apps/web/__tests__/LoginButton.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import LoginButton from '../components/LoginButton';

describe('LoginButton', () => {
  it('renders login button', () => {
    render(<LoginButton />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<LoginButton onClick={handleClick} />);
    fireEvent.click(screen.getByText('Login'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Test Coverage Requirements

- **Minimum coverage**: 60% overall
- **Critical paths**: 80% coverage required
  - Authentication/authorization logic
  - Payment processing
  - Data validation
  - Security-sensitive operations

### Integration Tests

```javascript
// Test API endpoints end-to-end
describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@maestro.edu',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe('alice@maestro.edu');
  });

  it('should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@maestro.edu',
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid credentials');
  });
});
```

## 📚 Documentation

### Code Comments

```javascript
// ✅ Good: Explain WHY, not WHAT
// Hash password before storing to prevent plaintext leakage
const hashedPassword = await bcrypt.hash(password, 12);

// Use refresh token rotation to prevent token replay attacks
await revokeRefreshToken(oldToken);
const newToken = await generateRefreshToken(userId);

// ❌ Bad: State the obvious
// Hash the password
const hashedPassword = await bcrypt.hash(password, 12);
```

### JSDoc Comments

```javascript
/**
 * Generate a secure signed URL for accessing a private file
 * @param {string} filename - Filename to access
 * @param {string} category - File category (photos, documents, resources)
 * @param {Object} options - Options
 * @param {number} options.expiresIn - Expiration time in seconds
 * @param {string} options.userId - User ID for access control (optional)
 * @returns {string} Signed URL token
 */
export function generateSignedUrl(filename, category, options = {}) {
  // Implementation
}
```

### Updating Documentation

When making changes, update relevant documentation:

- **README.md** - For major features or setup changes
- **CLAUDE.md** - For architecture or development workflow changes
- **API documentation** - For new endpoints or parameter changes
- **Security guides** - For security-related features
- **Migration guides** - For breaking changes

## 🎯 Best Practices Summary

### DO ✅

- Write clear, self-documenting code
- Use meaningful variable and function names
- Handle errors gracefully
- Validate all user input
- Write tests for new features
- Keep functions small and focused
- Use middleware for cross-cutting concerns
- Document complex logic
- Follow security guidelines
- Run linters before committing

### DON'T ❌

- Commit secrets or credentials
- Ignore linter warnings
- Skip error handling
- Trust user input
- Write large, monolithic functions
- Mix concerns in a single function
- Leave TODO comments in production code
- Commit commented-out code
- Push breaking changes without documentation
- Ignore security warnings

## 🆘 Getting Help

If you need help:

1. **Check documentation**:
   - [README.md](README.md)
   - [CLAUDE.md](CLAUDE.md)
   - [FILE_UPLOAD_SECURITY.md](FILE_UPLOAD_SECURITY.md)
   - [RBAC_GUIDE.md](RBAC_GUIDE.md)
   - [AUTH_MIGRATION_GUIDE.md](AUTH_MIGRATION_GUIDE.md)
   - [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md)

2. **Search existing issues** on GitHub

3. **Ask in discussions** (for questions)

4. **Create an issue** (for bugs or feature requests)

5. **Contact maintainers** (for urgent matters)

## 📞 Contact

- **Project Lead**: [Your Name]
- **Email**: dev@maestroverse.edu
- **Security**: security@maestroverse.edu
- **GitHub**: [Repository URL]

## 📄 License

By contributing to Maestroverse, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Maestroverse! 🎉
