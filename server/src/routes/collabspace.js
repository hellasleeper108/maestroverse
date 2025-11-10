import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ========== COURSES ==========

/**
 * GET /api/collabspace/courses
 * Get all courses
 */
router.get('/courses', authenticate, async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            threads: true,
            studyGroups: true,
            resources: true,
          },
        },
      },
    });

    res.json({ courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * POST /api/collabspace/courses
 * Create a course (admin only in production)
 */
router.post('/courses', authenticate, async (req, res) => {
  try {
    const { code, name, department, description } = req.body;

    const course = await prisma.course.create({
      data: {
        code,
        name,
        department,
        description,
      },
    });

    res.status(201).json({ course });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// ========== THREADS (FORUMS) ==========

/**
 * GET /api/collabspace/courses/:courseId/threads
 * Get course threads
 */
router.get('/courses/:courseId/threads', authenticate, async (req, res) => {
  try {
    const threads = await prisma.thread.findMany({
      where: { courseId: req.params.courseId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
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

    res.json({ threads });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

/**
 * POST /api/collabspace/threads
 * Create a thread
 */
router.post('/threads', authenticate, async (req, res) => {
  try {
    const { title, content, courseId } = req.body;

    const thread = await prisma.thread.create({
      data: {
        title,
        content,
        courseId,
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

    res.status(201).json({ thread });
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

/**
 * GET /api/collabspace/threads/:id
 * Get thread details with replies
 */
router.get('/threads/:id', authenticate, async (req, res) => {
  try {
    const thread = await prisma.thread.findUnique({
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
        course: true,
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
          },
        },
      },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Increment view count
    await prisma.thread.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
    });

    res.json({ thread });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

/**
 * DELETE /api/collabspace/threads/:id
 * Delete a thread (author only)
 */
router.delete('/threads/:id', authenticate, async (req, res) => {
  try {
    const threadId = req.params.id;

    // Check if thread exists and user is the author
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own threads' });
    }

    await prisma.thread.delete({
      where: { id: threadId },
    });

    res.json({ message: 'Thread deleted successfully' });
  } catch (error) {
    console.error('Delete thread error:', error);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

/**
 * POST /api/collabspace/threads/:id/replies
 * Add reply to thread
 */
router.post('/threads/:id/replies', authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const reply = await prisma.threadReply.create({
      data: {
        content,
        threadId: req.params.id,
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

    res.status(201).json({ reply });
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

/**
 * PUT /api/collabspace/replies/:id
 * Edit a thread reply (author only)
 */
router.put('/replies/:id', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const replyId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if reply exists and user is the author
    const reply = await prisma.threadReply.findUnique({
      where: { id: replyId },
    });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (reply.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own replies' });
    }

    const updatedReply = await prisma.threadReply.update({
      where: { id: replyId },
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
      },
    });

    res.json({ reply: updatedReply });
  } catch (error) {
    console.error('Edit reply error:', error);
    res.status(500).json({ error: 'Failed to edit reply' });
  }
});

/**
 * DELETE /api/collabspace/replies/:id
 * Delete a thread reply (author only)
 */
router.delete('/replies/:id', authenticate, async (req, res) => {
  try {
    const replyId = req.params.id;

    // Check if reply exists and user is the author
    const reply = await prisma.threadReply.findUnique({
      where: { id: replyId },
    });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (reply.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own replies' });
    }

    await prisma.threadReply.delete({
      where: { id: replyId },
    });

    res.json({ message: 'Reply deleted successfully' });
  } catch (error) {
    console.error('Delete reply error:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

// ========== STUDY GROUPS ==========

/**
 * GET /api/collabspace/study-groups
 * Browse/discover all study groups with filtering
 */
router.get('/study-groups', authenticate, async (req, res) => {
  try {
    const { courseId, cohort, search, tags } = req.query;

    const where = { isPublic: true };

    if (courseId) where.courseId = courseId;
    if (cohort) where.cohort = cohort;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tags) {
      const tagArray = tags.split(',');
      where.tags = { hasSome: tagArray };
    }

    const studyGroups = await prisma.studyGroup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
                cohort: true,
              },
            },
          },
        },
        _count: {
          select: { members: true, messages: true },
        },
      },
    });

    // Add isMember flag for current user
    const groupsWithMembership = studyGroups.map((group) => ({
      ...group,
      isMember: group.members.some((m) => m.userId === req.user.id),
      isFull: group.members.length >= group.maxMembers,
    }));

    res.json({ studyGroups: groupsWithMembership });
  } catch (error) {
    console.error('Get study groups error:', error);
    res.status(500).json({ error: 'Failed to fetch study groups' });
  }
});

/**
 * GET /api/collabspace/study-groups/my-groups
 * Get current user's study groups
 */
router.get('/study-groups/my-groups', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.studyGroupMember.findMany({
      where: { userId: req.user.id },
      include: {
        studyGroup: {
          include: {
            course: true,
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    photoUrl: true,
                  },
                },
              },
            },
            _count: {
              select: { members: true, messages: true },
            },
          },
        },
      },
    });

    const studyGroups = memberships.map((m) => ({
      ...m.studyGroup,
      membershipRole: m.role,
      joinedAt: m.joinedAt,
    }));

    res.json({ studyGroups });
  } catch (error) {
    console.error('Get my groups error:', error);
    res.status(500).json({ error: 'Failed to fetch your study groups' });
  }
});

/**
 * GET /api/collabspace/study-groups/:id
 * Get study group details
 */
router.get('/study-groups/:id', authenticate, async (req, res) => {
  try {
    const studyGroup = await prisma.studyGroup.findUnique({
      where: { id: req.params.id },
      include: {
        course: true,
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
                cohort: true,
                major: true,
                year: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: {
          select: { members: true, messages: true },
        },
      },
    });

    if (!studyGroup) {
      return res.status(404).json({ error: 'Study group not found' });
    }

    // Check if user is a member
    const membership = studyGroup.members.find((m) => m.userId === req.user.id);

    res.json({
      studyGroup: {
        ...studyGroup,
        isMember: !!membership,
        membershipRole: membership?.role,
        isFull: studyGroup.members.length >= studyGroup.maxMembers,
      },
    });
  } catch (error) {
    console.error('Get study group error:', error);
    res.status(500).json({ error: 'Failed to fetch study group' });
  }
});

/**
 * POST /api/collabspace/study-groups
 * Create a study group
 */
router.post('/study-groups', authenticate, async (req, res) => {
  try {
    const {
      name,
      description,
      courseId,
      cohort,
      tags,
      maxMembers,
      isPublic,
      meetingTime,
      meetingDays,
      location,
    } = req.body;

    const studyGroup = await prisma.studyGroup.create({
      data: {
        name,
        description,
        courseId: courseId || null,
        creatorId: req.user.id,
        cohort,
        tags: tags || [],
        maxMembers: maxMembers || 10,
        isPublic: isPublic !== false,
        meetingTime,
        meetingDays: meetingDays || [],
        location,
        members: {
          create: {
            userId: req.user.id,
            role: 'admin',
          },
        },
      },
      include: {
        course: true,
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    res.status(201).json({ studyGroup });
  } catch (error) {
    console.error('Create study group error:', error);
    res.status(500).json({ error: 'Failed to create study group' });
  }
});

/**
 * PUT /api/collabspace/study-groups/:id
 * Update study group (admin only)
 */
router.put('/study-groups/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const membership = await prisma.studyGroupMember.findUnique({
      where: {
        studyGroupId_userId: {
          studyGroupId: id,
          userId: req.user.id,
        },
      },
    });

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only group admins can update the group' });
    }

    const {
      name,
      description,
      cohort,
      tags,
      maxMembers,
      isPublic,
      meetingTime,
      meetingDays,
      location,
    } = req.body;

    const studyGroup = await prisma.studyGroup.update({
      where: { id },
      data: {
        name,
        description,
        cohort,
        tags,
        maxMembers,
        isPublic,
        meetingTime,
        meetingDays,
        location,
      },
    });

    res.json({ studyGroup });
  } catch (error) {
    console.error('Update study group error:', error);
    res.status(500).json({ error: 'Failed to update study group' });
  }
});

/**
 * POST /api/collabspace/study-groups/:id/join
 * Join a study group
 */
router.post('/study-groups/:id/join', authenticate, async (req, res) => {
  try {
    const studyGroupId = req.params.id;

    // Check if group exists and is public
    const studyGroup = await prisma.studyGroup.findUnique({
      where: { id: studyGroupId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!studyGroup) {
      return res.status(404).json({ error: 'Study group not found' });
    }

    if (!studyGroup.isPublic) {
      return res.status(403).json({ error: 'This study group is private' });
    }

    if (studyGroup._count.members >= studyGroup.maxMembers) {
      return res.status(400).json({ error: 'Study group is full' });
    }

    // Check if already a member
    const existing = await prisma.studyGroupMember.findUnique({
      where: {
        studyGroupId_userId: {
          studyGroupId,
          userId: req.user.id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already a member' });
    }

    await prisma.studyGroupMember.create({
      data: {
        studyGroupId,
        userId: req.user.id,
        role: 'member',
      },
    });

    res.json({ message: 'Joined study group successfully' });
  } catch (error) {
    console.error('Join study group error:', error);
    res.status(500).json({ error: 'Failed to join study group' });
  }
});

/**
 * POST /api/collabspace/study-groups/:id/leave
 * Leave a study group
 */
router.post('/study-groups/:id/leave', authenticate, async (req, res) => {
  try {
    const studyGroupId = req.params.id;

    const membership = await prisma.studyGroupMember.findUnique({
      where: {
        studyGroupId_userId: {
          studyGroupId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(400).json({ error: 'Not a member of this group' });
    }

    // Check if this is the last admin
    if (membership.role === 'admin') {
      const adminCount = await prisma.studyGroupMember.count({
        where: {
          studyGroupId,
          role: 'admin',
        },
      });

      if (adminCount === 1) {
        return res.status(400).json({
          error: 'Cannot leave: You are the only admin. Promote another member to admin first.',
        });
      }
    }

    await prisma.studyGroupMember.delete({
      where: { id: membership.id },
    });

    res.json({ message: 'Left study group successfully' });
  } catch (error) {
    console.error('Leave study group error:', error);
    res.status(500).json({ error: 'Failed to leave study group' });
  }
});

/**
 * GET /api/collabspace/study-groups/:id/messages
 * Get study group messages
 */
router.get('/study-groups/:id/messages', authenticate, async (req, res) => {
  try {
    const studyGroupId = req.params.id;

    // Check if user is a member
    const membership = await prisma.studyGroupMember.findUnique({
      where: {
        studyGroupId_userId: {
          studyGroupId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Must be a member to view messages' });
    }

    const messages = await prisma.groupMessage.findMany({
      where: { studyGroupId },
      orderBy: { createdAt: 'asc' },
      take: 100, // Last 100 messages
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

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/collabspace/study-groups/:id/messages
 * Send a message to study group
 */
router.post('/study-groups/:id/messages', authenticate, async (req, res) => {
  try {
    const studyGroupId = req.params.id;
    const { content } = req.body;

    // Check if user is a member
    const membership = await prisma.studyGroupMember.findUnique({
      where: {
        studyGroupId_userId: {
          studyGroupId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Must be a member to send messages' });
    }

    const message = await prisma.groupMessage.create({
      data: {
        content,
        studyGroupId,
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

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PUT /api/collabspace/messages/:id
 * Edit a group message (author only)
 */
router.put('/messages/:id', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const messageId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if message exists and user is the author
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const updatedMessage = await prisma.groupMessage.update({
      where: { id: messageId },
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
      },
    });

    res.json({ message: updatedMessage });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

/**
 * DELETE /api/collabspace/messages/:id
 * Delete a group message (author only)
 */
router.delete('/messages/:id', authenticate, async (req, res) => {
  try {
    const messageId = req.params.id;

    // Check if message exists and user is the author
    const message = await prisma.groupMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.authorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await prisma.groupMessage.delete({
      where: { id: messageId },
    });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ========== RESOURCES ==========

/**
 * GET /api/collabspace/courses/:courseId/resources
 * Get course resources
 */
router.get('/courses/:courseId/resources', authenticate, async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { voteCount: 'desc' },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        votes: {
          where: { userId: req.user.id },
        },
      },
    });

    res.json({ resources });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

/**
 * POST /api/collabspace/resources
 * Upload a resource
 */
router.post('/resources', authenticate, async (req, res) => {
  try {
    const { title, description, fileUrl, fileType, courseId } = req.body;

    const resource = await prisma.resource.create({
      data: {
        title,
        description,
        fileUrl,
        fileType,
        courseId,
        uploaderId: req.user.id,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ resource });
  } catch (error) {
    console.error('Upload resource error:', error);
    res.status(500).json({ error: 'Failed to upload resource' });
  }
});

/**
 * POST /api/collabspace/resources/:id/vote
 * Vote on a resource
 */
router.post('/resources/:id/vote', authenticate, async (req, res) => {
  try {
    const { value } = req.body; // 1 for upvote, -1 for downvote
    const resourceId = req.params.id;

    if (value !== 1 && value !== -1) {
      return res.status(400).json({ error: 'Vote value must be 1 or -1' });
    }

    // Check if already voted
    const existing = await prisma.resourceVote.findUnique({
      where: {
        resourceId_userId: {
          resourceId,
          userId: req.user.id,
        },
      },
    });

    if (existing) {
      if (existing.value === value) {
        // Remove vote
        await prisma.resourceVote.delete({
          where: { id: existing.id },
        });

        await prisma.resource.update({
          where: { id: resourceId },
          data: { voteCount: { decrement: value } },
        });

        return res.json({ voted: false });
      } else {
        // Change vote
        await prisma.resourceVote.update({
          where: { id: existing.id },
          data: { value },
        });

        await prisma.resource.update({
          where: { id: resourceId },
          data: { voteCount: { increment: value * 2 } },
        });

        return res.json({ voted: true, value });
      }
    }

    // New vote
    await prisma.resourceVote.create({
      data: {
        resourceId,
        userId: req.user.id,
        value,
      },
    });

    await prisma.resource.update({
      where: { id: resourceId },
      data: { voteCount: { increment: value } },
    });

    res.json({ voted: true, value });
  } catch (error) {
    console.error('Vote resource error:', error);
    res.status(500).json({ error: 'Failed to vote on resource' });
  }
});

export default router;
