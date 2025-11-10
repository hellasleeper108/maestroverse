import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Store active connections
const activeUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

/**
 * Initialize WebSocket server with Socket.IO
 */
export function initializeWebSocket(io) {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Store user connection
    activeUsers.set(socket.user.id, socket.id);
    userSockets.set(socket.id, socket.user.id);

    // Join user's personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Emit online status to all users
    io.emit('user:online', {
      userId: socket.user.id,
      username: socket.user.username,
    });

    // ========== MESSAGING ==========

    /**
     * Send direct message
     */
    socket.on('message:send', async (data) => {
      try {
        const { receiverId, content } = data;

        // Create message in database
        const message = await prisma.message.create({
          data: {
            content,
            senderId: socket.user.id,
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

        // Send to receiver if online
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message:receive', message);
        }

        // Send confirmation to sender
        socket.emit('message:sent', message);

        // Create notification
        await prisma.notification.create({
          data: {
            type: 'MESSAGE',
            message: `${socket.user.firstName} ${socket.user.lastName} sent you a message`,
            link: `/hub/messages`,
            userId: receiverId,
          },
        });

        // Emit notification
        io.to(`user:${receiverId}`).emit('notification:new', {
          type: 'MESSAGE',
          message: `New message from ${socket.user.firstName}`,
        });
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Typing indicator
     */
    socket.on('message:typing', (data) => {
      const { receiverId } = data;
      const receiverSocketId = activeUsers.get(receiverId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:typing', {
          senderId: socket.user.id,
          senderName: socket.user.firstName,
        });
      }
    });

    // ========== NOTIFICATIONS ==========

    /**
     * Mark notification as read
     */
    socket.on('notification:read', async (data) => {
      try {
        const { notificationId } = data;

        await prisma.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });

        socket.emit('notification:updated', { notificationId, isRead: true });
      } catch (error) {
        console.error('Notification read error:', error);
      }
    });

    /**
     * Get unread notifications count
     */
    socket.on('notification:count', async () => {
      try {
        const count = await prisma.notification.count({
          where: {
            userId: socket.user.id,
            isRead: false,
          },
        });

        socket.emit('notification:count', { count });
      } catch (error) {
        console.error('Notification count error:', error);
      }
    });

    // ========== REAL-TIME FEED UPDATES ==========

    /**
     * Join a group room for real-time updates
     */
    socket.on('group:join', (data) => {
      const { groupId } = data;
      socket.join(`group:${groupId}`);
    });

    /**
     * Leave a group room
     */
    socket.on('group:leave', (data) => {
      const { groupId } = data;
      socket.leave(`group:${groupId}`);
    });

    /**
     * New post notification
     */
    socket.on('post:new', (data) => {
      const { post, groupId } = data;

      if (groupId) {
        io.to(`group:${groupId}`).emit('post:update', { post });
      } else {
        io.emit('post:update', { post });
      }
    });

    // ========== COLLABORATION ==========

    /**
     * Join course room
     */
    socket.on('course:join', (data) => {
      const { courseId } = data;
      socket.join(`course:${courseId}`);
    });

    /**
     * Leave course room
     */
    socket.on('course:leave', (data) => {
      const { courseId } = data;
      socket.leave(`course:${courseId}`);
    });

    /**
     * Study group chat
     */
    socket.on('studygroup:message', async (data) => {
      const { studyGroupId, message } = data;

      io.to(`studygroup:${studyGroupId}`).emit('studygroup:message', {
        user: socket.user,
        message,
        timestamp: new Date(),
      });
    });

    /**
     * Join study group room
     */
    socket.on('studygroup:join', (data) => {
      const { studyGroupId } = data;
      socket.join(`studygroup:${studyGroupId}`);
    });

    // ========== MIM (CHAT ROOMS) ==========

    /**
     * Join chat room
     */
    socket.on('chatroom:join', async (data) => {
      try {
        const { roomId } = data;

        // Verify user has access to this room
        const membership = await prisma.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: socket.user.id,
            }
          },
          include: {
            room: true,
          }
        });

        if (!membership) {
          // Check if it's a public room
          const room = await prisma.chatRoom.findUnique({
            where: { id: roomId },
          });

          if (!room || room.type === 'PRIVATE') {
            socket.emit('error', { message: 'Access denied to this room' });
            return;
          }
        }

        // Join the room
        socket.join(`chatroom:${roomId}`);

        // Get current users in room
        const roomMembers = await prisma.chatRoomMember.findMany({
          where: { roomId },
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
          }
        });

        // Send user list to the joining user
        socket.emit('chatroom:userlist', {
          roomId,
          users: roomMembers.map(m => ({
            ...m.user,
            role: m.role,
            isOnline: activeUsers.has(m.userId),
          })),
        });

        // Notify room that user joined
        io.to(`chatroom:${roomId}`).emit('chatroom:user_joined', {
          roomId,
          user: {
            id: socket.user.id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            username: socket.user.username,
            photoUrl: socket.user.photoUrl,
          },
        });
      } catch (error) {
        console.error('Chatroom join error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * Leave chat room
     */
    socket.on('chatroom:leave', (data) => {
      const { roomId } = data;
      socket.leave(`chatroom:${roomId}`);

      // Notify room that user left
      io.to(`chatroom:${roomId}`).emit('chatroom:user_left', {
        roomId,
        userId: socket.user.id,
        username: socket.user.username,
      });
    });

    /**
     * Send message to chat room
     */
    socket.on('chatroom:message', async (data) => {
      try {
        const { roomId, content } = data;

        // Verify user is a member of the room
        const membership = await prisma.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: socket.user.id,
            }
          }
        });

        if (!membership) {
          // Check if it's a public room
          const room = await prisma.chatRoom.findUnique({
            where: { id: roomId },
          });

          if (!room || room.type === 'PRIVATE') {
            socket.emit('error', { message: 'You are not a member of this room' });
            return;
          }
        }

        // Create message in database
        const message = await prisma.chatMessage.create({
          data: {
            roomId,
            authorId: socket.user.id,
            content,
          },
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
          }
        });

        // Broadcast message to all users in the room
        io.to(`chatroom:${roomId}`).emit('chatroom:message', message);

      } catch (error) {
        console.error('Chatroom message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * User is typing in chat room
     */
    socket.on('chatroom:typing', (data) => {
      const { roomId, isTyping } = data;

      // Broadcast to room (except sender)
      socket.to(`chatroom:${roomId}`).emit('chatroom:typing', {
        roomId,
        userId: socket.user.id,
        username: socket.user.username,
        firstName: socket.user.firstName,
        isTyping,
      });
    });

    /**
     * Delete message from chat room
     */
    socket.on('chatroom:delete_message', async (data) => {
      try {
        const { messageId, roomId } = data;

        // Get message
        const message = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          include: {
            room: {
              include: {
                members: {
                  where: { userId: socket.user.id }
                }
              }
            }
          }
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check permissions (author, room admin, or site admin)
        const isAuthor = message.authorId === socket.user.id;
        const isRoomAdmin = message.room.members.some(m => m.role === 'ADMIN');
        const isSiteAdmin = socket.user.role === 'ADMIN';

        if (!isAuthor && !isRoomAdmin && !isSiteAdmin) {
          socket.emit('error', { message: 'Permission denied' });
          return;
        }

        // Delete message
        await prisma.chatMessage.delete({
          where: { id: messageId }
        });

        // Notify room that message was deleted
        io.to(`chatroom:${roomId}`).emit('chatroom:message_deleted', {
          roomId,
          messageId,
        });

      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // ========== DISCONNECT ==========

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);

      // Remove from active users
      activeUsers.delete(socket.user.id);
      userSockets.delete(socket.id);

      // Emit offline status
      io.emit('user:offline', {
        userId: socket.user.id,
        username: socket.user.username,
      });

      // Update last active timestamp
      prisma.user.update({
        where: { id: socket.user.id },
        data: { lastActive: new Date() },
      }).catch(console.error);
    });
  });

  console.log('WebSocket server initialized');
}

/**
 * Helper function to emit notification to a specific user
 */
export function emitNotification(io, userId, notification) {
  io.to(`user:${userId}`).emit('notification:new', notification);
}

/**
 * Helper function to broadcast to a group
 */
export function broadcastToGroup(io, groupId, event, data) {
  io.to(`group:${groupId}`).emit(event, data);
}

/**
 * Get active users count
 */
export function getActiveUsersCount() {
  return activeUsers.size;
}
