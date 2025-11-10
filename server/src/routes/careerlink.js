import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// ========== PORTFOLIOS ==========

const updatePortfolioSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  github: z.string().url().optional().or(z.literal('')),
  experience: z.array(z.any()).optional(),
  education: z.array(z.any()).optional(),
});

/**
 * GET /api/careerlink/portfolio/:userId
 * Get user's portfolio
 */
router.get('/portfolio/:userId', authenticate, async (req, res) => {
  try {
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: req.params.userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            major: true,
            year: true,
            skills: true,
          },
        },
      },
    });

    if (!portfolio) {
      // Create empty portfolio if doesn't exist
      const newPortfolio = await prisma.portfolio.create({
        data: {
          userId: req.params.userId,
          experience: [],
          education: [],
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              major: true,
              year: true,
              skills: true,
            },
          },
        },
      });
      return res.json({ portfolio: newPortfolio });
    }

    res.json({ portfolio });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

/**
 * PUT /api/careerlink/portfolio
 * Update current user's portfolio
 */
router.put('/portfolio', authenticate, async (req, res) => {
  try {
    const data = updatePortfolioSchema.parse(req.body);

    // Find or create portfolio
    let portfolio = await prisma.portfolio.findUnique({
      where: { userId: req.user.id },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: {
          userId: req.user.id,
          ...data,
          experience: data.experience || [],
          education: data.education || [],
        },
      });
    } else {
      portfolio = await prisma.portfolio.update({
        where: { userId: req.user.id },
        data,
      });
    }

    res.json({ portfolio });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update portfolio error:', error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
});

// ========== PROJECTS ==========

/**
 * GET /api/careerlink/projects
 * Get all public projects or user's projects
 */
router.get('/projects', authenticate, async (req, res) => {
  try {
    const { userId } = req.query;

    const where = userId ? { authorId: userId } : { isPublic: true };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            major: true,
          },
        },
      },
    });

    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * POST /api/careerlink/projects
 * Create a new project
 */
router.post('/projects', authenticate, async (req, res) => {
  try {
    const { title, description, imageUrl, projectUrl, technologies, isPublic } = req.body;

    const project = await prisma.project.create({
      data: {
        title,
        description,
        imageUrl,
        projectUrl,
        technologies: technologies || [],
        isPublic: isPublic !== false,
        authorId: req.user.id,
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
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * PUT /api/careerlink/projects/:id
 * Update a project
 */
router.put('/projects/:id', authenticate, async (req, res) => {
  try {
    // Check if user owns the project
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }

    const { title, description, imageUrl, projectUrl, technologies, isPublic } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        imageUrl,
        projectUrl,
        technologies,
        isPublic,
      },
    });

    res.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/careerlink/projects/:id
 * Delete a project
 */
router.delete('/projects/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this project' });
    }

    await prisma.project.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ========== CONNECTIONS ==========

/**
 * GET /api/careerlink/connections
 * Get user's connections
 */
router.get('/connections', authenticate, async (req, res) => {
  try {
    const connections = await prisma.connection.findMany({
      where: {
        OR: [{ requesterId: req.user.id }, { addresseeId: req.user.id }],
        status: 'ACCEPTED',
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            major: true,
            year: true,
          },
        },
        addressee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            major: true,
            year: true,
          },
        },
      },
    });

    res.json({ connections });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

/**
 * POST /api/careerlink/connections/:userId
 * Send connection request
 */
router.post('/connections/:userId', authenticate, async (req, res) => {
  try {
    const addresseeId = req.params.userId;

    if (addresseeId === req.user.id) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    // Check if connection already exists
    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: req.user.id, addresseeId },
          { requesterId: addresseeId, addresseeId: req.user.id },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Connection already exists or pending' });
    }

    const connection = await prisma.connection.create({
      data: {
        requesterId: req.user.id,
        addresseeId,
        status: 'PENDING',
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'CONNECTION',
        message: `${req.user.firstName} ${req.user.lastName} sent you a connection request`,
        link: `/careerlink/connections`,
        userId: addresseeId,
      },
    });

    res.status(201).json({ connection });
  } catch (error) {
    console.error('Send connection request error:', error);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

/**
 * PUT /api/careerlink/connections/:id/accept
 * Accept connection request
 */
router.put('/connections/:id/accept', authenticate, async (req, res) => {
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: req.params.id },
    });

    if (!connection || connection.addresseeId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.connection.update({
      where: { id: req.params.id },
      data: { status: 'ACCEPTED' },
    });

    res.json({ connection: updated });
  } catch (error) {
    console.error('Accept connection error:', error);
    res.status(500).json({ error: 'Failed to accept connection' });
  }
});

/**
 * GET /api/careerlink/browse
 * Browse students by filters
 */
router.get('/browse', authenticate, async (req, res) => {
  try {
    const { major, year, skills } = req.query;

    const where = {};
    if (major) where.major = major;
    if (year) where.year = parseInt(year);
    if (skills) where.skills = { hasSome: skills.split(',') };

    const students = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        bio: true,
        major: true,
        year: true,
        skills: true,
        _count: {
          select: {
            projects: true,
            connections: true,
          },
        },
      },
      take: 50,
    });

    res.json({ students });
  } catch (error) {
    console.error('Browse students error:', error);
    res.status(500).json({ error: 'Failed to browse students' });
  }
});

export default router;
