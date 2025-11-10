/**
 * RBAC Authorization Test Suite
 *
 * Comprehensive negative-path testing for Role-Based Access Control:
 * - Students CANNOT access admin or moderator routes (403)
 * - Moderators CAN access mod routes but NOT admin routes (403)
 * - Faculty CAN access faculty routes but NOT admin/mod routes (403)
 * - Admins CAN access ALL routes
 * - Role changes take effect IMMEDIATELY (no stale JWT claims)
 * - Proper 403 (Forbidden) errors for insufficient permissions
 * - Proper 401 (Unauthorized) errors for unauthenticated requests
 *
 * Role Hierarchy:
 * STUDENT < FACULTY < MODERATOR < ADMIN
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../index.js';

const prisma = new PrismaClient();

describe('RBAC Authorization - Negative Path Testing', () => {
  let studentUser, facultyUser, moderatorUser, adminUser;
  let studentToken, facultyToken, moderatorToken, adminToken;

  beforeAll(async () => {
    // Create users with different roles
    const hashedPassword = await bcrypt.hash('TestPassword123!', 12);

    // Student user
    studentUser = await prisma.user.create({
      data: {
        email: 'student@maestro.edu',
        username: 'rbacstudent',
        password: hashedPassword,
        firstName: 'Student',
        lastName: 'User',
        major: 'Computer Science',
        year: 2,
        role: 'STUDENT',
      },
    });

    // Faculty user
    facultyUser = await prisma.user.create({
      data: {
        email: 'faculty@maestro.edu',
        username: 'rbacfaculty',
        password: hashedPassword,
        firstName: 'Faculty',
        lastName: 'User',
        major: 'Computer Science',
        year: 4,
        role: 'FACULTY',
      },
    });

    // Moderator user
    moderatorUser = await prisma.user.create({
      data: {
        email: 'moderator@maestro.edu',
        username: 'rbacmoderator',
        password: hashedPassword,
        firstName: 'Moderator',
        lastName: 'User',
        major: 'Computer Science',
        year: 3,
        role: 'MODERATOR',
      },
    });

    // Admin user
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@maestro.edu',
        username: 'rbacadmin',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        major: 'Computer Science',
        year: 4,
        role: 'ADMIN',
      },
    });

    // Login to get tokens
    const studentLogin = await request(app).post('/api/auth/login').send({
      emailOrUsername: 'student@maestro.edu',
      password: 'TestPassword123!',
    });
    studentToken = studentLogin.body.token;

    const facultyLogin = await request(app).post('/api/auth/login').send({
      emailOrUsername: 'faculty@maestro.edu',
      password: 'TestPassword123!',
    });
    facultyToken = facultyLogin.body.token;

    const moderatorLogin = await request(app).post('/api/auth/login').send({
      emailOrUsername: 'moderator@maestro.edu',
      password: 'TestPassword123!',
    });
    moderatorToken = moderatorLogin.body.token;

    const adminLogin = await request(app).post('/api/auth/login').send({
      emailOrUsername: 'admin@maestro.edu',
      password: 'TestPassword123!',
    });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.refreshToken.deleteMany({
      where: {
        userId: {
          in: [studentUser.id, facultyUser.id, moderatorUser.id, adminUser.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [studentUser.id, facultyUser.id, moderatorUser.id, adminUser.id],
        },
      },
    });
    await prisma.$disconnect();
  });

  // ==========================================================================
  // PUBLIC ROUTES - Accessible to Everyone
  // ==========================================================================

  describe('Public Routes', () => {
    it('should allow unauthenticated access to public routes', async () => {
      const response = await request(app).get('/api/test-rbac/public').expect(200);

      expect(response.body.message).toContain('Public route');
      expect(response.body.authenticated).toBe(false);
    });

    it('should allow authenticated users to access public routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/public')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.message).toContain('Public route');
    });
  });

  // ==========================================================================
  // AUTHENTICATED ROUTES - Accessible to Any Authenticated User
  // ==========================================================================

  describe('Authenticated Routes', () => {
    it('should block unauthenticated access to authenticated routes', async () => {
      const response = await request(app).get('/api/test-rbac/authenticated').expect(401);

      expect(response.body.error).toContain('token');
    });

    it('should allow any authenticated user to access authenticated routes', async () => {
      const roles = [
        { token: studentToken, role: 'STUDENT' },
        { token: facultyToken, role: 'FACULTY' },
        { token: moderatorToken, role: 'MODERATOR' },
        { token: adminToken, role: 'ADMIN' },
      ];

      for (const { token, role } of roles) {
        const response = await request(app)
          .get('/api/test-rbac/authenticated')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.user.role).toBe(role);
      }
    });
  });

  // ==========================================================================
  // STUDENT ROUTES - NEGATIVE PATH TESTS
  // ==========================================================================

  describe('Student Routes - Negative Paths', () => {
    it('should allow students to access student routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/student')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('STUDENT');
    });

    it('should block faculty from student-only routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/student')
        .set('Authorization', `Bearer ${facultyToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block moderators from student-only routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/student')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block admins from student-only routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/student')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==========================================================================
  // FACULTY ROUTES - NEGATIVE PATH TESTS
  // ==========================================================================

  describe('Faculty Routes - Negative Paths', () => {
    it('should allow faculty to access faculty routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty')
        .set('Authorization', `Bearer ${facultyToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('FACULTY');
    });

    it('should block students from faculty routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block moderators from faculty routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block admins from faculty-only routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block students from faculty POST routes', async () => {
      const response = await request(app)
        .post('/api/test-rbac/faculty/grade')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ student: 'test', grade: 'A' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==========================================================================
  // MODERATOR ROUTES - NEGATIVE PATH TESTS (KEY TESTS)
  // ==========================================================================

  describe('Moderator Routes - Negative Paths', () => {
    it('should allow moderators to access moderator routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('MODERATOR');
    });

    it('should block students from moderator routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block faculty from moderator routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator')
        .set('Authorization', `Bearer ${facultyToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block admins from moderator-only routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block students from moderator POST routes', async () => {
      const response = await request(app)
        .post('/api/test-rbac/moderator/action')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ action: 'delete', target: 'post123' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block students from moderator DELETE routes', async () => {
      const response = await request(app)
        .delete('/api/test-rbac/moderator/content/123')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow moderators to perform moderation actions', async () => {
      const response = await request(app)
        .post('/api/test-rbac/moderator/action')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ action: 'delete', target: 'post123' })
        .expect(200);

      expect(response.body.message).toContain('Moderation action completed');
    });
  });

  // ==========================================================================
  // ADMIN ROUTES - NEGATIVE PATH TESTS (KEY TESTS)
  // ==========================================================================

  describe('Admin Routes - Negative Paths', () => {
    it('should allow admins to access admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should block students from admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block faculty from admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${facultyToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block moderators from admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block students from admin POST routes', async () => {
      const response = await request(app)
        .post('/api/test-rbac/admin/action')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ action: 'ban_user' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block moderators from admin POST routes', async () => {
      const response = await request(app)
        .post('/api/test-rbac/admin/action')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ action: 'ban_user' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block students from admin DELETE routes', async () => {
      const response = await request(app)
        .delete('/api/test-rbac/admin/user/123')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block moderators from admin DELETE routes', async () => {
      const response = await request(app)
        .delete('/api/test-rbac/admin/user/123')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow admins to perform admin actions', async () => {
      const response = await request(app)
        .post('/api/test-rbac/admin/action')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'ban_user' })
        .expect(200);

      expect(response.body.message).toContain('Admin action completed');
    });

    it('should block students from admin PUT routes', async () => {
      const response = await request(app)
        .put('/api/test-rbac/admin/settings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ setting: 'value' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==========================================================================
  // MULTI-ROLE ROUTES - Mixed Permissions
  // ==========================================================================

  describe('Multi-Role Routes', () => {
    it('should allow moderators to access moderator-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator-or-admin')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('MODERATOR');
    });

    it('should allow admins to access moderator-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator-or-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should block students from moderator-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator-or-admin')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should block faculty from moderator-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/moderator-or-admin')
        .set('Authorization', `Bearer ${facultyToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow faculty to access faculty-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty-or-admin')
        .set('Authorization', `Bearer ${facultyToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('FACULTY');
    });

    it('should allow admins to access faculty-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty-or-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should block students from faculty-or-admin routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/faculty-or-admin')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow all staff to access staff-only routes', async () => {
      const staffTokens = [
        { token: facultyToken, role: 'FACULTY' },
        { token: moderatorToken, role: 'MODERATOR' },
        { token: adminToken, role: 'ADMIN' },
      ];

      for (const { token, role } of staffTokens) {
        const response = await request(app)
          .get('/api/test-rbac/staff-only')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.user.role).toBe(role);
      }
    });

    it('should block students from staff-only routes', async () => {
      const response = await request(app)
        .get('/api/test-rbac/staff-only')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==========================================================================
  // ROLE CHANGES - IMMEDIATE EFFECT (No Stale Claims)
  // ==========================================================================

  describe('Role Changes - Immediate Effect', () => {
    let testUser;
    let testToken;

    beforeEach(async () => {
      // Create a test user for role change testing
      const hashedPassword = await bcrypt.hash('RoleChangeTest123!', 12);
      testUser = await prisma.user.create({
        data: {
          email: 'rolechange@maestro.edu',
          username: 'rolechangetest',
          password: hashedPassword,
          firstName: 'Role',
          lastName: 'Change',
          major: 'Computer Science',
          year: 2,
          role: 'STUDENT',
        },
      });

      // Login to get token
      const loginResponse = await request(app).post('/api/auth/login').send({
        emailOrUsername: 'rolechange@maestro.edu',
        password: 'RoleChangeTest123!',
      });
      testToken = loginResponse.body.token;
    });

    afterEach(async () => {
      // Cleanup
      await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    });

    it('should immediately reflect role change from STUDENT to MODERATOR', async () => {
      // Initially student - should be blocked from moderator route
      let response = await request(app)
        .get('/api/test-rbac/moderator')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');

      // Change role to MODERATOR
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'MODERATOR' },
      });

      // Should now have access to moderator route (no stale claims)
      response = await request(app)
        .get('/api/test-rbac/moderator')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('MODERATOR');
    });

    it('should immediately reflect role change from STUDENT to ADMIN', async () => {
      // Initially student - should be blocked from admin route
      let response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');

      // Change role to ADMIN
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'ADMIN' },
      });

      // Should now have access to admin route (no stale claims)
      response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should immediately reflect role downgrade from ADMIN to STUDENT', async () => {
      // Set user to ADMIN
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'ADMIN' },
      });

      // Should have access to admin route
      let response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');

      // Downgrade to STUDENT
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'STUDENT' },
      });

      // Should be immediately blocked from admin route (no stale claims)
      response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should immediately reflect role change from MODERATOR to ADMIN', async () => {
      // Set user to MODERATOR
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'MODERATOR' },
      });

      // Should be blocked from admin route
      let response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');

      // Promote to ADMIN
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'ADMIN' },
      });

      // Should now have access to admin route (no stale claims)
      response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should immediately block access when role is downgraded during session', async () => {
      // Set user to ADMIN
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'ADMIN' },
      });

      // Make multiple successful admin requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get('/api/test-rbac/admin')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(response.body.user.role).toBe('ADMIN');
      }

      // Downgrade to STUDENT mid-session
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'STUDENT' },
      });

      // Very next request should be blocked (no stale claims)
      const response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==========================================================================
  // UNSAFE METHODS (POST, PUT, PATCH, DELETE)
  // ==========================================================================

  describe('HTTP Methods - Authorization on Unsafe Methods', () => {
    it('should enforce authorization on POST requests', async () => {
      const response = await request(app)
        .post('/api/test-rbac/admin/action')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ action: 'test' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should enforce authorization on PUT requests', async () => {
      const response = await request(app)
        .put('/api/test-rbac/admin/settings')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ setting: 'value' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should enforce authorization on PATCH requests', async () => {
      const response = await request(app)
        .patch('/api/test-rbac/moderator/user/123')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ status: 'banned' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should enforce authorization on DELETE requests', async () => {
      const response = await request(app)
        .delete('/api/test-rbac/admin/user/123')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  // ==========================================================================
  // ERROR CODES AND MESSAGES
  // ==========================================================================

  describe('Error Codes and Messages', () => {
    it('should return 401 for missing authentication', async () => {
      const response = await request(app).get('/api/test-rbac/admin').expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('token');
    });

    it('should return 403 with proper message for insufficient permissions', async () => {
      const response = await request(app)
        .get('/api/test-rbac/admin')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should return consistent 403 errors across all unauthorized routes', async () => {
      const routes = [
        '/api/test-rbac/admin',
        '/api/test-rbac/moderator',
        '/api/test-rbac/faculty',
      ];

      for (const route of routes) {
        const response = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(403);

        expect(response.body.error).toBe('Insufficient permissions');
      }
    });
  });
});
