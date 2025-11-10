# Demo User Protection System

## Overview

The demo user protection system safeguards production environments from demo accounts with well-known credentials. Demo accounts are created by the seed script with password `password123` and are documented in README/documentation files, making them a **critical security vulnerability** if accessible in production.

## Security Rationale

### Why Demo Accounts Are Dangerous in Production

1. **Well-Known Credentials**: All demo accounts use `password123` as the password
2. **Publicly Documented**: Demo credentials are documented in:
   - README.md
   - CLAUDE.md
   - Seed script output
   - Development documentation
3. **Elevated Privileges**: Includes admin, moderator, and faculty accounts
4. **Attack Vector**: Anyone with access to documentation can compromise the system

### What Could Go Wrong

Without protection, attackers could:
- Log in as `admin@maestro.edu` with `password123`
- Access admin panel and delete/suspend accounts
- Modify platform data
- Steal user information
- Disrupt platform operations

## Architecture

### Components

1. **Demo Guard Utilities** (`server/src/utils/demoGuard.js`)
   - Identifies demo accounts
   - Checks environment configuration
   - Validates production safety

2. **Seed Script Protection** (`server/src/seed.js`)
   - Blocks seeding in production
   - Requires explicit `ALLOW_DEMO=1` override
   - Shows security warnings

3. **Login Protection** (`server/src/routes/auth.js`)
   - Blocks demo logins in production
   - Returns 403 with security message
   - Allows override with `ALLOW_DEMO=1`

4. **Startup Validation** (`server/src/index.js`)
   - Warns if demo accounts enabled in production
   - Runs on server startup
   - Logs security warnings

## Demo Accounts

### Complete List

**Admin Accounts:**
- Email: `admin@maestro.edu`, Username: `admin`, Role: ADMIN

**Moderator Accounts:**
- Email: `moderator@maestro.edu`, Username: `mod_sarah`, Role: MODERATOR

**Faculty Accounts:**
- Email: `faculty@maestro.edu`, Username: `prof_johnson`, Role: FACULTY

**Student Accounts:**
- Email: `alice@maestro.edu`, Username: `alice_wonder`, Role: STUDENT
- Email: `bob@maestro.edu`, Username: `bob_builder`, Role: STUDENT
- Email: `carol@maestro.edu`, Username: `carol_creative`, Role: STUDENT

**All Accounts:**
- Password: `password123`
- Created by: `server/src/seed.js`
- Purpose: Development and testing only

## Behavior by Environment

### Development (`NODE_ENV=development`)

✅ **Seeding**: Allowed
✅ **Demo Logins**: Allowed
✅ **Warnings**: None

Demo accounts work normally for local development and testing.

### Test (`NODE_ENV=test`)

✅ **Seeding**: Allowed
✅ **Demo Logins**: Allowed
✅ **Warnings**: None

Demo accounts work normally for automated testing.

### Production (`NODE_ENV=production`)

#### Default Behavior (Secure)

❌ **Seeding**: BLOCKED (exits with error)
❌ **Demo Logins**: BLOCKED (returns 403)
⚠️ **Warnings**: None (secure state)

Demo accounts are completely inaccessible.

#### With `ALLOW_DEMO=1` (Dangerous)

✅ **Seeding**: Allowed (with 5-second warning)
✅ **Demo Logins**: Allowed
⚠️ **Warnings**: CRITICAL security warning on startup

**WARNING**: This should ONLY be used temporarily for staging environments, and `ALLOW_DEMO=1` must be removed immediately after use.

## Usage

### Running Seed Script

**Development:**
```bash
npm run db:seed
# ✅ Works normally
```

**Production (Blocked):**
```bash
NODE_ENV=production npm run db:seed
# ❌ Exits with error:
# "SEEDING BLOCKED IN PRODUCTION"
# "Demo accounts have well-known passwords"
```

**Production (Override - Dangerous):**
```bash
NODE_ENV=production ALLOW_DEMO=1 npm run db:seed
# ⚠️ Shows 5-second warning, then seeds
# WARNING: Remove ALLOW_DEMO=1 immediately after!
```

### Login Attempts

**Development:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername": "alice@maestro.edu", "password": "password123"}'
# ✅ 200 OK - Login successful
```

**Production (Blocked):**
```bash
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername": "alice@maestro.edu", "password": "password123"}'
# ❌ 403 Forbidden
# {
#   "error": "Demo accounts are disabled in production",
#   "message": "For security reasons, demo accounts with well-known passwords..."
# }
```

**Production (Override - Dangerous):**
```bash
# With ALLOW_DEMO=1 in .env
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername": "alice@maestro.edu", "password": "password123"}'
# ✅ 200 OK - Login successful
# ⚠️ CRITICAL SECURITY VULNERABILITY!
```

## API Reference

### Utility Functions

#### `isDemoUser(identifier)`
Check if email or username belongs to a demo account.

```javascript
import { isDemoUser } from './utils/demoGuard.js';

