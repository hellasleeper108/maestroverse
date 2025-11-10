/**
 * Secure Authentication Routes (Session-Based)
 *
 * New implementation with:
 * - Registration with email verification
 * - Login with rate limiting and audit logging
 * - Logout with session cleanup
 * - Password reset flow
 * - Email verification
 * - Session management with HttpOnly cookies
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword, validatePassword, generateSecureToken } from '../utils/password.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';
import { registerRateLimiter, loginRateLimiter, passwordResetRateLimiter, emailVerificationRateLimiter, clearRateLimit } from '../middleware/rateLimiter.js';
import { regenerateSession, destroySession, requireAuth, attachUser, sessionFingerprint } from '../utils/session.js';
import { getCsrfToken } from '../utils/csrf.js';

const router = express.Router();
const prisma = new PrismaClient();

const rootAdminEmails = (process.env.ROOT_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/**
 * POST /api/auth-secure/register
 * Register new user with email verification
 */
router.post('/register', registerRateLimiter, async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      major,
      year,
      cohort,
    } = req.body;

    // Validation
    if (!email || !username || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'username', 'password', 'firstName', 'lastName'],
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate username format (alphanumeric + underscore, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-20 characters (letters, numbers, underscores only)',
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: passwordValidation.errors,
      });
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingEmail) {
      await logAudit({
        action: AUDIT_ACTIONS.REGISTER,
        req,
        success: false,
        errorMessage: 'Email already registered',
        metadata: { email, username },
      });

      return res.status(409).json({
        error: 'Email already registered',
        field: 'email',
      });
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (existingUsername) {
      await logAudit({
        action: AUDIT_ACTIONS.REGISTER,
        req,
        success: false,
        errorMessage: 'Username already taken',
        metadata: { email, username },
      });

      return res.status(409).json({
        error: 'Username already taken',
        field: 'username',
      });
    }

    // Hash password with Argon2id + pepper
    const hashedPassword = await hashPassword(password);

    // Check if user should be admin
    const shouldBeAdmin = rootAdminEmails.includes(email.toLowerCase());

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        major: major || null,
        year: year || null,
        cohort: cohort || null,
        isVerified: false, // Require email verification
        role: shouldBeAdmin ? 'ADMIN' : 'STUDENT',
        status: 'ACTIVE',
      },
    });

    // Generate email verification token
    const verificationToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expiresAt,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, verificationToken);

    if (!emailResult.success) {
      console.error('[AUTH] Failed to send verification email:', emailResult.error);
      // Don't fail registration if email fails - user can request resend
    }

    // Log successful registration
    await logAudit({
      action: AUDIT_ACTIONS.REGISTER,
      userId: user.id,
      req,
      success: true,
      metadata: { email: user.email, username: user.username },
    });

    // Clear rate limit on successful registration
    const identifier = `ip:${req.ip || req.connection?.remoteAddress}`;
    await clearRateLimit(identifier, 'register');

    // Return user info (without password)
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        role: user.role,
      },
      emailSent: emailResult.success,
    });

  } catch (error) {
    console.error('[AUTH] Registration error:', error);

    // Log failed registration
    await logAudit({
      action: AUDIT_ACTIONS.REGISTER,
      req,
      success: false,
      errorMessage: error.message,
    });

    // Check if it's a password validation error
    if (error.validationErrors) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: error.validationErrors,
      });
    }

    res.status(500).json({
      error: 'Registration failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth-secure/login
 * Login with email/username and password
 */
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { emailOrUsername, password, rememberMe } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        error: 'Email/username and password are required',
      });
    }

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername.toLowerCase() },
        ],
      },
    });

    if (!user) {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        req,
        success: false,
        errorMessage: 'User not found',
        metadata: { emailOrUsername },
      });

      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Auto-elevate root admins if necessary
    if (rootAdminEmails.includes(user.email.toLowerCase()) && user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      user.role = 'ADMIN';
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        userId: user.id,
        req,
        success: false,
        errorMessage: 'Invalid password',
        metadata: { emailOrUsername },
      });

      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Check if user is banned
    if (user.status === 'BANNED') {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        userId: user.id,
        req,
        success: false,
        errorMessage: 'Account banned',
      });

      return res.status(403).json({
        error: 'Account has been banned',
        code: 'ACCOUNT_BANNED',
      });
    }

    // Check if user is suspended
    if (user.status === 'SUSPENDED') {
      if (user.suspendedUntil && new Date() > user.suspendedUntil) {
        // Suspension expired - restore account
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'ACTIVE',
            suspendedUntil: null,
          },
        });
        user.status = 'ACTIVE';
      } else {
        await logAudit({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          userId: user.id,
          req,
          success: false,
          errorMessage: 'Account suspended',
        });

        return res.status(403).json({
          error: 'Account is suspended',
          code: 'ACCOUNT_SUSPENDED',
          suspendedUntil: user.suspendedUntil?.toISOString(),
        });
      }
    }

    // Regenerate session (prevent session fixation)
    await regenerateSession(req);

    // Set session data
    req.session.userId = user.id;
    req.session.fingerprint = sessionFingerprint(req);

    // Set session expiration based on rememberMe
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
    }

    // Save session to get session ID
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Update last active timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    // Create session record in database
    await prisma.session.create({
      data: {
        sid: req.session.id,
        userId: user.id,
        data: JSON.stringify({ fingerprint: req.session.fingerprint }),
        expiresAt: new Date(Date.now() + req.session.cookie.maxAge),
      },
    });

    // Log successful login
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      userId: user.id,
      req,
      success: true,
      metadata: { rememberMe: !!rememberMe },
    });

    // Clear rate limit on successful login
    const identifier = `ip:${req.ip || req.connection?.remoteAddress}`;
    await clearRateLimit(identifier, 'login');

    // Get CSRF token for subsequent requests
    const csrfToken = getCsrfToken(req, res);

    // Return user info
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
      },
      csrfToken,
    });

  } catch (error) {
    console.error('[AUTH] Login error:', error);

    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      req,
      success: false,
      errorMessage: error.message,
    });

    res.status(500).json({
      error: 'Login failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth-secure/logout
 * Logout and destroy session
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const sessionId = req.session.id;

    // Delete session from database
    await prisma.session.delete({
      where: { sid: sessionId },
    }).catch(() => {
      // Ignore if session doesn't exist
    });

    // Log logout
    await logAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      userId,
      req,
      success: true,
    });

    // Destroy session
    await destroySession(req);

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('[AUTH] Logout error:', error);

    res.status(500).json({
      error: 'Logout failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/auth-secure/me
 * Get current user info from session
 */
router.get('/me', attachUser, (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Not authenticated',
    });
  }

  res.json({
    user: req.user,
  });
});

