/**
 * Test Routes for RBAC (Role-Based Access Control)
 *
 * These routes are used for testing role-based authorization.
 * DO NOT use in production - these are for testing purposes only.
 *
 * Role Hierarchy:
 * - STUDENT: Basic access
 * - FACULTY: Enhanced access
 * - MODERATOR: Content moderation access
 * - ADMIN: Full administrative access
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTE (No authentication required)
// ============================================================================

router.get('/public', (req, res) => {
  res.json({
    message: 'Public route - accessible to everyone',
    authenticated: false,
  });
});

// ============================================================================
// AUTHENTICATED ROUTE (Any authenticated user)
// ============================================================================

router.get('/authenticated', authenticate, (req, res) => {
  res.json({
    message: 'Authenticated route - accessible to any logged-in user',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

// ============================================================================
// STUDENT ROUTES (STUDENT role only)
// ============================================================================

router.get('/student', authenticate, authorize('STUDENT'), (req, res) => {
  res.json({
    message: 'Student-only route',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

router.post('/student/action', authenticate, authorize('STUDENT'), (req, res) => {
  res.json({
    message: 'Student action completed',
    action: req.body.action || 'default',
  });
});

// ============================================================================
// FACULTY ROUTES (FACULTY role only)
// ============================================================================

router.get('/faculty', authenticate, authorize('FACULTY'), (req, res) => {
  res.json({
    message: 'Faculty-only route',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

router.post('/faculty/grade', authenticate, authorize('FACULTY'), (req, res) => {
  res.json({
    message: 'Grade submitted',
    student: req.body.student,
    grade: req.body.grade,
  });
});

// ============================================================================
// MODERATOR ROUTES (MODERATOR role only)
// ============================================================================

router.get('/moderator', authenticate, authorize('MODERATOR'), (req, res) => {
  res.json({
    message: 'Moderator-only route',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

router.post('/moderator/action', authenticate, authorize('MODERATOR'), (req, res) => {
  res.json({
    message: 'Moderation action completed',
    action: req.body.action,
    target: req.body.target,
  });
});

router.delete('/moderator/content/:id', authenticate, authorize('MODERATOR'), (req, res) => {
  res.json({
    message: 'Content moderated',
    contentId: req.params.id,
    moderator: req.user.id,
  });
});

// ============================================================================
// ADMIN ROUTES (ADMIN role only)
// ============================================================================

router.get('/admin', authenticate, authorize('ADMIN'), (req, res) => {
  res.json({
    message: 'Admin-only route',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

router.post('/admin/action', authenticate, authorize('ADMIN'), (req, res) => {
  res.json({
    message: 'Admin action completed',
    action: req.body.action,
  });
});

router.delete('/admin/user/:id', authenticate, authorize('ADMIN'), (req, res) => {
  res.json({
    message: 'User deleted by admin',
    userId: req.params.id,
    admin: req.user.id,
  });
});

// ============================================================================
// MULTI-ROLE ROUTES (Multiple roles allowed)
// ============================================================================

router.get('/moderator-or-admin', authenticate, authorize('MODERATOR', 'ADMIN'), (req, res) => {
  res.json({
    message: 'Route accessible to moderators and admins',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

router.get('/faculty-or-admin', authenticate, authorize('FACULTY', 'ADMIN'), (req, res) => {
  res.json({
    message: 'Route accessible to faculty and admins',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

router.get('/staff-only', authenticate, authorize('FACULTY', 'MODERATOR', 'ADMIN'), (req, res) => {
  res.json({
    message: 'Route accessible to all staff members',
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

// ============================================================================
// UNSAFE METHODS (POST, PUT, DELETE) for testing CSRF
// ============================================================================

router.put('/admin/settings', authenticate, authorize('ADMIN'), (req, res) => {
  res.json({
    message: 'Settings updated',
    settings: req.body,
  });
});

router.patch('/moderator/user/:id', authenticate, authorize('MODERATOR', 'ADMIN'), (req, res) => {
  res.json({
    message: 'User status updated',
    userId: req.params.id,
    status: req.body.status,
  });
});

export default router;
