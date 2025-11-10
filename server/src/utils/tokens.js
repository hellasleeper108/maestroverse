/**
 * Token Management Utilities - Enhanced Security
 *
 * Provides secure JWT access token and refresh token generation with:
 * - Token rotation on every refresh (single-use tokens)
 * - Per-device token tracking
 * - Hashed token storage (bcrypt)
 * - Reuse detection (security breach indicator)
 * - HTTP-only, Secure, SameSite=Strict cookies
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generate a JWT access token
 * @param {string} userId - User ID to encode in token
 * @returns {string} Signed JWT token
 */
export function generateAccessToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign({ userId, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generate a secure refresh token and store hashed version in database
 * @param {string} userId - User ID
 * @param {string} deviceId - Device identifier (e.g., fingerprint, UUID)
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<string>} Refresh token string (return to client)
 */
export async function generateRefreshToken(userId, deviceId, ipAddress, userAgent) {
  // Generate cryptographically secure random token
  const token = nanoid(64);

  // Hash the token before storing (like passwords)
  const tokenHash = await bcrypt.hash(token, 10);

  // Calculate expiration date
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  // Check if a token already exists for this user+device combination
  const existingToken = await prisma.refreshToken.findFirst({
    where: {
      userId,
      deviceId,
      isRevoked: false,
    },
  });

  // If exists, revoke it (we're replacing it)
  if (existingToken) {
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { isRevoked: true },
    });
  }

  // Store hashed token in database
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      deviceId,
      userId,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  // Return the plain token to send to client
  return token;
}

/**
 * Verify a refresh token from database
 * @param {string} token - Refresh token to verify
 * @returns {Promise<object|null>} Refresh token record or null if invalid
 */
export async function verifyRefreshToken(token) {
  try {
    // Fetch all non-revoked, non-expired tokens to check against
    const candidateTokens = await prisma.refreshToken.findMany({
      where: {
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            role: true,
            status: true,
            suspendedUntil: true,
          },
        },
      },
    });

    // Find matching token by comparing hash
    for (const candidate of candidateTokens) {
      const isMatch = await bcrypt.compare(token, candidate.tokenHash);
      if (isMatch) {
        return candidate;
      }
    }

    // No matching token found
    return null;
  } catch (error) {
    console.error('[TOKEN] Verification error:', error);
    return null;
  }
}

/**
 * Rotate refresh token (invalidate old, issue new)
 * This implements token rotation - each refresh token is single-use
 *
 * @param {string} oldToken - Current refresh token
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<object|null>} { accessToken, refreshToken, user } or null if invalid
 */
