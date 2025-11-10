/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Provides comprehensive authorization middleware for Maestroverse with:
 * - Role hierarchy enforcement
 * - Permission-based access control
 * - Resource ownership verification
 * - Flexible authorization rules
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Role hierarchy - higher roles inherit permissions from lower roles
 * ADMIN > MODERATOR > FACULTY > STUDENT
 */
export const ROLES = {
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
};

/**
 * Role hierarchy levels (higher number = more permissions)
 */
const ROLE_HIERARCHY = {
  [ROLES.STUDENT]: 1,
  [ROLES.FACULTY]: 2,
  [ROLES.MODERATOR]: 3,
  [ROLES.ADMIN]: 4,
};

/**
 * Permission definitions grouped by module
 */
export const PERMISSIONS = {
  // User management
  USER_VIEW: 'user:view',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_BAN: 'user:ban',
  USER_SUSPEND: 'user:suspend',
  USER_PROMOTE: 'user:promote',

  // Content moderation
  POST_MODERATE: 'post:moderate',
  POST_DELETE_ANY: 'post:delete:any',
  COMMENT_MODERATE: 'comment:moderate',
  COMMENT_DELETE_ANY: 'comment:delete:any',

  // Group management
  GROUP_CREATE: 'group:create',
  GROUP_MANAGE: 'group:manage',
  GROUP_DELETE_ANY: 'group:delete:any',

  // Admin panel
  ADMIN_PANEL_ACCESS: 'admin:panel:access',
  ADMIN_ANALYTICS: 'admin:analytics',
  ADMIN_SETTINGS: 'admin:settings',

  // System
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOGS: 'system:logs',
};

/**
 * Role-to-permissions mapping
 */
const ROLE_PERMISSIONS = {
  [ROLES.STUDENT]: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.GROUP_CREATE,
  ],

  [ROLES.FACULTY]: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE,
  ],

  [ROLES.MODERATOR]: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.POST_MODERATE,
    PERMISSIONS.POST_DELETE_ANY,
    PERMISSIONS.COMMENT_MODERATE,
    PERMISSIONS.COMMENT_DELETE_ANY,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE,
    PERMISSIONS.ADMIN_PANEL_ACCESS,
  ],

  [ROLES.ADMIN]: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_BAN,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_PROMOTE,
    PERMISSIONS.POST_MODERATE,
    PERMISSIONS.POST_DELETE_ANY,
    PERMISSIONS.COMMENT_MODERATE,
    PERMISSIONS.COMMENT_DELETE_ANY,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE,
    PERMISSIONS.GROUP_DELETE_ANY,
    PERMISSIONS.ADMIN_PANEL_ACCESS,
    PERMISSIONS.ADMIN_ANALYTICS,
    PERMISSIONS.ADMIN_SETTINGS,
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.SYSTEM_LOGS,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if a role is at least the specified level
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean}
 */
export function hasRoleLevel(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Get all permissions for a role (including inherited)
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Middleware: Require specific role(s) - exact match
 * Usage: requireRole(ROLES.ADMIN)
 * Usage: requireRole(ROLES.ADMIN, ROLES.MODERATOR)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware: Require minimum role level (includes higher roles)
 * Usage: requireRoleLevel(ROLES.MODERATOR) - allows MODERATOR and ADMIN
 */
export function requireRoleLevel(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!hasRoleLevel(req.user.role, minimumRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: `${minimumRole} or higher`,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific permission
 * Usage: requirePermission(PERMISSIONS.USER_BAN)
 */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const userPermissions = getRolePermissions(req.user.role);
    const hasAllPermissions = permissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: permissions,
      });
    }

    next();
  };
}

/**
 * Middleware: Require resource ownership OR specific role
 * Usage: requireOwnershipOrRole('userId', ROLES.MODERATOR)
 */
export function requireOwnershipOrRole(ownershipField, ...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Check if user has required role
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Check ownership
    const resourceOwnerId = req.params[ownershipField] || req.body[ownershipField];
    if (resourceOwnerId === req.user.id) {
      return next();
    }

    return res.status(403).json({
      error: 'You can only access your own resources or need moderator access',
      code: 'FORBIDDEN',
    });
  };
}

/**
 * Middleware: Require ownership of database resource OR role
 * Usage: requireResourceOwnership('post', 'postId', 'authorId', ROLES.MODERATOR)
 */
export function requireResourceOwnership(model, resourceIdParam, ownerField, ...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Check if user has required role
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Check resource ownership
    try {
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({
          error: 'Resource ID not provided',
          code: 'BAD_REQUEST',
        });
      }

      const resource = await prisma[model].findUnique({
        where: { id: resourceId },
        select: { [ownerField]: true },
      });

      if (!resource) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'NOT_FOUND',
        });
      }

      if (resource[ownerField] !== req.user.id) {
        return res.status(403).json({
          error: 'You can only access your own resources',
          code: 'FORBIDDEN',
        });
      }

      next();
    } catch (error) {
      console.error('[RBAC] Resource ownership check error:', error);
      res.status(500).json({
        error: 'Failed to verify resource ownership',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

/**
 * Middleware: Admin only access
 * Convenience wrapper for requireRole(ROLES.ADMIN)
 */
export const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * Middleware: Moderator or Admin access
 * Convenience wrapper for requireRoleLevel(ROLES.MODERATOR)
 */
export const requireModerator = requireRoleLevel(ROLES.MODERATOR);

/**
 * Middleware: Faculty or higher access
 * Convenience wrapper for requireRoleLevel(ROLES.FACULTY)
 */
export const requireFaculty = requireRoleLevel(ROLES.FACULTY);

/**
 * Utility: Check if user can moderate content
 */
export function canModerate(user) {
  return hasRoleLevel(user.role, ROLES.MODERATOR);
}

/**
 * Utility: Check if user is admin
 */
export function isAdmin(user) {
  return user.role === ROLES.ADMIN;
}

/**
 * Utility: Check if user owns resource
 */
export function ownsResource(user, resource, ownerField = 'userId') {
  return resource[ownerField] === user.id;
}

/**
 * Utility: Check if user can access resource (owner or moderator)
 */
export function canAccessResource(user, resource, ownerField = 'userId') {
  return ownsResource(user, resource, ownerField) || canModerate(user);
}

/**
 * Export all for easy importing
 */
export default {
  ROLES,
  PERMISSIONS,
  hasPermission,
  hasRoleLevel,
  getRolePermissions,
  requireRole,
  requireRoleLevel,
  requirePermission,
  requireOwnershipOrRole,
  requireResourceOwnership,
  requireAdmin,
  requireModerator,
  requireFaculty,
  canModerate,
  isAdmin,
  ownsResource,
  canAccessResource,
};
