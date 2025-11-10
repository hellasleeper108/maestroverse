# Security Integration Guide

This guide shows how to integrate the new security features into the Maestroverse application.

---

## Quick Start

### 1. Generate Secrets

```bash
# Generate required secrets
echo "MAESTROVERSE_PEPPER=\"$(openssl rand -base64 64)\"" >> .env
echo "SESSION_SECRET=\"$(openssl rand -base64 64)\"" >> .env
echo "CSRF_SECRET=\"$(openssl rand -base64 64)\"" >> .env
```

### 2. Install Dependencies

Dependencies are already added to `package.json`. Install them:

```bash
cd server
npm install
```

### 3. Run Database Migration

```bash
# Apply the security schema migration
npm run docker:exec server npx prisma migrate deploy

# Or if running locally
cd server && npx prisma migrate deploy
```

### 4. Integrate Security Middleware

Update `/server/src/index.js` to include the new security middleware:

```javascript
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import security middleware
import { sessionMiddleware, verifySessionFingerprint } from './utils/session.js';
import { applySecurityHeaders } from './middleware/securityHeaders.js';
import { csrfSetup, csrfProtect } from './utils/csrf.js';

// Import routes
import authSecureRoutes from './routes/authSecure.js';
import authRoutes from './routes/auth.js'; // Legacy

const app = express();

// ========== SECURITY MIDDLEWARE (ORDER MATTERS!) ==========

// 1. Security Headers (FIRST - before any other middleware)
app.use(applySecurityHeaders());

// 2. Cookie Parser (required for session and CSRF)
app.use(cookieParser());

// 3. CORS (with credentials support)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3005'],
    credentials: true,
  })
);

// 4. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Session Management
app.use(sessionMiddleware());
app.use(verifySessionFingerprint);

// 6. CSRF Protection Setup
app.use(csrfSetup);

// ========== ROUTES ==========

// Public routes (no CSRF protection needed for GET)
app.use('/api/auth', authRoutes); // Legacy JWT-based auth

// Protected routes with CSRF
app.use('/api/auth-secure', csrfProtect, authSecureRoutes);

// Other routes...
app.use('/api/hub', csrfProtect, hubRoutes);
app.use('/api/careerlink', csrfProtect, careerlinkRoutes);
app.use('/api/collabspace', csrfProtect, collabspaceRoutes);

// ========== START SERVER ==========

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 5. Test the Integration

```bash
# Start the server
npm run dev

# Test registration
curl -X POST http://localhost:3001/api/auth-secure/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "MySecurePassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Test login
curl -X POST http://localhost:3001/api/auth-secure/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "emailOrUsername": "test@example.com",
    "password": "MySecurePassword123!"
  }'

# Test authenticated endpoint
curl -X GET http://localhost:3001/api/auth-secure/me \
  -b cookies.txt
```

---

## Frontend Integration

### Update API Client

Update `/apps/web/lib/api.js` to support session-based auth:

```javascript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let csrfToken = null;

// Fetch CSRF token on app load
async function fetchCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/api/auth-secure/csrf-token`, {
    credentials: 'include', // Important: send cookies
  });
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

// Update fetchAPI to include CSRF token
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Include CSRF token for state-changing requests
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Important: send cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth methods
export const authSecure = {
  // Get CSRF token (call on app init)
  async getCsrfToken() {
    return fetchCsrfToken();
  },

  // Register
  async register(data) {
    return fetchAPI('/api/auth-secure/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Login
  async login(credentials) {
    const result = await fetchAPI('/api/auth-secure/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    // Update CSRF token from login response
    if (result.csrfToken) {
      csrfToken = result.csrfToken;
    }
    return result;
  },

  // Logout
  async logout() {
    return fetchAPI('/api/auth-secure/logout', {
      method: 'POST',
    });
  },

  // Get current user
  async getMe() {
    return fetchAPI('/api/auth-secure/me');
  },

  // Verify email
  async verifyEmail(token) {
    return fetchAPI('/api/auth-secure/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  // Request password reset
  async requestPasswordReset(email) {
    return fetchAPI('/api/auth-secure/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Reset password
  async resetPassword(token, newPassword) {
    return fetchAPI('/api/auth-secure/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
};
```

### Update Login Component

Update your login page to use the new secure auth:

