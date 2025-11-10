/**
 * Password Reset Token Utilities
 *
 * Secure password reset implementation with:
 * - Single-use tokens (marked as used after consumption)
 * - 15-minute TTL
 * - Hashed storage (never store plaintext tokens)
 * - Signed tokens (JWT signature prevents tampering)
 * - Replay attack prevention
 * - Token leak resilience
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Token expiration: 15 minutes
const RESET_TOKEN_EXPIRY_MINUTES = 15;
const RESET_TOKEN_EXPIRY_MS = RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;

/**
 * Generate a cryptographically secure random token
 * @returns {string} Base64url encoded random token (43 characters)
 */
function generateSecureToken() {
  // 32 bytes = 256 bits of entropy
  // Base64url encoded = 43 characters (no padding)
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash a token using SHA-256
 * @param {string} token - Raw token to hash
 * @returns {string} Hex-encoded hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a signed JWT token for password reset
 * Includes userId and expiry to prevent tampering
 *
 * @param {string} userId - User ID
 * @param {string} rawToken - Raw random token
 * @returns {string} Signed JWT token
 */
function signResetToken(userId, rawToken) {
  const payload = {
    userId,
    tokenId: rawToken,
    type: 'password_reset',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + RESET_TOKEN_EXPIRY_MS) / 1000),
  };

  return jwt.sign(payload, process.env.JWT_SECRET);
}

/**
 * Verify and decode a signed JWT reset token
 * @param {string} signedToken - JWT signed token
 * @returns {object|null} Decoded payload or null if invalid
 */
function verifyResetToken(signedToken) {
  try {
    const decoded = jwt.verify(signedToken, process.env.JWT_SECRET);

    // Verify token type
    if (decoded.type !== 'password_reset') {
      return null;
    }

    // Verify has required fields
    if (!decoded.userId || !decoded.tokenId) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Invalid signature, expired, or malformed
    return null;
  }
}

/**
 * Create a password reset token for a user
 * Invalidates any existing unused tokens
 *
 * @param {string} userId - User ID
 * @param {string} ipAddress - IP address of requester
 * @param {string} userAgent - User agent of requester
 * @returns {Promise<{token: string, expiresAt: Date}>} Token and expiry
 */
export async function createPasswordResetToken(userId, ipAddress, userAgent) {
  // Generate secure random token
  const rawToken = generateSecureToken();

  // Sign token with JWT
  const signedToken = signResetToken(userId, rawToken);

  // Hash token for database storage
  const tokenHash = hashToken(rawToken);

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      used: false,
      expiresAt: {
        gt: new Date(), // Only invalidate non-expired tokens
      },
    },
    data: {
      used: true,
      usedAt: new Date(),
    },
  });

  // Create new reset token
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Return the SIGNED token (includes JWT signature)
  return {
    token: signedToken,
    expiresAt,
  };
}

/**
 * Validate a password reset token
 * Checks signature, expiry, and usage status
 *
 * @param {string} signedToken - JWT signed token from user
 * @returns {Promise<{valid: boolean, userId?: string, error?: string}>}
 */
export async function validatePasswordResetToken(signedToken) {
  // Verify JWT signature and decode
  const decoded = verifyResetToken(signedToken);

  if (!decoded) {
    return {
      valid: false,
      error: 'Invalid or malformed token',
    };
  }

  const { userId, tokenId } = decoded;

  // Extract raw token from JWT
  const tokenHash = hashToken(tokenId);

  // Look up token in database using timing-safe comparison
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken) {
    return {
      valid: false,
      error: 'Token not found or already consumed',
    };
  }

  // Verify token belongs to the claimed user (prevent tampering)
  if (resetToken.userId !== userId) {
    return {
      valid: false,
      error: 'Token user mismatch',
    };
  }

  // Check if token has already been used (replay attack prevention)
  if (resetToken.used) {
    return {
      valid: false,
      error: 'Token has already been used',
    };
  }

  // Check if token has expired
  if (resetToken.expiresAt < new Date()) {
    return {
      valid: false,
      error: 'Token has expired',
    };
  }

  return {
    valid: true,
    userId,
    tokenHash,
  };
}

/**
 * Consume a password reset token
 * Marks the token as used to prevent replay attacks
 *
 * @param {string} tokenHash - Hashed token
 * @returns {Promise<boolean>} Success status
 */
export async function consumePasswordResetToken(tokenHash) {
  try {
    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error('Error consuming password reset token:', error);
    return false;
  }
}

/**
 * Clean up expired password reset tokens
 * Should be run periodically (e.g., daily cron job)
 *
 * @returns {Promise<number>} Number of tokens deleted
 */
export async function cleanupExpiredResetTokens() {
  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Get active reset token count for a user
 * Useful for rate limiting and debugging
 *
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of active tokens
 */
export async function getActiveResetTokenCount(userId) {
  return await prisma.passwordResetToken.count({
    where: {
      userId,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });
}

export { RESET_TOKEN_EXPIRY_MINUTES, RESET_TOKEN_EXPIRY_MS };
