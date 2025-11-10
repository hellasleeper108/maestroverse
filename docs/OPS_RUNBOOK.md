# Maestroverse Operations Runbook

Playbooks and configuration snippets for production hardening tasks.

---

## 1. Redeploy With HTTPS Redirect & Secure Headers

**Purpose:** Ensure the API redirects plain HTTP traffic and emits strict security headers after the recent code changes (`server/src/index.js`).

### Steps

1. **Build & push** the updated server image:
   ```bash
   docker build -t registry.example.com/maestroverse/server:$(git rev-parse --short HEAD) ./server
   docker push registry.example.com/maestroverse/server:$(git rev-parse --short HEAD)
   ```
2. **Update deployment manifest** (Kubernetes example):
   ```yaml
   containers:
     - name: maestroverse-server
       image: registry.example.com/maestroverse/server:<new-tag>
       env:
         - name: NODE_ENV
           value: production
         - name: CORS_ORIGINS
           value: 'https://app.maestroverse.edu,https://admin.maestroverse.edu'
   ```
3. **Apply deployment**:
   ```bash
   kubectl set image deploy/maestroverse-server maestroverse-server=registry.example.com/maestroverse/server:<new-tag>
   ```
4. **Verification checklist:**
   - `curl -I http://api.maestroverse.edu/health` returns `301` and `Location: https://...`.
   - `curl -Ik https://api.maestroverse.edu/health` shows `strict-transport-security`, `content-security-policy`, `referrer-policy`, etc.
   - Logs confirm only `combined` format in prod (no verbose dev output).

---

## 2. Database Least-Privilege Role

**Goal:** Separate migration privileges from runtime access.

### SQL Script (run as admin)

```sql
-- Create runtime role with no default privileges
CREATE ROLE maestro_app LOGIN PASSWORD 'GENERATE-STRONG-PASSWORD';

-- Restrict search path
ALTER ROLE maestro_app SET search_path TO public;

-- Revoke schema modification rights
REVOKE CREATE ON SCHEMA public FROM maestro_app;
REVOKE ALL ON DATABASE maestroverse FROM maestro_app;

-- Grant only CRUD rights on required tables
\c maestroverse
GRANT CONNECT ON DATABASE maestroverse TO maestro_app;

-- Replace <TABLE_LIST> with actual Prisma tables, or loop programmatically
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maestro_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO maestro_app;

-- Ensure future tables/sequences inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO maestro_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO maestro_app;
```

### Application Update

- In production `.env`, set `DATABASE_URL` to use `maestro_app`.
- Retain a separate admin credential (stored securely) for running Prisma migrations.

---

## 3. Secret Rotation Procedure

**Scope:** `MAESTROVERSE_PEPPER`, `JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET`.

### Workflow

1. **Generate new secrets** (example using OpenSSL):
   ```bash
   openssl rand -base64 64 > /tmp/maestroverse_pepper
   openssl rand -base64 64 > /tmp/jwt_secret
   openssl rand -base64 64 > /tmp/session_secret
   openssl rand -base64 64 > /tmp/csrf_secret
   ```
2. **Store in secret manager** (AWS Secrets Manager example):
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id maestroverse/app-secrets \
     --secret-string file://secrets.json
   ```
   `secrets.json`:
   ```json
   {
     "MAESTROVERSE_PEPPER": "...",
     "JWT_SECRET": "...",
     "SESSION_SECRET": "...",
     "CSRF_SECRET": "..."
   }
   ```
3. **Deploy using rolling restart**:
   - Update deployment to pull the new versioned secret.
   - Restart backend pods one at a time (`kubectl rollout restart deploy/maestroverse-server`).
4. **Cleanup**: Remove temporary files (`shred -u /tmp/maestroverse_pepper` etc.) and mark the old secret version for deletion after verification.

### Notes

- Rotate every 90 days or immediately after suspected compromise.
- JWT rotation requires supporting both old and new secrets during rollout; use `JWT_SECRET_ROLLING=<old>` if dual verification is implemented.

---

## 4. Edge Rate Limiting (Nginx Example)

Add to the external Nginx/Ingress configuration:

```nginx
http {
  limit_req_zone $binary_remote_addr zone=api_per_ip:10m rate=100r/m;

  server {
    listen 443 ssl;
    server_name api.maestroverse.edu;

    location / {
      limit_req zone=api_per_ip burst=20 nodelay;
      proxy_pass http://maestroverse-api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}
```

**Checklist:**

- Log blocked requests (`limit_req_status 429;` plus access/error logs).
- Ensure ingress forwards real client IP (so Express rate limiting and audit logs are accurate).
- Mirror limits into CDN/WAF if applicable (e.g., Cloudflare Rate Limiting rules).

---

## 5. Nightly PostgreSQL Backups

### Cron + pg_dump (self-hosted)

Create `/usr/local/bin/maestroverse_backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD="${POSTGRES_PASSWORD}"
TIMESTAMP=$(date '+%Y%m%d-%H%M')
pg_dump \
  --host="${POSTGRES_HOST}" \
  --username="${POSTGRES_USER}" \
  --format=custom \
  --file="/backups/maestroverse-${TIMESTAMP}.dump" \
  maestroverse

find /backups -name 'maestroverse-*.dump' -mtime +30 -delete
```

Cron entry (`crontab -e`):

```
0 2 * * * /usr/local/bin/maestroverse_backup.sh >> /var/log/maestroverse-backup.log 2>&1
```

**Managed DB Alternative:**

- Enable automated snapshots and PITR in RDS/Aurora/Cloud SQL.
- Configure snapshot retention ≥30 days and copy to a secondary region if required.

### Recovery Drill Steps

1. Restore latest backup into a staging database.
2. Run `npm run db:migrate --workspace=server` against the restored instance.
3. Execute smoke tests to confirm integrity.
4. Document findings and update runbook.

---

## 6. Observability & Alerting

### Uptime Monitoring

- Use a service (PagerDuty, Datadog Synthetics, Pingdom) to hit:
  - `https://api.maestroverse.edu/health`
  - `wss://api.maestroverse.edu/socket.io/`
- Alert policy: notify on 2 consecutive failures (<2 minutes apart).

### Log & Error Aggregation

**Datadog example:**

```yaml
logs:
  - type: file
    path: /var/log/maestroverse/*.log
    service: maestroverse-api
    source: nodejs
```

Alert query:

```
avg(last_5m):sum:maestroverse.api.errors{service:maestroverse-api} > 5
```

### Infrastructure Metrics

- Monitor CPU > 80%, Memory > 75%, DB connections > 80% utilization.
- Configure autoscaling or escalation paths when thresholds breached.

### On-Call Runbook

- Document rotation schedule and escalation ladder.
- Include quick links: dashboards, log explorer, incident templates.
- Store in shared knowledge base (e.g., Notion, Confluence) and update quarterly.

---

## 7. Verification Checklist After Implementation

- [ ] HTTP requests redirect to HTTPS in production.
- [ ] Security headers validated via securityheaders.com.
- [ ] Runtime DB role lacks DDL privileges (verify with `\du`).
- [ ] Secrets rotated and stored in secret manager; old versions revoked.
- [ ] Edge rate limiting confirms 429 on synthetic flood test.
- [ ] Nightly backups running; latest artefact restored successfully.
- [ ] Uptime checks and error alerts visible in monitoring tool.
