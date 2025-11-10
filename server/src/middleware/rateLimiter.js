/**
 * Layered Rate Limiting Middleware - Enhanced Security
 *
 * Features:
 * - Multi-layer protection: Per-IP + Per-Identifier (email/username) buckets
 * - Exponential backoff on repeated violations
 * - CAPTCHA threshold triggering after N failures
 * - Account lockout with cool-down period
 * - Audit logging for security events
 * - Configurable via environment variables
 * - Database-backed for distributed systems
 *
 * Environment Variables:
 * - RATE_LIMIT_WINDOW_MS: Window duration in milliseconds (default: 300000 = 5 min)
 * - RATE_LIMIT_MAX_ATTEMPTS: Max attempts per window (default: 5)
 * - RATE_LIMIT_BACKOFF_MULTIPLIER: Exponential backoff multiplier (default: 2)
 * - RATE_LIMIT_MAX_BACKOFF_MS: Max backoff duration (default: 7200000 = 2 hours)
 * - RATE_LIMIT_CAPTCHA_THRESHOLD: Failures before CAPTCHA required (default: 3)
 * - RATE_LIMIT_LOCKOUT_THRESHOLD: Failures before account lockout (default: 10)
 * - RATE_LIMIT_LOCKOUT_DURATION_MS: Account lockout duration (default: 3600000 = 1 hour)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Environment-based configuration with defaults
const ENV_CONFIG = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 300000, // 5 minutes
  maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5,
  backoffMultiplier: parseFloat(process.env.RATE_LIMIT_BACKOFF_MULTIPLIER) || 2,
  maxBackoffMs: parseInt(process.env.RATE_LIMIT_MAX_BACKOFF_MS) || 7200000, // 2 hours
  captchaThreshold: parseInt(process.env.RATE_LIMIT_CAPTCHA_THRESHOLD) || 3,
  lockoutThreshold: parseInt(process.env.RATE_LIMIT_LOCKOUT_THRESHOLD) || 10,
  lockoutDurationMs: parseInt(process.env.RATE_LIMIT_LOCKOUT_DURATION_MS) || 3600000, // 1 hour
};

/**
 * Rate limit configurations for different actions
 */
const RATE_LIMITS = {
  login: {
    maxAttempts: ENV_CONFIG.maxAttempts,
    windowMinutes: ENV_CONFIG.windowMs / 60000,
    message: 'Too many login attempts. Please try again later.',
    captchaThreshold: ENV_CONFIG.captchaThreshold,
    lockoutThreshold: ENV_CONFIG.lockoutThreshold,
    layered: true, // Use both IP and identifier tracking
  },
  register: {
    maxAttempts: 3,
    windowMinutes: 15,
    message: 'Too many registration attempts. Please try again later.',
    layered: false,
  },
  passwordReset: {
    maxAttempts: 3,
    windowMinutes: 15,
    message: 'Too many password reset requests. Please try again later.',
    layered: false,
  },
  emailVerification: {
    maxAttempts: 5,
    windowMinutes: 10,
    message: 'Too many verification attempts. Please try again later.',
    layered: false,
  },
  api: {
    maxAttempts: 100,
    windowMinutes: 1,
    message: 'Too many requests. Please slow down.',
    layered: false,
  },
};

/**
 * Get client IP address (handles proxies and load balancers)
 */
