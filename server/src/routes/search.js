import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/search
 * Global search across all modules
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results = {};

    // Search users
    if (!type || type === 'users') {
      results.users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          major: true,
          year: true,
        },
        take: 10,
      });
    }

    // Search posts
    if (!type || type === 'posts') {
      results.posts = await prisma.post.findMany({
        where: {
          content: { contains: q, mode: 'insensitive' },
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
            },
          },
        },
        take: 10,
      });
    }

    // Search groups
    if (!type || type === 'groups') {
      results.groups = await prisma.group.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          _count: {
            select: { members: true },
          },
        },
        take: 10,
      });
    }

    // Search courses
    if (!type || type === 'courses') {
      results.courses = await prisma.course.findMany({
        where: {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { department: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          _count: {
            select: {
              threads: true,
              studyGroups: true,
            },
          },
        },
        take: 10,
      });
    }

    // Search projects
    if (!type || type === 'projects') {
      results.projects = await prisma.project.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        take: 10,
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/analytics
 * Get platform analytics
 */
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const [
      totalUsers,
      totalPosts,
      totalGroups,
      totalCourses,
      totalProjects,
      recentActivity,
      topUsers,
      trendingPosts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.group.count(),
      prisma.course.count(),
      prisma.project.count(),

      // Recent activity (last 7 days)
      prisma.user.count({
        where: {
          lastActive: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Most active users
      prisma.user.findMany({
        orderBy: { lastActive: 'desc' },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          lastActive: true,
          _count: {
            select: {
              posts: true,
              comments: true,
            },
          },
        },
        take: 10,
      }),

      // Trending posts (most likes in last 24 hours)
      prisma.post.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          likes: {
            _count: 'desc',
          },
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
        take: 5,
      }),
    ]);

    res.json({
      analytics: {
        totalUsers,
        totalPosts,
        totalGroups,
        totalCourses,
        totalProjects,
        activeUsers: recentActivity,
        topUsers,
        trendingPosts,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
