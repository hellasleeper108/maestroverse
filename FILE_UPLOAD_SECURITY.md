# Secure File Upload Implementation

This guide explains Maestroverse's secure file upload system with MIME-type validation, path traversal prevention, and signed URL access control.

## 🎯 Overview

Maestroverse implements enterprise-grade file upload security with:

- **MIME-type whitelist validation** - Only approved file types allowed
- **5 MB maximum file size** - Prevents resource exhaustion attacks
- **Secure filename generation** - Random cryptographic filenames prevent path traversal
- **Private storage** - Files stored outside public web root
- **Signed URL access** - Time-limited, authenticated file access via JWT tokens
- **Extension validation** - Prevents MIME type spoofing attacks

## 🔒 Security Features

### 1. MIME-Type Validation

Files are validated against a strict whitelist of allowed MIME types:

**Images:**

- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/gif` (.gif)
- `image/webp` (.webp)

**Documents:**

- `application/pdf` (.pdf)
- `application/msword` (.doc)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
- `text/plain` (.txt)
- `text/csv` (.csv)

**Archives:**

- `application/zip` (.zip)

### 2. File Size Limits

- **Maximum file size:** 5 MB
- **Enforced at middleware level** - Requests abort if size exceeded
- **Prevents:** DoS attacks, storage exhaustion

### 3. Path Traversal Prevention

**Secure Filename Generation:**

```javascript
// Original: ../../../../etc/passwd
// Secure:   a3f7b9c2d8e4f1a6_1705234567890.jpg
```

- Filenames generated using `crypto.randomBytes(16)` + timestamp
- Original filename completely discarded
- All path characters (`.`, `/`, `\`) stripped
- Files stored with unpredictable names

### 4. Private Storage

**Directory Structure:**

```
server/
├── private-uploads/        # Not publicly accessible
│   ├── photos/            # Profile photos
│   ├── documents/         # PDFs, docs, etc.
│   └── resources/         # Course resources
└── uploads/               # DEPRECATED - Do not use
```

**Key Points:**

- Files stored in `private-uploads/` directory
- **NOT** served via static middleware
- **NOT** accessible via direct URL paths
- Requires signed URL token for access

### 5. Signed URL Access

Files are accessed using time-limited JWT tokens:

**URL Format:**

```
GET /api/files/serve/{signed-token}
```

**Token Contents:**

```javascript
{
  filename: "a3f7b9c2d8e4f1a6_1705234567890.jpg",
  category: "photos",
  userId: "user123",  // Optional: for access control
  type: "file-access",
  exp: 1705320967     // Expiration timestamp
}
```

**Expiration Times:**

- **Download URLs:** 15 minutes (temporary access)
- **View URLs:** 1 hour (standard viewing)
- **Embed URLs:** 24 hours (long-lived for pages)

## 📝 Usage Guide

### Backend: Uploading Files

#### Basic Upload with Middleware

```javascript
import { imageUploadMiddleware } from '../middleware/fileUpload.js';
import { createPublicSignedUrl } from '../utils/signedUrls.js';

// Photo upload route
router.post('/upload-photo', authenticate, imageUploadMiddleware, async (req, res) => {
  const { filename, category } = req.uploadedFile;

  // Generate signed URL (24 hour expiry)
  const signedUrl = createPublicSignedUrl(filename, category, {
    expiresIn: 24 * 60 * 60,
    userId: req.user.id,
  });

  res.json({ photoUrl: signedUrl, filename });
});
```

#### Custom Validation

```javascript
import { fileUploadMiddleware } from '../middleware/fileUpload.js';

// Document upload with custom settings
const documentUpload = fileUploadMiddleware({
  fieldName: 'document',
  category: 'documents',
  allowedTypes: ['application/pdf', 'application/msword'],
  maxSize: 5 * 1024 * 1024, // 5MB
});

