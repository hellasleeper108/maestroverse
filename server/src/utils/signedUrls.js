import jwt from 'jsonwebtoken';
import path from 'path';
import { UPLOAD_DIR } from '../middleware/fileUpload.js';

// Signed URL expiration times
const URL_EXPIRY = {
  SHORT: 15 * 60, // 15 minutes (for temporary access)
  MEDIUM: 60 * 60, // 1 hour (for viewing files)
  LONG: 24 * 60 * 60, // 24 hours (for downloads)
};

/**
 * Generate a signed URL for accessing a private file
 * @param {string} filename - Filename to access
 * @param {string} category - File category (photos, documents, resources)
 * @param {Object} options - Options
 * @param {number} options.expiresIn - Expiration time in seconds (default: 1 hour)
 * @param {string} options.userId - User ID for access control (optional)
 * @returns {string} Signed URL token
 */
export function generateSignedUrl(filename, category, options = {}) {
  const {
    expiresIn = URL_EXPIRY.MEDIUM,
    userId = null,
  } = options;

  // Use JWT for signed URLs with short expiration
  const token = jwt.sign(
    {
      filename,
      category,
      userId,
      type: 'file-access',
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  return token;
}

/**
 * Verify signed URL token
 * @param {string} token - Signed URL token
 * @returns {Object|null} Decoded token data or null if invalid
 */
export function verifySignedUrl(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure it's a file access token
    if (decoded.type !== 'file-access') {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Signed URL verification failed:', error.message);
    return null;
  }
}

/**
 * Generate a public-facing signed URL
 * @param {string} filename - Filename
 * @param {string} category - File category
 * @param {Object} options - Options
 * @returns {string} Full signed URL
 */
export function createPublicSignedUrl(filename, category, options = {}) {
  const token = generateSignedUrl(filename, category, options);
  const baseUrl = process.env.API_URL || 'http://localhost:3001';
  return `${baseUrl}/api/files/serve/${token}`;
}

/**
 * Generate multiple signed URLs for a list of files
 * @param {Array} files - Array of file objects with { filename, category }
 * @param {Object} options - Options
 * @returns {Array} Array of signed URLs
 */
export function createBulkSignedUrls(files, options = {}) {
  return files.map(file => createPublicSignedUrl(file.filename, file.category, options));
}

/**
 * Express middleware to verify and serve signed files
 * Usage: router.get('/serve/:token', serveSignedFile)
 */
export async function serveSignedFile(req, res) {
  try {
    const { token } = req.params;

    // Verify token
    const decoded = verifySignedUrl(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired file access token' });
    }

    const { filename, category, userId } = decoded;

    // Optional: Additional access control
    // If userId is set in token, verify requesting user matches
    if (userId && req.user && req.user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized file access' });
    }

    // Prevent path traversal
    const cleanFilename = path.basename(filename);
    const cleanCategory = path.basename(category);

    // Construct file path
    const filepath = path.join(UPLOAD_DIR, cleanCategory, cleanFilename);

    // Check file exists and serve
    const fs = await import('fs/promises');
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Serve file with appropriate headers
    res.sendFile(filepath, {
      headers: {
        'Content-Type': getMimeTypeFromFilename(cleanFilename),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Serve signed file error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
}

/**
 * Get MIME type from filename extension
 * @param {string} filename - Filename
 * @returns {string} MIME type
 */
function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Generate temporary download URL for a file
 * @param {string} filename - Filename
 * @param {string} category - File category
 * @param {string} userId - User ID for access control
 * @returns {string} Temporary download URL (valid for 15 minutes)
 */
export function generateDownloadUrl(filename, category, userId = null) {
  return createPublicSignedUrl(filename, category, {
    expiresIn: URL_EXPIRY.SHORT,
    userId,
  });
}

/**
 * Generate long-lived view URL for a file (24 hours)
 * Useful for embedding in pages that stay open
 * @param {string} filename - Filename
 * @param {string} category - File category
 * @param {string} userId - User ID for access control
 * @returns {string} Long-lived view URL
 */
export function generateViewUrl(filename, category, userId = null) {
  return createPublicSignedUrl(filename, category, {
    expiresIn: URL_EXPIRY.LONG,
    userId,
  });
}

/**
 * Middleware to serve files with optional authentication
 * This provides more flexible access control than serveSignedFile
 */
export function servePrivateFile(category = 'documents') {
  return async (req, res) => {
    try {
      const { filename } = req.params;

      // Optional authentication check
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Prevent path traversal
      const cleanFilename = path.basename(filename);
      const cleanCategory = path.basename(category);

      // Construct file path
      const filepath = path.join(UPLOAD_DIR, cleanCategory, cleanFilename);

      // Check file exists and serve
      const fs = await import('fs/promises');
      try {
        await fs.access(filepath);
      } catch {
        return res.status(404).json({ error: 'File not found' });
      }

      // Serve file
      res.sendFile(filepath, {
        headers: {
          'Content-Type': getMimeTypeFromFilename(cleanFilename),
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('Serve private file error:', error);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  };
}

export { URL_EXPIRY };
