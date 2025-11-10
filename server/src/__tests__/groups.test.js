/**
 * Groups API Integration Tests
 * Tests for creating, joining, and managing groups
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.js';
import hubRoutes from '../routes/hub.js';
import { prisma } from './setup.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/hub', hubRoutes);

describe('Groups API', () => {
  let authToken;
  let secondAuthToken;
  let testUser;
  let secondUser;

  beforeAll(async () => {
    // Register and login first test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'grouptest@maestro.edu',
        username: 'groupuser',
        password: 'TestPassword123!',
        firstName: 'Group',
        lastName: 'Test',
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        emailOrUsername: 'grouptest@maestro.edu',
        password: 'TestPassword123!',
      })
      .expect(200);

    authToken = loginResponse.body.token;
    testUser = loginResponse.body.user;

    // Register and login second test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'grouptest2@maestro.edu',
        username: 'groupuser2',
        password: 'TestPassword123!',
        firstName: 'Group2',
        lastName: 'Test',
      })
      .expect(201);

    const secondLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        emailOrUsername: 'grouptest2@maestro.edu',
        password: 'TestPassword123!',
      })
      .expect(200);

    secondAuthToken = secondLoginResponse.body.token;
    secondUser = secondLoginResponse.body.user;
  });

  describe('POST /api/hub/groups', () => {
    it('should create a new group successfully', async () => {
      const groupData = {
        name: 'Test Coding Club',
        description: 'A club for testing and coding',
        category: 'Technology',
      };

      const response = await request(app)
        .post('/api/hub/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(groupData.name);
      expect(response.body.description).toBe(groupData.description);
      expect(response.body.category).toBe(groupData.category);
      expect(response.body.members).toBeDefined();
      expect(response.body.members.length).toBe(1);
      expect(response.body.members[0].role).toBe('ADMIN');
    });

    it('should reject group creation without authentication', async () => {
      const groupData = {
        name: 'Unauthenticated Group',
        description: 'This should fail',
        category: 'Technology',
      };

      await request(app).post('/api/hub/groups').send(groupData).expect(401);
    });

    it('should reject group creation with empty name', async () => {
      const groupData = {
        name: '',
        description: 'Group with no name',
        category: 'Technology',
      };

      const response = await request(app)
        .post('/api/hub/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject group creation with missing category', async () => {
      const groupData = {
        name: 'No Category Group',
        description: 'Group without category',
      };

      const response = await request(app)
        .post('/api/hub/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/hub/groups', () => {
    beforeAll(async () => {
      // Create multiple test groups
      await prisma.group.createMany({
        data: [
          {
            name: 'AI Research Group',
            description: 'Researching AI',
            category: 'Technology',
          },
          {
            name: 'Design Thinkers',
            description: 'UX/UI Design',
            category: 'Design',
          },
          {
            name: 'Startup Founders',
            description: 'Building startups',
            category: 'Business',
          },
        ],
      });
    });

    it('should fetch all groups', async () => {
      const response = await request(app)
        .get('/api/hub/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('groups');
      expect(Array.isArray(response.body.groups)).toBe(true);
      expect(response.body.groups.length).toBeGreaterThan(0);
    });

    it('should filter groups by category', async () => {
      const response = await request(app)
        .get('/api/hub/groups?category=Technology')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.groups.length).toBeGreaterThan(0);
      response.body.groups.forEach((group) => {
        expect(group.category).toBe('Technology');
      });
    });

    it('should search groups by name', async () => {
      const response = await request(app)
        .get('/api/hub/groups?search=AI')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.groups.length).toBeGreaterThan(0);
      expect(response.body.groups[0].name).toContain('AI');
    });
  });

  describe('GET /api/hub/groups/:id', () => {
    let testGroup;

    beforeAll(async () => {
      testGroup = await prisma.group.create({
        data: {
          name: 'Detail Test Group',
          description: 'Group for detail testing',
          category: 'Technology',
          members: {
            create: {
              userId: testUser.id,
              role: 'ADMIN',
            },
          },
        },
      });
    });

    it('should retrieve group details with members', async () => {
      const response = await request(app)
        .get(`/api/hub/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testGroup.id);
      expect(response.body.name).toBe('Detail Test Group');
      expect(response.body.members).toBeDefined();
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBe(1);
      expect(response.body.members[0].user).toBeDefined();
    });

    it('should return 404 for non-existent group', async () => {
      await request(app)
        .get('/api/hub/groups/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/hub/groups/:id/join', () => {
    let testGroup;

    beforeAll(async () => {
      testGroup = await prisma.group.create({
        data: {
          name: 'Join Test Group',
          description: 'Group for join testing',
          category: 'Technology',
          members: {
            create: {
              userId: testUser.id,
              role: 'ADMIN',
            },
          },
        },
      });
    });

    it('should allow user to join a group', async () => {
      const response = await request(app)
        .post(`/api/hub/groups/${testGroup.id}/join`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(200);

      expect(response.body.message).toContain('joined');

      // Verify membership was created
      const member = await prisma.groupMember.findFirst({
        where: {
          groupId: testGroup.id,
          userId: secondUser.id,
        },
      });
      expect(member).toBeTruthy();
      expect(member.role).toBe('MEMBER');
    });

    it('should prevent duplicate group membership', async () => {
      // Second user already joined in previous test
      const response = await request(app)
        .post(`/api/hub/groups/${testGroup.id}/join`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(400);

      expect(response.body.error).toContain('already');
    });

    it('should return 404 when joining non-existent group', async () => {
      await request(app)
        .post('/api/hub/groups/nonexistent-id/join')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/hub/groups/:id/leave', () => {
    let testGroup;

    beforeAll(async () => {
      testGroup = await prisma.group.create({
        data: {
          name: 'Leave Test Group',
          description: 'Group for leave testing',
          category: 'Technology',
          members: {
            create: [
              {
                userId: testUser.id,
                role: 'ADMIN',
              },
              {
                userId: secondUser.id,
                role: 'MEMBER',
              },
            ],
          },
        },
      });
    });

    it('should allow user to leave a group', async () => {
      const response = await request(app)
        .post(`/api/hub/groups/${testGroup.id}/leave`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(200);

      expect(response.body.message).toContain('left');

      // Verify membership was removed
      const member = await prisma.groupMember.findFirst({
        where: {
          groupId: testGroup.id,
          userId: secondUser.id,
        },
      });
      expect(member).toBeNull();
    });

    it('should return error when leaving group not a member of', async () => {
      // Second user already left in previous test
      const response = await request(app)
        .post(`/api/hub/groups/${testGroup.id}/leave`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/hub/groups/:id', () => {
    let testGroup;

    beforeAll(async () => {
      testGroup = await prisma.group.create({
        data: {
          name: 'Update Test Group',
          description: 'Group for update testing',
          category: 'Technology',
          members: {
            create: {
              userId: testUser.id,
              role: 'ADMIN',
            },
          },
        },
      });
    });

    it('should allow admin to update group details', async () => {
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        category: 'Design',
      };

      const response = await request(app)
        .put(`/api/hub/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.category).toBe(updateData.category);
    });

    it('should reject update from non-admin user', async () => {
      const updateData = {
        name: 'Unauthorized Update',
      };

      await request(app)
        .put(`/api/hub/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/hub/groups/:id', () => {
    let testGroup;

    beforeAll(async () => {
      testGroup = await prisma.group.create({
        data: {
          name: 'Delete Test Group',
          description: 'Group for delete testing',
          category: 'Technology',
          members: {
            create: {
              userId: testUser.id,
              role: 'ADMIN',
            },
          },
        },
      });
    });

    it('should allow admin to delete group', async () => {
      const response = await request(app)
        .delete(`/api/hub/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('deleted');

      // Verify group was deleted
      const deletedGroup = await prisma.group.findUnique({
        where: { id: testGroup.id },
      });
      expect(deletedGroup).toBeNull();
    });

    it('should reject deletion from non-admin user', async () => {
      const newGroup = await prisma.group.create({
        data: {
          name: 'Another Delete Test',
          description: 'Testing non-admin delete',
          category: 'Technology',
          members: {
            create: {
              userId: testUser.id,
              role: 'ADMIN',
            },
          },
        },
      });

      await request(app)
        .delete(`/api/hub/groups/${newGroup.id}`)
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .expect(403);
    });
  });
});
