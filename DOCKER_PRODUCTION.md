# Docker Production Optimization Guide

This guide explains the production-optimized Docker configuration for Maestroverse, emphasizing security, performance, and best practices.

## 📋 Table of Contents

- [Overview](#overview)
- [Security Improvements](#security-improvements)
- [Multi-Stage Builds](#multi-stage-builds)
- [Image Optimization](#image-optimization)
- [File Structure](#file-structure)
- [Production Deployment](#production-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The production Docker configuration includes:

- **Multi-stage builds** - Separate build and runtime dependencies
- **Non-root users** - Run containers as unprivileged users
- **Minimal Alpine images** - 5x smaller than standard Node images
- **Read-only filesystems** - Prevent container modification
- **Resource limits** - Prevent resource exhaustion
- **Health checks** - Automatic container health monitoring
- **Comprehensive .dockerignore** - Exclude unnecessary files

### Image Size Comparison

| Image Type            | Size    | Description                      |
| --------------------- | ------- | -------------------------------- |
| Development (node:18) | ~900MB  | Full Node.js with build tools    |
| Production (Alpine)   | ~150MB  | Minimal Alpine with runtime only |
| **Reduction**         | **83%** | **~750MB savings per image**     |

## 🔒 Security Improvements

### 1. Non-Root User Execution

**Why?** Running as root inside containers is a security risk. If an attacker gains container access, they have root privileges.

**Implementation:**

```dockerfile
# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 maestro

# Set file ownership
COPY --chown=maestro:nodejs /app/dist ./dist

# Switch to non-root user
USER maestro
```

**Benefits:**

- ✅ Limits damage from container breakout attacks
- ✅ Principle of least privilege
- ✅ Compliance with security standards (PCI-DSS, SOC 2)

### 2. Read-Only Root Filesystem

**Why?** Prevents attackers from modifying container files, installing malware, or creating backdoors.

**Implementation:**

```yaml
services:
  server:
    read_only: true
    tmpfs:
      - /tmp # Allow writes to /tmp only
```

**Benefits:**

- ✅ Prevents file modification attacks
- ✅ Forces immutable infrastructure
- ✅ Easier to detect compromise

### 3. Minimal Base Images (Alpine)

**Why?** Smaller attack surface. Fewer packages = fewer vulnerabilities.

**Comparison:**

```
node:18            - 900MB - Includes python, gcc, make, etc.
node:18-alpine     - 150MB - Only essential packages
```

**Benefits:**

- ✅ 83% smaller image size
- ✅ Fewer CVEs to patch
- ✅ Faster downloads and deployments
- ✅ Lower storage costs

### 4. No Secrets in Images

**Why?** Secrets baked into images can be extracted by anyone with access.

**Implementation:**

```dockerfile
# ❌ Bad: Secret in image
ENV JWT_SECRET=my-secret-key

# ✅ Good: Secret from environment
ENV JWT_SECRET=${JWT_SECRET}
```

**Best Practices:**

- Use environment variables
- Use Docker secrets (Swarm mode)
- Use external secret managers (Vault, AWS Secrets Manager)
- Never commit .env files

### 5. Resource Limits

**Why?** Prevents single container from consuming all system resources (DoS protection).

**Implementation:**

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0' # Max 2 CPU cores
      memory: 2G # Max 2GB RAM
    reservations:
      cpus: '0.5' # Guaranteed 0.5 CPU
      memory: 512M # Guaranteed 512MB RAM
```

**Benefits:**

- ✅ Prevents resource exhaustion
- ✅ Predictable performance
- ✅ Better multi-tenant isolation

### 6. Network Segmentation

**Why?** Limits blast radius of security breaches.

**Implementation:**

```yaml
networks:
  maestro-internal:
    internal: true # No external access
  maestro-external:
    # Accessible from outside
```

**Result:**

- Database and Redis only accessible internally
- Web and API exposed externally
- Even if API is compromised, database is isolated

## 🏗️ Multi-Stage Builds

Multi-stage builds separate build dependencies from runtime dependencies, resulting in much smaller final images.

### Server Dockerfile Structure

```dockerfile
# =============================================================================
# STAGE 1: Dependencies (Production)
# =============================================================================
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# =============================================================================
# STAGE 2: Build
# =============================================================================
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci  # Install ALL dependencies
COPY . .
RUN npx prisma generate

# =============================================================================
# STAGE 3: Production Runtime
# =============================================================================
FROM node:18-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 maestro

# Copy only production dependencies
COPY --from=deps --chown=maestro:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=maestro:nodejs /app/dist ./dist

USER maestro
CMD ["node", "dist/index.js"]
```

### Benefits of Multi-Stage Builds

| Metric         | Single-Stage | Multi-Stage     | Improvement         |
| -------------- | ------------ | --------------- | ------------------- |
| Image Size     | 1.2GB        | 150MB           | **87% smaller**     |
| Security       | Low          | High            | **No build tools**  |
| Dependencies   | All          | Production only | **Fewer packages**  |
| Attack Surface | Large        | Minimal         | **Less vulnerable** |

## 📦 Image Optimization

### .dockerignore File

The `.dockerignore` file excludes unnecessary files from the build context, resulting in:

- ✅ Faster builds (smaller context)
- ✅ Smaller images (less bloat)
- ✅ Better security (no secrets)
- ✅ Consistent builds (no local artifacts)

**Key Exclusions:**

```
# Largest size reductions
node_modules/          # 100-500MB
.git/                  # 50-200MB
.next/                 # 50-100MB

# Security
.env*                  # Secrets
*.key, *.pem          # Private keys

# Development
.vscode/, .idea/      # IDE files
coverage/             # Test coverage
```

### Layer Caching Strategy

Docker caches layers to speed up builds. Order matters!

**Optimal Dockerfile Order:**

```dockerfile
# 1. Copy package files first (changes rarely)
COPY package*.json ./

# 2. Install dependencies (cache this layer)
RUN npm ci

# 3. Copy source code last (changes frequently)
COPY . .

# 4. Build application
RUN npm run build
```

**Result:** If source code changes but package.json doesn't, npm install is skipped.

### Image Size Comparison

```bash
# Before optimization
docker images maestroverse-server
REPOSITORY              TAG      SIZE
maestroverse-server     old      1.2GB

# After optimization
docker images maestroverse-server
REPOSITORY              TAG      SIZE
maestroverse-server     prod     150MB

# Savings: 1.05GB per image
```

## 📁 File Structure

```
maestroverse/
├── docker-compose.yml              # Development configuration
├── docker-compose.prod.yml         # Production configuration
├── .dockerignore                   # Root-level exclusions
│
├── server/
│   ├── Dockerfile                  # Development Dockerfile
│   ├── Dockerfile.prod             # Production Dockerfile
│   └── .dockerignore               # Server-specific exclusions
│
└── apps/web/
    ├── Dockerfile                  # Development Dockerfile
    ├── Dockerfile.prod             # Production Dockerfile
    └── .dockerignore               # Web-specific exclusions
```

## 🚀 Production Deployment

### Prerequisites

1. **Create .env.production file:**

```bash
# Database
POSTGRES_USER=maestro_prod
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=maestroverse_prod

# Redis
REDIS_PASSWORD=<strong-random-password>

# Authentication
JWT_SECRET=<256-bit-random-key>

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# URLs (production domains)
FRONTEND_URL=https://maestroverse.com
API_URL=https://api.maestroverse.com
CORS_ORIGINS=https://maestroverse.com

# Admin
ROOT_ADMIN_EMAILS=admin@maestroverse.com
```

2. **Generate strong secrets:**

```bash
# Generate JWT secret (256-bit)
openssl rand -base64 32

# Generate passwords
openssl rand -base64 24
```

### Build Production Images

```bash
# Build server image
docker build -f server/Dockerfile.prod -t maestroverse-server:1.0 ./server

# Build web image with API URL
docker build -f apps/web/Dockerfile.prod \
  --build-arg NEXT_PUBLIC_API_URL=https://api.maestroverse.com \
  --build-arg NEXT_PUBLIC_WS_URL=wss://api.maestroverse.com \
  -t maestroverse-web:1.0 \
  ./apps/web
```

### Start Production Environment

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f server
```

### Run Database Migrations

```bash
# Apply migrations
docker-compose -f docker-compose.prod.yml exec server npm run db:migrate

# Verify database
docker-compose -f docker-compose.prod.yml exec server npx prisma db seed
```

### Health Checks

All services have built-in health checks:

```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# Healthy output:
# NAME                     STATUS
# maestroverse-db-prod     Up (healthy)
# maestroverse-redis-prod  Up (healthy)
# maestroverse-server-prod Up (healthy)
# maestroverse-web-prod    Up (healthy)
```

## 📊 Monitoring & Maintenance

### Resource Monitoring

```bash
# Monitor resource usage
docker stats

# Output:
# CONTAINER           CPU %   MEM USAGE / LIMIT   MEM %
# maestroverse-server 5.2%    512MB / 2GB         25.6%
# maestroverse-web    2.1%    256MB / 1GB         25.6%
# maestroverse-db     1.8%    1.2GB / 2GB         60%
```

### Log Management

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service
docker-compose -f docker-compose.prod.yml logs -f server

# Tail last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 server

# Logs are automatically rotated:
# - Max size: 50MB per file
# - Max files: 5 files
# - Total: 250MB per service
```

### Backups

**Database Backup:**

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U maestro_prod maestroverse_prod > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U maestro_prod maestroverse_prod < backup_20250110.sql
```

**Volume Backup:**

```bash
# Backup volume
docker run --rm \
  -v maestroverse_postgres_data_prod:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz /data

# Restore volume
docker run --rm \
  -v maestroverse_postgres_data_prod:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup_20250110.tar.gz -C /
```

### Updates

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Rebuild with new code
docker-compose -f docker-compose.prod.yml build --no-cache

# Restart services (minimal downtime)
docker-compose -f docker-compose.prod.yml up -d
```

### Security Scanning

```bash
# Scan images for vulnerabilities
docker scan maestroverse-server:1.0

# Use Trivy for comprehensive scanning
trivy image maestroverse-server:1.0

# Fix vulnerabilities by rebuilding with updated base images
docker build -f server/Dockerfile.prod --pull -t maestroverse-server:1.0 ./server
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs server

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

**Solution:**

1. Verify .env.production has all required variables
2. Check database is healthy: `docker-compose ps`
3. Check port availability: `lsof -i :3001`

### Permission Denied Errors

```bash
# Error: EACCES: permission denied
```

**Cause:** Non-root user can't write to volumes.

**Solution:**

```bash
# Fix volume permissions
docker-compose -f docker-compose.prod.yml exec server chown -R maestro:nodejs /app/private-uploads
```

### Health Check Failures

```bash
# Check health status
docker inspect maestroverse-server-prod | grep -A 10 Health

# Test health endpoint manually
docker-compose -f docker-compose.prod.yml exec server \
  curl http://localhost:3001/health
```

**Solution:**

- Increase `start_period` in health check if application takes longer to start
- Check application logs for startup errors

### High Memory Usage

```bash
# Check memory usage
docker stats maestroverse-server-prod

# If near limit, increase memory limit:
deploy:
  resources:
    limits:
      memory: 4G  # Increase from 2G
```

### Database Connection Errors

```bash
# Error: connect ECONNREFUSED postgres:5432
```

**Cause:** Database not ready or network issue.

**Solution:**

1. Verify database is healthy: `docker-compose ps postgres`
2. Check network: `docker network inspect maestro-internal`
3. Verify DATABASE_URL in .env.production

## 📚 Best Practices Summary

### Security

- ✅ Run containers as non-root users
- ✅ Use read-only filesystems
- ✅ Set resource limits
- ✅ Scan images for vulnerabilities
- ✅ Keep base images updated
- ✅ Don't store secrets in images
- ✅ Use network segmentation

### Performance

- ✅ Use multi-stage builds
- ✅ Leverage layer caching
- ✅ Use .dockerignore files
- ✅ Use Alpine base images
- ✅ Minimize installed packages
- ✅ Set appropriate resource limits

### Reliability

- ✅ Implement health checks
- ✅ Set restart policies
- ✅ Configure log rotation
- ✅ Regular backups
- ✅ Monitor resource usage
- ✅ Test disaster recovery

### Maintenance

- ✅ Keep images updated
- ✅ Monitor security advisories
- ✅ Regular vulnerability scanning
- ✅ Document deployment procedures
- ✅ Automate common tasks

## 🆘 Getting Help

For issues with Docker deployment:

1. Check application logs
2. Verify environment variables
3. Test health endpoints
4. Review this documentation
5. Consult Docker documentation
6. Open GitHub issue

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Production Ready ✅
