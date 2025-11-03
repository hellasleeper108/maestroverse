/**
 * Password Hashing Utility - Argon2id with HMAC Pepper
 *
 * Security Strategy:
 * 1. Argon2id algorithm (memory-hard, GPU-resistant, side-channel resistant)
 * 2. HMAC-SHA256 pepper applied before hashing (pepper stored in secrets)
 * 3. Per-password random salt (handled by argon2)
 * 4. Configurable cost parameters optimized for 2025 baseline
 */

import argon2 from 'argon2';
import crypto from 'crypto';
import zxcvbn from 'zxcvbn';

// Argon2id configuration (2025 OWASP recommendations)
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
};

/**
 * Get the pepper from environment/secrets
 * CRITICAL: This should be stored in Docker Secrets or KMS, never in .env committed to repo
 */
function getPepper() {
  const pepper = process.env.MAESTROVERSE_PEPPER;

  if (!pepper) {
    console.error('CRITICAL: MAESTROVERSE_PEPPER is not set!');
    throw new Error('Server misconfiguration: Password pepper not available');
  }

  if (pepper.length < 32) {
    console.warn('WARNING: MAESTROVERSE_PEPPER should be at least 32 bytes for security');
  }

  return pepper;
}

/**
 * Apply HMAC-SHA256 pepper to password before hashing
 * This adds an additional layer - even if DB is compromised, attacker needs the pepper
 */
function applyPepper(password) {
  const pepper = getPepper();
  return crypto
    .createHmac('sha256', pepper)
    .update(password)
    .digest('hex');
}

/**
 * Validate password strength and format
 * Returns { valid: boolean, errors: string[], score: number }
 */
export function validatePassword(password) {
  const errors = [];

  // Length check (12-256 bytes as per spec)
  if (typeof password !== 'string') {
    return { valid: false, errors: ['Password must be a string'], score: 0 };
  }

  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (byteLength > 256) {
    errors.push('Password must not exceed 256 characters');
  }

  // Null byte check (security)
  if (password.includes('\0')) {
    errors.push('Password contains invalid characters');
  }

  // Use zxcvbn for strength estimation
  const strength = zxcvbn(password);

  // Require minimum score of 3/4 (strong)
  if (strength.score < 3) {
    errors.push(`Password is too weak. ${strength.feedback.warning || 'Use a stronger password with more variety.'}`);
    if (strength.feedback.suggestions.length > 0) {
      errors.push(...strength.feedback.suggestions);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    score: strength.score,
    feedback: strength.feedback,
  };
}

/**
 * Hash password with Argon2id + pepper
 * Returns promise resolving to hash string
 */
export async function hashPassword(password) {
  // Validate password first
  const validation = validatePassword(password);
  if (!validation.valid) {
    const error = new Error('Password validation failed');
    error.validationErrors = validation.errors;
    throw error;
  }

  // Apply pepper via HMAC
  const pepperedPassword = applyPepper(password);

  // Hash with Argon2id
  const hash = await argon2.hash(pepperedPassword, ARGON2_OPTIONS);

  return hash;
}

/**
 * Verify password against hash
 * Returns promise resolving to boolean
 */
export async function verifyPassword(password, hash) {
  try {
    // Apply pepper
    const pepperedPassword = applyPepper(password);

    // Verify with Argon2
    const isValid = await argon2.verify(hash, pepperedPassword);

    return isValid;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Check if password hash needs rehashing (algorithm upgrade)
 * This allows gradual migration from bcrypt to argon2 on next login
 */
export function needsRehash(hash) {
  // Check if it's an old bcrypt hash (starts with $2a$, $2b$, $2y$)
  if (hash.startsWith('$2')) {
    return true;
  }

  // Check if Argon2 params are outdated (optional - for future upgrades)
  try {
    // Argon2 hashes start with $argon2id$
    if (!hash.startsWith('$argon2id$')) {
      return true;
    }

    // Could parse and check if memoryCost/timeCost needs upgrade
    // For now, we'll keep existing Argon2id hashes
    return false;
  } catch (error) {
    return true; // If we can't parse it, rehash
  }
}

/**
 * Generate a cryptographically secure random token
 * Used for email verification, password reset, etc.
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a, 'utf8'),
    Buffer.from(b, 'utf8')
  );
}