router.post('/upload-document', authenticate, documentUpload, async (req, res) => {
  const fileInfo = req.uploadedFile;
  res.json({ success: true, file: fileInfo });
});
```

#### Manual File Upload

```javascript
import { validateFile, saveUploadedFile } from '../middleware/fileUpload.js';

router.post('/upload', authenticate, async (req, res) => {
  const file = req.files.myFile;

  // Validate
  const validation = validateFile(file, {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSize: 5 * 1024 * 1024,
  });

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Save securely
  const fileInfo = await saveUploadedFile(file, 'photos');

  res.json({ filename: fileInfo.filename });
});
```

### Backend: Serving Files

#### Via Signed URLs (Recommended)

```javascript
import { generateDownloadUrl, generateViewUrl } from '../utils/signedUrls.js';

// Generate temporary download URL (15 minutes)
const downloadUrl = generateDownloadUrl('file.pdf', 'documents', req.user.id);

// Generate view URL (1 hour)
const viewUrl = generateViewUrl('photo.jpg', 'photos', req.user.id);

// Generate long-lived embed URL (24 hours)
const embedUrl = createPublicSignedUrl('image.png', 'photos', {
  expiresIn: 24 * 60 * 60,
});
```

#### Direct Authenticated Access

```javascript
// Serve file with authentication check
router.get('/photos/:filename', authenticate, servePrivateFile('photos'));
```

### Frontend: Uploading Files

```javascript
async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch('http://localhost:3001/api/users/upload-photo', {
    method: 'POST',
    credentials: 'include', // Include cookies
    body: formData,
  });

  const data = await response.json();
  return data.photoUrl; // Returns signed URL
}
```

### Frontend: Displaying Files

```javascript
// Use signed URL directly in img tag
<img src={signedPhotoUrl} alt="Profile" />;

// Signed URLs expire - regenerate as needed
async function getLatestPhotoUrl(filename, category) {
  const response = await fetch(`/api/files/generate-url`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, category }),
  });
  const { url } = await response.json();
  return url;
}
```

## 🛡️ Security Best Practices

### 1. Always Validate MIME Types

```javascript
// ✅ Good: Strict MIME type validation
const validation = validateFile(file, {
  allowedTypes: ['image/jpeg', 'image/png'],
});

// ❌ Bad: Accepting any file type
// (never do this)
```

### 2. Enforce File Size Limits

```javascript
// ✅ Good: Reasonable file size limit
maxSize: 5 * 1024 * 1024; // 5MB

// ❌ Bad: No limit or very large limit
// maxSize: 100 * 1024 * 1024 // 100MB - too large!
```

### 3. Never Use Original Filenames

```javascript
// ✅ Good: Generate secure random filename
const secureFilename = generateSecureFilename('.jpg');
// Result: a3f7b9c2d8e4f1a6_1705234567890.jpg

// ❌ Bad: Use user-provided filename
// const filename = req.files.photo.name; // VULNERABLE TO PATH TRAVERSAL!
```

### 4. Store Files Outside Web Root

```javascript
// ✅ Good: Private storage
const UPLOAD_DIR = path.join(__dirname, '../../private-uploads');

// ❌ Bad: Public storage
// const UPLOAD_DIR = path.join(__dirname, '../../public/uploads'); // EXPOSED!
```

### 5. Use Signed URLs with Expiration

```javascript
// ✅ Good: Time-limited access
const url = generateSignedUrl(filename, category, {
  expiresIn: 60 * 60, // 1 hour
});

// ❌ Bad: Permanent public access
// app.use('/uploads', express.static('uploads')); // ANYONE CAN ACCESS!
```

### 6. Validate File Extensions

```javascript
// ✅ Good: Extension must match MIME type
if (!validateFileExtension(file.mimetype, file.name)) {
  throw new Error('Extension does not match file type');
}

