/**
 * Demo User Protection Test Suite
 *
 * Comprehensive tests for demo user protection system:
 * - Demo accounts blocked in production (unless ALLOW_DEMO=1)
 * - Demo accounts allowed in development
 * - Seeding blocked in production (unless ALLOW_DEMO=1)
 * - Seeding allowed in development
 * - Proper error messages and security warnings
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../index.js';
import {
  isDemoUser,
  isSeedingAllowed,
  areDemoLoginsAllowed,
  DEMO_USER_EMAILS,
  DEMO_USERNAMES,
} from '../utils/demoGuard.js';

const prisma = new PrismaClient();

describe('Demo User Protection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    prisma.$disconnect();
  });

  // ==========================================================================
  // UTILITY FUNCTION TESTS
  // ==========================================================================

  describe('isDemoUser', () => {
    it('should identify demo emails correctly', () => {
      expect(isDemoUser('alice@maestro.edu')).toBe(true);
      expect(isDemoUser('bob@maestro.edu')).toBe(true);
      expect(isDemoUser('carol@maestro.edu')).toBe(true);
      expect(isDemoUser('admin@maestro.edu')).toBe(true);
      expect(isDemoUser('moderator@maestro.edu')).toBe(true);
      expect(isDemoUser('faculty@maestro.edu')).toBe(true);
    });

    it('should identify demo usernames correctly', () => {
      expect(isDemoUser('alice_wonder')).toBe(true);
      expect(isDemoUser('bob_builder')).toBe(true);
      expect(isDemoUser('carol_creative')).toBe(true);
      expect(isDemoUser('admin')).toBe(true);
      expect(isDemoUser('mod_sarah')).toBe(true);
      expect(isDemoUser('prof_johnson')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isDemoUser('ALICE@maestro.edu')).toBe(true);
      expect(isDemoUser('Alice_Wonder')).toBe(true);
      expect(isDemoUser('ADMIN')).toBe(true);
    });

    it('should identify non-demo users correctly', () => {
      expect(isDemoUser('realuser@maestro.edu')).toBe(false);
      expect(isDemoUser('john_doe')).toBe(false);
      expect(isDemoUser('student123')).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isDemoUser(null)).toBe(false);
      expect(isDemoUser(undefined)).toBe(false);
      expect(isDemoUser('')).toBe(false);
      expect(isDemoUser(123)).toBe(false);
    });

    it('should maintain complete list of demo users', () => {
      // Ensure all expected demo accounts are in the list
      const expectedEmails = [
        'admin@maestro.edu',
        'moderator@maestro.edu',
        'faculty@maestro.edu',
        'alice@maestro.edu',
        'bob@maestro.edu',
        'carol@maestro.edu',
      ];

      expectedEmails.forEach((email) => {
        expect(DEMO_USER_EMAILS).toContain(email);
      });

      const expectedUsernames = [
        'admin',
        'mod_sarah',
        'prof_johnson',
        'alice_wonder',
        'bob_builder',
        'carol_creative',
      ];

      expectedUsernames.forEach((username) => {
        expect(DEMO_USERNAMES).toContain(username);
      });
    });
  });

  describe('isSeedingAllowed', () => {
    it('should allow seeding in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isSeedingAllowed()).toBe(true);
    });

    it('should allow seeding in test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isSeedingAllowed()).toBe(true);
    });

    it('should block seeding in production by default', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO;
      expect(isSeedingAllowed()).toBe(false);
    });

    it('should allow seeding in production with ALLOW_DEMO=1', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEMO = '1';
      expect(isSeedingAllowed()).toBe(true);
    });

    it('should allow seeding in production with ALLOW_DEMO=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEMO = 'true';
      expect(isSeedingAllowed()).toBe(true);
    });

    it('should block seeding in production with ALLOW_DEMO=0', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEMO = '0';
      expect(isSeedingAllowed()).toBe(false);
    });

    it('should block seeding in production with ALLOW_DEMO=false', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEMO = 'false';
      expect(isSeedingAllowed()).toBe(false);
    });

    it('should allow seeding in unknown environments', () => {
      process.env.NODE_ENV = 'staging';
      expect(isSeedingAllowed()).toBe(true);
    });
  });

  describe('areDemoLoginsAllowed', () => {
    it('should allow demo logins in development', () => {
      process.env.NODE_ENV = 'development';
      expect(areDemoLoginsAllowed()).toBe(true);
    });

    it('should allow demo logins in test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(areDemoLoginsAllowed()).toBe(true);
    });

    it('should block demo logins in production by default', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO;
      expect(areDemoLoginsAllowed()).toBe(false);
    });

    it('should allow demo logins in production with ALLOW_DEMO=1', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEMO = '1';
      expect(areDemoLoginsAllowed()).toBe(true);
    });

    it('should block demo logins in unknown environments (safer default)', () => {
      process.env.NODE_ENV = 'staging';
      delete process.env.ALLOW_DEMO;
      expect(areDemoLoginsAllowed()).toBe(false);
    });
  });

  // ==========================================================================
  // LOGIN PROTECTION TESTS (KEY TESTS)
  // ==========================================================================

  describe('Demo Login Protection - Development', () => {
    let aliceUser;

    beforeAll(async () => {
      // Set development environment
      process.env.NODE_ENV = 'development';

      // Create Alice demo user
      const hashedPassword = await bcrypt.hash('password123', 12);
      aliceUser = await prisma.user.create({
        data: {
          email: 'alice@maestro.edu',
          username: 'alice_wonder',
          password: hashedPassword,
          firstName: 'Alice',
          lastName: 'Wonder',
          major: 'Computer Science',
          year: 3,
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.refreshToken.deleteMany({ where: { userId: aliceUser.id } });
      await prisma.user.delete({ where: { id: aliceUser.id } });
    });

    it('should allow demo user login in development (email)', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'alice@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('alice@maestro.edu');
    });

    it('should allow demo user login in development (username)', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'alice_wonder',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe('alice_wonder');
    });

    it('should allow case-insensitive demo user login in development', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'ALICE@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('alice@maestro.edu');
    });
  });

  describe('Demo Login Protection - Production WITHOUT ALLOW_DEMO', () => {
    let bobUser;

    beforeAll(async () => {
      // Set production environment WITHOUT ALLOW_DEMO
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO;

      // Create Bob demo user
      const hashedPassword = await bcrypt.hash('password123', 12);
      bobUser = await prisma.user.create({
        data: {
          email: 'bob@maestro.edu',
          username: 'bob_builder',
          password: hashedPassword,
          firstName: 'Bob',
          lastName: 'Builder',
          major: 'Software Engineering',
          year: 4,
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.refreshToken.deleteMany({ where: { userId: bobUser.id } });
      await prisma.user.delete({ where: { id: bobUser.id } });

      // Restore environment
      process.env.NODE_ENV = 'test';
    });

    it('should block demo user login in production by email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'bob@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demo accounts are disabled in production');
    });

    it('should block demo user login in production by username', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'bob_builder',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demo accounts are disabled in production');
    });

    it('should block case-insensitive demo user login in production', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'BOB@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demo accounts are disabled in production');
    });

    it('should block admin demo account in production', async () => {
      // Create admin demo user
      const hashedPassword = await bcrypt.hash('password123', 12);
      const adminUser = await prisma.user.create({
        data: {
          email: 'admin@maestro.edu',
          username: 'admin',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
        },
      });

      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'admin@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demo accounts are disabled in production');

      // Cleanup
      await prisma.user.delete({ where: { id: adminUser.id } });
    });

    it('should provide helpful error message for blocked demo login', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'bob@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Demo accounts are disabled in production');
      expect(response.body.message).toContain('well-known passwords');
      expect(response.body.message).toContain('production environments');
    });
  });

  describe('Demo Login Protection - Production WITH ALLOW_DEMO=1', () => {
    let carolUser;

    beforeAll(async () => {
      // Set production environment WITH ALLOW_DEMO=1
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DEMO = '1';

      // Create Carol demo user
      const hashedPassword = await bcrypt.hash('password123', 12);
      carolUser = await prisma.user.create({
        data: {
          email: 'carol@maestro.edu',
          username: 'carol_creative',
          password: hashedPassword,
          firstName: 'Carol',
          lastName: 'Creative',
          major: 'Design & Technology',
          year: 2,
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.refreshToken.deleteMany({ where: { userId: carolUser.id } });
      await prisma.user.delete({ where: { id: carolUser.id } });

      // Restore environment
      delete process.env.ALLOW_DEMO;
      process.env.NODE_ENV = 'test';
    });

    it('should allow demo user login in production with ALLOW_DEMO=1', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'carol@maestro.edu',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('carol@maestro.edu');
    });
  });

  describe('Non-Demo User Login Protection', () => {
    let realUser;

    beforeAll(async () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO;

      // Create non-demo user
      const hashedPassword = await bcrypt.hash('RealPassword123!', 12);
      realUser = await prisma.user.create({
        data: {
          email: 'realuser@maestro.edu',
          username: 'real_user',
          password: hashedPassword,
          firstName: 'Real',
          lastName: 'User',
          major: 'Computer Science',
          year: 3,
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.refreshToken.deleteMany({ where: { userId: realUser.id } });
      await prisma.user.delete({ where: { id: realUser.id } });

      // Restore environment
      process.env.NODE_ENV = 'test';
    });

    it('should allow non-demo user login in production', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'realuser@maestro.edu',
        password: 'RealPassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('realuser@maestro.edu');
    });

    it('should allow non-demo user login by username in production', async () => {
      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'real_user',
        password: 'RealPassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe('real_user');
    });
  });

  // ==========================================================================
  // ALL DEMO ACCOUNTS TEST
  // ==========================================================================

  describe('All Demo Accounts Protection', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO;
    });

    afterAll(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should block all known demo emails in production', () => {
      const demoEmails = [
        'admin@maestro.edu',
        'moderator@maestro.edu',
        'faculty@maestro.edu',
        'alice@maestro.edu',
        'bob@maestro.edu',
        'carol@maestro.edu',
      ];

      demoEmails.forEach((email) => {
        expect(isDemoUser(email)).toBe(true);
        expect(areDemoLoginsAllowed()).toBe(false);
      });
    });

    it('should block all known demo usernames in production', () => {
      const demoUsernames = [
        'admin',
        'mod_sarah',
        'prof_johnson',
        'alice_wonder',
        'bob_builder',
        'carol_creative',
      ];

      demoUsernames.forEach((username) => {
        expect(isDemoUser(username)).toBe(true);
        expect(areDemoLoginsAllowed()).toBe(false);
      });
    });
  });

  // ==========================================================================
  // ERROR MESSAGE QUALITY
  // ==========================================================================

  describe('Error Message Quality', () => {
    it('should provide security-focused error message', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO;

      const response = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'alice@maestro.edu',
        password: 'password123',
      });

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toContain('security');
      expect(response.body.message).toContain('well-known passwords');

      process.env.NODE_ENV = 'test';
    });
  });
});