isDemoUser('alice@maestro.edu');     // true
isDemoUser('alice_wonder');          // true
isDemoUser('ALICE@maestro.edu');     // true (case-insensitive)
isDemoUser('realuser@example.com');  // false
```

#### `isSeedingAllowed()`
Check if seeding is allowed in current environment.

```javascript
import { isSeedingAllowed } from './utils/demoGuard.js';

// Development
isSeedingAllowed();  // true

// Production without ALLOW_DEMO
isSeedingAllowed();  // false

// Production with ALLOW_DEMO=1
isSeedingAllowed();  // true
```

#### `areDemoLoginsAllowed()`
Check if demo logins are allowed in current environment.

```javascript
import { areDemoLoginsAllowed } from './utils/demoGuard.js';

// Development
areDemoLoginsAllowed();  // true

// Production without ALLOW_DEMO
areDemoLoginsAllowed();  // false

// Production with ALLOW_DEMO=1
areDemoLoginsAllowed();  // true
```

#### `validateProductionSafety()`
Validate production environment safety. Logs warnings if demo accounts are enabled.

```javascript
import { validateProductionSafety } from './utils/demoGuard.js';

// Called automatically on server startup
validateProductionSafety();
```

### Environment Variables

#### `NODE_ENV`
Determines the environment mode.

- `development`: Demo accounts allowed
- `test`: Demo accounts allowed
- `production`: Demo accounts blocked (unless ALLOW_DEMO=1)

#### `ALLOW_DEMO`
Override to allow demo accounts in production.

- Not set: Demo accounts blocked in production (secure)
- `ALLOW_DEMO=1`: Demo accounts allowed in production (dangerous)
- `ALLOW_DEMO=true`: Demo accounts allowed in production (dangerous)
- `ALLOW_DEMO=0`: Demo accounts blocked (secure)

**WARNING**: Never set `ALLOW_DEMO=1` in production unless absolutely necessary for staging, and remove it immediately after use.

## Testing

### Run Tests
```bash
npm test -- demo-guard.test.js
```

### Test Coverage

The test suite includes 40+ comprehensive tests:

1. **Utility Function Tests** (13 tests)
   - Demo user identification by email
   - Demo user identification by username
   - Case-insensitive matching
   - Non-demo user identification
   - Invalid input handling
   - Complete demo user list validation

2. **Seeding Permission Tests** (9 tests)
   - Development: allowed
   - Test environment: allowed
   - Production: blocked by default
   - Production with ALLOW_DEMO=1: allowed
   - Various ALLOW_DEMO values

3. **Login Permission Tests** (5 tests)
   - Development: allowed
   - Test environment: allowed
   - Production: blocked by default
   - Production with ALLOW_DEMO=1: allowed
   - Unknown environments: blocked (safer default)

4. **Development Login Tests** (3 tests)
   - Demo login by email works
   - Demo login by username works
   - Case-insensitive login works

5. **Production Login Tests WITHOUT ALLOW_DEMO** (5 tests)
   - Demo login blocked by email
   - Demo login blocked by username
   - Case-insensitive blocking
   - Admin demo account blocked
   - Helpful error message provided

6. **Production Login Tests WITH ALLOW_DEMO=1** (1 test)
   - Demo login allowed with override

7. **Non-Demo User Tests** (2 tests)
   - Non-demo users can login in production
   - Works with both email and username

8. **All Demo Accounts Test** (2 tests)
   - All demo emails blocked in production
   - All demo usernames blocked in production

9. **Error Message Quality** (1 test)
   - Security-focused error messages

## Production Deployment Checklist

### Before Deployment

- [ ] Verify `NODE_ENV=production` in production .env
- [ ] Verify `ALLOW_DEMO` is NOT set in production .env
- [ ] Remove any demo users from production database
- [ ] Test that demo logins are blocked
- [ ] Run security tests: `npm test -- demo-guard.test.js`

### After Deployment

- [ ] Attempt to login as `alice@maestro.edu` (should fail with 403)
- [ ] Attempt to login as `admin@maestro.edu` (should fail with 403)
- [ ] Verify server startup logs show no ALLOW_DEMO warnings
- [ ] Test that real users can login normally

### If You Need Staging Data

**Option 1: Create Real Accounts (Recommended)**
```bash
# Use real passwords, not password123
# Create via registration API
curl -X POST https://staging.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staging-admin@yourcompany.com",
    "username": "staging_admin",
    "password": "ActualSecurePassword123!",
    "firstName": "Staging",
    "lastName": "Admin"
  }'
