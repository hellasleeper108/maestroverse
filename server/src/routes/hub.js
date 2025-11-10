import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// ========== POSTS ==========

const createPostSchema = z.object({
  content: z.string().min(1),
  mediaUrls: z.array(z.string()).optional(),
  groupId: z.string().optional(),
});

/**
 * GET /api/hub/posts
 * Get feed posts
 */
router.get('/posts', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      take: parseInt(limit),
      skip: parseInt(skip),
      orderBy: { createdAt: 'desc' },
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
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    res.json({ posts });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/**
 * POST /api/hub/posts
 * Create a new post
 */
router.post('/posts', authenticate, async (req, res) => {
  try {
    const data = createPostSchema.parse(req.body);

    const post = await prisma.post.create({
      data: {
        content: data.content,
        mediaUrls: data.mediaUrls || [],
        authorId: req.user.id,
        groupId: data.groupId,
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

    res.status(201).json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * GET /api/hub/posts/:id
 * Get a single post by ID
 */
router.get('/posts/:id', authenticate, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
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
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

/**
 * DELETE /api/hub/posts/:id
 * Delete a post (author only)
 */
router.delete('/posts/:id', authenticate, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check if post exists and user is the author
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

/**
 * POST /api/hub/posts/:id/like
 * Like/unlike a post
 */
router.post('/posts/:id/like', authenticate, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: req.user.id,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      res.json({ liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          postId,
          userId: req.user.id,
        },
      });

      // Create notification for post author
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });

      if (post.authorId !== req.user.id) {
        await prisma.notification.create({
          data: {
            type: 'LIKE',
            message: `${req.user.firstName} ${req.user.lastName} liked your post`,
            link: `/hub/posts/${postId}`,
            userId: post.authorId,
          },
        });
      }

      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

/**
 * POST /api/hub/posts/:id/comments
 * Add comment to post (or reply to comment)
 */
router.post('/posts/:id/comments', authenticate, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    const postId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        authorId: req.user.id,
        parentId: parentId || null,
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
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Create notification
    if (parentId) {
      // Reply to a comment - notify the comment author
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { authorId: true },
      });

      if (parentComment && parentComment.authorId !== req.user.id) {
        await prisma.notification.create({
          data: {
            type: 'COMMENT',
            message: `${req.user.firstName} ${req.user.lastName} replied to your comment`,
            link: `/hub/posts/${postId}`,
            userId: parentComment.authorId,
          },
        });
      }
    } else {
      // Top-level comment - notify the post author
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });

      if (post && post.authorId !== req.user.id) {
        await prisma.notification.create({
          data: {
            type: 'COMMENT',
            message: `${req.user.firstName} ${req.user.lastName} commented on your post`,
            link: `/hub/posts/${postId}`,
            userId: post.authorId,
          },
        });
      }
    }

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

/**
 * PUT /api/hub/comments/:id
 * Edit a comment (author only)
 */
router.put('/comments/:id', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const commentId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if comment exists and user is the author
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
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
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    res.json({ comment: updatedComment });
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

/**
 * DELETE /api/hub/comments/:id
 * Delete a comment (author only)
 */
router.delete('/comments/:id', authenticate, async (req, res) => {
  try {
    const commentId = req.params.id;

    // Check if comment exists and user is the author
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/**
 * GET /api/hub/posts/:id/comments
 * Get post comments with nested replies
 */
router.get('/posts/:id/comments', authenticate, async (req, res) => {
  try {
    // Get only top-level comments (parentId is null) with their replies
    const comments = await prisma.comment.findMany({
      where: {
        postId: req.params.id,
        parentId: null // Only top-level comments
      },
      orderBy: { createdAt: 'asc' },
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
        replies: {
          orderBy: { createdAt: 'asc' },
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
            _count: {
              select: {
                replies: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ========== GROUPS ==========

/**
 * GET /api/hub/groups
 * Get all groups
 */
router.get('/groups', authenticate, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: {
            members: true,
            posts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * POST /api/hub/groups
 * Create a group
 */
router.post('/groups', authenticate, async (req, res) => {
  try {
    const { name, description, category, isPrivate } = req.body;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        category,
        isPrivate: isPrivate || false,
        members: {
          create: {
            userId: req.user.id,
            role: 'ADMIN',
          },
        },
      },
    });

    res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * POST /api/hub/groups/:id/join
 * Join a group
 */
router.post('/groups/:id/join', authenticate, async (req, res) => {
  try {
    const groupId = req.params.id;

    // Check if already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: req.user.id,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    await prisma.groupMember.create({
      data: {
        groupId,
        userId: req.user.id,
      },
    });

    res.json({ message: 'Joined group successfully' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// ========== EVENTS ==========

/**
 * GET /api/hub/events
 * Get upcoming events
 */
router.get('/events', authenticate, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: {
        startDate: {
          gte: new Date(),
        },
      },
      orderBy: { startDate: 'asc' },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * POST /api/hub/events
 * Create an event
 */
router.post('/events', authenticate, async (req, res) => {
  try {
    const { title, description, location, startDate, endDate, groupId } = req.body;

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        organizerId: req.user.id,
        groupId,
      },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ========== MESSAGES ==========

/**
 * GET /api/hub/messages
 * Get user's messages
 */
router.get('/messages', authenticate, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        receiver: {
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

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/hub/messages
 * Send a message
 */
router.post('/messages', authenticate, async (req, res) => {
  try {
    const { content, receiverId } = req.body;

    const message = await prisma.message.create({
      data: {
        content,
        senderId: req.user.id,
        receiverId,
      },
      include: {
        sender: {
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

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'MESSAGE',
        message: `${req.user.firstName} ${req.user.lastName} sent you a message`,
        link: `/hub/messages/${message.id}`,
        userId: receiverId,
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
