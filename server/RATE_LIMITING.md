# Rate Limiting Documentation

## Overview

Maestroverse implements a comprehensive, layered rate limiting system designed to protect against brute-force attacks, account enumeration, and API abuse while maintaining a good user experience.

## Architecture

### Multi-Layer Protection

The rate limiting system employs **three layers of protection**:

1. **Per-IP Rate Limiting**: Tracks attempts by client IP address
2. **Per-Identifier Rate Limiting**: Tracks attempts by email/username
3. **Account Lockout**: Temporary account suspension after excessive failures

For login endpoints, **both IP and identifier limits must be satisfied** simultaneously. This prevents:

- A single IP from attacking multiple accounts
- A single account from being attacked from multiple IPs

### Key Features

✅ **Exponential Backoff**: Repeated violations increase cooldown duration
✅ **CAPTCHA Triggering**: Threshold-based CAPTCHA requirement
✅ **Account Lockout**: Temporary suspension with configurable duration
✅ **Audit Logging**: Security events logged to database
✅ **Database-Backed**: Supports distributed deployments
✅ **Configurable**: Environment variables for all parameters
✅ **Fail-Open**: Allows requests if database is unavailable (prevents DoS)

---

## Environment Variables

### Core Configuration

| Variable                        | Default         | Description                                   |
| ------------------------------- | --------------- | --------------------------------------------- |
| `RATE_LIMIT_WINDOW_MS`          | 300000 (5 min)  | Duration of rate limit window in milliseconds |
| `RATE_LIMIT_MAX_ATTEMPTS`       | 5               | Maximum attempts allowed per window           |
| `RATE_LIMIT_BACKOFF_MULTIPLIER` | 2               | Exponential backoff multiplier                |
| `RATE_LIMIT_MAX_BACKOFF_MS`     | 7200000 (2 hrs) | Maximum backoff duration                      |

### CAPTCHA & Lockout

| Variable                         | Default        | Description                      |
| -------------------------------- | -------------- | -------------------------------- |
| `RATE_LIMIT_CAPTCHA_THRESHOLD`   | 3              | Failures before CAPTCHA required |
| `RATE_LIMIT_LOCKOUT_THRESHOLD`   | 10             | Failures before account lockout  |
| `RATE_LIMIT_LOCKOUT_DURATION_MS` | 3600000 (1 hr) | Account lockout duration         |

### Global API Limits

| Variable                       | Default | Description                         |
| ------------------------------ | ------- | ----------------------------------- |
| `GLOBAL_RATE_LIMIT_MAX`        | 1000    | Max requests for global API limiter |
| `GLOBAL_RATE_LIMIT_WINDOW_MIN` | 15      | Window duration in minutes          |

---

## Rate Limit Configurations

### Login (`/api/auth/login`)

- **Type**: Layered (IP + Identifier)
- **Max Attempts**: `RATE_LIMIT_MAX_ATTEMPTS` (default: 5)
- **Window**: `RATE_LIMIT_WINDOW_MS` (default: 5 minutes)
- **CAPTCHA Threshold**: `RATE_LIMIT_CAPTCHA_THRESHOLD` (default: 3 failures)
- **Lockout Threshold**: `RATE_LIMIT_LOCKOUT_THRESHOLD` (default: 10 failures)
- **Behavior**: Clears rate limits on successful login

### Register (`/api/auth/register`)

- **Type**: IP-based
- **Max Attempts**: 3
- **Window**: 15 minutes
- **Behavior**: Clears rate limits on successful registration

### Password Reset

- **Type**: IP-based
- **Max Attempts**: 3
- **Window**: 15 minutes

### Email Verification

- **Type**: IP-based
- **Max Attempts**: 5
- **Window**: 10 minutes

### API Endpoints

- **Type**: IP-based
- **Max Attempts**: 100
- **Window**: 1 minute

---

## Exponential Backoff

The system applies exponential backoff on **repeated violations** within the same window:

### Formula

```
backoffDuration = windowMs × (multiplier ^ violationCount)
```

Capped at `RATE_LIMIT_MAX_BACKOFF_MS` (default: 2 hours)

### Example (5-minute window, multiplier=2)