export async function rotateRefreshToken(oldToken, ipAddress, userAgent) {
  try {
    // Verify the old token
    const oldTokenRecord = await verifyRefreshToken(oldToken);

    if (!oldTokenRecord) {
      return null;
    }

    // CRITICAL SECURITY CHECK: Detect token reuse
    // If a token has already been replaced (replacedByTokenId is set),
    // this indicates a potential security breach (token theft/replay attack)
    if (oldTokenRecord.replacedByTokenId) {
      console.error(
        `[SECURITY] Refresh token reuse detected for user ${oldTokenRecord.userId}, device ${oldTokenRecord.deviceId}`
      );

      // Revoke ALL tokens for this user on this device as a security measure
      await prisma.refreshToken.updateMany({
        where: {
          userId: oldTokenRecord.userId,
          deviceId: oldTokenRecord.deviceId,
        },
        data: { isRevoked: true },
      });

      return null;
    }

    // Update lastUsedAt timestamp
    await prisma.refreshToken.update({
      where: { id: oldTokenRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Generate new access token
    const newAccessToken = generateAccessToken(oldTokenRecord.userId);

    // Generate new refresh token
    const newRefreshToken = await generateRefreshToken(
      oldTokenRecord.userId,
      oldTokenRecord.deviceId,
      ipAddress,
      userAgent
    );

    // Get the newly created token record to link the rotation chain
    const newTokenRecord = await prisma.refreshToken.findFirst({
      where: {
        userId: oldTokenRecord.userId,
        deviceId: oldTokenRecord.deviceId,
        isRevoked: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mark old token as replaced (but don't revoke yet - allows grace period)
    await prisma.refreshToken.update({
      where: { id: oldTokenRecord.id },
      data: {
        replacedByTokenId: newTokenRecord.id,
        isRevoked: true, // Immediately revoke to prevent reuse
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: oldTokenRecord.user,
    };
  } catch (error) {
    console.error('[TOKEN] Rotation error:', error);
    return null;
  }
}

/**
 * Revoke a specific refresh token by token string
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<boolean>} True if revoked successfully
 */
export async function revokeRefreshToken(token) {
  try {
    const tokenRecord = await verifyRefreshToken(token);
    if (!tokenRecord) {
      return false;
    }

    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });
    return true;
  } catch (error) {
    console.error('[TOKEN] Revocation error:', error);
    return false;
  }
}

/**
 * Revoke a specific device token for a user
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID to revoke
 * @returns {Promise<number>} Number of tokens revoked
 */
export async function revokeDeviceToken(userId, deviceId) {
  try {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        deviceId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
    return result.count;
  } catch (error) {
    console.error('[TOKEN] Device revocation error:', error);
    return 0;
  }
}

/**
 * Revoke all refresh tokens for a user (all devices)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of tokens revoked
 */
export async function revokeAllUserTokens(userId) {
  try {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return result.count;
  } catch (error) {
    console.error('[TOKEN] Bulk revocation error:', error);
    return 0;
  }
}

/**
 * Get all active sessions for a user (for session management UI)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of active session info
 */
export async function getUserSessions(userId) {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        deviceId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions;
  } catch (error) {
    console.error('[TOKEN] Session retrieval error:', error);
    return [];
  }
}

/**
 * Delete expired refresh tokens (cleanup job)
 * @returns {Promise<number>} Number of tokens deleted
 */
export async function cleanupExpiredTokens() {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`[TOKEN_CLEANUP] Deleted ${result.count} expired refresh tokens`);
    return result.count;
  } catch (error) {
    console.error('[TOKEN_CLEANUP] Error:', error);
    return 0;
  }
}

/**
 * Set token cookies on response
 * @param {object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Refresh token
 */
export function setTokenCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd, // HTTPS only in production
    sameSite: 'strict', // Always strict for maximum CSRF protection
    path: '/',
  };

  // Access token cookie (15 minutes)
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
  });

  // Refresh token cookie (7 days)
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_EXPIRY_MS, // 7 days in milliseconds
  });
}

/**
 * Clear token cookies
 * @param {object} res - Express response object
 */
export function clearTokenCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

/**
 * Extract tokens from request (checks cookies first, then Authorization header)
 * @param {object} req - Express request object
 * @returns {object} { accessToken, refreshToken }
 */
export function extractTokens(req) {
  let accessToken = null;
  let refreshToken = null;

  // First, check cookies (preferred method)
  if (req.cookies) {
    accessToken = req.cookies.accessToken || null;
    refreshToken = req.cookies.refreshToken || null;
  }

  // Fallback to Authorization header (for API clients)
  if (!accessToken && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }

  return { accessToken, refreshToken };
}

/**
 * Generate a device ID from request headers
 * In production, client should generate and persist a UUID
 * @param {object} req - Express request object
 * @returns {string} Device identifier
 */
export function generateDeviceId(req) {
  // In a real application, the client should generate a persistent UUID
  // and send it in a header (e.g., X-Device-ID)
  // This is a fallback that creates a fingerprint from user agent
  const deviceIdHeader = req.headers['x-device-id'];
  if (deviceIdHeader) {
    return deviceIdHeader;
  }

  // Fallback: create fingerprint from user agent (not ideal, but works)
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `fallback-${Buffer.from(userAgent).toString('base64').substring(0, 32)}`;
}
