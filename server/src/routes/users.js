import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  bio: z.string().optional(),
  major: z.string().optional(),
  year: z.number().int().min(1).max(4).optional(),
  cohort: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  skills: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  photoUrl: z.string().optional(),
});

// ========== NOTIFICATIONS ==========
// Note: Specific routes must come BEFORE parameterized routes like /:id

/**
 * GET /api/users/notifications
 * Get current user's notifications
 */
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PUT /api/users/notifications/read-all
 * Mark all notifications as read
 */
router.put('/notifications/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * PUT /api/users/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ========== PROFILE ROUTES ==========

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        bio: true,
        major: true,
        year: true,
        cohort: true,
        skills: true,
        interests: true,
        updatedAt: true,
      },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/users/upload-photo
 * Upload profile photo
 */
router.post('/upload-photo', authenticate, async (req, res) => {
  try {
    if (!req.files || !req.files.photo) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photo = req.files.photo;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

    if (!allowedTypes.includes(photo.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and GIF allowed' });
    }

    const filename = `${req.user.id}_${Date.now()}_${photo.name}`;
    const uploadPath = `uploads/photos/${filename}`;

    await photo.mv(uploadPath);

    const photoUrl = `/uploads/photos/${filename}`;

    // Update user's photo URL
    await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl },
    });

    res.json({ photoUrl });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

/**
 * GET /api/users/:id
 * Get user profile by ID
 * Note: This MUST come last because :id will match any path segment
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        bio: true,
        major: true,
        year: true,
        cohort: true,
        skills: true,
        interests: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            projects: true,
            connections: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
