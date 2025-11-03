/**
 * Rate Limiting Middleware - Database-Backed with Exponential Backoff
 *
 * Strategy:
 * - Track attempts by IP address and user ID
 * - 5 attempts per 5 minutes (exponential backoff on repeated violations)
 * - Store rate limit records in database (RateLimitRecord model)
 * - Different limits for different actions (login, register, password reset)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Rate limit configurations for different actions
 */
const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowMinutes: 5,
    message: 'Too many login attempts. Please try again later.',
  },
  register: {
    maxAttempts: 3,
    windowMinutes: 15,
    message: 'Too many registration attempts. Please try again later.',
  },
  passwordReset: {
    maxAttempts: 3,
    windowMinutes: 15,
    message: 'Too many password reset requests. Please try again later.',
  },
  emailVerification: {
    maxAttempts: 5,
    windowMinutes: 10,
    message: 'Too many verification attempts. Please try again later.',
  },
  api: {
    maxAttempts: 100,
    windowMinutes: 1,
    message: 'Too many requests. Please slow down.',
  },
};

/**
 * Get client identifier (IP address or user ID)
 */
function getIdentifier(req, useUserId = false) {
  if (useUserId && req.user?.id) {
    return `user:${req.user.id}`;
  }

  // Extract IP from various possible headers (for proxy/load balancer scenarios)
  const ip = req.ip
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || 'unknown';

  return `ip:${ip}`;
}

/**
 * Calculate exponential backoff time based on violation count
 */
function calculateBackoffMinutes(violationCount, baseMinutes) {
  if (violationCount === 0) return baseMinutes;

  // Exponential backoff: 5min, 10min, 20min, 40min, 80min (capped at 2 hours)
  const backoffMinutes = baseMinutes * Math.pow(2, violationCount - 1);
  return Math.min(backoffMinutes, 120);
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
      };
    }

    // Within reset window - check if limit exceeded
    if (record.attempts >= config.maxAttempts) {
      // Check if we need to apply exponential backoff
      const violationCount = Math.floor(record.attempts / config.maxAttempts);
      const backoffMinutes = calculateBackoffMinutes(violationCount, config.windowMinutes);

      // Update reset time with backoff if this is a repeated violation
      if (violationCount > 1) {
        const newResetAt = new Date(now.getTime() + backoffMinutes * 60 * 1000);
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
          backoffApplied: true,
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
      };
    }

    // Increment attempt counter
    await prisma.rateLimitRecord.update({
      where: { id: record.id },
      data: {
        attempts: record.attempts + 1,
      },
    });

    return {
      allowed: true,
      remaining: config.maxAttempts - (record.attempts + 1),
      resetAt: record.resetAt,
    };

  } catch (error) {
    console.error('[RATE_LIMIT] Database error:', error);
    // On database errors, fail open (allow request) to prevent DoS
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: new Date(now.getTime() + config.windowMinutes * 60 * 1000),
      error: true,
    };
  }
}

/**
 * Clear rate limit for a user (call after successful action to prevent lockout on success)
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
 * Cleanup expired rate limit records (call periodically via cron)
 */
export async function cleanupExpiredRateLimits() {
  try {
    const result = await prisma.rateLimitRecord.deleteMany({
      where: {
        resetAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`[RATE_LIMIT] Cleaned up ${result.count} expired records`);
    return result.count;
  } catch (error) {
    console.error('[RATE_LIMIT] Cleanup error:', error);
    return 0;
  }
}

/**
 * Create rate limiter middleware for specific action
 *
 * @param {string} action - Action name (login, register, etc.)
 * @param {object} options - Override default config
 * @param {boolean} options.trackByUser - Track by user ID instead of IP
 * @returns {Function} Express middleware
 */
export function rateLimiter(action, options = {}) {
  const config = options.config || RATE_LIMITS[action] || RATE_LIMITS.api;
  const trackByUser = options.trackByUser || false;

  return async (req, res, next) => {
    const identifier = getIdentifier(req, trackByUser);

    const result = await checkRateLimit(identifier, action, config);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxAttempts);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - new Date()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      let message = config.message;
      if (result.backoffApplied) {
        message += ' Due to repeated violations, your cooldown period has been extended.';
      }

      return res.status(429).json({
        error: message,
        retryAfter,
        resetAt: result.resetAt.toISOString(),
      });
    }

    // Attach rate limit info to request for logging
    req.rateLimit = result;

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
 * Conditional rate limiter - only applies after failed attempts
 */
export function adaptiveRateLimiter(action) {
  return async (req, res, next) => {
    const config = RATE_LIMITS[action] || RATE_LIMITS.api;
    const identifier = getIdentifier(req);

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Only track failed attempts (status 401, 403, or explicit error)
      const isFailed = res.statusCode === 401
        || res.statusCode === 403
        || (data && data.error);

      if (isFailed) {
        // Async tracking (don't await)
        checkRateLimit(identifier, action, config).catch(err => {
          console.error('[RATE_LIMIT] Async tracking error:', err);
        });
      }

      return originalJson(data);
    };

    next();
  };
}
