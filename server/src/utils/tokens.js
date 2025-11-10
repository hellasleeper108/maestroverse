/**
 * Token Management Utilities
 *
 * Provides secure JWT access token and refresh token generation,
 * verification, and management with HTTP-only cookie support.
 */

import jwt from 'jsonwebtoken';
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
 * Generate a secure refresh token and store in database
 * @param {string} userId - User ID
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<string>} Refresh token string
 */
export async function generateRefreshToken(userId, ipAddress, userAgent) {
  // Generate cryptographically secure random token
  const token = nanoid(64);

  // Calculate expiration date
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  // Store token in database
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  return token;
}

/**
 * Verify and decode a JWT access token
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyAccessToken(token) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure this is an access token
    if (decoded.type !== 'access') {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token expired, invalid, or malformed
    return null;
  }
}

/**
 * Verify a refresh token from database
 * @param {string} token - Refresh token to verify
 * @returns {Promise<object|null>} Refresh token record or null if invalid
 */
export async function verifyRefreshToken(token) {
  try {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
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

    // Check if token exists
    if (!refreshToken) {
      return null;
    }

    // Check if token is revoked
    if (refreshToken.isRevoked) {
      return null;
    }

    // Check if token has expired
    if (new Date() > refreshToken.expiresAt) {
      // Clean up expired token
      await prisma.refreshToken.delete({
        where: { id: refreshToken.id },
      });
      return null;
    }

    return refreshToken;
  } catch (error) {
    console.error('Refresh token verification error:', error);
    return null;
  }
}

/**
 * Revoke a refresh token
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<boolean>} True if revoked successfully
 */
export async function revokeRefreshToken(token) {
  try {
    await prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
    return true;
  } catch (error) {
    console.error('Token revocation error:', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
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
    console.error('Bulk token revocation error:', error);
    return 0;
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
    sameSite: isProd ? 'strict' : 'lax',
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
