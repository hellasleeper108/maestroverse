/**
 * Token Security Test Suite
 *
 * Tests for JWT + refresh token security features:
 * - Token rotation on refresh
 * - Reused token detection (security breach)
 * - Expired token rejection
 * - Revoked token rejection
 * - Concurrent refresh attempts
 * - Per-device token tracking
 * - Device-specific logout
 * - Logout all devices
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../index.js';
import { generateRefreshToken, rotateRefreshToken } from '../utils/tokens.js';

const prisma = new PrismaClient();

describe('Token Security', () => {
  let testUser;
  let testUserId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('SecurePassword123!', 12);

    testUser = await prisma.user.create({
      data: {
        email: 'tokentest@maestro.edu',
        username: 'tokentest',
        password: hashedPassword,
        firstName: 'Token',
        lastName: 'Test',
        major: 'Computer Science',
        year: 3,
      },
    });

    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('Token Rotation', () => {
    it('should rotate refresh token on /refresh endpoint', async () => {
      // Login to get initial tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'tokentest@maestro.edu',
          password: 'SecurePassword123!',
        })
        .expect(200);

      const refreshTokenCookie = loginResponse.headers['set-cookie']?.find((cookie) =>
        cookie.startsWith('refreshToken=')
      );

      expect(refreshTokenCookie).toBeDefined();

      // Extract refresh token from cookie
      const oldRefreshToken = refreshTokenCookie.split('refreshToken=')[1].split(';')[0];

      // Wait a moment to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh the token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${oldRefreshToken}`)
        .expect(200);

      const newRefreshTokenCookie = refreshResponse.headers['set-cookie']?.find((cookie) =>
        cookie.startsWith('refreshToken=')
      );

      expect(newRefreshTokenCookie).toBeDefined();

      const newRefreshToken = newRefreshTokenCookie.split('refreshToken=')[1].split(';')[0];

      // New token should be different from old token
      expect(newRefreshToken).not.toBe(oldRefreshToken);

      // Old token should now be invalid (revoked)
      const reusedTokenResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${oldRefreshToken}`)
        .expect(401);

      expect(reusedTokenResponse.body.error).toBe('Invalid or expired refresh token');
    });

    it('should invalidate old token after rotation', async () => {
      // Generate a refresh token directly
      const refreshToken = await generateRefreshToken(testUserId, 'device-1', '127.0.0.1', 'Jest');

      // Rotate it
      const result = await rotateRefreshToken(refreshToken, '127.0.0.1', 'Jest');

      expect(result).not.toBeNull();
      expect(result.refreshToken).not.toBe(refreshToken);

      // Try to use the old token again - should fail
      const reuseResult = await rotateRefreshToken(refreshToken, '127.0.0.1', 'Jest');

      expect(reuseResult).toBeNull();
    });
  });

  describe('Reused Token Detection (Security Breach)', () => {
    it('should detect reused refresh token and revoke all device tokens', async () => {
      // Generate initial token
      const token1 = await generateRefreshToken(testUserId, 'breach-device', '127.0.0.1', 'Jest');

      // Rotate to get token2
      const rotation1 = await rotateRefreshToken(token1, '127.0.0.1', 'Jest');
      expect(rotation1).not.toBeNull();
      const token2 = rotation1.refreshToken;

      // Rotate again to get token3
      const rotation2 = await rotateRefreshToken(token2, '127.0.0.1', 'Jest');
      expect(rotation2).not.toBeNull();
      const token3 = rotation2.refreshToken;

      // Now try to reuse token2 (which was already replaced by token3)
      // This indicates a security breach (token theft/replay attack)
      const breachAttempt = await rotateRefreshToken(token2, '127.0.0.1', 'Jest');

      expect(breachAttempt).toBeNull();

      // All tokens for this device should be revoked now
      const token3Attempt = await rotateRefreshToken(token3, '127.0.0.1', 'Jest');

      expect(token3Attempt).toBeNull();
    });
  });

  describe('Expired Token Rejection', () => {
    it('should reject expired refresh token', async () => {
      // Create a refresh token with immediate expiration
      const expiresAt = new Date(Date.now() - 1000); // 1 second ago

      const expiredTokenRecord = await prisma.refreshToken.create({
        data: {
          tokenHash: await bcrypt.hash('expired-token-test', 10),
          deviceId: 'expired-device',
          userId: testUserId,
          expiresAt,
          ipAddress: '127.0.0.1',
          userAgent: 'Jest',
        },
      });

      expect(expiredTokenRecord.expiresAt).toBeLessThan(new Date());

      // Try to use the expired token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'expired-token-test' })
        .expect(401);

      expect(refreshResponse.body.error).toBe('Invalid or expired refresh token');
    });
  });

  describe('Revoked Token Rejection', () => {
    it('should reject manually revoked refresh token', async () => {
      // Generate a valid token
      const refreshToken = await generateRefreshToken(
        testUserId,
        'revoked-device',
        '127.0.0.1',
        'Jest'
      );

      // Manually revoke it
      const tokenRecord = await prisma.refreshToken.findFirst({
        where: {
          userId: testUserId,
          deviceId: 'revoked-device',
        },
      });

      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });

      // Try to use the revoked token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body.error).toBe('Invalid or expired refresh token');
    });
  });

  describe('Concurrent Refresh Attempts', () => {
    it('should handle concurrent refresh attempts gracefully', async () => {
      // Generate initial token
      const refreshToken = await generateRefreshToken(
        testUserId,
        'concurrent-device',
        '127.0.0.1',
        'Jest'
      );

      // Simulate concurrent refresh attempts
      const [result1, result2, result3] = await Promise.all([
        rotateRefreshToken(refreshToken, '127.0.0.1', 'Jest'),
        rotateRefreshToken(refreshToken, '127.0.0.1', 'Jest'),
        rotateRefreshToken(refreshToken, '127.0.0.1', 'Jest'),
      ]);

      // Only ONE should succeed, others should fail
      const successCount = [result1, result2, result3].filter((r) => r !== null).length;
      const failCount = [result1, result2, result3].filter((r) => r === null).length;

      // Due to race conditions, exactly one should succeed
      // The others will fail because the token was already rotated/revoked
      expect(successCount).toBe(1);
      expect(failCount).toBe(2);
    });
  });

  describe('Per-Device Token Tracking', () => {
    it('should track tokens per device', async () => {
      // Generate tokens for multiple devices
      const token1 = await generateRefreshToken(testUserId, 'device-alpha', '127.0.0.1', 'Chrome');
      const token2 = await generateRefreshToken(
        testUserId,
        'device-beta',
        '192.168.1.1',
        'Firefox'
      );
      const token3 = await generateRefreshToken(testUserId, 'device-gamma', '10.0.0.1', 'Safari');

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token3).toBeDefined();

      // Verify all tokens exist in database
      const deviceTokens = await prisma.refreshToken.findMany({
        where: {
          userId: testUserId,
          deviceId: { in: ['device-alpha', 'device-beta', 'device-gamma'] },
          isRevoked: false,
        },
      });

      expect(deviceTokens.length).toBe(3);

      // Verify each device has correct metadata
      const alphaToken = deviceTokens.find((t) => t.deviceId === 'device-alpha');
      expect(alphaToken.userAgent).toBe('Chrome');
      expect(alphaToken.ipAddress).toBe('127.0.0.1');

      const betaToken = deviceTokens.find((t) => t.deviceId === 'device-beta');
      expect(betaToken.userAgent).toBe('Firefox');
      expect(betaToken.ipAddress).toBe('192.168.1.1');
    });

    it('should replace old token when generating new token for same device', async () => {
      // Generate first token for device
      const token1 = await generateRefreshToken(
        testUserId,
        'device-replace',
        '127.0.0.1',
        'Chrome'
      );

      // Verify token exists
      const tokens1 = await prisma.refreshToken.findMany({
        where: {
          userId: testUserId,
          deviceId: 'device-replace',
          isRevoked: false,
        },
      });

      expect(tokens1.length).toBe(1);

      // Generate second token for same device
      const token2 = await generateRefreshToken(
        testUserId,
        'device-replace',
        '127.0.0.1',
        'Chrome'
      );

      expect(token2).not.toBe(token1);

      // Old token should be revoked, only new token active
      const tokens2 = await prisma.refreshToken.findMany({
        where: {
          userId: testUserId,
          deviceId: 'device-replace',
          isRevoked: false,
        },
      });

      expect(tokens2.length).toBe(1);
    });
  });

  describe('Device-Specific Logout', () => {
    it('should logout from specific device via /logout-device', async () => {
      // Login from device 1
      const login1 = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'tokentest@maestro.edu',
        password: 'SecurePassword123!',
      });

      const token1 = login1.headers['set-cookie']?.find((c) => c.startsWith('accessToken='));

      // Generate token for device 2 manually
      await generateRefreshToken(testUserId, 'logout-device-2', '127.0.0.1', 'Jest');

      // Logout from device 2 using device 1's session
      const accessToken = token1.split('accessToken=')[1].split(';')[0];

      const logoutResponse = await request(app)
        .post('/api/auth/logout-device')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: 'logout-device-2' })
        .expect(200);

      expect(logoutResponse.body.message).toContain('Logged out from device');

      // Verify device 2 tokens are revoked
      const device2Tokens = await prisma.refreshToken.findMany({
        where: {
          userId: testUserId,
          deviceId: 'logout-device-2',
          isRevoked: false,
        },
      });

      expect(device2Tokens.length).toBe(0);
    });

    it('should return 404 when logging out non-existent device', async () => {
      // Login to get access token
      const loginResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'tokentest@maestro.edu',
        password: 'SecurePassword123!',
      });

      const accessTokenCookie = loginResponse.headers['set-cookie']?.find((c) =>
        c.startsWith('accessToken=')
      );
      const accessToken = accessTokenCookie.split('accessToken=')[1].split(';')[0];

      // Try to logout from non-existent device
      const logoutResponse = await request(app)
        .post('/api/auth/logout-device')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: 'non-existent-device-xyz' })
        .expect(404);

      expect(logoutResponse.body.error).toBe('No active session found for this device');
    });
  });

  describe('Logout All Devices', () => {
    it('should revoke all user tokens via /logout-all', async () => {
      // Generate tokens for multiple devices
      await generateRefreshToken(testUserId, 'logout-all-1', '127.0.0.1', 'Chrome');
      await generateRefreshToken(testUserId, 'logout-all-2', '192.168.1.1', 'Firefox');
      await generateRefreshToken(testUserId, 'logout-all-3', '10.0.0.1', 'Safari');

      // Login to get access token
      const loginResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'tokentest@maestro.edu',
        password: 'SecurePassword123!',
      });

      const accessTokenCookie = loginResponse.headers['set-cookie']?.find((c) =>
        c.startsWith('accessToken=')
      );
      const accessToken = accessTokenCookie.split('accessToken=')[1].split(';')[0];

      // Logout from all devices
      const logoutResponse = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body.message).toContain('sessions terminated');

      // Verify all tokens are revoked
      const activeTokens = await prisma.refreshToken.findMany({
        where: {
          userId: testUserId,
          isRevoked: false,
        },
      });

      expect(activeTokens.length).toBe(0);
    });
  });

  describe('Session Listing', () => {
    it('should list all active sessions via /sessions', async () => {
      // Generate tokens for multiple devices
      await generateRefreshToken(testUserId, 'session-list-1', '127.0.0.1', 'Chrome/Mac');
      await generateRefreshToken(testUserId, 'session-list-2', '192.168.1.1', 'Firefox/Windows');
      await generateRefreshToken(testUserId, 'session-list-3', '10.0.0.1', 'Safari/iPhone');

      // Login to get access token
      const loginResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'tokentest@maestro.edu',
        password: 'SecurePassword123!',
      });

      const accessTokenCookie = loginResponse.headers['set-cookie']?.find((c) =>
        c.startsWith('accessToken=')
      );
      const accessToken = accessTokenCookie.split('accessToken=')[1].split(';')[0];

      // Get sessions list
      const sessionsResponse = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(sessionsResponse.body.sessions).toBeDefined();
      expect(Array.isArray(sessionsResponse.body.sessions)).toBe(true);
      expect(sessionsResponse.body.sessions.length).toBeGreaterThanOrEqual(3);

      // Verify session details
      const sessions = sessionsResponse.body.sessions;
      const chromeSession = sessions.find((s) => s.deviceId === 'session-list-1');

      expect(chromeSession).toBeDefined();
      expect(chromeSession.userAgent).toBe('Chrome/Mac');
      expect(chromeSession.ipAddress).toBe('127.0.0.1');
      expect(chromeSession.expiresAt).toBeDefined();
    });

    it('should mark current session in session list', async () => {
      // Login to create session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Mozilla/5.0 TestBrowser')
        .send({
          emailOrUsername: 'tokentest@maestro.edu',
          password: 'SecurePassword123!',
        })
        .expect(200);

      const accessTokenCookie = loginResponse.headers['set-cookie']?.find((c) =>
        c.startsWith('accessToken=')
      );
      const accessToken = accessTokenCookie.split('accessToken=')[1].split(';')[0];

      // Get sessions
      const sessionsResponse = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('User-Agent', 'Mozilla/5.0 TestBrowser')
        .expect(200);

      const sessions = sessionsResponse.body.sessions;

      // At least one session should be marked as current
      const currentSession = sessions.find((s) => s.isCurrent === true);

      expect(currentSession).toBeDefined();
    });
  });

  describe('Token Hashing', () => {
    it('should store refresh tokens as hashed values', async () => {
      const refreshToken = await generateRefreshToken(
        testUserId,
        'hash-test-device',
        '127.0.0.1',
        'Jest'
      );

      // Find the token record in database
      const tokenRecord = await prisma.refreshToken.findFirst({
        where: {
          userId: testUserId,
          deviceId: 'hash-test-device',
        },
      });

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.tokenHash).toBeDefined();

      // Hashed value should NOT match plain token
      expect(tokenRecord.tokenHash).not.toBe(refreshToken);

      // Hash should be bcrypt format (starts with $2a$ or $2b$)
      expect(tokenRecord.tokenHash).toMatch(/^\$2[ab]\$\d{2}\$/);
    });
  });
});