function getClientIP(req) {
  return (
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * Get identifier from request (IP or user-specific)
 */
function getIdentifier(req, useUserId = false) {
  if (useUserId && req.user?.id) {
    return `user:${req.user.id}`;
  }

  const ip = getClientIP(req);
  return `ip:${ip}`;
}

/**
 * Get user identifier from login credentials
 */
function getUserIdentifier(req) {
  const emailOrUsername = req.body?.emailOrUsername || req.body?.email || req.body?.username;
  if (emailOrUsername) {
    return `identifier:${emailOrUsername.toLowerCase()}`;
  }
  return null;
}

/**
 * Calculate exponential backoff duration
 */
function calculateBackoffMs(violationCount, baseMs) {
  if (violationCount === 0) return baseMs;

  // Exponential backoff: baseMs * (multiplier ^ (violationCount - 1))
  const backoffMs = baseMs * Math.pow(ENV_CONFIG.backoffMultiplier, violationCount - 1);
  return Math.min(backoffMs, ENV_CONFIG.maxBackoffMs);
}

/**
 * Create audit log entry for security events
 */
async function createAuditLog(event, details) {
  try {
    await prisma.auditLog.create({
      data: {
        event,
        details: JSON.stringify(details),
        severity: details.severity || 'MEDIUM',
        ipAddress: details.ipAddress,
        userId: details.userId || null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[AUDIT_LOG] Failed to create audit log:', error);
  }
}

/**
 * Check account lockout status
 */
async function checkAccountLockout(identifier) {
  try {
    const lockout = await prisma.accountLockout.findUnique({
      where: { identifier },
    });

    if (!lockout) {
      return { locked: false };
    }

    const now = new Date();

    // Check if lockout has expired
    if (now > lockout.lockedUntil) {
      // Remove expired lockout
      await prisma.accountLockout.delete({
        where: { identifier },
      });
      return { locked: false };
    }

    // Account is locked
    return {
      locked: true,
      lockedUntil: lockout.lockedUntil,
      reason: lockout.reason,
      attempts: lockout.attempts,
    };
  } catch (error) {
    console.error('[LOCKOUT] Check error:', error);
    return { locked: false, error: true };
  }
}

/**
 * Create account lockout
 */
async function createAccountLockout(identifier, attempts, ipAddress, userId = null) {
  try {
    const lockedUntil = new Date(Date.now() + ENV_CONFIG.lockoutDurationMs);

    await prisma.accountLockout.upsert({
      where: { identifier },
      create: {
        identifier,
        lockedUntil,
        attempts,
        reason: `Exceeded ${ENV_CONFIG.lockoutThreshold} failed login attempts`,
      },
      update: {
        lockedUntil,
        attempts,
        reason: `Exceeded ${ENV_CONFIG.lockoutThreshold} failed login attempts`,
      },
    });

    // Create audit log entry
    await createAuditLog('ACCOUNT_LOCKED', {
      severity: 'HIGH',
      identifier,
      attempts,
      lockedUntil: lockedUntil.toISOString(),
      ipAddress,
      userId,
      message: `Account locked due to ${attempts} failed login attempts`,
    });

    console.log(`[LOCKOUT] Account locked: ${identifier} until ${lockedUntil.toISOString()}`);

    return { lockedUntil };
  } catch (error) {
    console.error('[LOCKOUT] Creation error:', error);
    return null;
  }
}

/**
 * Check and record rate limit attempt
 */
async function checkRateLimit(identifier, action, config) {
  const now = new Date();

  try {
    // Find existing rate limit record
    let record = await prisma.rateLimitRecord.findUnique({
      where: {
        identifier_action: {
          identifier,
          action,
        },
      },
    });

    if (!record) {
      // First attempt - create new record
      const resetAt = new Date(now.getTime() + config.windowMinutes * 60 * 1000);

      await prisma.rateLimitRecord.create({
        data: {
          identifier,
          action,
          attempts: 1,
          resetAt,
        },
      });

      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        resetAt,
        attempts: 1,
        requiresCaptcha: false,
      };
    }

    // Check if reset window has passed
    if (now > record.resetAt) {
      // Reset window expired - reset counter
      const resetAt = new Date(now.getTime() + config.windowMinutes * 60 * 1000);

      await prisma.rateLimitRecord.update({
        where: { id: record.id },
        data: {
          attempts: 1,
          resetAt,
        },
      });

      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        resetAt,
        attempts: 1,
        requiresCaptcha: false,
      };
    }

    // Within reset window - check if limit exceeded
    if (record.attempts >= config.maxAttempts) {
      // Check if we need to apply exponential backoff
      const violationCount = Math.floor(record.attempts / config.maxAttempts);
      const backoffMs = calculateBackoffMs(violationCount, config.windowMinutes * 60 * 1000);

      // Update reset time with backoff if this is a repeated violation
      if (violationCount > 1) {
        const newResetAt = new Date(now.getTime() + backoffMs);
        await prisma.rateLimitRecord.update({
          where: { id: record.id },
          data: {
            attempts: record.attempts + 1,
            resetAt: newResetAt,
          },
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt: newResetAt,
          attempts: record.attempts + 1,
          backoffApplied: true,
          requiresCaptcha: record.attempts >= (config.captchaThreshold || 999),
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
        attempts: record.attempts,
        requiresCaptcha: record.attempts >= (config.captchaThreshold || 999),
      };
    }

    // Increment attempt counter
    const newAttempts = record.attempts + 1;

    await prisma.rateLimitRecord.update({
      where: { id: record.id },
      data: {
        attempts: newAttempts,
      },
    });

    return {
      allowed: true,
      remaining: config.maxAttempts - newAttempts,
      resetAt: record.resetAt,
      attempts: newAttempts,
      requiresCaptcha: newAttempts >= (config.captchaThreshold || 999),
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Database error:', error);
    // On database errors, fail open (allow request) to prevent DoS
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: new Date(now.getTime() + config.windowMinutes * 60 * 1000),
      error: true,
      requiresCaptcha: false,
    };
  }
}

/**
 * Layered rate limiting - checks both IP and identifier buckets
 */
async function checkLayeredRateLimit(req, action, config) {
  const ipIdentifier = getIdentifier(req, false);
  const userIdentifier = getUserIdentifier(req);

  // Check IP-based rate limit
  const ipResult = await checkRateLimit(ipIdentifier, action, config);

  // If no user identifier (e.g., missing credentials), only check IP
  if (!userIdentifier) {
    return {
      layer: 'ip',
      ...ipResult,
    };
  }

  // Check user identifier-based rate limit
  const userResult = await checkRateLimit(userIdentifier, action, config);

  // Check account lockout (only for user identifiers)
  if (config.lockoutThreshold) {
    const lockoutStatus = await checkAccountLockout(userIdentifier);

    if (lockoutStatus.locked) {
      return {
        layer: 'lockout',
        allowed: false,
        locked: true,
        lockedUntil: lockoutStatus.lockedUntil,
        reason: lockoutStatus.reason,
        attempts: lockoutStatus.attempts,
      };
    }

    // Check if we should create a lockout
    if (userResult.attempts >= config.lockoutThreshold) {
      const lockout = await createAccountLockout(
        userIdentifier,
        userResult.attempts,
        getClientIP(req)
      );

      if (lockout) {
        return {
          layer: 'lockout',
          allowed: false,
          locked: true,
          lockedUntil: lockout.lockedUntil,
          reason: `Exceeded ${config.lockoutThreshold} failed attempts`,
          attempts: userResult.attempts,
        };
      }
    }
  }

  // Return the most restrictive result
  if (!ipResult.allowed) {
    return { layer: 'ip', ...ipResult };
  }

  if (!userResult.allowed) {
    return { layer: 'identifier', ...userResult };
  }

  // Both allowed - return combined result
  return {
    layer: 'both',
    allowed: true,
    remaining: Math.min(ipResult.remaining, userResult.remaining),
    resetAt: new Date(Math.max(ipResult.resetAt.getTime(), userResult.resetAt.getTime())),
    attempts: Math.max(ipResult.attempts, userResult.attempts),
    requiresCaptcha: ipResult.requiresCaptcha || userResult.requiresCaptcha,
    ipRemaining: ipResult.remaining,
    identifierRemaining: userResult.remaining,
  };
}

/**
 * Clear rate limit for a user (call after successful action)
 */
export async function clearRateLimit(identifier, action) {
  try {
    await prisma.rateLimitRecord.delete({
      where: {
        identifier_action: {
          identifier,
          action,
        },
      },
    });
  } catch (error) {
    // Ignore errors (record might not exist)
  }
}

/**
 * Clear all rate limits for an identifier (after successful login)
 */
export async function clearAllRateLimits(req, action = 'login') {
  const ipIdentifier = getIdentifier(req, false);
  const userIdentifier = getUserIdentifier(req);

  await clearRateLimit(ipIdentifier, action);
  if (userIdentifier) {
    await clearRateLimit(userIdentifier, action);
  }
}

/**
 * Cleanup expired rate limit records (call periodically via cron)
 */
export async function cleanupExpiredRateLimits() {
  try {
    const [rateLimitResult, lockoutResult] = await Promise.all([
      prisma.rateLimitRecord.deleteMany({
        where: {
          resetAt: {
            lt: new Date(),
          },
        },
      }),
      prisma.accountLockout.deleteMany({
        where: {
          lockedUntil: {
            lt: new Date(),
          },
        },
      }),
    ]);

    console.log(
      `[RATE_LIMIT] Cleaned up ${rateLimitResult.count} rate limit records, ${lockoutResult.count} lockouts`
    );

    return {
      rateLimits: rateLimitResult.count,
      lockouts: lockoutResult.count,
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Cleanup error:', error);
    return { rateLimits: 0, lockouts: 0 };
  }
}

/**
 * Create rate limiter middleware for specific action
 */
export function rateLimiter(action, options = {}) {
  const config = options.config || RATE_LIMITS[action] || RATE_LIMITS.api;
  const trackByUser = options.trackByUser || false;
  const layered = config.layered || false;

  return async (req, res, next) => {
    let result;

    if (layered && action === 'login') {
      // Use layered rate limiting for login
      result = await checkLayeredRateLimit(req, action, config);
    } else {
      // Use single-layer rate limiting
      const identifier = getIdentifier(req, trackByUser);
      result = await checkRateLimit(identifier, action, config);
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxAttempts);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining || 0));
    res.setHeader('X-RateLimit-Reset', result.resetAt?.toISOString() || new Date().toISOString());

    // Handle account lockout
    if (result.locked) {
      const retryAfter = Math.ceil((result.lockedUntil - new Date()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed attempts',
        locked: true,
        lockedUntil: result.lockedUntil.toISOString(),
        reason: result.reason,
        retryAfter,
      });
    }

    // Handle rate limit exceeded
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - new Date()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      let message = config.message;
      if (result.backoffApplied) {
        message += ' Due to repeated violations, your cooldown period has been extended.';
      }

      const response = {
        error: message,
        retryAfter,
        resetAt: result.resetAt.toISOString(),
      };

      // Include CAPTCHA requirement if threshold reached
      if (result.requiresCaptcha) {
        response.requiresCaptcha = true;
        response.captchaMessage =
          'Please complete CAPTCHA verification to continue. Too many failed attempts detected.';
      }

      return res.status(429).json(response);
    }

    // Attach rate limit info to request for logging
    req.rateLimit = result;

    // Include CAPTCHA warning in response if approaching threshold
    if (result.requiresCaptcha) {
      req.requiresCaptcha = true;
    }

    next();
  };
}

/**
 * Common rate limiter presets
 */
export const loginRateLimiter = rateLimiter('login');
export const registerRateLimiter = rateLimiter('register');
export const passwordResetRateLimiter = rateLimiter('passwordReset');
export const emailVerificationRateLimiter = rateLimiter('emailVerification');
export const apiRateLimiter = rateLimiter('api');

/**
 * Global API rate limiter (apply to all routes)
 */
export const globalApiLimiter = rateLimiter('api', {
  config: {
    maxAttempts: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX) || 1000,
    windowMinutes: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MIN) || 15,
    message: 'Global rate limit exceeded. Please slow down your requests.',
  },
});

/**
 * Conditional rate limiter - only applies after failed attempts
 */
export function adaptiveRateLimiter(action) {
  return async (req, res, next) => {
    const config = RATE_LIMITS[action] || RATE_LIMITS.api;
    const identifier = getIdentifier(req);

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Only track failed attempts (status 401, 403, or explicit error)
      const isFailed = res.statusCode === 401 || res.statusCode === 403 || (data && data.error);

      if (isFailed) {
        // Async tracking (don't await)
        checkRateLimit(identifier, action, config).catch((err) => {
          console.error('[RATE_LIMIT] Async tracking error:', err);
        });
      } else {
        // Clear rate limit on success
        clearRateLimit(identifier, action).catch((err) => {
          console.error('[RATE_LIMIT] Clear error:', err);
        });
      }

      return originalJson(data);
    };

    next();
  };
}
