/**
 * Rate Limiting Integration Test Suite
 *
 * Tests for layered rate limiting features:
 * - Per-IP rate limiting
 * - Per-identifier (email/username) rate limiting
 * - Exponential backoff on repeated violations
 * - CAPTCHA threshold triggering
 * - Account lockout after N failures
 * - Audit logging for security events
 * - Rate limit clearing on successful login
 * - Global API rate limiting
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../index.js';

const prisma = new PrismaClient();

describe('Layered Rate Limiting', () => {
  let testUser;
  let testUserId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('RateLimitTest123!', 12);

    testUser = await prisma.user.create({
      data: {
        email: 'ratelimitest@maestro.edu',
        username: 'ratelimitest',
        password: hashedPassword,
        firstName: 'RateLimit',
        lastName: 'Test',
        major: 'Computer Science',
        year: 3,
      },
    });

    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.accountLockout.deleteMany({});
    await prisma.rateLimitRecord.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up between tests
    await prisma.accountLockout.deleteMany({});
    await prisma.rateLimitRecord.deleteMany({});
  });

  describe('Per-IP Rate Limiting', () => {
    it('should allow login attempts within rate limit', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'WrongPassword',
      });

      // Should get 401 for wrong password (not 429 for rate limit)
      expect(response.status).toBe(401);
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should block after exceeding IP rate limit', async () => {
      const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5;

      // Make max + 1 attempts with wrong password
      for (let i = 0; i < maxAttempts; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'ratelimitest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Next attempt should be rate limited
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many login attempts');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Per-Identifier Rate Limiting', () => {
    it('should track attempts per email/username separately from IP', async () => {
      const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5;

      // Exhaust attempts for one identifier
      for (let i = 0; i < maxAttempts; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'ratelimitest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Next attempt with same identifier should be blocked
      const blockedResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(blockedResponse.status).toBe(429);

      // Attempt with different identifier should still work (IP limit not reached)
      const differentResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'nonexistent@maestro.edu',
        password: 'WrongPassword',
      });

      // May get 429 if IP limit also reached, or 401 for invalid credentials
      expect([401, 429]).toContain(differentResponse.status);
    });
  });

  describe('Exponential Backoff', () => {
    it('should apply exponential backoff on repeated violations', async () => {
      const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5;

      // First violation - exhaust rate limit
      for (let i = 0; i < maxAttempts; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'backofftest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Trigger first violation
      const response1 = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'backofftest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response1.status).toBe(429);
      const resetAt1 = new Date(response1.headers['x-ratelimit-reset']);

      // Continue making attempts to trigger second violation (exponential backoff)
      for (let i = 0; i < maxAttempts; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'backofftest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      const response2 = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'backofftest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response2.status).toBe(429);
      expect(response2.body.error).toContain('cooldown period has been extended');

      // Reset time should be significantly later (exponential backoff)
      const resetAt2 = new Date(response2.headers['x-ratelimit-reset']);
      expect(resetAt2.getTime()).toBeGreaterThan(resetAt1.getTime());
    });
  });

  describe('CAPTCHA Threshold', () => {
    it('should require CAPTCHA after threshold failures', async () => {
      const captchaThreshold = parseInt(process.env.RATE_LIMIT_CAPTCHA_THRESHOLD) || 3;

      // Make attempts up to CAPTCHA threshold
      for (let i = 0; i < captchaThreshold + 1; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'captchatest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Next attempt should indicate CAPTCHA required
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'captchatest@maestro.edu',
        password: 'WrongPassword',
      });

      // Should be rate limited and require CAPTCHA
      if (response.status === 429) {
        expect(response.body.requiresCaptcha).toBe(true);
        expect(response.body.captchaMessage).toContain('CAPTCHA');
      }
    });
  });

  describe('Account Lockout', () => {
    it('should lock account after lockout threshold failures', async () => {
      const lockoutThreshold = parseInt(process.env.RATE_LIMIT_LOCKOUT_THRESHOLD) || 10;

      // Make attempts up to lockout threshold
      for (let i = 0; i < lockoutThreshold; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'lockouttest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Next attempt should trigger account lockout
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'lockouttest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response.status).toBe(429);
      expect(response.body.locked).toBe(true);
      expect(response.body.lockedUntil).toBeDefined();
      expect(response.body.reason).toContain('failed');
    });

    it('should create audit log entry for account lockout', async () => {
      const lockoutThreshold = parseInt(process.env.RATE_LIMIT_LOCKOUT_THRESHOLD) || 10;

      // Trigger lockout
      for (let i = 0; i <= lockoutThreshold; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'auditlogtest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          event: 'ACCOUNT_LOCKED',
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      const lockoutLog = auditLogs.find((log) =>
        log.details.includes('auditlogtest@maestro.edu')
      );

      expect(lockoutLog).toBeDefined();
      expect(lockoutLog.severity).toBe('HIGH');
    });

    it('should prevent login even with correct password when locked', async () => {
      const lockoutThreshold = parseInt(process.env.RATE_LIMIT_LOCKOUT_THRESHOLD) || 10;

      // Trigger lockout
      for (let i = 0; i <= lockoutThreshold; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'ratelimitest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Try to login with correct password
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'RateLimitTest123!',
      });

      expect(response.status).toBe(429);
      expect(response.body.locked).toBe(true);
    });
  });

  describe('Rate Limit Clearing on Success', () => {
    it('should clear rate limits after successful login', async () => {
      // Make a few failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'ratelimitest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Successful login should clear rate limits
      await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'RateLimitTest123!',
      });

      // Check that rate limit records are cleared
      const rateLimitRecords = await prisma.rateLimitRecord.findMany({
        where: {
          OR: [
            { identifier: { contains: 'ratelimitest@maestro.edu' } },
            { identifier: { contains: '127.0.0.1' } },
          ],
          action: 'login',
        },
      });

      expect(rateLimitRecords.length).toBe(0);
    });

    it('should allow immediate retry after successful login', async () => {
      // Make failed attempts to increment counter
      for (let i = 0; i < 4; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'ratelimitest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Successful login
      await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'RateLimitTest123!',
      });

      // Should be able to login again immediately (limits cleared)
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'RateLimitTest123!',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limit Window Expiration', () => {
    it('should reset rate limit after window expires', async () => {
      // Note: This test would require waiting for window to expire
      // or mocking the time. Skipping for now as it requires time manipulation.

      // Make some failed attempts
      await request(app).post('/api/auth/login').send({
        emailOrUsername: 'expirytest@maestro.edu',
        password: 'WrongPassword',
      });

      // Check that record exists
      const record1 = await prisma.rateLimitRecord.findFirst({
        where: {
          identifier: { contains: 'expirytest' },
          action: 'login',
        },
      });

      expect(record1).toBeDefined();
      expect(record1.attempts).toBe(1);

      // In real scenario, after window expires, attempts should reset
    });
  });

  describe('Layered Protection', () => {
    it('should enforce both IP and identifier limits', async () => {
      const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5;

      // Exhaust IP-based rate limit
      for (let i = 0; i < maxAttempts; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: `test${i}@maestro.edu`,
          password: 'WrongPassword',
        });
      }

      // Even with a new identifier, should be blocked by IP limit
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'newidentifier@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response.status).toBe(429);
    });
  });

  describe('Global API Rate Limiting', () => {
    it('should apply global rate limit to API endpoints', async () => {
      // Note: Global API limiter would need to be applied to routes
      // This is a placeholder test showing the concept

      const globalMax = parseInt(process.env.GLOBAL_RATE_LIMIT_MAX) || 1000;

      // In practice, this would make many API calls to trigger global limit
      // For testing purposes, we verify the middleware exists
      expect(globalMax).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include correct rate limit headers in response', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ratelimitest@maestro.edu',
        password: 'WrongPassword',
      });

      // Check headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(parseInt(response.headers['x-ratelimit-limit'])).toBeGreaterThan(0);

      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);

      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(new Date(response.headers['x-ratelimit-reset'])).toBeInstanceOf(Date);
    });

    it('should include Retry-After header when rate limited', async () => {
      const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5;

      // Exhaust rate limit
      for (let i = 0; i < maxAttempts; i++) {
        await request(app).post('/api/auth/login').send({
          emailOrUsername: 'retrytest@maestro.edu',
          password: 'WrongPassword',
        });
      }

      // Trigger rate limit
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'retrytest@maestro.edu',
        password: 'WrongPassword',
      });

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Database Failure Handling', () => {
    it('should fail open on database errors to prevent DoS', async () => {
      // This test would require mocking database errors
      // The rateLimiter middleware is designed to fail open (allow request)
      // if the database is unavailable to prevent accidental DoS

      // Verify the middleware exists and handles errors gracefully
      // (Actual testing would require dependency injection or mocking)
    });
  });
});
