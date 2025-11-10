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
  setTokenCookies,
  clearTokenCookies,
  extractTokens,
} from '../utils/tokens.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimiter.js';

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

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers['user-agent']);

    // Set HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);

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

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers['user-agent']);

    // Set HTTP-only cookies
    setTokenCookies(res, accessToken, refreshToken);

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
 * POST /api/auth/refresh
 * Refresh access token using refresh token (token rotation)
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

    // Verify refresh token
    const refreshTokenRecord = await verifyRefreshToken(refreshTokenString);

    if (!refreshTokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Check user status
    const user = refreshTokenRecord.user;

    if (user.status === 'BANNED') {
      await revokeRefreshToken(refreshTokenString);
      return res.status(403).json({ error: 'This account has been permanently banned.' });
    }

    if (user.status === 'SUSPENDED') {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        await revokeRefreshToken(refreshTokenString);
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

    // Revoke old refresh token (token rotation)
    await revokeRefreshToken(refreshTokenString);

    // Generate new tokens
    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = await generateRefreshToken(user.id, req.ip, req.headers['user-agent']);

    // Set new cookies
    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.json({
      message: 'Token refreshed successfully',
      token: newAccessToken, // For backward compatibility
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
router.post('/logout', async (req, res) => {
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
router.post('/logout-all', authenticate, async (req, res) => {
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

      // Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers['user-agent']);

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

      // Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers['user-agent']);

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

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers['user-agent']);

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