| Violation | Backoff Duration               |
| --------- | ------------------------------ |
| 1st       | 5 minutes                      |
| 2nd       | 10 minutes                     |
| 3rd       | 20 minutes                     |
| 4th       | 40 minutes                     |
| 5th+      | 80 minutes (capped at 2 hours) |

### Response

When exponential backoff is applied, the error message includes:

> "Due to repeated violations, your cooldown period has been extended."

---

## CAPTCHA Threshold

After `RATE_LIMIT_CAPTCHA_THRESHOLD` failures (default: 3), responses include:

```json
{
  "error": "Too many login attempts...",
  "requiresCaptcha": true,
  "captchaMessage": "Please complete CAPTCHA verification to continue...",
  "retryAfter": 300,
  "resetAt": "2025-11-10T12:30:00.000Z"
}
```

### Implementation Notes

- CAPTCHA requirement is **advisory** (client must implement enforcement)
- Threshold tracking is per-identifier and per-IP
- CAPTCHA flag appears in responses **even before rate limit is exceeded**

---

## Account Lockout

### Triggering

After `RATE_LIMIT_LOCKOUT_THRESHOLD` failures (default: 10), the account is **temporarily locked**:

```json
{
  "error": "Account temporarily locked due to too many failed attempts",
  "locked": true,
  "lockedUntil": "2025-11-10T13:00:00.000Z",
  "reason": "Exceeded 10 failed login attempts",
  "retryAfter": 3600
}
```

### Characteristics

- ✅ Prevents login **even with correct password**
- ✅ Applies to identifier (email/username), not IP
- ✅ Auto-expires after `RATE_LIMIT_LOCKOUT_DURATION_MS`
- ✅ Creates HIGH-severity audit log entry
- ✅ Can be manually cleared via database

### Audit Logging

Lockouts create audit logs with:

```json
{
  "event": "ACCOUNT_LOCKED",
  "severity": "HIGH",
  "identifier": "identifier:user@example.com",
  "attempts": 10,
  "lockedUntil": "2025-11-10T13:00:00.000Z",
  "ipAddress": "203.0.113.42",
  "message": "Account locked due to 10 failed login attempts"
}
```

---

## HTTP Headers

All rate-limited responses include standard headers:

### Success Response

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2025-11-10T12:30:00.000Z
```

### Rate Limited Response (429)

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-11-10T12:35:00.000Z
Retry-After: 300
```

---

## Database Schema

### RateLimitRecord

```prisma
model RateLimitRecord {
  id         String   @id @default(cuid())
  identifier String   // "ip:203.0.113.42" or "identifier:user@example.com"
  action     String   // "login", "register", etc.
  attempts   Int      @default(1)
  resetAt    DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([identifier, action])
  @@index([identifier])
  @@index([resetAt])
}
```

### AccountLockout

```prisma
model AccountLockout {
  id          String   @id @default(cuid())
  identifier  String   @unique
  lockedUntil DateTime
  attempts    Int      @default(0)
  reason      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([identifier])
  @@index([lockedUntil])
}
```

### AuditLog

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  event     String   // e.g., "ACCOUNT_LOCKED"
  details   String?  // JSON
  severity  String   @default("MEDIUM") // LOW, MEDIUM, HIGH, CRITICAL
  ipAddress String?
  timestamp DateTime @default(now())

  @@index([event])
  @@index([severity])
  @@index([timestamp])
}
```

---

## Usage Examples

### Applying Rate Limiters

```javascript
import {
  loginRateLimiter,
  registerRateLimiter,
  globalApiLimiter,
} from '../middleware/rateLimiter.js';

// Login endpoint (layered rate limiting)
router.post('/login', loginRateLimiter, async (req, res) => {
  // ... login logic
});

// Register endpoint (IP-based)
router.post('/register', registerRateLimiter, async (req, res) => {
  // ... registration logic
});

// Global API rate limiter (apply to all routes)
app.use('/api', globalApiLimiter);
```

### Custom Rate Limiter

```javascript
import { rateLimiter } from '../middleware/rateLimiter.js';

const customLimiter = rateLimiter('customAction', {
  config: {
    maxAttempts: 10,
    windowMinutes: 5,
    message: 'Too many requests for this action',
    captchaThreshold: 5,
    lockoutThreshold: 20,
    layered: false, // IP-based only
  },
});

