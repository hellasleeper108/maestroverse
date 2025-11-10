# OAuth2 Setup Guide - Google & GitHub Authentication

This guide explains how to set up and use OAuth2 authentication with Google and GitHub for Maestroverse.

## 🎯 Overview

Maestroverse now supports OAuth2 authentication via:
- **Google** - Sign in with Google accounts
- **GitHub** - Sign in with GitHub accounts

**Key Features:**
- **Account Linking**: OAuth accounts automatically link to existing users by email
- **Profile Syncing**: User profiles are created/updated with OAuth provider information
- **Secure Token Management**: OAuth tokens stored securely with JWT + refresh token flow
- **Multiple Providers**: Users can link multiple OAuth accounts to one profile
- **Account Protection**: Prevents users from removing their only authentication method

## 📋 Prerequisites

Before setting up OAuth:
1. Complete the JWT + Refresh Token authentication setup (see `AUTH_MIGRATION_GUIDE.md`)
2. Apply the OAuthAccount database migration
3. Have admin access to Google Cloud Console and/or GitHub

## 🔧 Setup Instructions

### 1. Apply Database Migration

```bash
# Using Docker
docker-compose exec server npx prisma migrate deploy
docker-compose exec server npx prisma generate
docker-compose restart server

# OR locally
cd server
npx prisma migrate deploy
npx prisma generate
npm run dev
```

### 2. Set up Google OAuth

#### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure the OAuth consent screen if prompted:
   - User Type: **External** (for testing) or **Internal** (for organization)
   - App name: **Maestroverse**
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `userinfo.email` and `userinfo.profile`
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: **Maestroverse**
   - Authorized JavaScript origins:
     ```
     http://localhost:3005
     http://localhost:3001
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3001/api/auth/google/callback
     ```
   - For production, add your production URLs:
     ```
     https://yourdomain.com
     https://api.yourdomain.com
     https://api.yourdomain.com/api/auth/google/callback
     ```
7. Copy the **Client ID** and **Client Secret**

#### B. Update Environment Variables

Add to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

For production:
```bash
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
```

### 3. Set up GitHub OAuth

#### A. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - Application name: **Maestroverse**
   - Homepage URL: `http://localhost:3005`
   - Authorization callback URL: `http://localhost:3001/api/auth/github/callback`
   - For production:
     - Homepage URL: `https://yourdomain.com`
     - Callback URL: `https://api.yourdomain.com/api/auth/github/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Generate a new **Client Secret** and copy it

#### B. Update Environment Variables

Add to your `.env` file:

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
```

For production:
```bash
GITHUB_CALLBACK_URL=https://api.yourdomain.com/api/auth/github/callback
```

### 4. Configure Frontend URL

Add to your `.env` file:

```bash
FRONTEND_URL=http://localhost:3005
```

For production:
```bash
FRONTEND_URL=https://yourdomain.com
```

### 5. Restart the Server

```bash
# Docker
docker-compose restart server

# Local
npm run dev --workspace=server
```

## 🎨 Frontend Integration

The frontend OAuth buttons are already integrated into the login page at `apps/web/pages/login.js`.

### How It Works

1. User clicks "Continue with Google" or "Continue with GitHub"
2. Frontend redirects to `/api/auth/google` or `/api/auth/github`
3. Backend initiates OAuth flow with the provider
4. User authorizes on the provider's website
5. Provider redirects back to `/api/auth/{provider}/callback`
6. Backend:
   - Verifies OAuth tokens
   - Finds or creates user account
   - Links OAuth account to user profile
   - Generates JWT + refresh tokens
   - Sets HTTP-only cookies
   - Redirects to frontend with success/error
7. Frontend:
   - Receives redirect with auth status
   - Fetches user data
   - Redirects to dashboard

### OAuth Button Component

Located at `apps/web/components/OAuthButtons.js`:

```javascript
import OAuthButtons from '../components/OAuthButtons';

function LoginPage() {
  return (
    <div>
      {/* Login form */}
      <OAuthButtons />
    </div>
  );
}
```

## 🔐 Account Linking Logic

The OAuth system intelligently handles account linking:

### New User Registration
```
1. User signs in with Google (alice@example.com)
2. No user exists with this email
3. System creates new user account
4. Links Google OAuth account to user
5. User is logged in
```

### Linking to Existing Account
```
1. User has account (alice@example.com) with password
2. User clicks "Sign in with Google"
3. Google returns email: alice@example.com
4. System finds existing user by email
5. Links Google OAuth account to existing user
6. User is logged in with existing profile
```

### Multiple OAuth Providers
```
1. User has account linked to Google
2. User clicks "Sign in with GitHub"
3. GitHub returns same email
4. System links GitHub account to same user
5. User can now log in with Google OR GitHub
```

## 📊 Database Schema

### OAuthAccount Model

```prisma
model OAuthAccount {
  id           String        @id @default(cuid())
  userId       String
  provider     OAuthProvider  // GOOGLE or GITHUB
  providerId   String        // User ID from provider
  email        String?
  displayName  String?
  profileUrl   String?
  accessToken  String?       // OAuth access token
  refreshToken String?       // OAuth refresh token (if provided)
  expiresAt    DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  user         User          @relation(...)

  @@unique([provider, providerId])
}
```

