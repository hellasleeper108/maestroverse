import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import hubRoutes from './routes/hub.js';
import careerlinkRoutes from './routes/careerlink.js';
import collabspaceRoutes from './routes/collabspace.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';
import mimRoutes from './routes/mim.js';
import filesRoutes from './routes/files.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';

// OAuth configuration
import passport from './config/passport.js';
import { initializePassport } from './config/passport.js';

// WebSocket handler
import { initializeWebSocket } from './websocket/index.js';

// File upload utilities
import { ensureUploadDirectories } from './middleware/fileUpload.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3005')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Initialize Socket.IO for real-time features
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Authorization',
    'Content-Type',
    'Origin',
    'X-Requested-With',
    'X-CSRF-Token',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],
};

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

if (isProd) {
  app.use(
    helmet.hsts({
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    })
  );
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
if (!isProd) {
  app.use(morgan('dev'));
}

if (isProd) {
  // Force HTTPS in production with host validation to prevent open redirect attacks
  app.use((req, res, next) => {
    if (!req.secure) {
      // Validate host against allowed origins to prevent open redirect vulnerability
      const allowedHosts = allowedOrigins.map((origin) => {
        try {
          return new URL(origin).host;
        } catch {
          return null;
        }
      }).filter(Boolean);

      const requestHost = req.headers.host;

      // Only redirect if host is in the allowed list
      if (requestHost && allowedHosts.includes(requestHost)) {
        return res.redirect(301, `https://${requestHost}${req.originalUrl}`);
      }

      // If host is not allowed, return 400 Bad Request
      return res.status(400).send('Invalid host header');
    }
    return next();
  });
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit for security
    abortOnLimit: true,
    createParentPath: true,
    useTempFiles: true, // Use temp files for large uploads
    tempFileDir: '/tmp/',
  })
);

// REMOVED: Public static file serving for security
// Files are now served via signed URLs through /api/files routes
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global API rate limiting
app.use('/api', apiRateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hub', hubRoutes);
app.use('/api/careerlink', careerlinkRoutes);
app.use('/api/collabspace', collabspaceRoutes);
app.use('/api/mim', mimRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes); // Secure file serving with signed URLs

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Initialize Passport.js OAuth
initializePassport();

// Initialize WebSocket
initializeWebSocket(io);

// Initialize secure upload directories
await ensureUploadDirectories();

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Maestroverse Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready on ws://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Secure file uploads: Enabled (5MB limit, signed URLs)`);
  console.log(`\n📍 Available endpoints:`);
  console.log(`   - Student Hub:    http://localhost:${PORT}/api/hub`);
  console.log(`   - CareerLink:     http://localhost:${PORT}/api/careerlink`);
  console.log(`   - CollabSpace:    http://localhost:${PORT}/api/collabspace`);
  console.log(`   - Search:         http://localhost:${PORT}/api/search`);
  console.log(`   - Admin:          http://localhost:${PORT}/api/admin`);
  console.log(`   - File Serving:   http://localhost:${PORT}/api/files\n`);
});

export { io };