// ❌ Bad: Trust extension only
// const ext = path.extname(file.name); // CAN BE SPOOFED!
```

## 🔍 Attack Prevention

### Path Traversal Attack

**Attack Attempt:**

```javascript
// Malicious filename
filename: '../../../etc/passwd';
```

**Prevention:**

```javascript
// Secure filename generation ignores original name
const secureFilename = generateSecureFilename('.txt');
// Result: b8f4c9a1d7e3f2a5_1705234567890.txt
```

### MIME Type Spoofing

**Attack Attempt:**

```javascript
// Malicious file: shell.php.jpg
// Content: <?php system($_GET['cmd']); ?>
// MIME: image/jpeg (spoofed)
```

**Prevention:**

```javascript
// Extension must match MIME type
if (mimetype === 'image/jpeg' && !extension.match(/\.jpe?g$/i)) {
  return { valid: false, error: 'Extension does not match file type' };
}
```

### File Bomb / Zip Bomb

**Attack Attempt:**

```javascript
// 42KB file that expands to 5GB
upload('zipbomb.zip');
```

**Prevention:**

```javascript
// Strict file size limits
app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true, // Immediately abort if exceeded
  })
);
```

### Unauthorized File Access

**Attack Attempt:**

```
GET /uploads/other-user-photo.jpg
```

**Prevention:**

```javascript
// Files require signed URLs with user-specific tokens
const token = generateSignedUrl(filename, category, {
  userId: req.user.id, // Bound to specific user
});

// Token verification checks userId
if (decoded.userId && decoded.userId !== req.user.id) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

## 🧪 Testing File Upload Security

### Test MIME Type Validation

```bash
# Should succeed
curl -X POST http://localhost:3001/api/users/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@profile.jpg"

# Should fail with "File type not allowed"
curl -X POST http://localhost:3001/api/users/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@malicious.php"
```

### Test File Size Limit

```bash
# Create 6MB file (exceeds 5MB limit)
dd if=/dev/zero of=large.jpg bs=1M count=6

# Should fail with "File size exceeds 5.0MB limit"
curl -X POST http://localhost:3001/api/users/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@large.jpg"
```

### Test Path Traversal

```bash
# Attempt path traversal
curl -X POST http://localhost:3001/api/users/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@../../../etc/passwd"

# File will be saved with secure random name, not as "../../../etc/passwd"
```

### Test Signed URL Expiration

```javascript
// Generate expired token
const expiredToken = jwt.sign(
  { filename: 'test.jpg', category: 'photos', type: 'file-access' },
  process.env.JWT_SECRET,
  { expiresIn: '1s' } // 1 second
);

// Wait 2 seconds
await new Promise((resolve) => setTimeout(resolve, 2000));

// Should fail with "Invalid or expired file access token"
const response = await fetch(`http://localhost:3001/api/files/serve/${expiredToken}`);
```

## 📁 File Structure

```
server/
├── src/
│   ├── middleware/
│   │   └── fileUpload.js          # Secure upload middleware
│   ├── utils/
│   │   └── signedUrls.js          # Signed URL generation
│   └── routes/
│       ├── files.js                # File serving routes
│       └── users.js                # Upload endpoint example
└── private-uploads/                # Private storage
    ├── photos/                     # User profile photos
    ├── documents/                  # PDF, Word docs, etc.
    └── resources/                  # Course materials
