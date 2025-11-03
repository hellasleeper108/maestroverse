/**
 * CSRF Protection - Double Submit Cookie Pattern
 *
 * Strategy: Generate token, store in httpOnly cookie AND send in response body.
 * Client includes token in custom header for state-changing requests.
 * Server validates token from header matches cookie.
 */

import { doubleCsrf } from 'csrf-csrf';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET;

if (!CSRF_SECRET) {
  console.warn('WARNING: CSRF_SECRET not set, using fallback');
}

// Initialize CSRF protection
const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  cookieName: '__Host-mv.csrf',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

/**
 * Middleware to generate and attach CSRF token
 */
export function csrfSetup(req, res, next) {
  const token = generateToken(req, res);
  res.locals.csrfToken = token;
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export const csrfProtect = doubleCsrfProtection;

/**
 * Get CSRF token for current request (use in login/register responses)
 */
export function getCsrfToken(req, res) {
  return generateToken(req, res);
}
