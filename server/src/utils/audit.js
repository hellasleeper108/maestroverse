/**
 * Audit Logging Utility
 *
 * Centralized security event logging for compliance and forensics.
 * All sensitive operations are logged with context but without exposing secrets.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Log security-relevant action
 * @param {Object} options - Logging options
 * @param {string} options.action - Action type (LOGIN, LOGOUT, PASSWORD_CHANGE, etc.)
 * @param {string} [options.userId] - User ID if authenticated
 * @param {Object} [options.req] - Express request object
 * @param {boolean} [options.success=true] - Whether action succeeded
 * @param {string} [options.errorMessage] - Error message if failed
 * @param {Object} [options.metadata] - Additional context (will be JSON serialized)
 */
export async function logAudit({
  action,
  userId = null,
  req = null,
  success = true,
  errorMessage = null,
  metadata = null,
}) {
  try {
    const logData = {
      action,
      userId,
      success,
      errorMessage,
    };

    // Extract safe request information
    if (req) {
      logData.ipAddress = req.ip || req.connection?.remoteAddress;
      logData.userAgent = req.get('user-agent');

      // Sanitize metadata - never log passwords, tokens, or secrets
      if (metadata) {
        const sanitized = { ...metadata };
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.secret;
        delete sanitized.oldPassword;
        delete sanitized.newPassword;
        logData.metadata = JSON.stringify(sanitized);
      }
    }

    await prisma.auditLog.create({
      data: logData,
    });
  } catch (error) {
    // Never let audit logging break the request flow
    console.error('[AUDIT] Failed to log:', error);
  }
}

/**
 * Common audit actions
 */
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',

  // Password management
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',

  // Account verification
  EMAIL_VERIFICATION_SENT: 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',

  // MFA
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_CHALLENGE_SUCCESS: 'MFA_CHALLENGE_SUCCESS',
  MFA_CHALLENGE_FAILED: 'MFA_CHALLENGE_FAILED',

  // Security events
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',

  // Session management
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_DESTROYED: 'SESSION_DESTROYED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};

/**
 * Helper to log authentication attempts
 */
export async function logAuthAttempt(req, userId, success, errorMessage = null) {
  await logAudit({
    action: success ? AUDIT_ACTIONS.LOGIN_SUCCESS : AUDIT_ACTIONS.LOGIN_FAILED,
    userId,
    req,
    success,
    errorMessage,
    metadata: {
      emailOrUsername: req.body?.emailOrUsername, // Safe to log (not password)
    },
  });
}