router.post('/custom-action', customLimiter, handler);
```

### Clearing Rate Limits

```javascript
import { clearAllRateLimits } from '../middleware/rateLimiter.js';

// After successful login
await clearAllRateLimits(req, 'login');

// Clears both IP and identifier rate limits
```

---

## Testing

### Run Rate Limiting Tests

```bash
# Run all tests
npm run test --workspace=server

# Run rate limiting tests specifically
NODE_OPTIONS=--experimental-vm-modules npx jest rate-limiting.test.js
```

### Test Coverage

The test suite covers:

✅ Per-IP rate limiting
✅ Per-identifier rate limiting
✅ Exponential backoff
✅ CAPTCHA threshold triggering
✅ Account lockout
✅ Audit log creation
✅ Rate limit clearing on success
✅ Rate limit headers
✅ Layered protection enforcement
✅ Window expiration

---

## Monitoring & Maintenance

### Cleanup Expired Records

The system includes automatic cleanup for expired records:

```javascript
import { cleanupExpiredRateLimits } from '../middleware/rateLimiter.js';

// Run cleanup (call periodically via cron)
const result = await cleanupExpiredRateLimits();
console.log(`Cleaned up ${result.rateLimits} rate limits, ${result.lockouts} lockouts`);
```

### Recommended Cron Schedule

```cron
# Cleanup expired rate limits every hour
0 * * * * node cleanup-rate-limits.js
```

### Monitoring Queries

**Check active rate limits:**

```sql
SELECT identifier, action, attempts, resetAt
FROM "RateLimitRecord"
WHERE "resetAt" > NOW()
ORDER BY attempts DESC
LIMIT 20;
```

**Check active lockouts:**

```sql
SELECT identifier, lockedUntil, attempts, reason
FROM "AccountLockout"
WHERE "lockedUntil" > NOW()
ORDER BY "createdAt" DESC;
```

**Check recent lockout events:**

```sql
SELECT event, severity, details, timestamp
FROM "AuditLog"
WHERE event = 'ACCOUNT_LOCKED'
ORDER BY timestamp DESC
LIMIT 20;
```

---

## Security Considerations

### IP Spoofing

The system handles proxies and load balancers by checking multiple headers:

```javascript
const ip =
  req.ip ||
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.headers['x-real-ip'] ||
  req.connection?.remoteAddress ||
  'unknown';
```

**Recommendation**: Configure your reverse proxy to set `X-Forwarded-For` header.

### Distributed Deployments

Rate limits are **database-backed**, ensuring consistency across multiple server instances.

### Fail-Open Behavior

If the database is unavailable, the middleware **fails open** (allows request) to prevent accidental DoS. Monitor database health separately.

### Account Enumeration

Layered rate limiting helps prevent account enumeration attacks by:

- Limiting attempts per identifier (prevents testing many passwords on one account)
- Limiting attempts per IP (prevents testing many accounts from one IP)

---

## Troubleshooting

### Issue: Rate limits not applying

**Check:**

1. Middleware is applied to routes
2. Database connection is working
3. Environment variables are loaded

### Issue: Users locked out unexpectedly

**Check:**

1. `RATE_LIMIT_LOCKOUT_THRESHOLD` is not too low
2. Audit logs for lockout events
3. Check for distributed brute-force attempts

### Issue: Performance degradation

**Solution:**

- Run `cleanupExpiredRateLimits()` regularly
- Add database indexes (already included in schema)
- Consider Redis for high-traffic scenarios

---

## Best Practices

1. **Production Settings**:
   - Set strong rate limits (5-10 attempts)
   - Enable account lockout
   - Monitor audit logs regularly

2. **Development Settings**:
   - Increase limits for testing
   - Disable lockout if needed
   - Clear rate limits manually during debugging

3. **User Experience**:
   - Display clear error messages
   - Show time until lockout expires
   - Implement CAPTCHA after threshold
   - Provide account recovery options

4. **Monitoring**:
   - Alert on high lockout rates
   - Track failed login patterns
   - Review audit logs weekly
   - Set up automated cleanup cron jobs

---

## References

- **OWASP**: [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- **NIST SP 800-63B**: Digital Identity Guidelines
- **RFC 6585**: Additional HTTP Status Codes (429 Too Many Requests)