```

## 🚀 Production Deployment

### Environment Variables

```bash
# .env (production)
NODE_ENV=production
API_URL=https://api.yourdomain.com
JWT_SECRET=your-super-secret-256-bit-key
```

### Additional Hardening

1. **Enable HTTPS Only**

   ```javascript
   if (!req.secure) {
     return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
   }
   ```

2. **Add Rate Limiting**

   ```javascript
   const uploadLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 10, // 10 uploads per window
   });
   router.post('/upload', uploadLimiter, authenticate, imageUploadMiddleware, handler);
   ```

3. **Implement Virus Scanning**

   ```javascript
   import ClamScan from 'clamscan';

   const clamscan = await new ClamScan().init();
   const { isInfected } = await clamscan.scanFile(filepath);
   if (isInfected) {
     await fs.unlink(filepath);
     throw new Error('File contains malware');
   }
   ```

4. **Monitor Upload Activity**

   ```javascript
   console.log(`[UPLOAD] User ${req.user.id} uploaded ${file.mimetype} (${file.size} bytes)`);
   ```

5. **Backup Private Uploads Directory**
   ```bash
   # Regular backups
   tar -czf backup-$(date +%Y%m%d).tar.gz private-uploads/
   ```

## 🔄 Migration from Old System

If migrating from public `/uploads` directory:

1. **Move files to private storage:**

   ```bash
   mkdir -p server/private-uploads/photos
   mv server/uploads/photos/* server/private-uploads/photos/
   ```

2. **Update database references:**

   ```sql
   -- Convert old URL format to filename format
   UPDATE users
   SET photoUrl = JSON_OBJECT(
     'filename', SUBSTRING_INDEX(photoUrl, '/', -1),
     'category', 'photos'
   )
   WHERE photoUrl LIKE '/uploads/photos/%';
   ```

3. **Generate signed URLs on retrieval:**
   ```javascript
   // When returning user data
   if (user.photoUrl) {
     const photoData = JSON.parse(user.photoUrl);
     user.photoUrl = createPublicSignedUrl(photoData.filename, photoData.category, {
       expiresIn: 24 * 60 * 60,
     });
   }
   ```

## 📚 API Reference

### Middleware Functions

- `fileUploadMiddleware(options)` - Generic upload middleware
- `imageUploadMiddleware` - Pre-configured for images
- `documentUploadMiddleware` - Pre-configured for documents

### Validation Functions

- `validateFile(file, options)` - Validate file against rules
- `validateFileExtension(mimetype, filename)` - Check extension matches MIME type

### Storage Functions

- `saveUploadedFile(file, category, options)` - Securely save uploaded file
- `deleteUploadedFile(filename, category)` - Delete file from storage

### Signed URL Functions

- `generateSignedUrl(filename, category, options)` - Generate JWT token
- `createPublicSignedUrl(filename, category, options)` - Generate full URL
- `verifySignedUrl(token)` - Verify and decode token
- `generateDownloadUrl(filename, category, userId)` - 15-minute download URL
- `generateViewUrl(filename, category, userId)` - 1-hour view URL

### Route Handlers

- `serveSignedFile(req, res)` - Serve file via signed URL token
- `servePrivateFile(category)` - Serve file with authentication

## 🆘 Troubleshooting

### "No file provided" error

**Cause:** Form field name doesn't match expected name.

**Solution:** Ensure field name matches middleware configuration:

```javascript
formData.append('photo', file); // Must be 'photo' for imageUploadMiddleware
```

### "File type not allowed" error

**Cause:** MIME type not in whitelist.

**Solution:** Add MIME type to `ALLOWED_MIMETYPES` in `fileUpload.js` or use custom middleware:

```javascript
const customUpload = fileUploadMiddleware({
  allowedTypes: ['image/jpeg', 'image/png', 'your/mimetype'],
});
```

### "Extension does not match file type" error

**Cause:** File extension doesn't match MIME type (possible spoofing attempt).

**Solution:** Ensure file has correct extension for its type:

```
✅ file.jpg with MIME image/jpeg
❌ file.jpg with MIME application/pdf
```

### Signed URL expired

**Cause:** Token expiration time passed.

**Solution:** Regenerate signed URL:

```javascript
const newUrl = createPublicSignedUrl(filename, category, { expiresIn: 3600 });
```

---

**Last Updated:** January 2025
**Version:** 1.0
**Security Status:** Production Ready ✅
**Compliance:** OWASP Top 10 Secure File Upload Guidelines