## 🛣️ API Endpoints

### OAuth Flow Endpoints

```
GET /api/auth/google
├─ Initiates Google OAuth flow
└─ Redirects to Google authorization page

GET /api/auth/google/callback
├─ Handles Google OAuth callback
├─ Creates/links user account
├─ Sets JWT + refresh token cookies
└─ Redirects to frontend with result

GET /api/auth/github
├─ Initiates GitHub OAuth flow
└─ Redirects to GitHub authorization page

GET /api/auth/github/callback
├─ Handles GitHub OAuth callback
├─ Creates/links user account
├─ Sets JWT + refresh token cookies
└─ Redirects to frontend with result
```

### OAuth Management Endpoints

```
GET /api/auth/oauth/accounts
├─ Requires: Authentication
├─ Returns: List of linked OAuth accounts
└─ Response: { accounts: [{ id, provider, email, displayName, profileUrl, createdAt }] }

DELETE /api/auth/oauth/accounts/:accountId
├─ Requires: Authentication
├─ Unlinks an OAuth account
├─ Protection: Cannot unlink if it's the only auth method
└─ Response: { message: "OAuth account unlinked successfully" }
```

## 🧪 Testing OAuth Flow

### 1. Test Google OAuth

```bash
# Open browser and navigate to
http://localhost:3005/login

# Click "Continue with Google"
# You should be redirected to Google's authorization page
# After authorizing, you should be logged in and redirected to /hub
```

### 2. Test GitHub OAuth

```bash
# Open browser and navigate to
http://localhost:3005/login

# Click "Continue with GitHub"
# You should be redirected to GitHub's authorization page
# After authorizing, you should be logged in and redirected to /hub
```

### 3. Test Account Linking

```bash
# 1. Create account with email alice@example.com using password
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "username": "alice",
    "password": "password123",
    "firstName": "Alice",
    "lastName": "Test"
  }'

# 2. Log in with Google using alice@example.com
# The Google account should automatically link to the existing user

# 3. Check linked accounts
curl http://localhost:3001/api/auth/oauth/accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔒 Security Considerations

### Production Deployment

1. **HTTPS Only**
   - OAuth providers require HTTPS in production
   - Update callback URLs to use `https://`
   - Ensure `NODE_ENV=production` for secure cookies

2. **Callback URL Whitelist**
   - Only whitelist your production callback URLs
   - Remove localhost URLs from production OAuth apps

3. **Token Storage**
   - OAuth access/refresh tokens are stored in database
   - In production, consider encrypting these tokens
   - Tokens are only used for profile syncing, not exposed to frontend

4. **Email Verification**
   - OAuth users are marked as `isVerified: true`
   - Providers have already verified email addresses
   - Traditional signups may require email verification

### Account Security

1. **Multiple Auth Methods**
   - Users can link multiple OAuth providers
   - Users cannot remove their only authentication method
   - OAuth-only users should set a password before unlinking

2. **Account Takeover Prevention**
   - OAuth accounts link by email (verified by provider)
   - Existing accounts take precedence
   - No duplicate accounts created

## 🐛 Troubleshooting

### "OAuth not configured" warning

```
[OAUTH] Google OAuth not configured - missing credentials
[OAUTH] GitHub OAuth not configured - missing credentials
```

**Solution**: Add OAuth credentials to `.env` file and restart server.

### "Redirect URI mismatch" error

**Solution**: Ensure callback URLs in `.env` match exactly what's configured in the OAuth provider console. Include the protocol (`http://` or `https://`).

### OAuth callback redirect loop

**Solution**: Check that `FRONTEND_URL` is set correctly in `.env`. Should match your frontend URL (e.g., `http://localhost:3005`).

### "Cannot unlink the only authentication method" error

**Solution**: User needs to:
1. Set a password first, OR
2. Link another OAuth provider

### Cookies not being set

**Solution**:
1. Ensure `cookie-parser` middleware is loaded
2. Check CORS configuration allows credentials
3. Verify frontend sends `credentials: 'include'`
4. Check `CORS_ORIGINS` includes your frontend URL

## 🚀 Production Checklist

Before deploying to production:

- [ ] Update OAuth app callback URLs to production URLs
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS for all URLs
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Update `GOOGLE_CALLBACK_URL` to production URL
- [ ] Update `GITHUB_CALLBACK_URL` to production URL
- [ ] Remove localhost URLs from OAuth app configurations
- [ ] Test OAuth flow in production environment
- [ ] Verify cookies are set with `secure` flag
- [ ] Confirm CORS allows production frontend
- [ ] Monitor OAuth error rates in logs
- [ ] Set up OAuth token encryption (optional but recommended)

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Passport.js Documentation](http://www.passportjs.org/docs/)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)

---

**Implementation Date**: January 10, 2025
**OAuth Providers**: Google, GitHub
**Account Linking**: Automatic by email
**Security**: Production-ready with JWT + HTTP-only cookies ✅
