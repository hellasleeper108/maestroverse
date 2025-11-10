/**
 * Authentication API Integration Tests
 * Tests for user registration, login, token refresh, and logout
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.js';
import { prisma } from './setup.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@maestro.edu',
        username: 'testuser',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        major: 'Computer Science',
        year: 2,
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user).not.toHaveProperty('password');

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(user).toBeTruthy();
      expect(user.firstName).toBe(userData.firstName);
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'duplicate@maestro.edu',
        username: 'user1',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // First registration
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...userData, username: 'user2' })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'weakpass@maestro.edu',
        username: 'weakuser',
        password: '123', // Too weak
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'testuser2',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logintest@maestro.edu',
          username: 'loginuser',
          password: 'TestPassword123!',
          firstName: 'Login',
          lastName: 'Test',
        })
        .expect(201);
    });

    it('should login with email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'logintest@maestro.edu',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('logintest@maestro.edu');
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('should login with username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'loginuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('loginuser');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'logintest@maestro.edu',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'nonexistent@maestro.edu',
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'logintest@maestro.edu',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;

    beforeAll(async () => {
      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'metest@maestro.edu',
          username: 'meuser',
          password: 'TestPassword123!',
          firstName: 'Me',
          lastName: 'Test',
        })
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'metest@maestro.edu',
          password: 'TestPassword123!',
        })
        .expect(200);

      authToken = loginResponse.body.token;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.email).toBe('metest@maestro.edu');
      expect(response.body.username).toBe('meuser');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.error).toContain('token');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_here')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeAll(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logouttest@maestro.edu',
          username: 'logoutuser',
          password: 'TestPassword123!',
          firstName: 'Logout',
          lastName: 'Test',
        })
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'logouttest@maestro.edu',
          password: 'TestPassword123!',
        })
        .expect(200);

      authToken = loginResponse.body.token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('Logged out');
    });

    it('should reject logout without token', async () => {
      await request(app).post('/api/auth/logout').expect(401);
    });
  });
});
