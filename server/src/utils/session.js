/**
 * Session Management - PostgreSQL-Backed Sessions
 *
 * Strategy:
 * - HttpOnly, Secure, SameSite=Lax cookies
 * - Session data stored in PostgreSQL (not in-memory)
 * - Automatic cleanup of expired sessions
 * - Session regeneration on privilege escalation (login, logout)
 * - Rolling session expiration (extends on activity)
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const prisma = new PrismaClient();
const PgSession = connectPgSimple(session);

/**
 * PostgreSQL connection pool for session store
 * Separate from Prisma to avoid conflicts
 */
const pgPool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'maestroverse',
  user: process.env.POSTGRES_USER || 'maestro',
  password: process.env.POSTGRES_PASSWORD || 'maestro123',
});

/**
 * Session store configuration
 */
const sessionStore = new PgSession({
  pool: pgPool,
  tableName: 'session', // Will create this table automatically
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // Cleanup every 15 minutes
});

/**
 * Session middleware configuration
 */
export const sessionConfig = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  name: 'mv_sid', // Custom session cookie name
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on every request (rolling session)
  cookie: {
    httpOnly: true, // Prevent XSS access to cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // CSRF protection
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  // Custom session ID generator (nanoid for better entropy)
  genid: () => {
    const { nanoid } = require('nanoid');
    return nanoid(32);
  },
};

/**
 * Initialize session middleware
 */
export function sessionMiddleware() {
  return session(sessionConfig);
}

/**
 * Regenerate session (call after login/privilege escalation)
 * Prevents session fixation attacks
 */
export function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    const oldSessionData = { ...req.session };

    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      // Restore session data after regeneration
      Object.assign(req.session, oldSessionData);
      resolve();
    });
  });
}

/**
 * Destroy session (call on logout)
 */
export function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Update session activity timestamp
 * Call this on important actions to track last activity
 */
export async function updateSessionActivity(sessionId, userId) {
  try {
    // Update our custom Session model in Prisma
    await prisma.session.upsert({
      where: {
        sid: sessionId,
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        sid: sessionId,
        userId,
        data: JSON.stringify({}),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      },
    });
  } catch (error) {
    console.error('[SESSION] Failed to update activity:', error);
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId) {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return sessions;
  } catch (error) {
    console.error('[SESSION] Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId, userId) {
  try {
    // Verify session belongs to user before revoking
    const session = await prisma.session.findUnique({
      where: { sid: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    await prisma.session.delete({
      where: { sid: sessionId },
    });

    // Also delete from connect-pg-simple table
    await pgPool.query('DELETE FROM session WHERE sid = $1', [sessionId]);

    return true;
  } catch (error) {
    console.error('[SESSION] Failed to revoke session:', error);
    return false;
  }
}

/**
 * Revoke all sessions for a user (except current)
 */
export async function revokeAllUserSessions(userId, exceptSessionId = null) {
  try {
    const where = {
      userId,
    };

    if (exceptSessionId) {
      where.NOT = { sid: exceptSessionId };
    }

    const deletedSessions = await prisma.session.findMany({
      where,
      select: { sid: true },
    });

    // Delete from Prisma
    await prisma.session.deleteMany({ where });

    // Delete from connect-pg-simple table
    for (const session of deletedSessions) {
      await pgPool.query('DELETE FROM session WHERE sid = $1', [session.sid]);
    }

    return deletedSessions.length;
  } catch (error) {
    console.error('[SESSION] Failed to revoke all sessions:', error);
    return 0;
  }
}

/**
 * Cleanup expired sessions (call via cron job)
 */
export async function cleanupExpiredSessions() {
  try {
    // Cleanup from Prisma Session model
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`[SESSION] Cleaned up ${result.count} expired sessions`);
    return result.count;
  } catch (error) {
    console.error('[SESSION] Cleanup error:', error);
    return 0;
  }
}

/**
 * Middleware to require authenticated session
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_SESSION',
    });
  }

  next();
}

/**
 * Middleware to attach user to request from session
 */
export async function attachUser(req, res, next) {
  if (!req.session?.userId) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isVerified: true,
        suspendedUntil: true,
      },
    });

    if (!user) {
      // User deleted - destroy session
      await destroySession(req);
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_DELETED',
      });
    }

    // Check if user is banned
    if (user.status === 'BANNED') {
      await destroySession(req);
      return res.status(403).json({
        error: 'Account banned',
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
        return res.status(403).json({
          error: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED',
          suspendedUntil: user.suspendedUntil?.toISOString(),
        });
      }
    }

    // Check if email is verified (optional - uncomment to require)
    // if (!user.isVerified) {
    //   return res.status(403).json({
    //     error: 'Email not verified',
    //     code: 'EMAIL_NOT_VERIFIED',
    //   });
    // }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.error('[SESSION] Failed to attach user:', error);
    res.status(500).json({
      error: 'Authentication error',
    });
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Session fingerprinting (additional security layer)
 * Detect session hijacking by tracking user agent + IP
 */
export function sessionFingerprint(req) {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection?.remoteAddress || '';

  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(userAgent + ip)
    .digest('hex');
}

/**
 * Middleware to verify session fingerprint
 */
export function verifySessionFingerprint(req, res, next) {
  if (!req.session?.userId) {
    return next();
  }

  const currentFingerprint = sessionFingerprint(req);

  if (!req.session.fingerprint) {
    // First time - set fingerprint
    req.session.fingerprint = currentFingerprint;
    return next();
  }

  if (req.session.fingerprint !== currentFingerprint) {
    // Fingerprint mismatch - possible session hijacking
    console.warn('[SESSION] Fingerprint mismatch for user:', req.session.userId);

    // Destroy session and require re-login
    destroySession(req);

    return res.status(401).json({
      error: 'Session security violation detected. Please log in again.',
      code: 'FINGERPRINT_MISMATCH',
    });
  }

  next();
}
