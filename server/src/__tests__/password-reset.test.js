/**
 * Password Reset Security Test Suite
 *
 * Comprehensive tests for secure password reset functionality:
 * - Replay attack prevention (single-use tokens)
 * - Expired token handling (15-minute TTL)
 * - Token leak resilience (safe even if leaked after use)
 * - Invalid/tampered token rejection
 * - JWT signature verification
 * - Rate limiting enforcement
 * - Refresh token rotation on reset
 * - Email enumeration prevention
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../index.js';
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  RESET_TOKEN_EXPIRY_MS,
} from '../utils/passwordReset.js';

const prisma = new PrismaClient();

describe('Password Reset Security', () => {
  let testUser;
  let testUserPassword = 'OriginalPassword123!';

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash(testUserPassword, 12);
    testUser = await prisma.user.create({
      data: {
        email: 'resettest@maestro.edu',
        username: 'resettestuser',
        password: hashedPassword,
        firstName: 'Reset',
        lastName: 'Test',
        major: 'Computer Science',
        year: 2,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up reset tokens after each test
    await prisma.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
  });

  // ==========================================================================
  // REQUEST RESET TOKEN TESTS
  // ==========================================================================

  describe('POST /api/auth/request-reset', () => {
    it('should successfully request a password reset for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.message).toContain('password reset link has been sent');
      expect(response.body.expiresIn).toBe('15 minutes');

      // Verify token was created in database
      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens.length).toBe(1);
      expect(tokens[0].used).toBe(false);
      expect(tokens[0].expiresAt).toBeInstanceOf(Date);
    });

    it('should return token in development mode for testing', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT reveal if email does not exist (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'nonexistent@maestro.edu' })
        .expect(200);

      // Same success message even for non-existent email
      expect(response.body.message).toContain('password reset link has been sent');

      // Verify no token was created
      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens.length).toBe(0);
    });

    it('should invalidate previous unused tokens when requesting new one', async () => {
      // Request first token
      await request(app)
        .post('/api/auth/request-reset')
        .send({ email: testUser.email })
        .expect(200);

      const firstTokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id, used: false },
      });
      expect(firstTokens.length).toBe(1);

      // Request second token
      await request(app)
        .post('/api/auth/request-reset')
        .send({ email: testUser.email })
        .expect(200);

      // First token should be marked as used
      const allTokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });
      const unusedTokens = allTokens.filter((t) => !t.used);

      expect(allTokens.length).toBe(2);
      expect(unusedTokens.length).toBe(1);
    });

    it('should require valid email format', async () => {
      const response = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: '' })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should enforce rate limiting', async () => {
      // Make multiple requests in quick succession
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app).post('/api/auth/request-reset').send({ email: testUser.email })
        );
      }

      const responses = await Promise.all(requests);

      // Some should be rate limited (429)
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // RESET PASSWORD TESTS
  // ==========================================================================

  describe('POST /api/auth/reset', () => {
    it('should successfully reset password with valid token', async () => {
      // Request reset token
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Reset password
      const newPassword = 'NewSecurePassword123!';
      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword })
        .expect(200);

      expect(response.body.message).toContain('reset successfully');

      // Verify password was changed
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isMatch).toBe(true);

      // Verify token was marked as used
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { userId: testUser.id },
      });
      expect(resetToken.used).toBe(true);
      expect(resetToken.usedAt).toBeInstanceOf(Date);
    });

    it('should require minimum password length', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'short' })
        .expect(400);

      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should require valid token format', async () => {
      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token: '', newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toContain('token is required');
    });
  });

  // ==========================================================================
  // REPLAY ATTACK PREVENTION (KEY TEST)
  // ==========================================================================

  describe('Replay Attack Prevention', () => {
    it('should reject token after first use (replay attack)', async () => {
      // Request reset token
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // First use - should succeed
      const firstReset = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'FirstPassword123!' })
        .expect(200);

      expect(firstReset.body.message).toContain('reset successfully');

      // Second use - should fail (replay attack)
      const secondReset = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'SecondPassword123!' })
        .expect(400);

      expect(secondReset.body.error).toContain('already been used');
    });

    it('should prevent multiple concurrent uses of same token', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Attempt to use token multiple times concurrently
      const resetPromises = [
        request(app)
          .post('/api/auth/reset')
          .send({ token, newPassword: 'Password1!' }),
        request(app)
          .post('/api/auth/reset')
          .send({ token, newPassword: 'Password2!' }),
        request(app)
          .post('/api/auth/reset')
          .send({ token, newPassword: 'Password3!' }),
      ];

      const results = await Promise.all(resetPromises);

      // Only one should succeed, others should fail
      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);
    });
  });

  // ==========================================================================
  // EXPIRED TOKEN TESTS (KEY TEST)
  // ==========================================================================

  describe('Expired Token Handling', () => {
    it('should reject expired token', async () => {
      // Create token that expires immediately
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Manually expire the token in database
      await prisma.passwordResetToken.updateMany({
        where: { userId: testUser.id },
        data: { expiresAt: new Date(Date.now() - 1000) }, // Expired 1 second ago
      });

      // Attempt to use expired token
      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toContain('expired');
    });

    it('should accept token within 15-minute window', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Verify token is not expired
      const validation = await validatePasswordResetToken(token);
      expect(validation.valid).toBe(true);

      // Use token immediately (within window)
      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(200);

      expect(response.body.message).toContain('reset successfully');
    });

    it('should reject token exactly at expiration time', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Set expiration to exactly now
      await prisma.passwordResetToken.updateMany({
        where: { userId: testUser.id },
        data: { expiresAt: new Date() },
      });

      // Wait a tiny bit to ensure time has passed
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toContain('expired');
    });
  });

  // ==========================================================================
  // TOKEN LEAK RESILIENCE (KEY TEST)
  // ==========================================================================

  describe('Token Leak Resilience', () => {
    it('should be safe even if token leaked after first use', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // User A uses token legitimately
      await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'LegitimatePassword123!' })
        .expect(200);

      // Attacker B gets leaked token and tries to use it
      const attackerAttempt = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'AttackerPassword123!' })
        .expect(400);

      expect(attackerAttempt.body.error).toContain('already been used');

      // Verify password is still the legitimate one
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      const isLegitimate = await bcrypt.compare('LegitimatePassword123!', user.password);
      const isAttacker = await bcrypt.compare('AttackerPassword123!', user.password);

      expect(isLegitimate).toBe(true);
      expect(isAttacker).toBe(false);
    });

    it('should invalidate token even if database is compromised', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Simulate attacker who has database access but only sees hash
      const dbToken = await prisma.passwordResetToken.findFirst({
        where: { userId: testUser.id },
      });

      // Attacker has tokenHash but cannot reverse it
      // They cannot use the hash directly
      const attackerAttempt = await request(app)
        .post('/api/auth/reset')
        .send({ token: dbToken.tokenHash, newPassword: 'AttackerPassword123!' })
        .expect(400);

      expect(attackerAttempt.body.error).toBeDefined();

      // Legitimate user can still use token
      await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'LegitimatePassword123!' })
        .expect(200);
    });
  });

  // ==========================================================================
  // JWT SIGNATURE VERIFICATION
  // ==========================================================================

  describe('JWT Signature Verification', () => {
    it('should reject tampered token (invalid signature)', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Tamper with token by modifying payload
      const decoded = jwt.decode(token);
      const tamperedToken = jwt.sign(
        { ...decoded, userId: 'different-user-id' },
        'wrong-secret'
      );

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token: tamperedToken, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject malformed token', async () => {
      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token: 'not-a-valid-jwt-token', newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject token with wrong type', async () => {
      // Create token with wrong type
      const wrongTypeToken = jwt.sign(
        {
          userId: testUser.id,
          tokenId: 'some-token',
          type: 'email_verification', // Wrong type
          exp: Math.floor((Date.now() + RESET_TOKEN_EXPIRY_MS) / 1000),
        },
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token: wrongTypeToken, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  // ==========================================================================
  // REFRESH TOKEN ROTATION
  // ==========================================================================

  describe('Refresh Token Rotation on Password Reset', () => {
    it('should invalidate all refresh tokens when password is reset', async () => {
      // Create multiple refresh tokens (simulate multiple devices)
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        const refreshToken = await prisma.refreshToken.create({
          data: {
            userId: testUser.id,
            token: `refresh-token-${i}`,
            deviceId: `device-${i}`,
            deviceName: `Device ${i}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        tokens.push(refreshToken);
      }

      // Verify tokens exist
      const beforeReset = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });
      expect(beforeReset.length).toBe(3);

      // Reset password
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');
      await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(200);

      // Verify all refresh tokens are deleted
      const afterReset = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });
      expect(afterReset.length).toBe(0);
    });

    it('should force re-login after password reset', async () => {
      // Login and get refresh token
      const loginResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: testUser.email,
        password: testUserPassword,
      });

      const refreshToken = loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // Reset password
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');
      await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(200);

      // Try to use old refresh token - should fail
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body.error).toContain('Invalid or expired refresh token');

      // Update test user password for cleanup
      testUserPassword = 'NewPassword123!';
    });
  });

  // ==========================================================================
  // AUDIT LOGGING
  // ==========================================================================

  describe('Audit Logging', () => {
    it('should create audit log entry for password reset', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(200);

      // Verify audit log was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId: testUser.id,
          event: 'PASSWORD_RESET',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.severity).toBe('MEDIUM');
      expect(auditLog.success).toBe(true);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle non-existent user ID in token', async () => {
      // Create token with non-existent user ID
      const fakeToken = jwt.sign(
        {
          userId: 'non-existent-user-id',
          tokenId: 'some-token',
          type: 'password_reset',
          exp: Math.floor((Date.now() + RESET_TOKEN_EXPIRY_MS) / 1000),
        },
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token: fakeToken, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle banned user attempting password reset', async () => {
      // Ban user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'BANNED' },
      });

      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(403);

      expect(response.body.error).toContain('banned');

      // Restore user status
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'ACTIVE' },
      });
    });

    it('should handle database transaction failure gracefully', async () => {
      const { token } = await createPasswordResetToken(testUser.id, '127.0.0.1', 'test');

      // Delete user to cause transaction failure
      await prisma.user.delete({ where: { id: testUser.id } });

      const response = await request(app)
        .post('/api/auth/reset')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(400);

      expect(response.body.error).toContain('User not found');

      // Restore user for other tests
      const hashedPassword = await bcrypt.hash(testUserPassword, 12);
      testUser = await prisma.user.create({
        data: {
          id: testUser.id,
          email: testUser.email,
          username: testUser.username,
          password: hashedPassword,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          major: testUser.major,
          year: testUser.year,
        },
      });
    });
  });
});
