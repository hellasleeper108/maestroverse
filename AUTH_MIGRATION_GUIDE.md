# JWT + Refresh Token Authentication Migration Guide

This guide explains the new secure authentication system implemented for Maestroverse and how to apply the changes.

## 🔐 What's New

### Security Improvements

1. **JWT + Refresh Token Flow**
   - Access tokens expire after **15 minutes** (short-lived)
   - Refresh tokens expire after **7 days** (long-lived)
   - Automatic token rotation on refresh

2. **HTTP-Only Cookies**
   - Tokens stored in HTTP-only cookies (not accessible via JavaScript)
   - Secure flag enabled in production (HTTPS only)
   - SameSite protection against CSRF attacks

3. **Enhanced Password Security**
   - Bcrypt rounds increased from 10 to 12
   - Constant-time password comparison

4. **Rate Limiting**
   - Login attempts: 5 per 5 minutes
   - Registration attempts: 3 per 15 minutes
   - Exponential backoff on repeated violations

5. **HTTPS Enforcement**
   - Automatic HTTPS redirect in production
   - Already implemented in `server/src/index.js:87-97`

6. **Token Management**
   - Refresh token rotation (old token revoked when new token issued)
   - Logout from all devices support
   - Automatic cleanup of expired tokens

## 📋 Changes Made

### Database Schema

**New Model: `RefreshToken`**

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  isRevoked Boolean  @default(false)
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Backend Files Modified

1. **`server/prisma/schema.prisma`**
   - Added `RefreshToken` model
   - Added `refreshTokens` relation to `User` model

2. **`server/src/utils/tokens.js`** (NEW)
   - Token generation utilities
   - Token verification functions
   - Cookie management helpers

3. **`server/src/middleware/auth.js`**
   - Updated to support cookies
   - Backward compatible with Authorization header

4. **`server/src/routes/auth.js`**
   - Updated `/register` endpoint with refresh tokens
   - Updated `/login` endpoint with refresh tokens
   - Added `/refresh` endpoint for token rotation
   - Added `/logout` endpoint
   - Added `/logout-all` endpoint
   - Updated `/sso/callback` endpoint

5. **`server/src/index.js`**
   - Added `cookie-parser` middleware

6. **`.env.example`** (NEW)
   - Comprehensive environment configuration
   - Security checklist for production

## 🚀 Applying the Migration

### Option 1: Using Docker (Recommended)

```bash
# 1. Start Docker services
npm run dev

# 2. Apply migration inside Docker container
docker-compose exec server npx prisma migrate deploy

# 3. Generate Prisma client
docker-compose exec server npx prisma generate

# 4. Restart server
docker-compose restart server
```

### Option 2: Local Development

```bash
# 1. Navigate to server directory
cd server

# 2. Apply migration
npx prisma migrate deploy

# 3. Generate Prisma client
npx prisma generate

# 4. Restart server
npm run dev
```

### Option 3: Manual Migration (If Prisma Commands Fail)

If you encounter issues with Prisma CLI, apply the migration manually:

```bash
# 1. Connect to PostgreSQL
psql -U maestro -h localhost -d maestroverse

# 2. Run the migration SQL (located at server/prisma/migrations/20250110_add_refresh_token_auth/migration.sql)
\i server/prisma/migrations/20250110_add_refresh_token_auth/migration.sql

# 3. Verify table creation
\dt RefreshToken
```

## 🔧 Configuration

### Environment Variables

Update your `.env` file based on `.env.example`:

```bash
# REQUIRED: Strong JWT secret (generate with: openssl rand -base64 64)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# REQUIRED: Node environment
NODE_ENV=production  # or 'development'

# OPTIONAL: Root admin emails (comma-separated)
ROOT_ADMIN_EMAILS=admin@maestro.edu

# OPTIONAL: CORS origins (comma-separated)
CORS_ORIGINS=https://maestroverse.com,https://app.maestroverse.com
```

### Generate Strong JWT Secret

```bash
openssl rand -base64 64
```

## 📡 API Changes

### New Endpoints

#### `POST /api/auth/refresh`

Refresh access token using refresh token (with automatic rotation).

**Request:**

```json
{
  "refreshToken": "optional-if-using-cookies"
}
```

**Response:**

```json
{
  "message": "Token refreshed successfully",
  "token": "new-access-token"
}
```

#### `POST /api/auth/logout`

Logout user and revoke refresh token.

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

#### `POST /api/auth/logout-all`

Logout user from all devices (requires authentication).

**Response:**

```json
{
  "message": "Logged out from all devices (3 sessions terminated)"
}
```

### Modified Endpoints

All existing auth endpoints now:

- Accept tokens from cookies OR Authorization header (backward compatible)
- Return tokens in both cookies AND response body
- Use 15-minute access tokens instead of 7-day tokens

