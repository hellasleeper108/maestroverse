# Maestroverse Security Overview

**Last Updated:** 2025-11-03
**Status:** Production-Ready Authentication System Implemented

This document provides a comprehensive overview of the security architecture, implementation details, and operational procedures for the Maestroverse platform.

---

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication System](#authentication-system)
3. [Password Security](#password-security)
4. [Session Management](#session-management)
5. [Rate Limiting & Abuse Prevention](#rate-limiting--abuse-prevention)
6. [CSRF Protection](#csrf-protection)
7. [Security Headers](#security-headers)
8. [Audit Logging](#audit-logging)
9. [Email Verification & Password Reset](#email-verification--password-reset)
10. [Environment Variables & Secrets](#environment-variables--secrets)
11. [Database Security](#database-security)
12. [Deployment Checklist](#deployment-checklist)
13. [Incident Response](#incident-response)

---

## Security Architecture

### Defense in Depth Strategy

Maestroverse implements multiple layers of security controls:

```
┌─────────────────────────────────────────┐
│  1. Transport Layer (HTTPS/TLS)         │
├─────────────────────────────────────────┤
│  2. Security Headers (CSP, HSTS, etc.)  │
├─────────────────────────────────────────┤
│  3. Rate Limiting (IP + User)           │
├─────────────────────────────────────────┤
│  4. CSRF Protection (Double Submit)     │
├─────────────────────────────────────────┤
│  5. Session Authentication (HttpOnly)   │
├─────────────────────────────────────────┤
│  6. Authorization (Role-Based)          │
├─────────────────────────────────────────┤
│  7. Input Validation & Sanitization     │
├─────────────────────────────────────────┤
│  8. Audit Logging (All Actions)         │
└─────────────────────────────────────────┘
```

### Security Principles

1. **Least Privilege**: Users and services have minimal necessary permissions
2. **Fail Securely**: Errors default to deny access, not grant it
3. **Defense in Depth**: Multiple overlapping security controls
4. **Audit Everything**: Comprehensive logging of security-relevant events
5. **Zero Trust**: Verify every request, never assume trust

---

## Authentication System

### Overview

Maestroverse uses **session-based authentication** with HttpOnly cookies (replacing the previous JWT token approach for enhanced security).

**Files:**

- `/server/src/routes/authSecure.js` - New secure authentication endpoints
- `/server/src/utils/session.js` - Session management utilities
- `/server/src/utils/password.js` - Password hashing and validation

### Authentication Flow

#### Registration Flow

```
1. Client submits registration form
   ↓
2. Server validates input (email format, username format, password strength)
   ↓
3. Check for existing email/username (prevent duplicates)
   ↓
4. Hash password with Argon2id + HMAC pepper
   ↓
5. Create user record (isVerified: false)
   ↓
6. Generate email verification token (32-byte secure random)
   ↓
7. Send verification email (24-hour expiry)
   ↓
8. Return success (no auto-login - must verify email)
   ↓
9. Log audit event (REGISTER)
```

#### Login Flow

```
1. Client submits credentials (email/username + password)
   ↓
2. Rate limiting check (5 attempts / 5 min)
   ↓
3. Find user by email or username
   ↓
4. Verify password with Argon2id
   ↓
5. Check account status (BANNED/SUSPENDED/ACTIVE)
   ↓
6. Regenerate session ID (prevent session fixation)
   ↓
7. Set session data (userId, fingerprint)
   ↓
8. Create session record in database
   ↓
9. Update user.lastActive timestamp
   ↓
10. Return user info + CSRF token
    ↓
11. Log audit event (LOGIN_SUCCESS)
    ↓
12. Clear rate limit counter (successful login)
```

#### Logout Flow

```
1. Client sends logout request
   ↓
2. Verify session exists
   ↓
3. Delete session from database
   ↓
4. Destroy session cookie
   ↓
5. Log audit event (LOGOUT)
   ↓
6. Return success
```

### API Endpoints

#### New Secure Endpoints (`/api/auth-secure/*`)

| Method | Endpoint                  | Description                | Rate Limit |
| ------ | ------------------------- | -------------------------- | ---------- |
| POST   | `/register`               | Register new user          | 3 / 15min  |
| POST   | `/login`                  | Login with credentials     | 5 / 5min   |
| POST   | `/logout`                 | Logout and destroy session | None       |
| GET    | `/me`                     | Get current user info      | None       |
| GET    | `/csrf-token`             | Get CSRF token             | None       |
| POST   | `/verify-email`           | Verify email with token    | 5 / 10min  |
| POST   | `/resend-verification`    | Resend verification email  | 5 / 10min  |
| POST   | `/request-password-reset` | Request password reset     | 3 / 15min  |
| POST   | `/reset-password`         | Reset password with token  | None       |

#### Legacy Endpoints (`/api/auth/*`)

The old JWT-based endpoints remain available for backward compatibility but should be migrated to the new secure endpoints.

---

## Password Security

### Implementation: Argon2id + HMAC Pepper

**File:** `/server/src/utils/password.js`

#### Algorithm: Argon2id

Argon2id is the recommended password hashing algorithm (winner of the Password Hashing Competition 2015).

**Why Argon2id?**

- ✅ **Memory-hard**: Resistant to GPU/ASIC attacks
- ✅ **CPU-hard**: Computationally expensive
- ✅ **Side-channel resistant**: Protected against timing attacks
- ✅ **Configurable**: Can increase difficulty as hardware improves

**Parameters (2025 OWASP Baseline):**

```javascript
{
  type: argon2id,
  memoryCost: 65536,   // 64 MB RAM
  timeCost: 3,         // 3 iterations
  parallelism: 4       // 4 threads
}
```

#### HMAC-SHA256 Pepper Layer

**What is a pepper?**
A pepper is a secret key stored separately from the database. Even if the database is compromised, attackers cannot crack passwords without the pepper.

**Implementation:**

1. Password is peppered using HMAC-SHA256 with `MAESTROVERSE_PEPPER` secret
2. Peppered password is then hashed with Argon2id
3. Pepper is stored in environment variable (Docker Secrets in production)

**Storage:**

```
Password Flow:
  User Password (plaintext)
       ↓
  HMAC-SHA256(password, MAESTROVERSE_PEPPER)
       ↓
  Argon2id(peppered_password, random_salt)
       ↓
  Final Hash (stored in database)
```

### Password Validation Rules

**Requirements:**

- Length: 12-256 characters (byte length)
- Strength: zxcvbn score ≥ 3/4 (strong)
- No null bytes (`\0`)
- Must not be common password (zxcvbn checks against dictionaries)

**Feedback:**
The `validatePassword()` function returns detailed feedback:

- `valid`: Boolean
- `errors`: Array of error messages
- `score`: 0-4 strength score
- `feedback`: Suggestions for improvement

**Example:**

```javascript
const result = validatePassword('password123');
// {
//   valid: false,
//   errors: ['Password is too weak. This is a top-10 common password'],
//   score: 0
// }
```

### Password Rehashing

The system supports **automatic password rehashing** on login:

1. Check if hash uses old algorithm (bcrypt: starts with `$2`)
2. If old algorithm detected, verify password
3. On successful verification, rehash with Argon2id
4. Update database with new hash

**Function:** `needsRehash(hash)` in `/server/src/utils/password.js`

---

## Session Management

### Implementation: PostgreSQL-Backed Sessions

**File:** `/server/src/utils/session.js`

### Session Storage

Sessions are stored in **two locations**:

1. **connect-pg-simple table**: `session` (automatic)
   - Used by express-session for fast lookups
   - Stores serialized session data
   - Auto-cleanup every 15 minutes

2. **Prisma Session model**: Custom tracking
   - Tracks userId, expiresAt, fingerprint
   - Enables user session management features
   - Allows revoking specific sessions

### Session Cookie Configuration

```javascript
{
  name: 'mv_sid',              // Cookie name
  httpOnly: true,              // No JavaScript access (XSS protection)
  secure: true,                // HTTPS only (production)
  sameSite: 'lax',            // CSRF protection
  maxAge: 7 days,              // Default expiration
  path: '/',                   // Available site-wide
  domain: undefined            // Current domain only
}
```

### Session Security Features

#### 1. Session Regeneration

- **When**: On login, privilege escalation
- **Why**: Prevents session fixation attacks
- **How**: `regenerateSession(req)` creates new session ID, preserves data

#### 2. Session Fingerprinting

- **What**: SHA256 hash of (User-Agent + IP)
- **When**: Set on first session creation, verified on each request
- **Why**: Detects session hijacking
- **Action**: If fingerprint mismatch → destroy session, require re-login

#### 3. Rolling Expiration

- **What**: Session expiration extends on each request
- **Why**: Active users stay logged in, inactive sessions expire
- **Config**: `rolling: true` in session config

#### 4. Session Revocation

```javascript
// Revoke single session
await revokeSession(sessionId, userId);

// Revoke all sessions except current (e.g., password change)
await revokeAllUserSessions(userId, exceptSessionId);

// Get all active sessions
const sessions = await getUserSessions(userId);
```

### Middleware

#### `requireAuth`

Requires valid session, returns 401 if not authenticated.

```javascript
router.post('/protected-route', requireAuth, async (req, res) => {
  // req.session.userId is guaranteed to exist
});
```

#### `attachUser`

Loads user from session, attaches to `req.user`. Does NOT block if unauthenticated.

```javascript
router.get('/optional-auth', attachUser, async (req, res) => {
  if (req.user) {
    // Authenticated user
  } else {
    // Anonymous user
  }
});
```

#### `requireRole(...roles)`

Requires specific role(s).

```javascript
router.delete('/admin/users/:id', requireRole('ADMIN'), async (req, res) => {
  // Only ADMIN can access
});
```

#### `verifySessionFingerprint`

Checks session fingerprint, destroys session if mismatch.

```javascript
app.use(sessionMiddleware());
app.use(verifySessionFingerprint);
```

---

## Rate Limiting & Abuse Prevention

### Implementation: Database-Backed with Exponential Backoff

**File:** `/server/src/middleware/rateLimiter.js`

### Rate Limit Configurations

| Action             | Max Attempts | Window | Backoff     |
| ------------------ | ------------ | ------ | ----------- |
| Login              | 5            | 5 min  | Exponential |
| Registration       | 3            | 15 min | Exponential |
| Password Reset     | 3            | 15 min | Exponential |
| Email Verification | 5            | 10 min | None        |
| API (general)      | 100          | 1 min  | None        |

### Tracking Strategy

Rate limits are tracked by:

- **IP Address**: For unauthenticated requests
- **User ID**: For authenticated requests (optional)

**Database Model:** `RateLimitRecord`

```prisma
model RateLimitRecord {
  id         String   @unique([identifier, action])
  identifier String   // "ip:192.168.1.1" or "user:cuid123"
  action     String   // "login", "register", etc.
  attempts   Int
  resetAt    DateTime
}
```

### Exponential Backoff

On **repeated violations**, cooldown period doubles:

```
Violation 1: 5 minutes
Violation 2: 10 minutes
Violation 3: 20 minutes
Violation 4: 40 minutes
Violation 5: 80 minutes
Max: 120 minutes (2 hours)
```

**Example:**

1. User fails login 5 times → Blocked for 5 minutes
2. After 5 min, user tries again and fails → Blocked for 10 minutes
3. Pattern continues with doubling backoff

### Rate Limit Headers

All rate-limited responses include:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 2025-11-03T10:45:00.000Z
Retry-After: 180
```

### Success-Based Clearing

On **successful** authentication, the rate limit counter is **cleared**:

```javascript
// After successful login
await clearRateLimit(identifier, 'login');
```

This prevents legitimate users from being locked out after typos.

### Cleanup

Expired rate limit records are cleaned up via cron job:

```javascript
// Run every hour
await cleanupExpiredRateLimits();
```

---

## CSRF Protection

### Implementation: Double Submit Cookie Pattern

**File:** `/server/src/utils/csrf.js`

### How It Works

1. Server generates random CSRF token
2. Token is stored in two places:
   - **HttpOnly cookie**: `__Host-mv.csrf`
   - **Response body**: `csrfToken` field
3. Client includes token in custom header: `X-CSRF-Token`
4. Server validates token from header matches cookie

### Cookie Configuration

```javascript
{
  cookieName: '__Host-mv.csrf',
  sameSite: 'lax',
  httpOnly: true,
  secure: true,           // Production only
  path: '/',
  size: 64                // 64-byte token
}
```

**Note:** `__Host-` prefix enforces:

- `secure: true`
- `path: '/'`
- No `domain` attribute

### Protected Methods

CSRF protection applies to:

- POST
- PUT
- PATCH
- DELETE

**Exempt methods:**

- GET
- HEAD
- OPTIONS

### Client Usage

```javascript
// 1. Get CSRF token on app load
const { csrfToken } = await fetch('/api/auth-secure/csrf-token').then((r) => r.json());

// 2. Include in state-changing requests
await fetch('/api/auth-secure/logout', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Important: send cookies
});
```

### Integration

```javascript
import { csrfSetup, csrfProtect } from './utils/csrf.js';

// Setup (generates token, attaches to res.locals)
app.use(csrfSetup);

// Protect specific routes
app.use('/api', csrfProtect);
```

---

## Security Headers

### Implementation: Helmet + Custom Headers

**File:** `/server/src/middleware/securityHeaders.js`

### Applied Headers

| Header                         | Value                                          | Purpose                  |
| ------------------------------ | ---------------------------------------------- | ------------------------ |
| `Strict-Transport-Security`    | `max-age=31536000; includeSubDomains; preload` | Force HTTPS              |
| `Content-Security-Policy`      | See CSP section                                | Prevent XSS              |
| `X-Content-Type-Options`       | `nosniff`                                      | Prevent MIME sniffing    |
| `X-Frame-Options`              | `DENY`                                         | Prevent clickjacking     |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`              | Control referrer         |
| `Permissions-Policy`           | Restrictive                                    | Block unnecessary APIs   |
| `X-XSS-Protection`             | `1; mode=block`                                | Legacy XSS protection    |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                  | Isolate browsing context |
| `Cross-Origin-Resource-Policy` | `same-origin`                                  | Prevent resource leaks   |

### Content Security Policy (CSP)

```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Next.js requirements
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  connectSrc: ["'self'", "ws://localhost:3001", "wss://localhost:3001"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: [], // Production only
}
```

**Development Mode:** CSP runs in `report-only` mode to avoid breaking hot reload.

### Permissions-Policy

Blocks unnecessary browser features:

```
camera=(), microphone=(), geolocation=(self), payment=(),
usb=(), magnetometer=(), gyroscope=(), accelerometer=()
```

### Integration

```javascript
import { applySecurityHeaders } from './middleware/securityHeaders.js';

// Apply all security headers
app.use(applySecurityHeaders());
```

---

## Audit Logging

### Implementation: Database-Backed Event Logging

**File:** `/server/src/utils/audit.js`

### Logged Events

All security-relevant actions are logged:

```javascript
AUDIT_ACTIONS = {
  // Authentication
  LOGIN_SUCCESS,
  LOGIN_FAILED,
  LOGOUT,
  REGISTER,

  // Password
  PASSWORD_CHANGE,
  PASSWORD_RESET_REQUEST,
  PASSWORD_RESET_COMPLETE,

  // Verification
  EMAIL_VERIFICATION_SENT,
  EMAIL_VERIFIED,

  // MFA
  MFA_ENABLED,
  MFA_DISABLED,
  MFA_CHALLENGE_SUCCESS,
  MFA_CHALLENGE_FAILED,

  // Security
  ACCOUNT_LOCKED,
  ACCOUNT_SUSPENDED,
  ACCOUNT_BANNED,
  SUSPICIOUS_ACTIVITY,

  // Sessions
  SESSION_CREATED,
  SESSION_DESTROYED,
  SESSION_EXPIRED,
};
```

### Log Structure

```prisma
model AuditLog {
  id           String
  userId       String?     // Null for unauthenticated actions
  action       String
  ipAddress    String?
  userAgent    String?
  metadata     String?     // JSON, sanitized
  success      Boolean
  errorMessage String?
  createdAt    DateTime
}
```

### Metadata Sanitization

Sensitive fields are **automatically removed** from metadata:

```javascript
delete metadata.password;
delete metadata.token;
delete metadata.secret;
delete metadata.oldPassword;
delete metadata.newPassword;
```

### Usage

```javascript
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';

await logAudit({
  action: AUDIT_ACTIONS.LOGIN_FAILED,
  userId: user?.id,
  req,
  success: false,
  errorMessage: 'Invalid credentials',
  metadata: { emailOrUsername: 'user@example.com' },
});
```

### Querying Logs

```javascript
// Get all failed logins in last 24 hours
const failedLogins = await prisma.auditLog.findMany({
  where: {
    action: 'LOGIN_FAILED',
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
  orderBy: { createdAt: 'desc' },
});

// Get user activity
const userActivity = await prisma.auditLog.findMany({
  where: { userId: 'user123' },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

---

## Email Verification & Password Reset

### Email Verification Flow

**File:** `/server/src/utils/email.js`

#### On Registration

1. User registers → `isVerified: false`
2. Generate 32-byte secure random token
3. Store in `VerificationToken` table (expires in 24 hours)
4. Send verification email with link
5. User clicks link → `POST /api/auth-secure/verify-email`
6. Token validated → `user.isVerified = true`
7. Token marked as used

#### Resending Verification

- Authenticated users can request resend
- Old unused tokens are deleted
- New 24-hour token generated
- Rate limited: 5 attempts / 10 minutes

### Password Reset Flow

#### Request Reset

1. User submits email
2. Always return success (prevent user enumeration)
3. If user exists:
   - Generate 32-byte secure reset token
   - Store in `PasswordResetToken` (expires in 1 hour)
   - Send reset email with link
4. Rate limited: 3 attempts / 15 minutes

#### Reset Password

1. User clicks reset link with token
2. Validates token (not expired, not used)
3. User enters new password
4. Validate password strength
5. Hash with Argon2id + pepper
6. Update user password
7. Mark token as used
8. **Revoke all sessions** (force re-login)

### Email Templates

Professional HTML templates with:

- Responsive design (mobile-friendly)
- Branded styling (Maestroverse colors)
- Security warnings
- Plain text fallback

**Templates:**

- Verification email (`sendVerificationEmail`)
- Password reset email (`sendPasswordResetEmail`)
- Security alert email (`sendSecurityAlert`)

### Email Transport Configuration

Supports multiple transports based on environment:

```javascript
// Production: SMTP
{
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
}

// Development: Ethereal (test SMTP)
// Test: Mock (console.log)
```

---

## Environment Variables & Secrets

### Required Environment Variables

**File:** `.env` (never commit to Git)

#### Critical Secrets

```bash
# Password Pepper (CRITICAL - must be 32+ bytes)
MAESTROVERSE_PEPPER="generate-with-openssl-rand-base64-64"

# Session Secret (used for session cookie signing)
SESSION_SECRET="generate-with-openssl-rand-base64-64"

# CSRF Secret (fallback if not set, uses SESSION_SECRET)
CSRF_SECRET="generate-with-openssl-rand-base64-64"

# JWT Secret (legacy, for backward compat)
JWT_SECRET="generate-with-openssl-rand-base64-64"
```

#### Database

```bash
DATABASE_URL="postgresql://maestro:maestro123@postgres:5432/maestroverse"
POSTGRES_HOST="postgres"
POSTGRES_PORT="5432"
POSTGRES_DB="maestroverse"
POSTGRES_USER="maestro"
POSTGRES_PASSWORD="maestro123"
```

#### Email (SMTP)

```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASS="SG.xxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM='"Maestroverse" <noreply@maestroverse.edu>'
```

#### Frontend

```bash
FRONTEND_URL="https://maestroverse.edu"
API_URL="https://api.maestroverse.edu"
ALLOWED_ORIGINS="https://maestroverse.edu,https://www.maestroverse.edu"
COOKIE_DOMAIN=".maestroverse.edu"
```

#### Admin

```bash
ROOT_ADMIN_EMAILS="admin@maestroverse.edu,superadmin@maestroverse.edu"
```

### Docker Secrets (Production)

For production deployment, store secrets in Docker Secrets or Kubernetes Secrets:

**Docker Compose Example:**

```yaml
services:
  server:
    secrets:
      - maestroverse_pepper
      - session_secret
      - db_password

secrets:
  maestroverse_pepper:
    external: true
  session_secret:
    external: true
  db_password:
    external: true
```

**Create Secrets:**

```bash
# Generate secure random strings
openssl rand -base64 64 | docker secret create maestroverse_pepper -
openssl rand -base64 64 | docker secret create session_secret -
openssl rand -base64 64 | docker secret create csrf_secret -
```

**Read Secrets in App:**

```javascript
import fs from 'fs';

function getPepper() {
  // Try Docker Secret first
  if (fs.existsSync('/run/secrets/maestroverse_pepper')) {
    return fs.readFileSync('/run/secrets/maestroverse_pepper', 'utf8').trim();
  }

  // Fallback to environment variable
  return process.env.MAESTROVERSE_PEPPER;
}
```

---

## Database Security

### Connection Security

- Use SSL/TLS for database connections in production
- Restrict database access by IP (firewall rules)
- Use strong passwords (32+ characters)
- Rotate database credentials regularly

### Prisma Security

```javascript
// Enable query logging in development only
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

### SQL Injection Prevention

Prisma ORM provides automatic SQL injection protection through parameterized queries. **Never** use raw SQL unless absolutely necessary.

**Safe:**

```javascript
await prisma.user.findUnique({ where: { email } });
```

**Unsafe (avoid):**

```javascript
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`; // Still safe (parameterized)
await prisma.$executeRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`); // UNSAFE
```

### Data Encryption at Rest

For sensitive fields (MFA secrets, backup codes), encrypt before storing:

```javascript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: authTag.toString('hex'),
  });
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] **Secrets Generated**
  - [ ] MAESTROVERSE_PEPPER (64+ bytes)
  - [ ] SESSION_SECRET (64+ bytes)
  - [ ] CSRF_SECRET (64+ bytes)
  - [ ] Database password (32+ characters)

- [ ] **Environment Configuration**
  - [ ] `NODE_ENV=production`
  - [ ] HTTPS enabled (secure cookies)
  - [ ] SMTP configured (email delivery)
  - [ ] FRONTEND_URL set correctly
  - [ ] ALLOWED_ORIGINS configured

- [ ] **Database**
  - [ ] Migrations applied
  - [ ] Backups configured
  - [ ] Connection pooling configured
  - [ ] SSL/TLS enabled

- [ ] **Security Headers**
  - [ ] HSTS enabled (production only)
  - [ ] CSP configured for production domains
  - [ ] Permissions-Policy applied

- [ ] **Rate Limiting**
  - [ ] Cleanup cron job scheduled
  - [ ] Monitoring configured

### Post-Deployment Verification

- [ ] Test registration flow
- [ ] Test login flow (success + failure)
- [ ] Test email verification
- [ ] Test password reset
- [ ] Test rate limiting (attempt brute force)
- [ ] Test CSRF protection (omit token)
- [ ] Test session expiration
- [ ] Verify security headers (securityheaders.com)
- [ ] Verify SSL/TLS configuration (ssllabs.com)
- [ ] Check audit logs are being created

### Monitoring

- [ ] Set up alerts for:
  - [ ] Failed login spikes (> 100 / minute)
  - [ ] Rate limit violations (> 1000 / hour)
  - [ ] Database errors
  - [ ] Email delivery failures
  - [ ] CSRF token violations

- [ ] Review audit logs daily for:
  - [ ] Suspicious activity patterns
  - [ ] Account lockouts
  - [ ] Password reset abuse

---

## Operational Hardening

### Database Least Privilege

- Provision a dedicated application role (e.g., `maestro_app`) with only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on runtime schemas.
- Revoke `CREATE`, `ALTER`, and `DROP` permissions from the runtime role; run migrations with a separate admin credential.
- Enforce SSL connections and rotate database credentials at least quarterly.

### Secret Management & Rotation

- Store `MAESTROVERSE_PEPPER`, `JWT_SECRET`, `SESSION_SECRET`, and `CSRF_SECRET` in a managed secret store (AWS Secrets Manager, Vault, Doppler, etc.).
- Rotate secrets every 90 days or immediately after any suspected compromise.
- Use versioned secrets to enable zero-downtime rotation (deploy new secret, restart services, revoke prior version).

### Edge Rate Limiting

- Enable request throttling at the ingress layer (Nginx, ALB, Cloudflare) to block abusive traffic before reaching the app.
- Mirror or exceed application limits (e.g., 100 requests/minute per IP) and configure burst allowances for legitimate spikes.
- Emit rate-limit logs to your SIEM for correlation with application-level events.

### Backups & Disaster Recovery

- Schedule nightly logical backups (`pg_dump`) to off-site storage with at least 30-day retention.
- Add weekly full snapshots plus point-in-time recovery (PITR) if supported by your PostgreSQL provider.
- Perform quarterly restore drills and document the recovery procedure end-to-end.

### Observability & Alerting

- Uptime monitoring: configure HTTP and WebSocket checks from multiple regions (PagerDuty, Opsgenie, Pingdom).
- Error observability: ship application logs to a central aggregator (Datadog, ELK, Loki) with alerts on 5xx spikes.
- Infrastructure alerts: watch CPU, memory, and connection pool utilization with thresholds tuned to production load.
- Maintain an on-call runbook with escalation paths and remediation steps.

---

## Incident Response

### Security Incident Procedure

#### 1. Detection

- Monitor audit logs for suspicious patterns
- Watch for rate limit violations
- Alert on authentication failures

#### 2. Containment

```bash
# Immediately ban compromised accounts
await prisma.user.update({
  where: { id: userId },
  data: { status: 'BANNED' }
});

# Revoke all sessions
await revokeAllUserSessions(userId);

# Block IP address (add to firewall)
```

#### 3. Investigation

```javascript
// Review audit logs
const logs = await prisma.auditLog.findMany({
  where: {
    userId,
    createdAt: { gte: suspiciousDate },
  },
  orderBy: { createdAt: 'asc' },
});

// Check session history
const sessions = await prisma.session.findMany({
  where: { userId },
});
```

#### 4. Recovery

- Force password reset for affected users
- Notify users of security incident
- Rotate secrets if compromised
- Apply patches/fixes

#### 5. Post-Incident

- Document incident in security log
- Update security procedures
- Implement additional controls if needed

### Rotating Secrets

If `MAESTROVERSE_PEPPER` is compromised:

```bash
# 1. Generate new pepper
NEW_PEPPER=$(openssl rand -base64 64)

# 2. Set dual-pepper mode (verify with both old + new)
MAESTROVERSE_PEPPER="$OLD_PEPPER"
MAESTROVERSE_PEPPER_NEW="$NEW_PEPPER"

# 3. Force all users to reset passwords
# (passwords will be rehashed with new pepper)

# 4. After all users reset, switch to new pepper only
MAESTROVERSE_PEPPER="$NEW_PEPPER"
```

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Argon2 RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)
- [Session Management Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

**Document Maintained By:** Maestroverse Security Team
**Review Frequency:** Quarterly
**Next Review:** 2025-02-03
