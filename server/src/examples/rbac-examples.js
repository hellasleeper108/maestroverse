/**
 * RBAC Route Protection Examples
 *
 * This file demonstrates various ways to protect routes using the RBAC middleware.
 * Copy these examples into your route files as needed.
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  ROLES,
  PERMISSIONS,
  requireRole,
  requireRoleLevel,
  requirePermission,
  requireOwnershipOrRole,
  requireResourceOwnership,
  requireAdmin,
  requireModerator,
  requireFaculty,
} from '../middleware/rbac.js';

const router = express.Router();

// ============================================================================
// EXAMPLE 1: Admin-Only Routes
// ============================================================================

/**
 * Only ADMIN role can access
 * Used for: System settings, user management, critical operations
 */
router.get('/admin/settings', authenticate, requireAdmin, (req, res) => {
  res.json({
    message: 'Admin settings',
    user: req.user,
  });
});

/**
 * Alternative syntax - explicit role check
 */
router.post('/admin/config', authenticate, requireRole(ROLES.ADMIN), (req, res) => {
  res.json({ message: 'Config updated' });
});

// ============================================================================
// EXAMPLE 2: Moderator or Admin Routes
// ============================================================================

/**
 * MODERATOR and ADMIN can access
 * Used for: Content moderation, user suspensions
 */
router.get('/moderation/reports', authenticate, requireModerator, (req, res) => {
  res.json({
    message: 'Moderation reports',
    canModerate: true,
  });
});

/**
 * Using requireRoleLevel - allows MODERATOR and above (including ADMIN)
 */
router.delete('/posts/:postId/moderate', authenticate, requireRoleLevel(ROLES.MODERATOR), (req, res) => {
  res.json({
    message: 'Post removed by moderator',
    postId: req.params.postId,
  });
});

// ============================================================================
// EXAMPLE 3: Faculty or Higher Routes
// ============================================================================

/**
 * FACULTY, MODERATOR, and ADMIN can access
 * Used for: Course management, advanced features
 */
router.post('/courses/create', authenticate, requireFaculty, (req, res) => {
  res.json({
    message: 'Course created',
    role: req.user.role,
  });
});

/**
 * Specific faculty-only feature
 */
router.post('/courses/:courseId/grade', authenticate, requireRole(ROLES.FACULTY, ROLES.ADMIN), (req, res) => {
  res.json({
    message: 'Grades submitted',
    courseId: req.params.courseId,
  });
});

// ============================================================================
// EXAMPLE 4: Permission-Based Routes
// ============================================================================

/**
 * Check for specific permission
 * More granular than role checking
 */
router.post('/users/:userId/ban', authenticate, requirePermission(PERMISSIONS.USER_BAN), (req, res) => {
  res.json({
    message: 'User banned',
    userId: req.params.userId,
  });
});

/**
 * Multiple permissions required
 */
router.post(
  '/users/:userId/promote',
  authenticate,
  requirePermission(PERMISSIONS.USER_EDIT, PERMISSIONS.USER_PROMOTE),
  (req, res) => {
    res.json({
      message: 'User promoted',
      userId: req.params.userId,
    });
  }
);

// ============================================================================
// EXAMPLE 5: Ownership-Based Routes
// ============================================================================

/**
 * User can access their own resource OR be a moderator
 * Used for: Profile editing, content management
 */
router.put(
  '/users/:userId/profile',
  authenticate,
  requireOwnershipOrRole('userId', ROLES.MODERATOR, ROLES.ADMIN),
  (req, res) => {
    res.json({
      message: 'Profile updated',
      userId: req.params.userId,
    });
  }
);

/**
 * User can delete their own post OR be a moderator
 */
router.delete(
  '/posts/:postId',
  authenticate,
  requireResourceOwnership('post', 'postId', 'authorId', ROLES.MODERATOR, ROLES.ADMIN),
  (req, res) => {
    res.json({
      message: 'Post deleted',
      postId: req.params.postId,
    });
  }
);

// ============================================================================
// EXAMPLE 6: Custom Authorization Logic
// ============================================================================

/**
 * Complex authorization with custom logic
 * Combine authentication with custom checks
 */
router.post('/groups/:groupId/join', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const user = req.user;

    // Custom authorization logic
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Students can join public groups
    // Faculty+ can join any group
    if (group.isPrivate && user.role === ROLES.STUDENT) {
      return res.status(403).json({
        error: 'Students cannot join private groups without invitation',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// EXAMPLE 7: Multiple Role Combinations
// ============================================================================

/**
 * Allow multiple specific roles (not hierarchical)
 * FACULTY and MODERATOR can access, but not ADMIN
 */
router.get('/reports/teaching', authenticate, requireRole(ROLES.FACULTY, ROLES.MODERATOR), (req, res) => {
  res.json({
    message: 'Teaching reports',
    role: req.user.role,
  });
});

// ============================================================================
// EXAMPLE 8: Conditional Authorization
// ============================================================================

/**
 * Different permissions for different HTTP methods
 */
router
  .route('/posts/:postId/comments')
  // Anyone authenticated can view comments
  .get(authenticate, (req, res) => {
    res.json({ comments: [] });
  })
  // Only authenticated users can create comments
  .post(authenticate, (req, res) => {
    res.json({ message: 'Comment created' });
  })
  // Only moderators can delete all comments
  .delete(authenticate, requireModerator, (req, res) => {
    res.json({ message: 'Comments deleted' });
  });

// ============================================================================
// EXAMPLE 9: Soft Authorization (Optional Roles)
// ============================================================================

/**
 * Public endpoint with enhanced features for higher roles
 * Uses custom middleware to add role-based data
 */
router.get('/posts/feed', authenticate, (req, res) => {
  const baseResponse = {
    posts: [],
  };

  // Add moderation tools for moderators
  if (req.user.role === ROLES.MODERATOR || req.user.role === ROLES.ADMIN) {
    baseResponse.moderationTools = true;
    baseResponse.canDeleteAny = true;
  }

  res.json(baseResponse);
});

// ============================================================================
// EXAMPLE 10: Error Handling with RBAC
// ============================================================================

/**
 * Proper error handling for authorization failures
 */
router.post('/admin/critical-action', authenticate, requireAdmin, async (req, res) => {
  try {
    // Critical admin action
    res.json({ message: 'Action completed' });
  } catch (error) {
    console.error('[RBAC] Critical action failed:', error);
    res.status(500).json({
      error: 'Action failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ============================================================================
// COMMON PATTERNS SUMMARY
// ============================================================================

/*
1. Admin only:
   authenticate, requireAdmin

2. Moderator or higher:
   authenticate, requireModerator
   authenticate, requireRoleLevel(ROLES.MODERATOR)

3. Faculty or higher:
   authenticate, requireFaculty
   authenticate, requireRoleLevel(ROLES.FACULTY)

4. Specific roles only:
   authenticate, requireRole(ROLES.FACULTY, ROLES.MODERATOR)

5. Permission-based:
   authenticate, requirePermission(PERMISSIONS.USER_BAN)

6. Ownership or moderator:
   authenticate, requireOwnershipOrRole('userId', ROLES.MODERATOR)
   authenticate, requireResourceOwnership('post', 'postId', 'authorId', ROLES.MODERATOR)

7. Everyone authenticated:
   authenticate

8. Optional authentication (public + enhanced for authenticated):
   optionalAuth
*/

export default router;