## 🔄 Frontend Migration

### Option 1: Use HTTP-Only Cookies (Recommended)

The frontend will automatically receive and send cookies. No changes needed if using same-origin requests.

```javascript
// Login - cookies are set automatically
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // Important: include cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrUsername, password }),
});

// Authenticated requests - cookies sent automatically
const user = await fetch('/api/auth/me', {
  credentials: 'include', // Important: include cookies
});

// Refresh token - automatic when access token expires
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  credentials: 'include',
});
```

### Option 2: Keep Using localStorage (Backward Compatible)

The API still returns tokens in the response body for backward compatibility:

```javascript
// Existing code continues to work
const { token } = await auth.login({ emailOrUsername, password });
localStorage.setItem('maestro_token', token);

// Add token refresh logic (call every 14 minutes or on 401 errors)
async function refreshToken() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  const { token } = await response.json();
  localStorage.setItem('maestro_token', token);
  return token;
}
```

### Recommended: Implement Automatic Token Refresh

```javascript
// Refresh token 1 minute before expiry (14 minutes)
setInterval(
  () => {
    refreshToken().catch((err) => {
      console.error('Token refresh failed:', err);
      // Redirect to login
      window.location.href = '/login';
    });
  },
  14 * 60 * 1000
); // 14 minutes

// Or handle 401 errors globally
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await refreshToken();
        // Retry original request
        return axios(error.config);
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

## 🧪 Testing the Changes

### 1. Test Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "alice@maestro.edu",
    "password": "password123"
  }' \
  -c cookies.txt \
  -v
```

Check that `Set-Cookie` headers include `accessToken` and `refreshToken`.

### 2. Test Authenticated Request

```bash
curl http://localhost:3001/api/auth/me \
  -b cookies.txt \
  -v
```

### 3. Test Token Refresh

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt \
  -v
```

### 4. Test Logout

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -b cookies.txt \
  -v
```

## 🔒 Security Best Practices

### Production Checklist

- [x] **JWT_SECRET**: Use a strong, random secret (64+ characters)
- [x] **NODE_ENV=production**: Enables secure cookies and HTTPS enforcement
- [x] **HTTPS**: Ensure your server is behind HTTPS in production
- [x] **CORS**: Restrict `CORS_ORIGINS` to your production domains only
- [x] **Database**: Use strong database password
- [x] **Rate Limiting**: Already configured (5 login attempts per 5 minutes)
- [x] **Bcrypt Rounds**: Upgraded to 12 rounds
- [x] **Token Expiry**: Access tokens expire in 15 minutes
- [x] **Cookie Security**: HTTP-only, Secure, SameSite flags set

### Monitoring

Monitor the following in production:

1. **Failed Login Attempts**: Check `RateLimitRecord` table
2. **Active Refresh Tokens**: Monitor `RefreshToken` table size
3. **Token Refresh Rate**: High refresh rate may indicate issues
4. **Revoked Tokens**: Track revoked tokens for security auditing

### Token Cleanup

Add a cron job to clean up expired tokens:

```javascript
// Run daily at 2 AM
import { cleanupExpiredTokens } from './src/utils/tokens.js';

cron.schedule('0 2 * * *', async () => {
  await cleanupExpiredTokens();
});
```

Or manually:

```bash
# In Node REPL or script
node -e "import('./server/src/utils/tokens.js').then(m => m.cleanupExpiredTokens())"
```

## 🐛 Troubleshooting

### Issue: "No token provided" error

**Solution**: Ensure cookies are included in requests:

```javascript
fetch('/api/auth/me', { credentials: 'include' });
```

### Issue: Tokens not persisting across requests

**Solution**:

1. Check that `cookie-parser` middleware is loaded
2. Verify `credentials: 'include'` in fetch requests
3. Check CORS configuration allows credentials

### Issue: "Invalid or expired token" on every request

**Solution**:

1. Verify JWT_SECRET is set correctly
2. Check system clock is synchronized (JWT exp validation)
3. Ensure token hasn't actually expired (15 min lifetime)

### Issue: CORS errors with cookies

**Solution**: Update CORS configuration:

```javascript
cors({
  origin: 'http://localhost:3005',
  credentials: true, // Must be true for cookies
});
```

## 📚 Additional Resources

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [HTTP-Only Cookie Security](https://owasp.org/www-community/HttpOnly)
- [Bcrypt Recommendations](https://github.com/kelektiv/node.bcrypt.js#a-note-on-rounds)

## 💬 Support

If you encounter issues:

1. Check the console logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure database migration was applied successfully
4. Review the `.env.example` file for required configuration

---

**Implementation Date**: January 10, 2025
**Auth Token Lifetime**: 15 minutes (access), 7 days (refresh)
**Security Level**: Production-ready ✅