/**
 * GET /api/auth-secure/csrf-token
 * Get CSRF token for client
 */
router.get('/csrf-token', (req, res) => {
  const token = getCsrfToken(req, res);
  res.json({ csrfToken: token });
});

/**
 * POST /api/auth-secure/verify-email
 * Verify email with token
 */
router.post('/verify-email', emailVerificationRateLimiter, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Find verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // Check if token expired
    if (new Date() > verificationToken.expiresAt) {
      return res.status(400).json({
        error: 'Verification token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    // Check if token already used
    if (verificationToken.used) {
      return res.status(400).json({
        error: 'Verification token already used',
        code: 'TOKEN_USED',
      });
    }

    // Mark user as verified
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { isVerified: true },
    });

    // Mark token as used
    await prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Log email verification
    await logAudit({
      action: AUDIT_ACTIONS.EMAIL_VERIFIED,
      userId: verificationToken.userId,
      req,
      success: true,
    });

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    console.error('[AUTH] Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * POST /api/auth-secure/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', emailVerificationRateLimiter, requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Delete old unused tokens
    await prisma.verificationToken.deleteMany({
      where: {
        userId,
        used: false,
      },
    });

    // Generate new token
    const verificationToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        userId,
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expiresAt,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, verificationToken);

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    // Log event
    await logAudit({
      action: AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT,
      userId,
      req,
      success: true,
    });

    res.json({ message: 'Verification email sent' });

  } catch (error) {
    console.error('[AUTH] Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

/**
 * POST /api/auth-secure/request-password-reset
 * Request password reset email
 */
router.post('/request-password-reset', passwordResetRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success even if user not found (security best practice)
    if (!user) {
      await logAudit({
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
        req,
        success: false,
        errorMessage: 'User not found',
        metadata: { email },
      });

      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Delete old unused tokens
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    });

    // Generate reset token
    const resetToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Send reset email
    const emailResult = await sendPasswordResetEmail(user.email, resetToken);

    if (!emailResult.success) {
      console.error('[AUTH] Failed to send password reset email');
    }

    // Log password reset request
    await logAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
      userId: user.id,
      req,
      success: true,
    });

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });

  } catch (error) {
    console.error('[AUTH] Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * POST /api/auth-secure/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    // Find reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Check if token expired
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({
        error: 'Reset token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    // Check if token already used
    if (resetToken.used) {
      return res.status(400).json({
        error: 'Reset token already used',
        code: 'TOKEN_USED',
      });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: passwordValidation.errors,
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Revoke all user sessions (force re-login)
    await prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    });

    // Log password reset
    await logAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETE,
      userId: resetToken.userId,
      req,
      success: true,
    });

    res.json({ message: 'Password reset successful. Please log in with your new password.' });

  } catch (error) {
    console.error('[AUTH] Password reset error:', error);

    if (error.validationErrors) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: error.validationErrors,
      });
    }

    res.status(500).json({ error: 'Password reset failed' });
  }
});

export default router;
