import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import passport from '../config/passport.js';
import { authenticate } from '../middleware/auth.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  revokeDeviceToken,
  rotateRefreshToken,
  getUserSessions,
  setTokenCookies,
  clearTokenCookies,
  extractTokens,
  generateDeviceId,
} from '../utils/tokens.js';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
  clearAllRateLimits,
} from '../middleware/rateLimiter.js';
import { generateCSRFToken } from '../utils/csrf.js';
import { csrfProtection } from '../middleware/csrfProtection.js';
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  consumePasswordResetToken,
  RESET_TOKEN_EXPIRY_MINUTES,
} from '../utils/passwordReset.js';

const router = express.Router();
const prisma = new PrismaClient();

const rootAdminEmails = (process.env.ROOT_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  major: z.string().optional(),
  year: z.number().int().min(1).max(4).optional(),
  cohort: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

const loginSchema = z.object({
  emailOrUsername: z.string(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * Register a new user with JWT + refresh token authentication
 */
router.post('/register', registerRateLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email or username already exists',
      });
    }

    // Hash password with bcrypt (12 rounds for better security)
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const shouldBeAdmin = rootAdminEmails.includes(data.email.toLowerCase());

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        major: data.major,
        year: data.year,
        cohort: data.cohort,
        role: shouldBeAdmin ? 'ADMIN' : undefined,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        major: true,
        year: true,
        cohort: true,
        createdAt: true,
        role: true,
        status: true,
      },
    });

    // Generate tokens with device tracking
    const accessToken = generateAccessToken(user.id);
    const deviceId = generateDeviceId(req);
    const refreshToken = await generateRefreshToken(
      user.id,
      deviceId,
      req.ip,
      req.headers['user-agent']
    );

    // Set HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Clear rate limits on successful registration
    await clearAllRateLimits(req, 'register');

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token: accessToken, // For backward compatibility with frontend
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Login user with JWT + refresh token authentication
 */
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.emailOrUsername }, { username: data.emailOrUsername }],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password first (constant-time comparison)
    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Auto-elevate root admins if necessary
    if (rootAdminEmails.includes(user.email.toLowerCase()) && user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      user.role = 'ADMIN';
    }

    // Moderation status checks
    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'This account has been permanently banned.' });
    }

    if (user.status === 'SUSPENDED') {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        return res.status(403).json({
          error: `Account suspended until ${user.suspendedUntil.toISOString()}`,
        });
      }

      // Suspension expired – reset status
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', suspendedUntil: null },
      });
      user.status = 'ACTIVE';
      user.suspendedUntil = null;
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    // Generate tokens with device tracking
    const accessToken = generateAccessToken(user.id);
    const deviceId = generateDeviceId(req);
    const refreshToken = await generateRefreshToken(
      user.id,
      deviceId,
      req.ip,
      req.headers['user-agent']
    );

    // Set HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Clear rate limits on successful login
    await clearAllRateLimits(req, 'login');

    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token: accessToken, // For backward compatibility with frontend
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        bio: true,
        major: true,
        year: true,
        cohort: true,
        skills: true,
        interests: true,
        role: true,
        status: true,
        suspendedUntil: true,
        moderationNote: true,
        isVerified: true,
        lastActive: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/auth/csrf
 * Get CSRF token for current session (requires authentication)
 *
 * This endpoint issues a signed CSRF token tied to the user's session.
 * The token must be included in the X-CSRF-Token header for all unsafe
 * HTTP methods (POST, PUT, PATCH, DELETE) when using cookie-based auth.
 */
