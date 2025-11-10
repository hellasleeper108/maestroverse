import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = path.join(__dirname, '../../private-uploads');

// MIME type whitelist with corresponding extensions
const ALLOWED_MIMETYPES = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  // Archives
  'application/zip': ['.zip'],
};

/**
 * Generate a secure random filename
 * Format: {randomId}_{timestamp}.{extension}
 * @param {string} originalExtension - Original file extension
 * @returns {string} Secure filename
 */
export function generateSecureFilename(originalExtension) {
  const randomId = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  // Remove any path traversal attempts from extension
  const cleanExtension = path.basename(originalExtension);
  return `${randomId}_${timestamp}${cleanExtension}`;
}

/**
 * Validate file extension matches MIME type
 * Prevents MIME type spoofing attacks
 * @param {string} mimetype - File MIME type
 * @param {string} filename - Original filename
 * @returns {boolean} True if extension matches MIME type
 */
export function validateFileExtension(mimetype, filename) {
  const allowedExtensions = ALLOWED_MIMETYPES[mimetype];
  if (!allowedExtensions) return false;

  const fileExtension = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(fileExtension);
}

/**
 * Get file extension from MIME type
 * @param {string} mimetype - File MIME type
 * @param {string} fallbackFilename - Fallback filename to extract extension
 * @returns {string} File extension with dot (e.g., '.jpg')
 */
export function getExtensionForMimetype(mimetype, fallbackFilename = '') {
  const extensions = ALLOWED_MIMETYPES[mimetype];
  if (extensions && extensions.length > 0) {
    return extensions[0];
  }
  // Fallback to original extension if MIME type is allowed
  return path.extname(fallbackFilename).toLowerCase() || '.bin';
}

/**
 * Ensure upload directories exist
 */
export async function ensureUploadDirectories() {
  const directories = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, 'photos'),
    path.join(UPLOAD_DIR, 'documents'),
    path.join(UPLOAD_DIR, 'resources'),
  ];

  for (const dir of directories) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✓ Created upload directory: ${dir}`);
    }
  }
}

/**
 * Validate uploaded file
 * @param {Object} file - File object from express-fileupload
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedTypes - Allowed MIME types (defaults to all)
 * @param {number} options.maxSize - Max file size in bytes (defaults to 5MB)
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
export function validateFile(file, options = {}) {
  const { allowedTypes = Object.keys(ALLOWED_MIMETYPES), maxSize = MAX_FILE_SIZE } = options;

  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `File type ${file.mimetype} not allowed` };
  }

  // Validate extension matches MIME type (prevents spoofing)
  if (!validateFileExtension(file.mimetype, file.name)) {
    return { valid: false, error: 'File extension does not match file type' };
  }

  // Additional security checks
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { valid: false, error: 'Invalid filename' };
  }

  return { valid: true };
}

/**
 * Securely save uploaded file
 * @param {Object} file - File object from express-fileupload
 * @param {string} category - File category (photos, documents, resources)
 * @param {Object} options - Save options
 * @returns {Promise<Object>} Saved file info { filename, filepath, originalName, mimetype, size }
 */
export async function saveUploadedFile(file, category = 'documents', options = {}) {
  // Validate file first
  const validation = validateFile(file, options);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Ensure upload directory exists
  await ensureUploadDirectories();

  // Generate secure filename
  const extension = getExtensionForMimetype(file.mimetype, file.name);
  const secureFilename = generateSecureFilename(extension);

  // Construct full path
  const categoryDir = path.join(UPLOAD_DIR, category);
  const filepath = path.join(categoryDir, secureFilename);

  // Move file to secure location
  await file.mv(filepath);

  console.log(`✓ File uploaded: ${secureFilename} (${(file.size / 1024).toFixed(2)} KB)`);

  return {
    filename: secureFilename,
    filepath,
    category,
    originalName: file.name,
    mimetype: file.mimetype,
    size: file.size,
  };
}

/**
 * Delete uploaded file
 * @param {string} filename - Filename to delete
 * @param {string} category - File category
 */
export async function deleteUploadedFile(filename, category = 'documents') {
  try {
    // Prevent path traversal
    const cleanFilename = path.basename(filename);
    const filepath = path.join(UPLOAD_DIR, category, cleanFilename);

    await fs.unlink(filepath);
    console.log(`✓ File deleted: ${cleanFilename}`);
  } catch (error) {
    console.error('Delete file error:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * Express middleware for file upload validation
 * Usage: router.post('/upload', fileUploadMiddleware({ category: 'photos', allowedTypes: ['image/jpeg', 'image/png'] }), handler)
 */
export function fileUploadMiddleware(options = {}) {
  const { fieldName = 'file', category = 'documents', allowedTypes, maxSize } = options;

  return async (req, res, next) => {
    try {
      // Check if file exists
      if (!req.files || !req.files[fieldName]) {
        return res.status(400).json({ error: `No ${fieldName} provided` });
      }

      const file = req.files[fieldName];

      // Validate file
      const validation = validateFile(file, { allowedTypes, maxSize });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Save file securely
      const fileInfo = await saveUploadedFile(file, category, { allowedTypes, maxSize });

      // Attach file info to request
      req.uploadedFile = fileInfo;

      next();
    } catch (error) {
      console.error('File upload middleware error:', error);
      res.status(500).json({ error: error.message || 'File upload failed' });
    }
  };
}

// Image-specific middleware
export const imageUploadMiddleware = fileUploadMiddleware({
  fieldName: 'photo',
  category: 'photos',
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxSize: 5 * 1024 * 1024, // 5MB
});

// Document-specific middleware
export const documentUploadMiddleware = fileUploadMiddleware({
  fieldName: 'document',
  category: 'documents',
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  maxSize: 5 * 1024 * 1024, // 5MB
});

// Export constants for use in other modules
export { MAX_FILE_SIZE, UPLOAD_DIR, ALLOWED_MIMETYPES };
