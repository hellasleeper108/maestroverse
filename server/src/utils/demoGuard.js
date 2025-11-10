/**
 * Demo User Protection Utilities
 *
 * Protects production environments from demo/seed data by:
 * - Preventing seed script execution in production (unless explicitly allowed)
 * - Blocking demo user logins in production
 * - Providing utilities to identify demo accounts
 *
 * Security rationale:
 * - Demo accounts have well-known credentials (password123)
 * - These credentials are publicly documented in README/docs
 * - Allowing demo logins in production is a critical security vulnerability
 */

/**
 * List of known demo user emails
 * These are created by the seed script and have well-known passwords
 */
export const DEMO_USER_EMAILS = [
  'admin@maestro.edu',
  'moderator@maestro.edu',
  'faculty@maestro.edu',
  'alice@maestro.edu',
  'bob@maestro.edu',
  'carol@maestro.edu',
];

/**
 * List of known demo usernames
 * Alternative identifiers for demo accounts
 */
export const DEMO_USERNAMES = [
  'admin',
  'mod_sarah',
  'prof_johnson',
  'alice_wonder',
  'bob_builder',
  'carol_creative',
];

/**
 * Check if a user identifier (email or username) is a demo account
 * @param {string} identifier - Email or username to check
 * @returns {boolean} True if identifier belongs to a demo account
 */
export function isDemoUser(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return false;
  }

  const lowerIdentifier = identifier.toLowerCase();

  // Check if it's a demo email
  if (DEMO_USER_EMAILS.some((email) => email.toLowerCase() === lowerIdentifier)) {
    return true;
  }

  // Check if it's a demo username
  if (DEMO_USERNAMES.some((username) => username.toLowerCase() === lowerIdentifier)) {
    return true;
  }

  return false;
}

/**
 * Check if seeding is allowed in the current environment
 * @returns {boolean} True if seeding is allowed
 */
export function isSeedingAllowed() {
  const env = process.env.NODE_ENV;
  const allowDemo = process.env.ALLOW_DEMO;

  // Always allow in development and test
  if (env === 'development' || env === 'test') {
    return true;
  }

  // In production, only allow if ALLOW_DEMO=1 is explicitly set
  if (env === 'production') {
    return allowDemo === '1' || allowDemo === 'true';
  }

  // Default: allow for unknown environments
  return true;
}

/**
 * Check if demo user logins are allowed in the current environment
 * @returns {boolean} True if demo logins are allowed
 */
export function areDemoLoginsAllowed() {
  const env = process.env.NODE_ENV;
  const allowDemo = process.env.ALLOW_DEMO;

  // Always allow in development and test
  if (env === 'development' || env === 'test') {
    return true;
  }

  // In production, only allow if ALLOW_DEMO=1 is explicitly set
  if (env === 'production') {
    return allowDemo === '1' || allowDemo === 'true';
  }

  // Default: block for unknown environments (safer)
  return false;
}

/**
 * Get environment information for error messages
 * @returns {object} Environment status
 */
export function getEnvironmentStatus() {
  return {
    env: process.env.NODE_ENV || 'unknown',
    allowDemo: process.env.ALLOW_DEMO || 'not set',
    seedingAllowed: isSeedingAllowed(),
    demoLoginsAllowed: areDemoLoginsAllowed(),
  };
}

/**
 * Validate that the environment is safe for production
 * Throws an error if demo data is accessible in production without explicit override
 * @throws {Error} If production environment is misconfigured
 */
export function validateProductionSafety() {
  const env = process.env.NODE_ENV;

  if (env !== 'production') {
    return; // Not production, no validation needed
  }

  const allowDemo = process.env.ALLOW_DEMO;

  if (allowDemo === '1' || allowDemo === 'true') {
    console.warn('\n' + '='.repeat(80));
    console.warn('⚠️  WARNING: Demo accounts enabled in production!');
    console.warn('='.repeat(80));
    console.warn('ALLOW_DEMO=1 is set in production environment.');
    console.warn('Demo accounts with well-known passwords are accessible.');
    console.warn('This is a CRITICAL SECURITY VULNERABILITY.');
    console.warn('');
    console.warn('Demo accounts:');
    DEMO_USER_EMAILS.forEach((email) => {
      console.warn(`  - ${email} (password: password123)`);
    });
    console.warn('');
    console.warn('To fix: Remove ALLOW_DEMO=1 from production .env file');
    console.warn('='.repeat(80) + '\n');
  }
}

/**
 * Express middleware to block demo user logins in production
 * @returns {Function} Express middleware
 */
export function blockDemoLoginsInProduction() {
  return (req, res, next) => {
    // Only enforce in production without ALLOW_DEMO=1
    if (areDemoLoginsAllowed()) {
      return next();
    }

    // Check if this is a login request
    if (req.method === 'POST' && req.path === '/login') {
      const { emailOrUsername } = req.body;

      if (isDemoUser(emailOrUsername)) {
        return res.status(403).json({
          error: 'Demo accounts are disabled in production',
          message:
            'For security reasons, demo accounts with well-known passwords are not accessible in production environments.',
        });
      }
    }

    next();
  };
}

export default {
  DEMO_USER_EMAILS,
  DEMO_USERNAMES,
  isDemoUser,
  isSeedingAllowed,
  areDemoLoginsAllowed,
  getEnvironmentStatus,
  validateProductionSafety,
  blockDemoLoginsInProduction,
};
