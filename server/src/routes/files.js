import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { serveSignedFile, servePrivateFile } from '../utils/signedUrls.js';

const router = express.Router();

/**
 * GET /api/files/serve/:token
 * Serve file using signed URL token
 * Public endpoint - authentication in token
 */
router.get('/serve/:token', serveSignedFile);

/**
 * GET /api/files/photos/:filename
 * Serve photo files (requires authentication)
 * Alternative to signed URLs for direct file access
 */
router.get('/photos/:filename', authenticate, servePrivateFile('photos'));

/**
 * GET /api/files/documents/:filename
 * Serve document files (requires authentication)
 */
router.get('/documents/:filename', authenticate, servePrivateFile('documents'));

/**
 * GET /api/files/resources/:filename
 * Serve resource files (requires authentication)
 */
router.get('/resources/:filename', authenticate, servePrivateFile('resources'));

export default router;
