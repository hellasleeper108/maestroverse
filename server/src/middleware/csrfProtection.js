/**
 * CSRF Protection Middleware
 *
 * Validates CSRF tokens on all unsafe HTTP methods (POST, PUT, PATCH, DELETE)
 * when using cookie-based authentication.
 *
 * Strategy:
 * - Safe methods (GET, HEAD, OPTIONS): No CSRF validation
 * - Bearer token auth: No CSRF validation (not vulnerable to CSRF)
 * - Cookie auth + unsafe method: Requires valid CSRF token in X-CSRF-Token header
 *
 * Usage:
 *   router.post('/protected', csrfProtection, authenticate, handler)
 */

import { verifyCSRFToken, isUsingCookieAuth, isUnsafeMethod } from '../utils/csrf.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * CSRF Protection Middleware
 *
 * Validates CSRF token for unsafe methods when using cookie authentication
 */
export const csrfProtection = (req, res, next) => {
  try {
    // Skip CSRF validation for safe methods
    if (!isUnsafeMethod(req.method)) {
      return next();
    }

    // Skip CSRF validation if using Bearer token (not vulnerable to CSRF)
    if (!isUsingCookieAuth(req)) {
      return next();
    }

    // At this point: unsafe method + cookie auth = CSRF protection required

    // Extract CSRF token from header
    const csrfToken = req.headers['x-csrf-token'];

    if (!csrfToken) {
      return res.status(403).json({
        error: 'CSRF token required',
        code: 'CSRF_TOKEN_MISSING',
      });
    }

    // Extract user ID from access token (in cookie)
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Verify access token to get user ID
    const decoded = verifyAccessToken(accessToken);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: 'Invalid access token',
        code: 'INVALID_TOKEN',
      });
    }

    // Verify CSRF token matches user session
    const isValid = verifyCSRFToken(csrfToken, decoded.userId);

    if (!isValid) {
      return res.status(403).json({
        error: 'Invalid or expired CSRF token',
        code: 'CSRF_TOKEN_INVALID',
      });
    }

    // CSRF token valid - continue
    next();
  } catch (error) {
    console.error('[CSRF] Protection error:', error);
    res.status(500).json({
      error: 'CSRF validation failed',
      code: 'CSRF_ERROR',
    });
  }
};

/**
 * Optional CSRF Protection Middleware
 *
 * Only validates CSRF if user is authenticated via cookies
 * Useful for endpoints that support both authenticated and anonymous access
 */
export const optionalCsrfProtection = (req, res, next) => {
  try {
    // Skip CSRF validation for safe methods
    if (!isUnsafeMethod(req.method)) {
      return next();
    }

    // Skip CSRF validation if using Bearer token
    if (!isUsingCookieAuth(req)) {
      return next();
    }

    // Check if user is authenticated via cookies
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      // Not authenticated - no CSRF required
      return next();
    }

    // User is authenticated via cookies - require CSRF
    return csrfProtection(req, res, next);
  } catch (error) {
    console.error('[CSRF] Optional protection error:', error);
    res.status(500).json({
      error: 'CSRF validation failed',
      code: 'CSRF_ERROR',
    });
  }
};

/**
 * Conditional CSRF Protection Factory
 *
 * Apply CSRF protection only to specific routes
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.optional - Make CSRF optional (only if authenticated)
 * @param {string[]} options.excludePaths - Paths to exclude from CSRF protection
 * @returns {Function} Express middleware
 */
export function createCsrfProtection(options = {}) {
  const { optional = false, excludePaths = [] } = options;

  return (req, res, next) => {
    // Check if path is excluded
    const isExcluded = excludePaths.some((path) => req.path.startsWith(path));

    if (isExcluded) {
      return next();
    }

    // Use optional or strict CSRF protection
    if (optional) {
      return optionalCsrfProtection(req, res, next);
    } else {
      return csrfProtection(req, res, next);
    }
  };
}
