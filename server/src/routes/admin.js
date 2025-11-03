import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const userSummarySelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  suspendedUntil: true,
  moderationNote: true,
  createdAt: true,
  lastActive: true,
};

const suspendSchema = z.object({
  durationMinutes: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

const banSchema = z.object({
  reason: z.string().max(500).optional(),
});

const roleSchema = z.object({
  role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']),
});

router.use(authenticate, authorize('ADMIN'));

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: userSummarySelect,
    orderBy: [{ createdAt: 'asc' }],
  });
  res.json({ users });
});

router.post('/users/:id/suspend', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot suspend yourself.' });
  }

  const parsed = suspendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  const suspendedUntil = new Date(Date.now() + parsed.data.durationMinutes * 60000);

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: 'SUSPENDED',
        suspendedUntil,
        moderationNote: parsed.data.reason || null,
      },
      select: userSummarySelect,
    });

    res.json({
      message: `User suspended until ${suspendedUntil.toISOString()}`,
      user,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot ban yourself.' });
  }

  const parsed = banSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: 'BANNED',
        suspendedUntil: null,
        moderationNote: parsed.data.reason || null,
      },
      select: userSummarySelect,
    });

    res.json({ message: 'User has been banned', user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:id/restore', async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: 'ACTIVE',
        suspendedUntil: null,
        moderationNote: null,
      },
      select: userSummarySelect,
    });

    res.json({ message: 'User restored to active status', user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Restore user error:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

router.post('/users/:id/role', async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  if (req.params.id === req.user.id && parsed.data.role !== 'ADMIN') {
    return res.status(400).json({ error: 'You cannot remove your own admin role.' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: parsed.data.role },
      select: userSummarySelect,
    });

    res.json({ message: 'User role updated', user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User account deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
