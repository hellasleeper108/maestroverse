#!/bin/bash

# Maestroverse Build Verification Script
# This script tests the project structure and configuration

set -e

echo "======================================"
echo "  Maestroverse Build Verification"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $1"
        ((TESTS_FAILED++))
    fi
}

# 1. Project Structure Tests
echo "1. Testing Project Structure..."
echo "--------------------------------"

[ -f "package.json" ]
test_check "Root package.json exists"

[ -f "docker-compose.yml" ]
test_check "Docker Compose configuration exists"

[ -f ".env.example" ]
test_check "Environment example file exists"

[ -d "apps/hub" ]
test_check "Student Hub app directory exists"

[ -d "apps/careerlink" ]
test_check "CareerLink app directory exists"

[ -d "apps/collabspace" ]
test_check "CollabSpace app directory exists"

[ -d "server" ]
test_check "Server directory exists"

[ -d "shared" ]
test_check "Shared utilities directory exists"

echo ""

# 2. Configuration Files
echo "2. Testing Configuration Files..."
echo "--------------------------------"

[ -f "apps/hub/package.json" ]
test_check "Hub package.json exists"

[ -f "apps/careerlink/package.json" ]
test_check "CareerLink package.json exists"

[ -f "apps/collabspace/package.json" ]
test_check "CollabSpace package.json exists"

[ -f "server/package.json" ]
test_check "Server package.json exists"

[ -f "server/prisma/schema.prisma" ]
test_check "Prisma schema exists"

[ -f ".eslintrc.json" ]
test_check "ESLint configuration exists"

[ -f ".prettierrc.json" ]
test_check "Prettier configuration exists"

echo ""

# 3. Server Files
echo "3. Testing Server Files..."
echo "--------------------------------"

[ -f "server/src/index.js" ]
test_check "Server entry point exists"

[ -f "server/src/routes/auth.js" ]
test_check "Auth routes exist"

[ -f "server/src/routes/hub.js" ]
test_check "Hub routes exist"

[ -f "server/src/routes/careerlink.js" ]
test_check "CareerLink routes exist"

[ -f "server/src/routes/collabspace.js" ]
test_check "CollabSpace routes exist"

[ -f "server/src/routes/search.js" ]
test_check "Search routes exist"

[ -f "server/src/routes/users.js" ]
test_check "User routes exist"

[ -f "server/src/middleware/auth.js" ]
test_check "Auth middleware exists"

[ -f "server/src/websocket/index.js" ]
test_check "WebSocket handler exists"

[ -f "server/src/seed.js" ]
test_check "Database seed script exists"

echo ""

# 4. Frontend Files
echo "4. Testing Frontend Files..."
echo "--------------------------------"

# Hub
[ -f "apps/hub/pages/index.js" ]
test_check "Hub index page exists"

[ -f "apps/hub/pages/login.js" ]
test_check "Hub login page exists"

[ -f "apps/hub/pages/register.js" ]
test_check "Hub register page exists"

[ -f "apps/hub/pages/profile.js" ]
test_check "Hub profile page exists"

[ -f "apps/hub/pages/_app.js" ]
test_check "Hub app wrapper exists"

# CareerLink
[ -f "apps/careerlink/pages/index.js" ]
test_check "CareerLink index page exists"

[ -f "apps/careerlink/pages/login.js" ]
test_check "CareerLink login page exists"

# CollabSpace
[ -f "apps/collabspace/pages/index.js" ]
test_check "CollabSpace index page exists"

[ -f "apps/collabspace/pages/login.js" ]
test_check "CollabSpace login page exists"

[ -f "apps/collabspace/pages/study-groups/index.js" ]
test_check "Study groups browse page exists"

[ -f "apps/collabspace/pages/study-groups/[id].js" ]
test_check "Study group detail page exists"

[ -f "apps/collabspace/pages/study-groups/create.js" ]
test_check "Study group creation page exists"

echo ""

# 5. Shared Components
echo "5. Testing Shared Components..."
echo "--------------------------------"

[ -f "shared/components/Navbar.jsx" ]
test_check "Shared Navbar component exists"

[ -f "shared/utils/api.js" ]
test_check "API utility exists"

echo ""

# 6. Documentation
echo "6. Testing Documentation..."
echo "--------------------------------"

[ -f "README.md" ]
test_check "Main README exists"

[ -f "QUICKSTART.md" ]
test_check "Quick start guide exists"

[ -f "docs/SETUP_GUIDE.md" ]
test_check "Setup guide exists"

[ -f "docs/ARCHITECTURE_OVERVIEW.md" ]
test_check "Architecture documentation exists"

[ -f "docs/claude_notes.md" ]
test_check "Development notes exist"

echo ""

# 7. Docker Files
echo "7. Testing Docker Configuration..."
echo "--------------------------------"

[ -f "server/Dockerfile" ]
test_check "Server Dockerfile exists"

[ -f "apps/hub/Dockerfile" ]
test_check "Hub Dockerfile exists"

[ -f "apps/careerlink/Dockerfile" ]
test_check "CareerLink Dockerfile exists"

[ -f "apps/collabspace/Dockerfile" ]
test_check "CollabSpace Dockerfile exists"

echo ""

# 8. Prisma Schema Validation
echo "8. Testing Database Schema..."
echo "--------------------------------"

# Count models in schema
MODEL_COUNT=$(grep -c "^model " server/prisma/schema.prisma || true)
if [ "$MODEL_COUNT" -ge 15 ]; then
    echo -e "${GREEN}✓${NC} Prisma schema has $MODEL_COUNT models"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Prisma schema has insufficient models ($MODEL_COUNT)"
    ((TESTS_FAILED++))
fi

# Check for key models
grep -q "model User" server/prisma/schema.prisma
test_check "User model exists in schema"

grep -q "model Post" server/prisma/schema.prisma
test_check "Post model exists in schema"

grep -q "model Portfolio" server/prisma/schema.prisma
test_check "Portfolio model exists in schema"

grep -q "model Course" server/prisma/schema.prisma
test_check "Course model exists in schema"

echo ""

# 9. Package Configuration
echo "9. Testing Package Configuration..."
echo "--------------------------------"

# Check hub package name
grep -q '"name": "hub"' apps/hub/package.json
test_check "Hub package name is correct"

# Check careerlink package name
grep -q '"name": "careerlink"' apps/careerlink/package.json
test_check "CareerLink package name is correct"

# Check collabspace package name
grep -q '"name": "collabspace"' apps/collabspace/package.json
test_check "CollabSpace package name is correct"

# Check server package name
grep -q '"name": "server"' server/package.json
test_check "Server package name is correct"

echo ""

# 10. Port Configuration
echo "10. Testing Port Configuration..."
echo "--------------------------------"

grep -q '3000' apps/hub/package.json
test_check "Hub configured for port 3000"

grep -q '3002' apps/careerlink/package.json
test_check "CareerLink configured for port 3002"

grep -q '3003' apps/collabspace/package.json
test_check "CollabSpace configured for port 3003"

grep -q '3001' server/package.json || grep -q 'PORT=3001' .env.example
test_check "Server configured for port 3001"

echo ""

# Summary
echo "======================================"
echo "  Test Summary"
echo "======================================"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
else
    echo -e "${GREEN}Tests Failed: $TESTS_FAILED${NC}"
fi
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
echo "Success Rate: ${SUCCESS_RATE}%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Maestroverse is ready to use.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Review the output above.${NC}"
    exit 1
fi
