# Role-Based Access Control (RBAC) Guide

This guide explains Maestroverse's comprehensive role-based access control system, including roles, permissions, and middleware usage.

## 📋 Table of Contents

- [Overview](#overview)
- [Roles](#roles)
- [Permissions](#permissions)
- [Middleware](#middleware)
- [Route Protection Examples](#route-protection-examples)
- [Testing](#testing)
- [Best Practices](#best-practices)

## 🎯 Overview

Maestroverse implements a hierarchical RBAC system with:
- **4 roles**: STUDENT, FACULTY, MODERATOR, ADMIN
- **Role hierarchy**: ADMIN > MODERATOR > FACULTY > STUDENT
- **Permission-based access**: Granular control over specific actions
- **Resource ownership**: Users can access their own resources
- **Flexible middleware**: Multiple ways to protect routes

## 👥 Roles

### Role Hierarchy

```
ADMIN (Level 4)
  ├── Full system access
  ├── User management (ban, delete, promote)
  ├── System configuration
  └── All lower role permissions

MODERATOR (Level 3)
  ├── Content moderation
  ├── User suspension
  ├── Post/comment deletion
  └── Admin panel access

FACULTY (Level 2)
  ├── Course management
  ├── Advanced features
  └── Group management

STUDENT (Level 1)
  ├── Basic platform features
  ├── Content creation
  └── Group participation
```

### Role Definitions

#### STUDENT
- **Default role** for new users
- Can create posts, comments, and join groups
- Can manage own content
- Limited moderation capabilities

#### FACULTY
- Teaching staff and instructors
- Can create and manage courses
- Enhanced group management
- All student permissions

#### MODERATOR
- Community moderators
- Can suspend users temporarily
- Can delete any post/comment
- Access to moderation dashboard
- All faculty permissions

#### ADMIN
- Platform administrators
- Full system access
- Can ban users permanently
- Can promote/demote users
- System configuration access
- All moderator permissions

## 🔐 Permissions

### Permission Categories

#### User Management
```javascript
USER_VIEW          // View user profiles
USER_EDIT          // Edit user information
USER_DELETE        // Delete user accounts
USER_BAN           // Permanently ban users
USER_SUSPEND       // Temporarily suspend users
USER_PROMOTE       // Change user roles
```

#### Content Moderation
```javascript
POST_MODERATE      // Moderate posts
POST_DELETE_ANY    // Delete any post
COMMENT_MODERATE   // Moderate comments
COMMENT_DELETE_ANY // Delete any comment
```

#### Group Management
```javascript
GROUP_CREATE       // Create new groups
GROUP_MANAGE       // Manage group settings
GROUP_DELETE_ANY   // Delete any group
```

#### Admin Panel
```javascript
ADMIN_PANEL_ACCESS // Access admin dashboard
ADMIN_ANALYTICS    // View analytics
ADMIN_SETTINGS     // Change platform settings
```

#### System
```javascript
SYSTEM_CONFIG      // System configuration
SYSTEM_LOGS        // View system logs
```

### Permission Matrix

| Permission | STUDENT | FACULTY | MODERATOR | ADMIN |
|-----------|---------|---------|-----------|-------|
| USER_VIEW | ✅ | ✅ | ✅ | ✅ |
| USER_EDIT | ❌ | ❌ | ❌ | ✅ |
| USER_DELETE | ❌ | ❌ | ❌ | ✅ |
| USER_BAN | ❌ | ❌ | ❌ | ✅ |
| USER_SUSPEND | ❌ | ❌ | ✅ | ✅ |
| USER_PROMOTE | ❌ | ❌ | ❌ | ✅ |
| POST_MODERATE | ❌ | ❌ | ✅ | ✅ |
| POST_DELETE_ANY | ❌ | ❌ | ✅ | ✅ |
| GROUP_CREATE | ✅ | ✅ | ✅ | ✅ |
| GROUP_MANAGE | ❌ | ✅ | ✅ | ✅ |
| ADMIN_PANEL_ACCESS | ❌ | ❌ | ✅ | ✅ |
| SYSTEM_CONFIG | ❌ | ❌ | ❌ | ✅ |

## 🛡️ Middleware

### Basic Middleware

#### 1. requireRole(...roles)
Requires user to have one of the specified roles (exact match).

```javascript
import { requireRole, ROLES } from '../middleware/rbac.js';

// Only admins
router.post('/admin/settings', authenticate, requireRole(ROLES.ADMIN), handler);

// Admins OR Faculty
router.post('/courses', authenticate, requireRole(ROLES.ADMIN, ROLES.FACULTY), handler);
```

#### 2. requireRoleLevel(minimumRole)
Requires user to have at least the specified role level (hierarchical).

```javascript
import { requireRoleLevel, ROLES } from '../middleware/rbac.js';

// Moderators and Admins (level 3+)
router.get('/moderation', authenticate, requireRoleLevel(ROLES.MODERATOR), handler);

// Faculty, Moderators, and Admins (level 2+)
router.post('/courses/:id', authenticate, requireRoleLevel(ROLES.FACULTY), handler);
```

#### 3. requirePermission(...permissions)
Requires user to have specific permissions.

```javascript
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';

// Requires ban permission
router.post('/users/:id/ban',
  authenticate,
  requirePermission(PERMISSIONS.USER_BAN),
  handler
);

// Requires multiple permissions
router.post('/users/:id/promote',
  authenticate,
  requirePermission(PERMISSIONS.USER_EDIT, PERMISSIONS.USER_PROMOTE),
  handler
);
```

### Convenience Middleware

#### requireAdmin
Shorthand for `requireRole(ROLES.ADMIN)`.

```javascript
import { requireAdmin } from '../middleware/rbac.js';

router.post('/admin/config', authenticate, requireAdmin, handler);
```

#### requireModerator
Shorthand for `requireRoleLevel(ROLES.MODERATOR)`.

```javascript
import { requireModerator } from '../middleware/rbac.js';

router.get('/moderation/reports', authenticate, requireModerator, handler);
```

#### requireFaculty
Shorthand for `requireRoleLevel(ROLES.FACULTY)`.

```javascript
import { requireFaculty } from '../middleware/rbac.js';

router.post('/courses/create', authenticate, requireFaculty, handler);
```

### Ownership-Based Middleware

#### requireOwnershipOrRole(ownershipField, ...allowedRoles)
Allows resource owner OR users with specified roles.

```javascript
import { requireOwnershipOrRole, ROLES } from '../middleware/rbac.js';

// User can edit their own profile, OR moderator/admin can edit any
router.put('/users/:userId/profile',
  authenticate,
  requireOwnershipOrRole('userId', ROLES.MODERATOR, ROLES.ADMIN),
  handler
);
```

#### requireResourceOwnership(model, resourceIdParam, ownerField, ...allowedRoles)
Checks database resource ownership.

```javascript
import { requireResourceOwnership, ROLES } from '../middleware/rbac.js';

// User can delete their own post, OR moderator/admin can delete any
router.delete('/posts/:postId',
  authenticate,
  requireResourceOwnership('post', 'postId', 'authorId', ROLES.MODERATOR, ROLES.ADMIN),
  handler
);
```

## 📝 Route Protection Examples

### Example 1: Admin-Only Endpoint

```javascript
router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ users });
});
```

### Example 2: Moderator Dashboard

```javascript
router.get('/moderation/dashboard', authenticate, requireModerator, async (req, res) => {
  const reports = await prisma.report.findMany({
    where: { status: 'PENDING' },
  });
  res.json({ reports });
});
```

### Example 3: Faculty Course Management

```javascript
router.post('/courses', authenticate, requireFaculty, async (req, res) => {
  const course = await prisma.course.create({
    data: req.body,
  });
  res.json({ course });
});
```

### Example 4: Permission-Based User Ban

```javascript
router.post('/users/:userId/ban',
  authenticate,
  requirePermission(PERMISSIONS.USER_BAN),
  async (req, res) => {
    await prisma.user.update({
      where: { id: req.params.userId },
      data: { status: 'BANNED' },
    });
    res.json({ message: 'User banned' });
  }
);
```

### Example 5: Ownership with Moderator Override

```javascript
router.put('/posts/:postId',
  authenticate,
  requireResourceOwnership('post', 'postId', 'authorId', ROLES.MODERATOR),
  async (req, res) => {
    // User can edit their own post
    // Moderators can edit any post
    const post = await prisma.post.update({
      where: { id: req.params.postId },
      data: req.body,
    });
    res.json({ post });
  }
);
```

### Example 6: Multiple HTTP Methods with Different Permissions

```javascript
router.route('/posts/:postId/comments')
  // Anyone can view
  .get(authenticate, handler)
  // Authenticated users can create
  .post(authenticate, handler)
  // Moderators can delete all
  .delete(authenticate, requireModerator, handler);
```

## 🧪 Testing

### Running Tests

```bash
# Using Node.js test runner (Node 18+)
node --test server/src/__tests__/rbac.test.js

# Manual test
node server/src/__tests__/rbac.test.js
```

### Test Coverage

The test suite covers:
- ✅ Role hierarchy validation
- ✅ Permission checking for all roles
- ✅ Permission retrieval
- ✅ Utility function behavior
- ✅ Permission matrix consistency
- ✅ Middleware simulation

### Sample Test Output

```
RBAC Middleware Tests
  Role Hierarchy
    ✓ should correctly identify role levels
    ✓ should match exact role level
  Permission System
    ✓ should grant permissions to admin
    ✓ should grant moderate permissions to moderator
    ✓ should not grant admin permissions to moderator
    ✓ should not grant moderation permissions to student
  Utility Functions
    ✓ canModerate should return true for moderators and admins
    ✓ isAdmin should return true only for admins
    ✓ ownsResource should correctly identify resource ownership
```

## ✅ Best Practices

### 1. Always Authenticate First

```javascript
// ✅ Correct
router.get('/admin/users', authenticate, requireAdmin, handler);

// ❌ Wrong
router.get('/admin/users', requireAdmin, handler);
```

### 2. Use Role Levels for Hierarchical Access

```javascript
// ✅ Correct - allows moderators and admins
router.get('/moderation', authenticate, requireRoleLevel(ROLES.MODERATOR), handler);

// ❌ Wrong - only allows moderators, not admins
router.get('/moderation', authenticate, requireRole(ROLES.MODERATOR), handler);
```

### 3. Use Permissions for Sensitive Actions

```javascript
// ✅ Correct - explicit permission check
router.post('/users/:id/ban', authenticate, requirePermission(PERMISSIONS.USER_BAN), handler);

// ⚠️ Less secure - role-based only
router.post('/users/:id/ban', authenticate, requireAdmin, handler);
```

### 4. Combine Ownership with Moderation

```javascript
// ✅ Correct - owner can edit, moderators can edit any
router.put('/posts/:postId',
  authenticate,
  requireResourceOwnership('post', 'postId', 'authorId', ROLES.MODERATOR),
  handler
);
```

### 5. Document Route Protection

```javascript
/**
 * POST /api/admin/users/:id/suspend
 * Suspend user temporarily
 *
 * @requires Authentication
 * @requires Permission: USER_SUSPEND
 * @access Moderator, Admin
 */
router.post('/users/:id/suspend',
  authenticate,
  requirePermission(PERMISSIONS.USER_SUSPEND),
  handler
);
```

### 6. Handle Authorization Errors Gracefully

```javascript
router.post('/admin/action', authenticate, requireAdmin, async (req, res) => {
  try {
    // Admin action
    res.json({ success: true });
  } catch (error) {
    console.error('Admin action failed:', error);
    res.status(500).json({ error: 'Action failed' });
  }
});
```

### 7. Test Role-Based Features

```javascript
// Test as different roles
describe('Admin Routes', () => {
  it('should allow admin to delete user', async () => {
    const token = await getAdminToken();
    const response = await request(app)
      .delete('/api/admin/users/123')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it('should deny student access', async () => {
    const token = await getStudentToken();
    const response = await request(app)
      .delete('/api/admin/users/123')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
```

## 🔄 Database Seed with Roles

After seeding, you can login with:

```
Admin:
  Email: admin@maestro.edu
  Password: password123
  Role: ADMIN

Moderator:
  Email: moderator@maestro.edu
  Password: password123
  Role: MODERATOR

Faculty:
  Email: faculty@maestro.edu
  Password: password123
  Role: FACULTY

Student:
  Email: alice@maestro.edu
  Password: password123
  Role: STUDENT
```

## 🎯 Common Patterns

### Pattern 1: Public with Enhanced Features for Authenticated Users

```javascript
router.get('/posts/feed', optionalAuth, (req, res) => {
  const response = { posts: [] };

  if (req.user && canModerate(req.user)) {
    response.moderationTools = true;
  }

  res.json(response);
});
```

### Pattern 2: Tiered Feature Access

```javascript
router.get('/analytics', authenticate, (req, res) => {
  const data = { basic: getBasicAnalytics() };

  if (hasRoleLevel(req.user.role, ROLES.FACULTY)) {
    data.advanced = getAdvancedAnalytics();
  }

  if (isAdmin(req.user)) {
    data.system = getSystemAnalytics();
  }

  res.json(data);
});
```

### Pattern 3: Role-Based Response Filtering

```javascript
router.get('/users/:userId', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
  });

  // Everyone sees public info
  const response = {
    id: user.id,
    username: user.username,
    bio: user.bio,
  };

  // Moderators see additional info
  if (canModerate(req.user)) {
    response.email = user.email;
    response.status = user.status;
    response.reports = await getReports(user.id);
  }

  res.json(response);
});
```

## 📚 API Reference

### Utility Functions

```javascript
import {
  ROLES,
  PERMISSIONS,
  hasPermission,
  hasRoleLevel,
  getRolePermissions,
  canModerate,
  isAdmin,
  ownsResource,
  canAccessResource,
} from '../middleware/rbac.js';

// Check if role has permission
hasPermission(ROLES.ADMIN, PERMISSIONS.USER_BAN); // true

// Check role hierarchy
hasRoleLevel(ROLES.MODERATOR, ROLES.STUDENT); // true
hasRoleLevel(ROLES.STUDENT, ROLES.MODERATOR); // false

// Get all permissions for role
getRolePermissions(ROLES.MODERATOR); // ['USER_SUSPEND', ...]

// Quick checks
canModerate({ role: ROLES.MODERATOR }); // true
isAdmin({ role: ROLES.ADMIN }); // true

// Resource ownership
ownsResource({ id: '123' }, { userId: '123' }); // true
canAccessResource({ id: '123', role: ROLES.MODERATOR }, { userId: '456' }); // true
```

## 🚨 Troubleshooting

### Error: "Authentication required"

```json
{ "error": "Authentication required", "code": "AUTH_REQUIRED" }
```

**Solution**: Add `authenticate` middleware before authorization middleware.

### Error: "Insufficient permissions"

```json
{
  "error": "Insufficient permissions",
  "code": "FORBIDDEN",
  "required": ["ADMIN"],
  "current": "STUDENT"
}
```

**Solution**: User doesn't have required role. Check role assignments.

### Error: Role hierarchy not working

```javascript
// ❌ Wrong - exact role match
requireRole(ROLES.MODERATOR) // Only MODERATOR, not ADMIN

// ✅ Correct - hierarchical
requireRoleLevel(ROLES.MODERATOR) // MODERATOR and ADMIN
```

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Production Ready ✅
