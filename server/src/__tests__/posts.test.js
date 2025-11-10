/**
 * Posts API Integration Tests
 * Tests for creating, reading, updating, deleting posts, comments, and likes
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from '../routes/auth.js';
import hubRoutes from '../routes/hub.js';
import { prisma } from './setup.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/hub', hubRoutes);

describe('Posts API', () => {
  let authToken;
  let testUser;
  let testGroup;

  beforeAll(async () => {
    // Register and login test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'posttest@maestro.edu',
        username: 'postuser',
        password: 'TestPassword123!',
        firstName: 'Post',
        lastName: 'Test',
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        emailOrUsername: 'posttest@maestro.edu',
        password: 'TestPassword123!',
      })
      .expect(200);

    authToken = loginResponse.body.token;
    testUser = loginResponse.body.user;

    // Create a test group
    testGroup = await prisma.group.create({
      data: {
        name: 'Test Group',
        description: 'Group for testing',
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

  describe('POST /api/hub/posts', () => {
    it('should create a new post successfully', async () => {
      const postData = {
        content: 'This is a test post! #testing',
      };

      const response = await request(app)
        .post('/api/hub/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(postData.content);
      expect(response.body.authorId).toBe(testUser.id);
      expect(response.body.author).toBeDefined();
      expect(response.body.author.username).toBe('postuser');
    });

    it('should create a post in a group', async () => {
      const postData = {
        content: 'This is a group post!',
        groupId: testGroup.id,
      };

      const response = await request(app)
        .post('/api/hub/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.content).toBe(postData.content);
      expect(response.body.groupId).toBe(testGroup.id);
    });

    it('should reject post without authentication', async () => {
      const postData = {
        content: 'This post should fail',
      };

      await request(app).post('/api/hub/posts').send(postData).expect(401);
    });

    it('should reject post with empty content', async () => {
      const postData = {
        content: '',
      };

      const response = await request(app)
        .post('/api/hub/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/hub/feed', () => {
    beforeAll(async () => {
      // Create multiple test posts
      await prisma.post.createMany({
        data: [
          { content: 'Feed post 1', authorId: testUser.id },
          { content: 'Feed post 2', authorId: testUser.id },
          { content: 'Feed post 3', authorId: testUser.id },
        ],
      });
    });

    it('should fetch feed with posts', async () => {
      const response = await request(app)
        .get('/api/hub/feed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(Array.isArray(response.body.posts)).toBe(true);
      expect(response.body.posts.length).toBeGreaterThan(0);
      expect(response.body.posts[0]).toHaveProperty('author');
    });

    it('should paginate feed results', async () => {
      const response = await request(app)
        .get('/api/hub/feed?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts.length).toBeLessThanOrEqual(2);
    });

    it('should reject feed request without authentication', async () => {
      await request(app).get('/api/hub/feed').expect(401);
    });
  });

  describe('POST /api/hub/posts/:id/like', () => {
    let testPost;

    beforeAll(async () => {
      testPost = await prisma.post.create({
        data: {
          content: 'Post to be liked',
          authorId: testUser.id,
        },
      });
    });

    it('should like a post successfully', async () => {
      const response = await request(app)
        .post(`/api/hub/posts/${testPost.id}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('liked');

      // Verify like was created
      const like = await prisma.like.findFirst({
        where: {
          postId: testPost.id,
          userId: testUser.id,
        },
      });
      expect(like).toBeTruthy();
    });

    it('should prevent duplicate likes', async () => {
      // Like already exists from previous test
      const response = await request(app)
        .post(`/api/hub/posts/${testPost.id}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('already liked');
    });

    it('should reject like on non-existent post', async () => {
      await request(app)
        .post('/api/hub/posts/nonexistent-id/like')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/hub/posts/:id/like', () => {
    let testPost;

    beforeAll(async () => {
      testPost = await prisma.post.create({
        data: {
          content: 'Post to be unliked',
          authorId: testUser.id,
        },
      });

      // Create a like
      await prisma.like.create({
        data: {
          postId: testPost.id,
          userId: testUser.id,
        },
      });
    });

    it('should unlike a post successfully', async () => {
      const response = await request(app)
        .delete(`/api/hub/posts/${testPost.id}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('unliked');

      // Verify like was removed
      const like = await prisma.like.findFirst({
        where: {
          postId: testPost.id,
          userId: testUser.id,
        },
      });
      expect(like).toBeNull();
    });
  });

  describe('POST /api/hub/posts/:id/comments', () => {
    let testPost;

    beforeAll(async () => {
      testPost = await prisma.post.create({
        data: {
          content: 'Post to be commented on',
          authorId: testUser.id,
        },
      });
    });

    it('should create a comment on a post', async () => {
      const commentData = {
        content: 'This is a test comment!',
      };

      const response = await request(app)
        .post(`/api/hub/posts/${testPost.id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentData)
        .expect(201);

      expect(response.body.content).toBe(commentData.content);
      expect(response.body.postId).toBe(testPost.id);
      expect(response.body.authorId).toBe(testUser.id);
      expect(response.body.author).toBeDefined();
    });

    it('should reject comment with empty content', async () => {
      const commentData = {
        content: '',
      };

      await request(app)
        .post(`/api/hub/posts/${testPost.id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentData)
        .expect(400);
    });

    it('should reject comment on non-existent post', async () => {
      const commentData = {
        content: 'Comment on non-existent post',
      };

      await request(app)
        .post('/api/hub/posts/nonexistent-id/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentData)
        .expect(404);
    });
  });

  describe('GET /api/hub/posts/:id', () => {
    let testPost;

    beforeAll(async () => {
      testPost = await prisma.post.create({
        data: {
          content: 'Post to be retrieved',
          authorId: testUser.id,
          comments: {
            create: {
              content: 'Test comment',
              authorId: testUser.id,
            },
          },
        },
      });
    });

    it('should retrieve a post with comments', async () => {
      const response = await request(app)
        .get(`/api/hub/posts/${testPost.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testPost.id);
      expect(response.body.content).toBe('Post to be retrieved');
      expect(response.body.author).toBeDefined();
      expect(response.body.comments).toBeDefined();
      expect(Array.isArray(response.body.comments)).toBe(true);
      expect(response.body.comments.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent post', async () => {
      await request(app)
        .get('/api/hub/posts/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/hub/posts/:id', () => {
    let testPost;

    beforeAll(async () => {
      testPost = await prisma.post.create({
        data: {
          content: 'Post to be deleted',
          authorId: testUser.id,
        },
      });
    });

    it('should delete own post successfully', async () => {
      const response = await request(app)
        .delete(`/api/hub/posts/${testPost.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('deleted');

      // Verify post was deleted
      const deletedPost = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(deletedPost).toBeNull();
    });

    it('should return 404 when deleting non-existent post', async () => {
      await request(app)
        .delete('/api/hub/posts/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