```

**Option 2: Temporary Demo Override (Dangerous)**
```bash
# 1. Set ALLOW_DEMO=1 in .env
echo "ALLOW_DEMO=1" >> .env

# 2. Run seed
npm run db:seed

# 3. IMMEDIATELY remove ALLOW_DEMO=1
# Edit .env and delete ALLOW_DEMO line

# 4. Restart server
pm2 restart all

# 5. IMMEDIATELY change all demo passwords
# Use password reset or direct database update
```

## Security Best Practices

### DO ✅

- Keep `NODE_ENV=production` in production
- Never set `ALLOW_DEMO=1` in production .env
- Use real accounts with strong passwords for staging
- Change demo passwords immediately if accidentally deployed
- Run `npm test -- demo-guard.test.js` before deployment
- Remove demo users from production database
- Monitor for failed login attempts to demo accounts

### DON'T ❌

- Never commit `ALLOW_DEMO=1` to version control
- Never leave demo accounts in production database
- Never use `password123` for any real account
- Never skip the production checklist
- Never assume demo accounts are harmless
- Never ignore security warnings in logs

## Incident Response

### If Demo Accounts Are Discovered in Production

**Immediate Actions:**

1. **Disable Demo Logins**
   ```bash
   # Remove ALLOW_DEMO from .env if present
   # Restart server immediately
   pm2 restart all
   ```

2. **Change Demo Passwords**
   ```sql
   -- Generate new secure passwords
   UPDATE users
   SET password = '$2a$12$NewSecureHashHere'
   WHERE email IN (
     'admin@maestro.edu',
     'moderator@maestro.edu',
     'faculty@maestro.edu',
     'alice@maestro.edu',
     'bob@maestro.edu',
     'carol@maestro.edu'
   );
   ```

3. **Check Access Logs**
   ```bash
   # Look for suspicious demo account logins
   grep "alice@maestro.edu\|bob@maestro.edu\|admin@maestro.edu" /var/log/app.log
   ```

4. **Audit Recent Activity**
   - Check admin actions in audit logs
   - Review user data modifications
   - Check for unauthorized access

5. **Optional: Delete Demo Users**
   ```sql
   -- Permanently remove demo accounts
   DELETE FROM users
   WHERE email IN (
     'admin@maestro.edu',
     'moderator@maestro.edu',
     'faculty@maestro.edu',
     'alice@maestro.edu',
     'bob@maestro.edu',
     'carol@maestro.edu'
   );
   ```

## Troubleshooting

### Seed Script Blocked in Development

**Problem**: "SEEDING BLOCKED IN PRODUCTION" in development

**Solution**:
```bash
# Check NODE_ENV
echo $NODE_ENV
# Should be "development" or "test"

# If production, set to development
export NODE_ENV=development
npm run db:seed
```

### Demo Login Works in Production

**Problem**: Demo accounts work in production (security issue!)

**Solution**:
```bash
# 1. Check environment
grep ALLOW_DEMO .env
grep NODE_ENV .env

# 2. Remove ALLOW_DEMO if present
# Edit .env and remove ALLOW_DEMO line

# 3. Restart server
pm2 restart all

# 4. Test (should now fail with 403)
curl -X POST https://api.yourdomain.com/api/auth/login \
  -d '{"emailOrUsername": "alice@maestro.edu", "password": "password123"}'
```

### Real User Can't Login

**Problem**: Real user blocked like demo account

**Solution**:
```javascript
// Check if user is mistakenly identified as demo
import { isDemoUser } from './utils/demoGuard.js';
console.log(isDemoUser('youruser@example.com'));  // Should be false

// If true, user's email/username matches demo pattern
// Change user's email or username to something different
```

## Files

### Core Implementation
- `server/src/utils/demoGuard.js` - Demo guard utilities
- `server/src/seed.js` - Seed script with protection
- `server/src/routes/auth.js` - Login protection
- `server/src/index.js` - Startup validation

### Tests
- `server/src/__tests__/demo-guard.test.js` - 40+ comprehensive tests

### Documentation
- `server/DEMO_USER_PROTECTION.md` - This file

## Related Documentation

- [RATE_LIMITING.md](./RATE_LIMITING.md) - Rate limiting protection
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [README.md](../README.md) - Project overview

## Summary

The demo user protection system provides **defense-in-depth** against accidental or intentional exposure of demo accounts in production:

1. **Prevention**: Blocks seeding in production
2. **Detection**: Startup warnings if demo enabled
3. **Mitigation**: Blocks demo logins in production
4. **Testing**: 40+ tests ensure protection works
5. **Documentation**: Clear security guidance

**Remember**: Demo accounts with `password123` are a critical security vulnerability in production. This system ensures they never pose a risk.