```javascript
// /apps/web/pages/login.js
import { useState, useEffect } from 'react';
import { authSecure } from '../lib/api';
import { useRouter } from 'next/router';

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Fetch CSRF token on mount
  useEffect(() => {
    authSecure.getCsrfToken().catch(console.error);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authSecure.login({
        emailOrUsername,
        password,
        rememberMe,
      });

      console.log('Login successful:', result.user);

      // Redirect to dashboard
      router.push('/hub');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Email or Username"
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me (30 days)
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

---

## Migration from JWT to Sessions

### Gradual Migration Strategy

1. **Phase 1: Parallel Operation** (Current)
   - Old JWT endpoints: `/api/auth/*`
   - New session endpoints: `/api/auth-secure/*`
   - Both systems operational

2. **Phase 2: Frontend Migration**
   - Update frontend to use `/api/auth-secure/*`
   - Test thoroughly in staging
   - Monitor error rates

3. **Phase 3: Deprecation**
   - Mark `/api/auth/*` as deprecated
   - Add warning logs
   - Set sunset date

4. **Phase 4: Removal**
   - Remove old JWT endpoints
   - Clean up JWT middleware
   - Update documentation

### User Migration

**Option A: Force re-login (Recommended)**

- Users must log in again with new system
- Cleanest approach
- Best security posture

**Option B: Gradual migration**

- Keep JWT auth for existing users
- New registrations use sessions
- Migrate on next login

---

## Production Deployment

### Docker Secrets Setup

```bash
# Create secrets
echo -n "$(openssl rand -base64 64)" | docker secret create maestroverse_pepper -
echo -n "$(openssl rand -base64 64)" | docker secret create session_secret -
echo -n "$(openssl rand -base64 64)" | docker secret create csrf_secret -
echo -n "YOUR_SMTP_PASSWORD" | docker secret create smtp_password -
```

### Update docker-compose.yml

```yaml
services:
  server:
    secrets:
      - maestroverse_pepper
      - session_secret
      - csrf_secret
      - smtp_password
    environment:
      NODE_ENV: production
      MAESTROVERSE_PEPPER_FILE: /run/secrets/maestroverse_pepper
      SESSION_SECRET_FILE: /run/secrets/session_secret
      CSRF_SECRET_FILE: /run/secrets/csrf_secret
      SMTP_PASS_FILE: /run/secrets/smtp_password

secrets:
  maestroverse_pepper:
    external: true
  session_secret:
    external: true
  csrf_secret:
    external: true
  smtp_password:
    external: true
```

### Update Secret Loading

Modify `/server/src/utils/password.js` to read from Docker Secrets:

```javascript
import fs from 'fs';

function getPepper() {
  // Try Docker Secret first
  const secretFile = process.env.MAESTROVERSE_PEPPER_FILE;
  if (secretFile && fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }

  // Fallback to environment variable
  const pepper = process.env.MAESTROVERSE_PEPPER;
  if (!pepper) {
    console.error('CRITICAL: MAESTROVERSE_PEPPER is not set!');
    throw new Error('Server misconfiguration: Password pepper not available');
  }

  return pepper;
}
```

---

## Monitoring & Maintenance

### Scheduled Tasks (Cron Jobs)

Add to server startup:

```javascript
import { cleanupExpiredRateLimits } from './middleware/rateLimiter.js';
import { cleanupExpiredSessions } from './utils/session.js';

// Run cleanup every hour
setInterval(
  async () => {
    await cleanupExpiredRateLimits();
    await cleanupExpiredSessions();
  },
  60 * 60 * 1000
);
```

### Health Checks

Add health check endpoint:

```javascript
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check session store
    const sessionCount = await prisma.session.count();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      sessions: sessionCount,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

### Audit Log Monitoring

Query audit logs for security events:

```javascript
// Failed login attempts in last hour
const failedLogins = await prisma.auditLog.findMany({
  where: {
    action: 'LOGIN_FAILED',
    createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
  },
  select: {
    userId: true,
    ipAddress: true,
    createdAt: true,
    metadata: true,
  },
});

// Detect brute force patterns
const ipCounts = {};
failedLogins.forEach((log) => {
  ipCounts[log.ipAddress] = (ipCounts[log.ipAddress] || 0) + 1;
});

// Alert on IPs with >10 failed attempts
Object.entries(ipCounts).forEach(([ip, count]) => {
  if (count > 10) {
    console.warn(`[SECURITY] Potential brute force from ${ip}: ${count} failed attempts`);
    // TODO: Send alert, consider blocking IP
  }
});
```

---

## Troubleshooting

### Common Issues

#### 1. "MAESTROVERSE_PEPPER is not set"

**Solution:**

```bash
# Generate and add to .env
echo "MAESTROVERSE_PEPPER=\"$(openssl rand -base64 64)\"" >> .env
```

#### 2. CSRF Token Mismatch

**Cause:** Client not sending CSRF token or cookies

**Solution:**

```javascript
// Ensure credentials: 'include' in fetch
fetch('/api/auth-secure/login', {
  credentials: 'include',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
});
```

#### 3. Session Not Persisting

**Cause:** Cookie domain mismatch or missing `credentials: 'include'`

**Solution:**

- Check `COOKIE_DOMAIN` in .env
- Ensure frontend uses `credentials: 'include'`
- Verify cookies in browser DevTools

#### 4. Rate Limit Not Resetting

**Cause:** Cleanup cron not running

**Solution:**

```javascript
// Manually run cleanup
await cleanupExpiredRateLimits();
```

#### 5. Email Not Sending

**Cause:** SMTP not configured

**Solution:**

- Check SMTP credentials in .env
- In development, check console for Ethereal preview URL
- In production, verify SMTP server connectivity

---

## Testing

### Unit Tests

```javascript
// Test password hashing
import { hashPassword, verifyPassword } from './utils/password.js';

test('password hashing works', async () => {
  const password = 'MySecurePassword123!';
  const hash = await hashPassword(password);

  expect(await verifyPassword(password, hash)).toBe(true);
  expect(await verifyPassword('wrong', hash)).toBe(false);
});

// Test rate limiting
import { rateLimiter } from './middleware/rateLimiter.js';

test('rate limiting blocks after max attempts', async () => {
  // Make 6 requests (limit is 5)
  for (let i = 0; i < 6; i++) {
    const res = await request(app)
      .post('/api/auth-secure/login')
      .send({ emailOrUsername: 'test', password: 'wrong' });

    if (i < 5) {
      expect(res.status).toBe(401); // Unauthorized
    } else {
      expect(res.status).toBe(429); // Too Many Requests
    }
  }
});
```

### Integration Tests

```javascript
// Test full registration flow
test('registration flow', async () => {
  // 1. Register
  const registerRes = await request(app).post('/api/auth-secure/register').send({
    email: 'newuser@example.com',
    username: 'newuser',
    password: 'SecurePassword123!',
    firstName: 'New',
    lastName: 'User',
  });

  expect(registerRes.status).toBe(201);
  expect(registerRes.body.user.isVerified).toBe(false);

  // 2. Get verification token from database
  const token = await prisma.verificationToken.findFirst({
    where: { userId: registerRes.body.user.id },
  });

  // 3. Verify email
  const verifyRes = await request(app)
    .post('/api/auth-secure/verify-email')
    .send({ token: token.token });

  expect(verifyRes.status).toBe(200);

  // 4. Login
  const loginRes = await request(app).post('/api/auth-secure/login').send({
    emailOrUsername: 'newuser@example.com',
    password: 'SecurePassword123!',
  });

  expect(loginRes.status).toBe(200);
  expect(loginRes.body.user.isVerified).toBe(true);
});
```

---

## Security Checklist

Before going to production:

- [ ] All secrets generated with `openssl rand -base64 64`
- [ ] Secrets stored in Docker Secrets (not .env in production)
- [ ] `NODE_ENV=production`
- [ ] HTTPS enabled (secure cookies)
- [ ] SMTP configured and tested
- [ ] Database backups configured
- [ ] Rate limit cleanup cron running
- [ ] Session cleanup cron running
- [ ] Audit log monitoring configured
- [ ] Security headers verified (securityheaders.com)
- [ ] SSL/TLS verified (ssllabs.com)
- [ ] CSRF protection tested
- [ ] Password strength validation tested
- [ ] Email verification flow tested
- [ ] Password reset flow tested
- [ ] Rate limiting tested
- [ ] Session expiration tested

---

For more details, see [SECURITY_OVERVIEW.md](./SECURITY_OVERVIEW.md).
