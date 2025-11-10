import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          role: true,
          status: true,
          suspendedUntil: true,
          moderationNote: true,
        },
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Moderation checks
      if (user.status === 'BANNED') {
        return res.status(403).json({ error: 'This account has been permanently banned.' });
      }

      if (user.status === 'SUSPENDED') {
        if (user.suspendedUntil && user.suspendedUntil > new Date()) {
          return res.status(403).json({
            error: `Account suspended until ${user.suspendedUntil.toISOString()}`,
          });
        }

        // Suspension expired – automatically restore the account
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE', suspendedUntil: null },
        });
        user.status = 'ACTIVE';
        user.suspendedUntil = null;
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          role: true,
          status: true,
          suspendedUntil: true,
          moderationNote: true,
        },
      });

      if (user) {
        if (user.status === 'BANNED') {
          return next();
        }

        if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil > new Date()) {
          return next();
        }

        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
