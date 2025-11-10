import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create demo users
  console.log('Creating users...');
  const password = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@maestro.edu',
        username: 'alice_wonder',
        password,
        firstName: 'Alice',
        lastName: 'Wonder',
        major: 'Computer Science',
        year: 3,
        bio: 'Full-stack developer passionate about AI and web technologies',
        skills: ['JavaScript', 'Python', 'React', 'Node.js'],
        interests: ['Artificial Intelligence', 'Web Development', 'Open Source'],
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@maestro.edu',
        username: 'bob_builder',
        password,
        firstName: 'Bob',
        lastName: 'Builder',
        major: 'Software Engineering',
        year: 4,
        bio: 'Senior software engineer, love building scalable systems',
        skills: ['Java', 'Go', 'Docker', 'Kubernetes'],
        interests: ['DevOps', 'Cloud Computing', 'System Design'],
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'carol@maestro.edu',
        username: 'carol_creative',
        password,
        firstName: 'Carol',
        lastName: 'Creative',
        major: 'Design & Technology',
        year: 2,
        bio: 'UI/UX designer who codes',
        skills: ['Figma', 'CSS', 'TypeScript', 'React'],
        interests: ['Design Systems', 'Accessibility', 'Animation'],
        isVerified: true,
      },
    }),
  ]);

  console.log(`✓ Created ${users.length} users\n`);

  // Create courses
  console.log('Creating courses...');
  const courses = await Promise.all([
    prisma.course.create({
      data: {
        code: 'CS101',
        name: 'Introduction to Computer Science',
        department: 'Computer Science',
        description: 'Fundamental concepts of programming and computation',
      },
    }),
    prisma.course.create({
      data: {
        code: 'CS201',
        name: 'Data Structures and Algorithms',
        department: 'Computer Science',
        description: 'Core data structures and algorithmic techniques',
      },
    }),
    prisma.course.create({
      data: {
        code: 'WEB301',
        name: 'Advanced Web Development',
        department: 'Computer Science',
        description: 'Building modern full-stack web applications',
      },
    }),
  ]);

  console.log(`✓ Created ${courses.length} courses\n`);

  // Create groups
  console.log('Creating groups...');
  const groups = await Promise.all([
    prisma.group.create({
      data: {
        name: 'Coding Club',
        description: 'A community for students who love to code',
        category: 'Technology',
        members: {
          create: [
            { userId: users[0].id, role: 'ADMIN' },
            { userId: users[1].id, role: 'MEMBER' },
          ],
        },
      },
    }),
    prisma.group.create({
      data: {
        name: 'Design Enthusiasts',
        description: 'Share and discuss design ideas',
        category: 'Design',
        members: {
          create: [
            { userId: users[2].id, role: 'ADMIN' },
            { userId: users[0].id, role: 'MEMBER' },
          ],
        },
      },
    }),
  ]);

  console.log(`✓ Created ${groups.length} groups\n`);

  // Create posts
  console.log('Creating posts...');
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        content: 'Just finished my first full-stack project! So excited to share it with everyone 🚀',
        authorId: users[0].id,
        groupId: groups[0].id,
      },
    }),
    prisma.post.create({
      data: {
        content: 'Looking for study partners for the upcoming algorithms exam. Anyone interested?',
        authorId: users[1].id,
      },
    }),
    prisma.post.create({
      data: {
        content: 'New design system components ready! Check them out in Figma 🎨',
        authorId: users[2].id,
        groupId: groups[1].id,
      },
    }),
  ]);

  console.log(`✓ Created ${posts.length} posts\n`);

  // Create projects
  console.log('Creating projects...');
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        title: 'Task Manager App',
        description: 'A full-stack task management application with real-time updates',
        technologies: ['React', 'Node.js', 'PostgreSQL', 'Socket.IO'],
        authorId: users[0].id,
        isPublic: true,
      },
    }),
    prisma.project.create({
      data: {
        title: 'Microservices Architecture Demo',
        description: 'Demonstration of microservices patterns using Docker and Kubernetes',
        technologies: ['Go', 'Docker', 'Kubernetes', 'gRPC'],
        authorId: users[1].id,
        isPublic: true,
      },
    }),
  ]);

  console.log(`✓ Created ${projects.length} projects\n`);

  // Create portfolios
  console.log('Creating portfolios...');
  await Promise.all(
    users.map((user) =>
      prisma.portfolio.create({
        data: {
          userId: user.id,
          headline: `${user.major} Student`,
          summary: `Passionate ${user.major} student at Maestro University`,
          experience: [
            {
              title: 'Software Engineering Intern',
              company: 'Tech Corp',
              startDate: '2023-06',
              endDate: '2023-08',
              description: 'Worked on web applications',
            },
          ],
          education: [
            {
              degree: 'Bachelor of Science',
              institution: 'Maestro University',
              startDate: '2021-09',
              endDate: '2025-05',
              major: user.major,
            },
          ],
        },
      })
    )
  );

  console.log('✓ Created portfolios for all users\n');

  // Create threads
  console.log('Creating forum threads...');
  const threads = await Promise.all([
    prisma.thread.create({
      data: {
        title: 'Best resources for learning React?',
        content: 'What are your favorite resources for learning React? Looking for recommendations!',
        courseId: courses[2].id,
        authorId: users[0].id,
      },
    }),
    prisma.thread.create({
      data: {
        title: 'Tips for the midterm exam',
        content: 'Anyone have tips for preparing for the data structures midterm?',
        courseId: courses[1].id,
        authorId: users[1].id,
      },
    }),
  ]);

  console.log(`✓ Created ${threads.length} forum threads\n`);

  // Create study groups
  console.log('Creating study groups...');
  const studyGroups = await Promise.all([
    prisma.studyGroup.create({
      data: {
        name: 'Algorithm Study Crew',
        description: 'Weekly meetups to solve algorithm problems',
        courseId: courses[1].id,
        maxMembers: 8,
        meetingTime: 'Wednesdays 6 PM',
        location: 'Library Room 301',
        members: {
          create: [
            { userId: users[0].id },
            { userId: users[1].id },
          ],
        },
      },
    }),
  ]);

  console.log(`✓ Created ${studyGroups.length} study groups\n`);

  // Create events
  console.log('Creating events...');
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: 'Hackathon 2024',
        description: 'Annual Maestro University Hackathon - Build amazing projects in 48 hours!',
        location: 'Student Center',
        startDate: new Date('2024-12-15T09:00:00'),
        endDate: new Date('2024-12-17T18:00:00'),
        organizerId: users[0].id,
        groupId: groups[0].id,
      },
    }),
  ]);

  console.log(`✓ Created ${events.length} events\n`);

  // Create MIM Chat Rooms
  console.log('Creating MIM chat rooms...');

  const chatRooms = await Promise.all([
    prisma.chatRoom.create({
      data: {
        name: 'Maestro Lobby',
        description: 'Welcome to the main public chat lobby! Say hi to everyone.',
        type: 'PUBLIC',
        creatorId: users[0].id,
        isActive: true,
      },
    }),
    prisma.chatRoom.create({
      data: {
        name: 'Study Hall',
        description: 'Quiet space for studying together and asking homework questions',
        type: 'PUBLIC',
        creatorId: users[1].id,
        isActive: true,
      },
    }),
    prisma.chatRoom.create({
      data: {
        name: 'Off-Topic',
        description: 'Chat about anything and everything not school-related',
        type: 'PUBLIC',
        creatorId: users[2].id,
        isActive: true,
      },
    }),
  ]);

  // Auto-join all users to the main lobby
  await Promise.all(
    users.map(user =>
      prisma.chatRoomMember.create({
        data: {
          roomId: chatRooms[0].id,
          userId: user.id,
          role: user.id === users[0].id ? 'ADMIN' : 'MEMBER',
        },
      })
    )
  );

  // Add some demo messages to the lobby
  await Promise.all([
    prisma.chatMessage.create({
      data: {
        roomId: chatRooms[0].id,
        authorId: users[0].id,
        content: 'Welcome to MIM! This is the main lobby where everyone can chat.',
      },
    }),
    prisma.chatMessage.create({
      data: {
        roomId: chatRooms[0].id,
        authorId: users[1].id,
        content: 'Hey everyone! Excited to try out this new chat feature!',
      },
    }),
    prisma.chatMessage.create({
      data: {
        roomId: chatRooms[0].id,
        authorId: users[2].id,
        content: 'This is awesome! Way better than email threads 😄',
      },
    }),
  ]);

  console.log(`✓ Created ${chatRooms.length} chat rooms with demo messages\n`);

  console.log('✅ Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Courses: ${courses.length}`);
  console.log(`   - Groups: ${groups.length}`);
  console.log(`   - Posts: ${posts.length}`);
  console.log(`   - Projects: ${projects.length}`);
  console.log(`   - Threads: ${threads.length}`);
  console.log(`   - Study Groups: ${studyGroups.length}`);
  console.log(`   - Events: ${events.length}`);
  console.log(`   - Chat Rooms: ${chatRooms.length}`);
  console.log('\n🔐 Demo credentials:');
  console.log('   Email: alice@maestro.edu / bob@maestro.edu / carol@maestro.edu');
  console.log('   Password: password123\n');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