router.get('/csrf', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate CSRF token tied to user session
    const csrfToken = generateCSRFToken(userId);

    res.json({
      csrfToken,
      expiresIn: '1h',
      usage: 'Include in X-CSRF-Token header for POST/PUT/PATCH/DELETE requests',
    });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token (automatic token rotation)
 */
router.post('/refresh', async (req, res) => {
  try {
    // Extract refresh token from cookies or body
    const { refreshToken: refreshTokenFromCookie } = extractTokens(req);
    const refreshTokenFromBody = req.body.refreshToken;
    const refreshTokenString = refreshTokenFromCookie || refreshTokenFromBody;

    if (!refreshTokenString) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Rotate refresh token (invalidates old, issues new)
    const result = await rotateRefreshToken(refreshTokenString, req.ip, req.headers['user-agent']);

    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken, user } = result;

    // Check user status
    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'This account has been permanently banned.' });
    }

    if (user.status === 'SUSPENDED') {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        return res.status(403).json({
          error: `Account suspended until ${user.suspendedUntil.toISOString()}`,
        });
      }

      // Suspension expired – restore account
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', suspendedUntil: null },
      });
    }

    // Set new cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      token: accessToken, // For backward compatibility
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 */
router.post('/logout', csrfProtection, async (req, res) => {
  try {
    // Extract refresh token
    const { refreshToken: refreshTokenFromCookie } = extractTokens(req);
    const refreshTokenFromBody = req.body.refreshToken;
    const refreshTokenString = refreshTokenFromCookie || refreshTokenFromBody;

    // Revoke refresh token if provided
    if (refreshTokenString) {
      await revokeRefreshToken(refreshTokenString);
    }

    // Clear cookies
    clearTokenCookies(res);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout user from all devices by revoking all refresh tokens
 */
router.post('/logout-all', csrfProtection, authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Revoke all refresh tokens for the user
    const count = await revokeAllUserTokens(userId);

    // Clear cookies
    clearTokenCookies(res);

    res.json({
      message: `Logged out from all devices (${count} sessions terminated)`,
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

/**
 * POST /api/auth/logout-device
 * Logout from a specific device by revoking that device's tokens
 */
router.post('/logout-device', csrfProtection, authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    // Revoke tokens for specific device
    const count = await revokeDeviceToken(userId, deviceId);

    if (count === 0) {
      return res.status(404).json({ error: 'No active session found for this device' });
    }

    // If logging out current device, clear cookies
    const currentDeviceId = generateDeviceId(req);
    if (deviceId === currentDeviceId) {
      clearTokenCookies(res);
    }

    res.json({
      message: `Logged out from device (${count} session(s) terminated)`,
    });
  } catch (error) {
    console.error('Logout device error:', error);
    res.status(500).json({ error: 'Failed to logout from device' });
  }
});

/**
 * POST /api/auth/request-reset
 * Request a password reset token
 *
 * Security features:
 * - Rate limited (3 attempts per 15 minutes per IP)
 * - Single-use tokens stored hashed in database
 * - 15-minute TTL
 * - No email disclosure (always returns success)
 * - Invalidates previous unused tokens
 */
router.post('/request-reset', passwordResetRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Get client IP and user agent for audit trail
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, status: true },
    });

    // IMPORTANT: Always return success to prevent email enumeration attacks
    // Don't reveal whether the email exists or not
    if (!user) {
      // Still apply rate limiting but don't create token
      return res.json({
        message: `If an account with email ${email} exists, a password reset link has been sent.`,
        expiresIn: `${RESET_TOKEN_EXPIRY_MINUTES} minutes`,
      });
    }

    // Check if user is banned or suspended
    if (user.status === 'BANNED') {
      return res.json({
        message: `If an account with email ${email} exists, a password reset link has been sent.`,
        expiresIn: `${RESET_TOKEN_EXPIRY_MINUTES} minutes`,
      });
    }

    // Create password reset token
    const { token, expiresAt } = await createPasswordResetToken(
      user.id,
      ipAddress,
      userAgent
    );

    // TODO: Send email with reset link
    // In production, you would send an email here with a link like:
    // https://yourdomain.com/reset-password?token=${token}
    //
    // For development/testing, we'll log the token
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n='.repeat(80));
      console.log('PASSWORD RESET TOKEN (DEVELOPMENT ONLY)');
      console.log('='.repeat(80));
      console.log(`User: ${user.email}`);
      console.log(`Token: ${token}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log(`Reset URL: http://localhost:3005/reset-password?token=${token}`);
      console.log('='.repeat(80) + '\n');
    }

    res.json({
      message: `If an account with email ${email} exists, a password reset link has been sent.`,
      expiresIn: `${RESET_TOKEN_EXPIRY_MINUTES} minutes`,
      // Include token in response for development/testing only
      ...(process.env.NODE_ENV !== 'production' && { token }),
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * POST /api/auth/reset
 * Reset password using a valid reset token
 *
 * Security features:
 * - Single-use tokens (marked as used after consumption)
 * - JWT signature verification (prevents tampering)
 * - Expiry check (15-minute TTL)
 * - Replay attack prevention
 * - All refresh tokens rotated (force logout all devices)
 */
router.post('/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate inputs
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
      });
    }

    // Validate token (checks signature, expiry, usage)
    const validation = await validatePasswordResetToken(token);

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'Invalid or expired reset token',
      });
    }

    const { userId, tokenHash } = validation;

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'Account is banned' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Mark token as used (prevent replay attacks)
      await tx.passwordResetToken.update({
        where: { tokenHash },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      // Rotate all refresh tokens (force logout from all devices)
      await tx.refreshToken.deleteMany({
        where: { userId },
      });
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId,
        event: 'PASSWORD_RESET',
        details: JSON.stringify({
          email: user.email,
          timestamp: new Date().toISOString(),
        }),
        severity: 'MEDIUM',
        success: true,
        timestamp: new Date(),
      },
    });

    res.json({
      message: 'Password has been reset successfully',
      note: 'All active sessions have been terminated. Please login with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * GET /api/auth/sessions
 * Get all active sessions for the current user
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all active sessions
    const sessions = await getUserSessions(userId);

    // Add 'current' flag to current device
    const currentDeviceId = generateDeviceId(req);
    const sessionsWithCurrent = sessions.map((session) => ({
      ...session,
      isCurrent: session.deviceId === currentDeviceId,
    }));

    res.json({ sessions: sessionsWithCurrent });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', passport.authenticate('google', { session: false }));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=google_auth_failed',
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect('/login?error=authentication_failed');
      }

      // Check user status
      if (user.status === 'BANNED') {
        return res.redirect('/login?error=account_banned');
      }

      if (user.status === 'SUSPENDED') {
        if (user.suspendedUntil && user.suspendedUntil > new Date()) {
          return res.redirect(
            `/login?error=account_suspended&until=${user.suspendedUntil.toISOString()}`
          );
        }

        // Restore expired suspension
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE', suspendedUntil: null },
        });
      }

      // Generate tokens with device tracking
      const accessToken = generateAccessToken(user.id);
      const deviceId = generateDeviceId(req);
      const refreshToken = await generateRefreshToken(
        user.id,
        deviceId,
        req.ip,
        req.headers['user-agent']
      );

      // Set cookies
      setTokenCookies(res, accessToken, refreshToken);

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
      res.redirect(`${frontendUrl}/?auth=success&token=${accessToken}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/login?error=authentication_error');
    }
  }
);

/**
 * GET /api/auth/github
 * Initiate GitHub OAuth flow
 */
router.get('/github', passport.authenticate('github', { session: false }));

/**
 * GET /api/auth/github/callback
 * GitHub OAuth callback
 */
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/login?error=github_auth_failed',
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect('/login?error=authentication_failed');
      }

      // Check user status
      if (user.status === 'BANNED') {
        return res.redirect('/login?error=account_banned');
      }

      if (user.status === 'SUSPENDED') {
        if (user.suspendedUntil && user.suspendedUntil > new Date()) {
          return res.redirect(
            `/login?error=account_suspended&until=${user.suspendedUntil.toISOString()}`
          );
        }

        // Restore expired suspension
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE', suspendedUntil: null },
        });
      }

      // Generate tokens with device tracking
      const accessToken = generateAccessToken(user.id);
      const deviceId = generateDeviceId(req);
      const refreshToken = await generateRefreshToken(
        user.id,
        deviceId,
        req.ip,
        req.headers['user-agent']
      );

      // Set cookies
      setTokenCookies(res, accessToken, refreshToken);

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
      res.redirect(`${frontendUrl}/?auth=success&token=${accessToken}`);
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect('/login?error=authentication_error');
    }
  }
);

/**
 * GET /api/auth/oauth/accounts
 * Get user's linked OAuth accounts (requires authentication)
 */
router.get('/oauth/accounts', authenticate, async (req, res) => {
  try {
    const accounts = await prisma.oAuthAccount.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        provider: true,
        email: true,
        displayName: true,
        profileUrl: true,
        createdAt: true,
      },
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Get OAuth accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch OAuth accounts' });
  }
});

/**
 * DELETE /api/auth/oauth/accounts/:accountId
 * Unlink an OAuth account (requires authentication)
 */
router.delete('/oauth/accounts/:accountId', authenticate, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;

    // Check if account exists and belongs to user
    const account = await prisma.oAuthAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'OAuth account not found' });
    }

    // Check if user has a password (prevent locking out OAuth-only users)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    // Check if user has other login methods
    const accountCount = await prisma.oAuthAccount.count({
      where: { userId },
    });

    // Prevent unlinking if this is the only auth method and no password is set
    if (accountCount === 1 && !user.password) {
      return res.status(400).json({
        error: 'Cannot unlink the only authentication method. Please set a password first.',
      });
    }

    // Delete OAuth account
    await prisma.oAuthAccount.delete({
      where: { id: accountId },
    });

    res.json({ message: 'OAuth account unlinked successfully' });
  } catch (error) {
    console.error('Unlink OAuth account error:', error);
    res.status(500).json({ error: 'Failed to unlink OAuth account' });
  }
});

/**
 * POST /api/auth/sso/callback
 * Mock Maestro SSO callback (for demo purposes)
 */
router.post('/sso/callback', async (req, res) => {
  try {
    const { code } = req.body;

    // In a real implementation, this would validate the OAuth code with the SSO provider
    // For demo, we'll just create/login a user

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Mock: extract user info from code (in real app, this comes from SSO provider)
    // Format: base64(email:firstName:lastName)
    const decoded = Buffer.from(code, 'base64').toString('utf-8');
    const [email, firstName, lastName] = decoded.split(':');

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Invalid SSO code' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user from SSO
      const username = email.split('@')[0];
      // Generate cryptographically secure random password for SSO users
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

      user = await prisma.user.create({
        data: {
          email,
          username,
          password: randomPassword,
          firstName,
          lastName,
          isVerified: true, // SSO users are auto-verified
        },
      });
    }

    // Generate tokens with device tracking
    const accessToken = generateAccessToken(user.id);
    const deviceId = generateDeviceId(req);
    const refreshToken = await generateRefreshToken(
      user.id,
      deviceId,
      req.ip,
      req.headers['user-agent']
    );

    // Set HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;

    res.json({
      message: 'SSO login successful',
      user: userWithoutPassword,
      token: accessToken, // For backward compatibility
    });
  } catch (error) {
    console.error('SSO callback error:', error);
    res.status(500).json({ error: 'SSO authentication failed' });
  }
});

export default router;
