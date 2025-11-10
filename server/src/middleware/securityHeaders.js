/**
 * Security Headers Middleware
 *
 * Implements OWASP security headers:
 * - HSTS (HTTP Strict Transport Security)
 * - Content Security Policy (CSP)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy
 * - X-DNS-Prefetch-Control
 *
 * Uses helmet for most headers with custom CSP configuration
 */

import helmet from 'helmet';

/**
 * Content Security Policy configuration
 * Tailored for Next.js frontend + Socket.IO WebSockets
 */
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Next.js inline scripts (consider 'unsafe-eval' removal in production)
      "'unsafe-eval'", // Required for Next.js dev mode
      'https://cdn.socket.io', // Socket.IO CDN if using
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for styled-components/CSS-in-JS
      'https://fonts.googleapis.com',
    ],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https:', // Allow HTTPS images from any domain (user avatars, external resources)
    ],
    connectSrc: [
      "'self'",
      'ws://localhost:3001', // WebSocket (dev)
      'wss://localhost:3001', // WebSocket secure (dev)
      'http://localhost:3001', // API (dev)
      'http://localhost:3005', // Web frontend (dev)
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.API_URL || 'http://localhost:3001',
      // Add production domains via environment variables
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
    ],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'", 'https:'],
    workerSrc: ["'self'", 'blob:'],
    childSrc: ["'self'", 'blob:'],
    formAction: ["'self'"],
    frameAncestors: ["'none'"], // Prevent clickjacking
    baseUri: ["'self'"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
  },
  // Report violations in development
  reportOnly: process.env.NODE_ENV === 'development',
};

/**
 * Helmet configuration with all security headers
 */
const helmetConfig = {
  contentSecurityPolicy: cspConfig,

  // HSTS - Force HTTPS (only in production)
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },

  // Prevent MIME type sniffing
  noSniff: true,

  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // Referrer policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // X-Powered-By header removal
  hidePoweredBy: true,

  // DNS prefetch control
  dnsPrefetchControl: {
    allow: false,
  },

  // X-Download-Options for IE8+
  ieNoOpen: true,

  // Cross-domain policies
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
};

/**
 * Apply helmet security headers
 */
export const securityHeaders = helmet(helmetConfig);

/**
 * Additional custom security headers not covered by helmet
 */
export function customSecurityHeaders(req, res, next) {
  // Permissions-Policy (formerly Feature-Policy)
  // Restrict access to sensitive browser features
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()', // Block camera access
      'microphone=()', // Block microphone access
      'geolocation=(self)', // Allow geolocation only from same origin
      'payment=()', // Block payment API
      'usb=()', // Block USB access
      'magnetometer=()', // Block magnetometer
      'gyroscope=()', // Block gyroscope
      'accelerometer=()', // Block accelerometer
      'ambient-light-sensor=()', // Block ambient light sensor
      'autoplay=(self)', // Allow autoplay only from same origin
      'encrypted-media=(self)', // Allow encrypted media only from same origin
      'fullscreen=(self)', // Allow fullscreen only from same origin
      'picture-in-picture=(self)', // Allow PiP only from same origin
    ].join(', ')
  );

  // X-Content-Type-Options (redundant with helmet but explicit)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection (legacy, but some browsers still use it)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Clear-Site-Data header utility (for logout)
  if (req.path === '/api/auth/logout' && req.method === 'POST') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  next();
}

/**
 * CORS headers with credentials support
 * Separate from helmet, applied before CORS middleware
 */
export function secureCorsPreflight(req, res, next) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3005',
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ].filter(Boolean);

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  // Preflight request handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }

  next();
}

/**
 * Security headers for development mode (more permissive)
 */
export function devSecurityHeaders(req, res, next) {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  // In dev mode, disable HSTS (allow HTTP)
  res.removeHeader('Strict-Transport-Security');

  next();
}

/**
 * Combined security headers middleware
 * Apply in this order: secureCorsPreflight -> helmet -> customSecurityHeaders
 */
export function applySecurityHeaders() {
  return [secureCorsPreflight, securityHeaders, customSecurityHeaders, devSecurityHeaders];
}
