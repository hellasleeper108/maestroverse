/**
 * Passport.js OAuth Configuration
 *
 * Configures Google and GitHub OAuth strategies with account linking
 * to existing user profiles (matched by email).
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Find or create user from OAuth profile
 * Links to existing user if email matches
 */
async function findOrCreateOAuthUser(provider, profile, accessToken, refreshToken) {
  const email = profile.emails?.[0]?.value;
  const providerId = profile.id;
  const displayName = profile.displayName || profile.username;
  const profileUrl = profile.profileUrl || profile._json?.html_url;

  // Check if OAuth account already exists
  let oauthAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider,
        providerId,
      },
    },
    include: {
      user: true,
    },
  });

  if (oauthAccount) {
    // Update OAuth account with latest tokens and info
    oauthAccount = await prisma.oAuthAccount.update({
      where: { id: oauthAccount.id },
      data: {
        email,
        displayName,
        profileUrl,
        accessToken,
        refreshToken,
        expiresAt: null, // Set based on provider response if available
      },
      include: {
        user: true,
      },
    });

    return oauthAccount.user;
  }

  // Check if user exists with this email
  let user = null;
  if (email) {
    user = await prisma.user.findUnique({
      where: { email },
    });
  }

  if (user) {
    // Link OAuth account to existing user
    await prisma.oAuthAccount.create({
      data: {
        provider,
        providerId,
        email,
        displayName,
        profileUrl,
        accessToken,
        refreshToken,
        userId: user.id,
      },
    });

    console.log(`[OAUTH] Linked ${provider} account to existing user: ${user.email}`);
    return user;
  }

  // Create new user with OAuth account
  const username = email
    ? email.split('@')[0]
    : `${provider.toLowerCase()}_${providerId.substring(0, 8)}`;

  // Generate random password for OAuth-only users
  const randomPassword = await bcrypt.hash(Math.random().toString(36), 12);

  // Extract name from displayName
  const nameParts = displayName.split(' ');
  const firstName = nameParts[0] || username;
  const lastName = nameParts.slice(1).join(' ') || '';

  user = await prisma.user.create({
    data: {
      email: email || `${username}@oauth.local`,
      username,
      password: randomPassword,
      firstName,
      lastName,
      isVerified: true, // OAuth users are pre-verified
      oauthAccounts: {
        create: {
          provider,
          providerId,
          email,
          displayName,
          profileUrl,
          accessToken,
          refreshToken,
        },
      },
    },
  });

  console.log(`[OAUTH] Created new user from ${provider}: ${user.email}`);
  return user;
}

/**
 * Configure Google OAuth Strategy
 */
export function configureGoogleStrategy() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[OAUTH] Google OAuth not configured - missing credentials');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser('GOOGLE', profile, accessToken, refreshToken);
          done(null, user);
        } catch (error) {
          console.error('[OAUTH] Google authentication error:', error);
          done(error, null);
        }
      }
    )
  );

  console.log('[OAUTH] Google OAuth strategy configured');
}

/**
 * Configure GitHub OAuth Strategy
 */
export function configureGitHubStrategy() {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn('[OAUTH] GitHub OAuth not configured - missing credentials');
    return;
  }

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:
          process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser('GITHUB', profile, accessToken, refreshToken);
          done(null, user);
        } catch (error) {
          console.error('[OAUTH] GitHub authentication error:', error);
          done(error, null);
        }
      }
    )
  );

  console.log('[OAUTH] GitHub OAuth strategy configured');
}

/**
 * Serialize user for session
 * Note: We're using JWT tokens, but Passport requires these methods
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Initialize all OAuth strategies
 */
export function initializePassport() {
  configureGoogleStrategy();
  configureGitHubStrategy();
  console.log('[OAUTH] Passport.js initialized');
}

export default passport;
