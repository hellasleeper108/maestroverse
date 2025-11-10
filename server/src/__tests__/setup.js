/**
 * Jest Test Setup
 * Configures test environment and database cleanup
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

const prisma = new PrismaClient();

// Global test timeout
jest.setTimeout(30000);

// Clean up database before all tests
beforeAll(async () => {
  console.log('🧹 Cleaning up test database...');

  // Delete all data in reverse order of dependencies
  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoomMember.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.message.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.threadReply.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.resourceVote.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.groupMessage.deleteMany();
  await prisma.studyGroupMember.deleteMany();
  await prisma.studyGroup.deleteMany();
  await prisma.event.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.project.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.course.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('✓ Test database cleaned\n');
});

// Disconnect from database after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Export prisma instance for tests
export { prisma };
