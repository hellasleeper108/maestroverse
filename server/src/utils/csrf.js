/**
 * CSRF Token Utilities - Double-Submit Cookie Pattern
 *
 * Implements CSRF protection using signed tokens that are:
 * - Tied to user session (userId)
 * - Cryptographically signed with JWT_SECRET
 * - Validated on all unsafe HTTP methods (POST, PUT, PATCH, DELETE)
 * - Only required when using cookie-based authentication
 *
 * Pattern: Double-submit cookie with signed tokens
 * - Client receives CSRF token from /api/auth/csrf
 * - Client includes token in X-CSRF-Token header
 * - Server verifies signature and user match
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Generate a CSRF token tied to a user session
 * @param {string} userId - User ID to tie token to
 * @returns {string} Signed CSRF token
 */
export function generateCSRFToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // Generate random nonce for additional entropy
  const nonce = crypto.randomBytes(16).toString('hex');

  // Create payload with userId and nonce
  const payload = {
    userId,
    nonce,
    type: 'csrf',
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign token with JWT_SECRET (1 hour expiry)
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
}

/**
 * Verify a CSRF token and extract user ID
 * @param {string} token - CSRF token to verify
 * @param {string} expectedUserId - Expected user ID (from session)
 * @returns {boolean} True if valid and matches user
 */
export function verifyCSRFToken(token, expectedUserId) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    if (!token || !expectedUserId) {
      return false;
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate token type
    if (decoded.type !== 'csrf') {
      return false;
    }

    // Validate user ID match (prevents token reuse across users)
    if (decoded.userId !== expectedUserId) {
      return false;
    }

    return true;
  } catch (error) {
    // Token expired, invalid, or malformed
    return false;
  }
}

/**
 * Check if request is using cookie-based authentication
 * @param {object} req - Express request object
 * @returns {boolean} True if using cookies (vs Authorization header)
 */
export function isUsingCookieAuth(req) {
  // Check if access token is in cookies
  if (req.cookies && req.cookies.accessToken) {
    return true;
  }

  // Check if using Authorization header instead
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return false;
  }

  // If neither, assume cookies (safer to require CSRF)
  return true;
}

/**
 * Check if HTTP method is unsafe (requires CSRF protection)
 * @param {string} method - HTTP method
 * @returns {boolean} True if unsafe method
 */
export function isUnsafeMethod(method) {
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return unsafeMethods.includes(method.toUpperCase());
}
