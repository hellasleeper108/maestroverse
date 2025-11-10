/**
 * RBAC Middleware Test Suite
 *
 * Tests for role-based access control functionality
 * Run with: npm test or node --test src/__tests__/rbac.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
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

describe('RBAC Middleware Tests', () => {
  describe('Role Hierarchy', () => {
    it('should correctly identify role levels', () => {
      assert.strictEqual(hasRoleLevel(ROLES.ADMIN, ROLES.STUDENT), true);
      assert.strictEqual(hasRoleLevel(ROLES.ADMIN, ROLES.MODERATOR), true);
      assert.strictEqual(hasRoleLevel(ROLES.MODERATOR, ROLES.STUDENT), true);
      assert.strictEqual(hasRoleLevel(ROLES.MODERATOR, ROLES.ADMIN), false);
      assert.strictEqual(hasRoleLevel(ROLES.STUDENT, ROLES.MODERATOR), false);
      assert.strictEqual(hasRoleLevel(ROLES.FACULTY, ROLES.STUDENT), true);
    });

    it('should match exact role level', () => {
      assert.strictEqual(hasRoleLevel(ROLES.STUDENT, ROLES.STUDENT), true);
      assert.strictEqual(hasRoleLevel(ROLES.MODERATOR, ROLES.MODERATOR), true);
      assert.strictEqual(hasRoleLevel(ROLES.ADMIN, ROLES.ADMIN), true);
    });
  });

  describe('Permission System', () => {
    it('should grant permissions to admin', () => {
      assert.strictEqual(hasPermission(ROLES.ADMIN, PERMISSIONS.USER_BAN), true);
      assert.strictEqual(hasPermission(ROLES.ADMIN, PERMISSIONS.USER_DELETE), true);
      assert.strictEqual(hasPermission(ROLES.ADMIN, PERMISSIONS.SYSTEM_CONFIG), true);
    });

    it('should grant moderate permissions to moderator', () => {
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.USER_SUSPEND), true);
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.POST_MODERATE), true);
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.COMMENT_DELETE_ANY), true);
    });

    it('should not grant admin permissions to moderator', () => {
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.USER_BAN), false);
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.USER_DELETE), false);
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.SYSTEM_CONFIG), false);
    });

    it('should not grant moderation permissions to student', () => {
      assert.strictEqual(hasPermission(ROLES.STUDENT, PERMISSIONS.USER_SUSPEND), false);
      assert.strictEqual(hasPermission(ROLES.STUDENT, PERMISSIONS.POST_MODERATE), false);
      assert.strictEqual(hasPermission(ROLES.STUDENT, PERMISSIONS.USER_BAN), false);
    });

    it('should grant basic permissions to all roles', () => {
      assert.strictEqual(hasPermission(ROLES.STUDENT, PERMISSIONS.USER_VIEW), true);
      assert.strictEqual(hasPermission(ROLES.FACULTY, PERMISSIONS.USER_VIEW), true);
      assert.strictEqual(hasPermission(ROLES.MODERATOR, PERMISSIONS.USER_VIEW), true);
      assert.strictEqual(hasPermission(ROLES.ADMIN, PERMISSIONS.USER_VIEW), true);
    });
  });

  describe('Role Permission Retrieval', () => {
    it('should return all permissions for admin', () => {
      const permissions = getRolePermissions(ROLES.ADMIN);
      assert.strictEqual(Array.isArray(permissions), true);
      assert.ok(permissions.length > 10);
      assert.ok(permissions.includes(PERMISSIONS.USER_BAN));
      assert.ok(permissions.includes(PERMISSIONS.SYSTEM_CONFIG));
    });

    it('should return moderate permissions for moderator', () => {
      const permissions = getRolePermissions(ROLES.MODERATOR);
      assert.ok(permissions.includes(PERMISSIONS.USER_SUSPEND));
      assert.ok(permissions.includes(PERMISSIONS.POST_MODERATE));
      assert.strictEqual(permissions.includes(PERMISSIONS.USER_BAN), false);
    });

    it('should return limited permissions for student', () => {
      const permissions = getRolePermissions(ROLES.STUDENT);
      assert.ok(permissions.length < 5);
      assert.ok(permissions.includes(PERMISSIONS.USER_VIEW));
      assert.ok(permissions.includes(PERMISSIONS.GROUP_CREATE));
    });

    it('should return empty array for invalid role', () => {
      const permissions = getRolePermissions('INVALID_ROLE');
      assert.deepStrictEqual(permissions, []);
    });
  });

  describe('Utility Functions', () => {
    it('canModerate should return true for moderators and admins', () => {
      assert.strictEqual(canModerate({ role: ROLES.MODERATOR }), true);
      assert.strictEqual(canModerate({ role: ROLES.ADMIN }), true);
      assert.strictEqual(canModerate({ role: ROLES.FACULTY }), false);
      assert.strictEqual(canModerate({ role: ROLES.STUDENT }), false);
    });

    it('isAdmin should return true only for admins', () => {
      assert.strictEqual(isAdmin({ role: ROLES.ADMIN }), true);
      assert.strictEqual(isAdmin({ role: ROLES.MODERATOR }), false);
      assert.strictEqual(isAdmin({ role: ROLES.FACULTY }), false);
      assert.strictEqual(isAdmin({ role: ROLES.STUDENT }), false);
    });

    it('ownsResource should correctly identify resource ownership', () => {
      const user = { id: 'user123' };
      const ownedResource = { userId: 'user123' };
      const notOwnedResource = { userId: 'user456' };

      assert.strictEqual(ownsResource(user, ownedResource), true);
      assert.strictEqual(ownsResource(user, notOwnedResource), false);
    });

    it('ownsResource should work with custom owner field', () => {
      const user = { id: 'user123' };
      const resource = { authorId: 'user123' };

      assert.strictEqual(ownsResource(user, resource, 'authorId'), true);
      assert.strictEqual(ownsResource(user, resource, 'userId'), false);
    });

    it('canAccessResource should allow owner or moderator', () => {
      const owner = { id: 'user123', role: ROLES.STUDENT };
      const moderator = { id: 'user456', role: ROLES.MODERATOR };
      const otherUser = { id: 'user789', role: ROLES.STUDENT };
      const resource = { userId: 'user123' };

      assert.strictEqual(canAccessResource(owner, resource), true);
      assert.strictEqual(canAccessResource(moderator, resource), true);
      assert.strictEqual(canAccessResource(otherUser, resource), false);
    });
  });

  describe('Permission Matrix Validation', () => {
    it('should have consistent permission hierarchy', () => {
      const studentPerms = getRolePermissions(ROLES.STUDENT);
      const facultyPerms = getRolePermissions(ROLES.FACULTY);
      const moderatorPerms = getRolePermissions(ROLES.MODERATOR);
      const adminPerms = getRolePermissions(ROLES.ADMIN);

      // Admin should have most permissions
      assert.ok(adminPerms.length > moderatorPerms.length);
      assert.ok(adminPerms.length > facultyPerms.length);
      assert.ok(adminPerms.length > studentPerms.length);

      // Moderator should have more than student
      assert.ok(moderatorPerms.length > studentPerms.length);
    });

    it('should define all critical admin permissions', () => {
      const adminPerms = getRolePermissions(ROLES.ADMIN);

      const criticalPerms = [
        PERMISSIONS.USER_DELETE,
        PERMISSIONS.USER_BAN,
        PERMISSIONS.USER_PROMOTE,
        PERMISSIONS.SYSTEM_CONFIG,
        PERMISSIONS.ADMIN_SETTINGS,
      ];

      criticalPerms.forEach((perm) => {
        assert.ok(adminPerms.includes(perm), `Admin should have ${perm} permission`);
      });
    });

    it('should not grant sensitive permissions to students', () => {
      const studentPerms = getRolePermissions(ROLES.STUDENT);

      const sensitivePerms = [
        PERMISSIONS.USER_DELETE,
        PERMISSIONS.USER_BAN,
        PERMISSIONS.USER_SUSPEND,
        PERMISSIONS.POST_DELETE_ANY,
        PERMISSIONS.SYSTEM_CONFIG,
      ];

      sensitivePerms.forEach((perm) => {
        assert.strictEqual(
          studentPerms.includes(perm),
          false,
          `Student should not have ${perm} permission`
        );
      });
    });
  });

  describe('Middleware Request Simulation', () => {
    it('should simulate requireRole middleware behavior', () => {
      const adminUser = { role: ROLES.ADMIN };
      const studentUser = { role: ROLES.STUDENT };

      // Simulate checking if user has required role
      const isAdminAllowed = [ROLES.ADMIN].includes(adminUser.role);
      const isStudentAllowed = [ROLES.ADMIN].includes(studentUser.role);

      assert.strictEqual(isAdminAllowed, true);
      assert.strictEqual(isStudentAllowed, false);
    });

    it('should simulate requireRoleLevel middleware behavior', () => {
      const adminUser = { role: ROLES.ADMIN };
      const moderatorUser = { role: ROLES.MODERATOR };
      const studentUser = { role: ROLES.STUDENT };

      // Simulate checking if user meets minimum role level
      const isAdminAllowed = hasRoleLevel(adminUser.role, ROLES.MODERATOR);
      const isModeratorAllowed = hasRoleLevel(moderatorUser.role, ROLES.MODERATOR);
      const isStudentAllowed = hasRoleLevel(studentUser.role, ROLES.MODERATOR);

      assert.strictEqual(isAdminAllowed, true);
      assert.strictEqual(isModeratorAllowed, true);
      assert.strictEqual(isStudentAllowed, false);
    });

    it('should simulate requirePermission middleware behavior', () => {
      const adminUser = { role: ROLES.ADMIN };
      const moderatorUser = { role: ROLES.MODERATOR };
      const studentUser = { role: ROLES.STUDENT };

      // Simulate permission check
      const requiredPerms = [PERMISSIONS.USER_BAN];

      const adminHasPerms = requiredPerms.every((perm) => hasPermission(adminUser.role, perm));
      const moderatorHasPerms = requiredPerms.every((perm) =>
        hasPermission(moderatorUser.role, perm)
      );
      const studentHasPerms = requiredPerms.every((perm) => hasPermission(studentUser.role, perm));

      assert.strictEqual(adminHasPerms, true);
      assert.strictEqual(moderatorHasPerms, false);
      assert.strictEqual(studentHasPerms, false);
    });
  });
});

// Manual test runner (if not using Node.js test runner)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running RBAC tests manually...\n');

  const tests = [
    { name: 'Role hierarchy', fn: () => hasRoleLevel(ROLES.ADMIN, ROLES.STUDENT) === true },
    {
      name: 'Admin permissions',
      fn: () => hasPermission(ROLES.ADMIN, PERMISSIONS.USER_BAN) === true,
    },
    {
      name: 'Moderator permissions',
      fn: () => hasPermission(ROLES.MODERATOR, PERMISSIONS.USER_SUSPEND) === true,
    },
    {
      name: 'Student restrictions',
      fn: () => hasPermission(ROLES.STUDENT, PERMISSIONS.USER_BAN) === false,
    },
    { name: 'Can moderate check', fn: () => canModerate({ role: ROLES.MODERATOR }) === true },
    { name: 'Is admin check', fn: () => isAdmin({ role: ROLES.ADMIN }) === true },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    try {
      if (test.fn()) {
        console.log(`✓ ${test.name}`);
        passed++;
      } else {
        console.log(`✗ ${test.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${test.name} - ${error.message}`);
      failed++;
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
