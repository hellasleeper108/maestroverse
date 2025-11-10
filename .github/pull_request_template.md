## 📋 Pull Request Description

### What does this PR do?
<!-- Provide a clear, concise description of the changes -->



### Why is this change needed?
<!-- Explain the motivation behind this PR -->



### Related Issues
<!-- Link related issues using "Closes #123" or "Fixes #456" -->

Closes #


## 🔍 Type of Change

<!-- Mark the appropriate option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style/refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix or improvement
- [ ] 🧪 Test addition or update
- [ ] 🔧 Configuration change
- [ ] 🏗️ Infrastructure/build change

## 📸 Screenshots/Videos (if applicable)

<!-- Add screenshots or screen recordings for UI changes -->



## 🧪 Testing

### How has this been tested?

<!-- Describe the tests you ran to verify your changes -->

- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Manual testing

### Test Configuration

- **Node version**:
- **Browser**:
- **OS**:

### Test Coverage

- [ ] Added tests for new functionality
- [ ] Updated existing tests
- [ ] All tests pass locally (`npm test`)
- [ ] Test coverage maintained or improved

### Manual Testing Checklist

<!-- Check all that apply -->

- [ ] Tested on development environment
- [ ] Tested with Docker
- [ ] Tested database migrations
- [ ] Tested with demo credentials
- [ ] Tested error cases
- [ ] Tested edge cases
- [ ] Tested on different screen sizes (if UI change)
- [ ] Tested keyboard navigation (if UI change)

## 🔒 Security Checklist

<!-- CRITICAL: Review all security items -->

- [ ] **No secrets or credentials committed** (API keys, passwords, tokens)
- [ ] **Input validation implemented** for all user inputs
- [ ] **SQL injection prevention** verified (using Prisma parameterized queries)
- [ ] **XSS prevention** verified (proper escaping/sanitization)
- [ ] **CSRF protection** implemented (if applicable)
- [ ] **Authentication required** for protected routes
- [ ] **Authorization checked** for restricted operations
- [ ] **Rate limiting** added for abuse-prone endpoints
- [ ] **File upload validation** (MIME type, size, filename sanitization)
- [ ] **Error messages** don't leak sensitive information
- [ ] **Dependencies** checked for vulnerabilities (`npm audit`)
- [ ] **No use of `eval()` or `dangerouslySetInnerHTML`** without sanitization
- [ ] **HTTPS enforced** in production (if applicable)

### Security Impact Assessment

<!-- Answer these questions -->

**Does this PR handle sensitive data?** (passwords, tokens, PII)
- [ ] Yes → Describe security measures:
- [ ] No

**Does this PR modify authentication/authorization logic?**
- [ ] Yes → Describe changes and testing:
- [ ] No

**Could this PR introduce a security vulnerability?**
- [ ] Yes → Explain mitigation:
- [ ] No → Explain why:

## 📚 Documentation

- [ ] **README.md** updated (if needed)
- [ ] **CLAUDE.md** updated (if architecture changes)
- [ ] **API documentation** updated (if new endpoints)
- [ ] **Inline code comments** added for complex logic
- [ ] **Migration guide** provided (if breaking changes)
- [ ] **Environment variables** documented in `.env.example`

## ✅ Code Quality Checklist

### Style & Standards

- [ ] Code follows project style guidelines
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatting applied (`npm run format`)
- [ ] No console.log statements (use proper logging)
- [ ] No commented-out code
- [ ] No TODO comments (create issues instead)

### Code Review

- [ ] Functions are small and focused (single responsibility)
- [ ] Variable and function names are clear and descriptive
- [ ] Error handling implemented for all async operations
- [ ] Edge cases handled
- [ ] Input validation using Zod schemas
- [ ] Database queries optimized (no N+1 queries)
- [ ] Middleware used for cross-cutting concerns
- [ ] No code duplication (DRY principle)

### React/Frontend (if applicable)

- [ ] Components use functional components with hooks
- [ ] PropTypes defined for all components
- [ ] No inline arrow functions in JSX (performance)
- [ ] Accessibility attributes added (ARIA labels, etc.)
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Mobile-responsive design

### Backend/API (if applicable)

- [ ] RESTful API conventions followed
- [ ] HTTP status codes used correctly
- [ ] Consistent error response format
- [ ] Request validation implemented
- [ ] Database transactions used where needed
- [ ] Indexes added for frequently queried fields
- [ ] API rate limiting configured

## 🔄 Database Changes

<!-- If this PR includes database changes -->

- [ ] **Prisma schema** updated
- [ ] **Migration file** created
- [ ] **Migration tested** (up and down)
- [ ] **Seed data** updated (if needed)
- [ ] **Backward compatible** or migration guide provided
- [ ] **Indexes added** for performance

### Migration Commands

<!-- Provide commands to apply migrations -->

```bash
# Apply migration
npm run db:migrate

# Rollback (if applicable)
# [Command here]
```

## 🚀 Deployment Notes

<!-- Information for deploying this PR -->

### Environment Variables

<!-- List any new or changed environment variables -->

**New variables:**
```bash
# None
```

**Changed variables:**
```bash
# None
```

### Pre-deployment Steps

- [ ] Database migration required
- [ ] Secrets need to be added to production
- [ ] Third-party service configuration needed
- [ ] Cache needs to be cleared

### Post-deployment Verification

- [ ] Health check endpoint returns 200
- [ ] Critical user flows tested
- [ ] Error monitoring checked
- [ ] Performance metrics reviewed

## 📊 Performance Impact

<!-- Describe any performance implications -->

- [ ] No significant performance impact
- [ ] Performance improved
- [ ] Performance degraded (explain why acceptable):

### Performance Testing

- [ ] Load testing performed
- [ ] Database query performance analyzed
- [ ] Bundle size checked (frontend changes)
- [ ] API response times measured

## 🔗 Dependencies

<!-- List any new dependencies added -->

### New Dependencies

- [ ] No new dependencies
- [ ] New dependencies added (list below):

| Package | Version | Purpose | Justification |
|---------|---------|---------|---------------|
|         |         |         |               |

### Dependency Security

- [ ] Dependencies checked for known vulnerabilities
- [ ] Licenses reviewed and compatible
- [ ] Dependencies actively maintained

## 💥 Breaking Changes

<!-- If this PR includes breaking changes -->

- [ ] **No breaking changes**
- [ ] **Breaking changes** (describe below):

### Breaking Change Details

<!-- Describe what breaks and why -->



### Migration Guide

<!-- Provide step-by-step migration instructions for users -->

```bash
# Step-by-step migration commands
```

## 🧹 Cleanup

<!-- Post-merge cleanup tasks -->

- [ ] Feature flags removed (if applicable)
- [ ] Deprecated code removed
- [ ] Old migrations cleaned up (if applicable)
- [ ] Unused dependencies removed

## 📝 Additional Notes

<!-- Any additional information reviewers should know -->



## 👥 Reviewers

<!-- Tag specific reviewers if needed -->

/cc @maintainer-name

---

## 🚦 Reviewer Checklist

<!-- For maintainers/reviewers -->

- [ ] Code reviewed for security vulnerabilities
- [ ] Tests are comprehensive and pass
- [ ] Documentation is clear and complete
- [ ] Commit messages follow conventional format
- [ ] No secrets or credentials in code
- [ ] Performance impact acceptable
- [ ] Breaking changes properly documented
- [ ] PR is ready to merge

### Review Notes

<!-- Reviewer comments -->


