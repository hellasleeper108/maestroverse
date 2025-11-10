/**
 * MIM (Maestroverse Instant Messenger) Routes
 * AOL IM-style chat rooms with public lobby and private rooms
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/mim/rooms
 * Get all accessible rooms for current user
 */
router.get('/rooms', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get public rooms + private rooms user is a member of
    const rooms = await prisma.chatRoom.findMany({
      where: {
        isActive: true,
        OR: [
          { type: 'PUBLIC' },
          {
            type: 'PRIVATE',
            members: {
              some: { userId }
            }
          }
        ]
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            messages: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * POST /api/mim/rooms
 * Create a new chat room
 */
router.post('/rooms', authenticate, async (req, res) => {
  try {
    const { name, description, type, password } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!['PUBLIC', 'PRIVATE'].includes(type)) {
      return res.status(400).json({ error: 'Type must be PUBLIC or PRIVATE' });
    }

    if (type === 'PRIVATE' && !password) {
      return res.status(400).json({ error: 'Password required for private rooms' });
    }

    // Check for duplicate room name
    const existingRoom = await prisma.chatRoom.findFirst({
      where: { name, isActive: true }
    });

    if (existingRoom) {
      return res.status(409).json({ error: 'Room name already exists' });
    }

    // Hash password for private rooms
    let hashedPassword = null;
    if (type === 'PRIVATE' && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create room
    const room = await prisma.chatRoom.create({
      data: {
        name,
        description,
        type,
        password: hashedPassword,
        creatorId: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        }
      }
    });

    // Auto-join creator as admin
    await prisma.chatRoomMember.create({
      data: {
        roomId: room.id,
        userId,
        role: 'ADMIN',
      }
    });

    res.status(201).json({ room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * GET /api/mim/rooms/:id
 * Get room details
 */
router.get('/rooms/:id', authenticate, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              }
            }
          },
          orderBy: {
            joinedAt: 'asc'
          }
        },
        _count: {
          select: {
            messages: true,
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user has access (public room or is member of private room or is admin)
    const isMember = room.members.some(m => m.userId === userId);
    const isAdmin = req.user.role === 'ADMIN';

    if (room.type === 'PRIVATE' && !isMember && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

/**
 * POST /api/mim/rooms/:id/join
 * Join a chat room
 */
router.post('/rooms/:id/join', authenticate, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;
    const { password } = req.body;

    // Get room
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.isActive) {
      return res.status(403).json({ error: 'Room is no longer active' });
    }

    // Check if already a member
    if (room.members.length > 0) {
      return res.status(400).json({ error: 'Already a member of this room' });
    }

    // Verify password for private rooms
    if (room.type === 'PRIVATE') {
      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }

      const isValidPassword = await bcrypt.compare(password, room.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Join room
    const membership = await prisma.chatRoomMember.create({
      data: {
        roomId,
        userId,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        }
      }
    });

    res.json({ membership, message: 'Successfully joined room' });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

/**
 * POST /api/mim/rooms/:id/leave
 * Leave a chat room
 */
router.post('/rooms/:id/leave', authenticate, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    // Check if member
    const membership = await prisma.chatRoomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        }
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Not a member of this room' });
    }

    // Delete membership
    await prisma.chatRoomMember.delete({
      where: { id: membership.id }
    });

    res.json({ message: 'Successfully left room' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

/**
 * POST /api/mim/rooms/:id/invite
 * Invite a user to a private room
 */
router.post('/rooms/:id/invite', authenticate, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;
    const { inviteeId } = req.body;

    if (!inviteeId) {
      return res.status(400).json({ error: 'inviteeId required' });
    }

    // Get room and check permissions
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only members can invite to private rooms
    if (room.type === 'PRIVATE' && room.members.length === 0) {
      return res.status(403).json({ error: 'Must be a member to invite others' });
    }

    // Check if invitee exists
    const invitee = await prisma.user.findUnique({
      where: { id: inviteeId }
    });

    if (!invitee) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const existingMembership = await prisma.chatRoomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: inviteeId,
        }
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Add invitee to room
    const membership = await prisma.chatRoomMember.create({
      data: {
        roomId,
        userId: inviteeId,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        }
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: inviteeId,
        type: 'GROUP_INVITE',
        message: `${req.user.firstName} ${req.user.lastName} invited you to join ${room.name}`,
        link: `/mim?room=${roomId}`,
      }
    });

    res.json({ membership, message: 'User invited successfully' });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

/**
 * GET /api/mim/rooms/:id/messages
 * Get messages for a room
 */
router.get('/rooms/:id/messages', authenticate, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 100;
    const before = req.query.before; // Cursor for pagination

    // Check room access
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check access (public room or member of private room or admin)
    const isMember = room.members.length > 0;
    const isAdmin = req.user.role === 'ADMIN';

    if (room.type === 'PRIVATE' && !isMember && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const where = { roomId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
    });

    // Reverse to show oldest first
    messages.reverse();

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * DELETE /api/mim/rooms/:id
 * Delete a chat room (creator or admin only)
 */
router.delete('/rooms/:id', authenticate, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is creator or admin
    const isCreator = room.creatorId === userId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the creator or admin can delete this room' });
    }

    // Don't actually delete - just mark as inactive
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { isActive: false }
    });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/**
 * DELETE /api/mim/messages/:id
 * Delete a message (author, room admin, or site admin)
 */
router.delete('/messages/:id', authenticate, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        room: {
          include: {
            members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check permissions
    const isAuthor = message.authorId === userId;
    const isRoomAdmin = message.room.members.some(m => m.userId === userId && m.role === 'ADMIN');
    const isSiteAdmin = req.user.role === 'ADMIN';

    if (!isAuthor && !isRoomAdmin && !isSiteAdmin) {
      return res.status(403).json({ error: 'You can only delete your own messages or you must be a room/site admin' });
    }

    await prisma.chatMessage.delete({
      where: { id: messageId }
    });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
