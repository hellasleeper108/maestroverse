/**
 * Strict CORS Configuration
 *
 * Features:
 * - Whitelist-based origin validation
 * - Blocks wildcard (*) in production
 * - Blocks credentials for unknown origins
 * - Startup validation (fails boot if misconfigured in production)
 * - Configurable via CORS_ORIGINS environment variable
 *
 * Security:
 * - Prevents CORS bypass attacks
 * - Enforces origin validation before setting Access-Control-Allow-Credentials
 * - Production-safe defaults
 */

import cors from 'cors';

/**
 * Parse and validate CORS origins from environment variable
 */
function parseAllowedOrigins() {
  const originsEnv = process.env.CORS_ORIGINS || '';
  const isProd = process.env.NODE_ENV === 'production';

  // Split by comma and trim whitespace
  const origins = originsEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Validate each origin
  const validOrigins = [];
  const invalidOrigins = [];

  for (const origin of origins) {
    // Check for wildcard
    if (origin === '*') {
      if (isProd) {
        throw new Error(
          'SECURITY ERROR: Wildcard (*) is not allowed in CORS_ORIGINS in production. ' +
            'Specify explicit origins instead.'
        );
      }
      validOrigins.push(origin);
      continue;
    }

    // Validate origin format (must be a valid URL or localhost)
    try {
      const url = new URL(origin);
      // Origin must have protocol (http/https) and host
      if (!url.protocol || !url.host) {
        invalidOrigins.push(origin);
        continue;
      }
      validOrigins.push(origin);
    } catch (error) {
      invalidOrigins.push(origin);
    }
  }

  // Report invalid origins
  if (invalidOrigins.length > 0) {
    console.warn(
      `[CORS] Warning: Invalid origins found in CORS_ORIGINS and will be ignored: ${invalidOrigins.join(', ')}`
    );
  }

  return validOrigins;
}

/**
 * Validate CORS configuration on startup
 * Fails boot if production requirements are not met
 */
export function validateCORSConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  const originsEnv = process.env.CORS_ORIGINS || '';

  // CRITICAL: Production must have explicit allowed origins
  if (isProd && !originsEnv.trim()) {
    throw new Error(
      'SECURITY ERROR: CORS_ORIGINS must be set in production environment.\n' +
        'Add allowed origins to .env file:\n' +
        'CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com\n\n' +
        'Refusing to start with insecure CORS configuration.'
    );
  }

  // Parse and validate origins
  const allowedOrigins = parseAllowedOrigins();

  // Production must have at least one valid origin
  if (isProd && allowedOrigins.length === 0) {
    throw new Error(
      'SECURITY ERROR: No valid origins found in CORS_ORIGINS for production.\n' +
        'Ensure CORS_ORIGINS contains valid URLs (e.g., https://yourdomain.com).\n' +
        'Refusing to start with insecure CORS configuration.'
    );
  }

  // Log configuration
  if (isProd) {
    console.log(`[CORS] ✓ Production CORS configured with ${allowedOrigins.length} allowed origin(s)`);
    console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
  } else {
    console.log(
      `[CORS] Development CORS configured with ${allowedOrigins.length} allowed origin(s): ${allowedOrigins.join(', ')}`
    );
  }

  return allowedOrigins;
}

/**
 * Get allowed origins list
 */
export function getAllowedOrigins() {
  return parseAllowedOrigins();
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin) {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();

  // Check for wildcard
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // Check for exact match
  return allowedOrigins.includes(origin);
}

/**
 * Create CORS middleware with strict origin validation
 */
export function createCORSMiddleware() {
  const allowedOrigins = getAllowedOrigins();
  const isProd = process.env.NODE_ENV === 'production';

  // CORS options
  const corsOptions = {
    // Origin validation function
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g., mobile apps, Postman, curl)
      // In production, you might want to disallow this for extra security
      if (!origin) {
        // Allow non-browser requests in development, block in production
        if (!isProd) {
          return callback(null, true);
        }
        // In production, you can choose to block or allow
        // For API testing, we'll allow but you can change this
        return callback(null, true);
      }

      // Check if wildcard is allowed
      if (allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Check if origin is in whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Origin not allowed
      const error = new Error(
        `Origin '${origin}' not allowed by CORS policy. ` +
          `Allowed origins: ${allowedOrigins.join(', ')}`
      );
      error.statusCode = 403;
      callback(error);
    },

    // Allow credentials (cookies, authorization headers)
    // Only works with whitelisted origins (handled by origin callback above)
    credentials: true,

    // Allowed methods
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Allowed headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Device-ID',
      'Accept',
      'Origin',
    ],

    // Exposed headers (accessible to client)
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'Content-Range',
      'X-Content-Range',
    ],

    // Preflight cache duration (in seconds)
    maxAge: 86400, // 24 hours

    // Pass the CORS preflight response to the next handler
    preflightContinue: false,

    // Provide a status code to use for successful OPTIONS requests
    optionsSuccessStatus: 204,
  };

  return cors(corsOptions);
}

/**
 * CORS error handler middleware
 * Handles CORS errors with proper status codes and messages
 */
export function corsErrorHandler(err, req, res, next) {
  // Check if this is a CORS error
  if (err && err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: err.message,
      origin: req.headers.origin || 'unknown',
    });
  }

  // Not a CORS error, pass to next error handler
  next(err);
}

/**
 * Get CORS configuration info (for debugging/monitoring)
 */
export function getCORSConfig() {
  return {
    allowedOrigins: getAllowedOrigins(),
    environment: process.env.NODE_ENV,
    credentialsAllowed: true,
    wildcardAllowed: !process.env.NODE_ENV === 'production',
  };
}
