# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Buuk centralized workflows.

## Quick Diagnostics

### Check Workflow Status
1. Go to repository → Actions tab
2. Click on the failing workflow run
3. Expand failed job steps
4. Look for error messages in red

### Common Error Patterns
- 🔑 `Error: secrets.BUUK_ACCESS_TOKEN not found` → Token setup issue
- 🐘 `PostgreSQL connection failed` → Database setup issue  
- 📦 `npm ci failed` → Dependency installation issue
- 🧪 `Coverage calculator not found` → Script download issue
- 🎭 `Playwright browser not found` → Browser installation issue

## Token and Authentication Issues

### Error: `secrets.BUUK_ACCESS_TOKEN not found`

**Symptoms:**
- E2E workflow fails at checkout step
- Error message about missing token

**Diagnosis:**
```bash
# Check if token is set at organization level
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/orgs/BuukGroup/actions/secrets

# Check repository-level secrets
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/BuukGroup/REPO_NAME/actions/secrets
```

**Solutions:**
1. **Add missing token:**
   - Go to Organization → Settings → Secrets → Actions
   - Add `BUUK_ACCESS_TOKEN` with PAT token

2. **Check token permissions:**
   - Token needs `repo` and `workflow` scopes
   - Must have access to both frontend and backend repos

3. **Verify token expiration:**
   - Generate new token if expired
   - Update organization secrets

### Error: `Bad credentials` or `403 Forbidden`

**Symptoms:**
- Cross-repository checkout fails
- API rate limiting errors

**Solutions:**
1. **Regenerate token:**
   ```bash
   # Test token validity
   curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
   ```

2. **Check repository access:**
   - Ensure token owner has access to private repositories
   - Verify organization permissions

## Database Issues

### Error: `PostgreSQL connection failed`

**Symptoms:**
- Backend/integration tests fail to connect
- Timeout waiting for database

**Diagnosis:**
```yaml
# Add debug step to workflow
- name: Debug PostgreSQL
  run: |
    pg_isready -h localhost -p 5432 -U postgres
    psql -h localhost -U postgres -c "SELECT version();"
    netstat -tlnp | grep :5432
```

**Solutions:**
1. **Service configuration:**
   ```yaml
   services:
     postgres:
       image: postgres:14  # or postgis/postgis:15-3.4
       env:
         POSTGRES_PASSWORD: test
         POSTGRES_USER: test  
         POSTGRES_DB: buuk_test
       options: >-
         --health-cmd pg_isready
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
       ports:
         - 5432:5432
   ```

2. **Connection string issues:**
   ```bash
   # Ensure correct format
   postgresql://user:password@host:port/database
   
   # Common mistakes:
   # ❌ postgres://... (wrong protocol)
   # ❌ Missing password
   # ❌ Wrong port
   ```

### Error: `PostGIS extension not found`

**Symptoms:**
- Extension creation fails
- Missing PostGIS functions

**Solutions:**
1. **Use PostGIS image:**
   ```yaml
   services:
     postgres:
       image: postgis/postgis:15-3.4  # Instead of postgres:15
   ```

2. **Manual extension creation:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "postgis";
   CREATE EXTENSION IF NOT EXISTS "postgis_topology";
   ```

## Build and Dependencies Issues

### Error: `npm ci failed`

**Symptoms:**
- Dependency installation fails
- Package-lock.json conflicts

**Diagnosis:**
```bash
# Check Node.js version compatibility
node --version
npm --version

# Check for package conflicts
npm ls --depth=0
```

**Solutions:**
1. **Node.js version mismatch:**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version: '24'  # Match your local version
   ```

2. **Clear npm cache:**
   ```yaml
   - name: Clear npm cache
     run: npm cache clean --force
   ```

3. **Update package-lock.json:**
   ```bash
   # Locally
   rm package-lock.json
   npm install
   git add package-lock.json
   git commit -m "Update package-lock.json"
   ```

### Error: `TypeScript compilation failed`

**Symptoms:**
- Build step fails with TS errors
- Type checking errors

**Solutions:**
1. **Check tsconfig.json:**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "skipLibCheck": true  // Add if needed
     }
   }
   ```

2. **Disable type checking temporarily:**
   ```yaml
   with:
     run-typecheck: false
   ```

## Test-Related Issues

### Error: `Jest tests failed`

**Symptoms:**
- Unit tests fail in CI but pass locally
- Environment-specific failures

**Diagnosis:**
```javascript
// Add debug info to test
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CI:', process.env.CI);
console.log('Database URL:', process.env.TEST_DATABASE_URL);
```

**Solutions:**
1. **Environment variables:**
   ```yaml
   env:
     NODE_ENV: test
     CI: true
     TEST_DATABASE_URL: postgresql://test:test@localhost:5432/buuk_test
   ```

2. **Test timeouts:**
   ```javascript
   // jest.config.js
   module.exports = {
     testTimeout: 30000,  // Increase for CI
   };
   ```

### Error: `Coverage threshold not met`

**Symptoms:**
- Coverage check fails
- PR comments show low coverage

**Solutions:**
1. **Adjust threshold:**
   ```yaml
   with:
     coverage-threshold: 15  # Lower threshold temporarily
   ```

2. **Exclude files from coverage:**
   ```javascript
   // jest.config.js
   collectCoverageFrom: [
     'src/**/*.ts',
     '!src/**/*.d.ts',
     '!src/__tests__/**',
   ]
   ```

## E2E Testing Issues

### Error: `Playwright browser not found`

**Symptoms:**
- E2E tests fail to start browser
- Browser installation timeout

**Solutions:**
1. **Explicit browser installation:**
   ```yaml
   - name: Install Playwright browsers
     run: npx playwright install chromium --with-deps
   ```

2. **Use different browser:**
   ```typescript
   // playwright.config.ts
   projects: [
     { name: 'webkit', use: { ...devices['Desktop Safari'] } }
   ]
   ```

### Error: `Frontend server failed to start`

**Symptoms:**
- E2E workflow times out waiting for frontend
- Server process dies immediately

**Diagnosis:**
```yaml
- name: Debug frontend startup
  run: |
    npm run start &
    SERVER_PID=$!
    sleep 10
    
    # Check if process is still running
    if kill -0 $SERVER_PID 2>/dev/null; then
      echo "✅ Server is running"
    else
      echo "❌ Server died"
      # Check logs
      cat frontend-server.log
    fi
```

**Solutions:**
1. **Check port conflicts:**
   ```yaml
   - name: Check port availability
     run: |
       netstat -tlnp | grep :3000 || echo "Port 3000 is free"
       netstat -tlnp | grep :8080 || echo "Port 8080 is free"
   ```

2. **Environment variables:**
   ```yaml
   env:
     NEXT_PUBLIC_E2E_TEST: true
     NODE_ENV: development  # Not production
   ```

## Performance Issues

### Error: `Workflow timeout`

**Symptoms:**
- Jobs exceed time limits
- Workflows cancelled after 6 hours

**Solutions:**
1. **Increase job timeout:**
   ```yaml
   jobs:
     test:
       timeout-minutes: 45  # Default is 360 (6 hours)
   ```

2. **Optimize dependencies:**
   ```yaml
   - name: Install dependencies
     run: npm ci --prefer-offline --no-audit
   ```

### Error: `GitHub Actions minutes exceeded`

**Symptoms:**
- Workflows queued or failed
- Billing alerts

**Solutions:**
1. **Optimize workflow triggers:**
   ```yaml
   on:
     push:
       paths:
         - 'src/**'        # Only run when source changes
         - 'package*.json'
   ```

2. **Use matrix builds sparingly:**
   ```yaml
   strategy:
     matrix:
       node-version: [20]  # Test only one version in PRs
   ```

## Script Download Issues

### Error: `Coverage calculator not found`

**Symptoms:**
- Script download fails with 404
- Network connectivity issues

**Solutions:**
1. **Check URL accessibility:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/BuukGroup/buuk-workflows/main/scripts/coverage-calculator.js
   ```

2. **Use specific branch/tag:**
   ```yaml
   run: |
     curl -fsSL https://raw.githubusercontent.com/BuukGroup/buuk-workflows/v1.0.0/scripts/coverage-calculator.js -o coverage-calculator.js
   ```

3. **Fallback to local copy:**
   ```yaml
   - name: Setup coverage calculator
     run: |
       if ! curl -fsSL https://raw.githubusercontent.com/BuukGroup/buuk-workflows/main/scripts/coverage-calculator.js -o coverage-calculator.js; then
         echo "Using fallback coverage calculation"
         # Inline fallback script
       fi
   ```

## Debugging Workflows

### Enable Debug Logging

```yaml
env:
  RUNNER_DEBUG: 1          # Enable runner debug logging
  ACTIONS_STEP_DEBUG: 1    # Enable step debug logging
```

### Add Debug Steps

```yaml
- name: Debug Environment
  run: |
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo "Working directory: $(pwd)"
    echo "Environment variables:"
    env | grep -E "(NODE_|NPM_|CI)" | sort
```

### Check Artifacts

```yaml
- name: Upload debug artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: debug-logs
    path: |
      *.log
      coverage/
      test-results/
```

## Performance Optimization

### Cache Strategy

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

### Parallel Jobs

```yaml
jobs:
  unit-tests:
    # Fast job
  
  integration-tests:
    # Slower job
  
  build-lint:
    # Medium job
    
  # All run in parallel by default
```

## Getting Help

### Information to Provide

When seeking help, include:

1. **Workflow file content**
2. **Complete error logs** (not just the summary)
3. **Repository configuration** (public/private, org settings)
4. **Local environment** that works/doesn't work
5. **Recent changes** that might have caused the issue

### Useful Commands

```bash
# Check repository permissions
gh api repos/BuukGroup/buuk-server

# Test API access
gh api user

# Check workflow runs
gh run list --repo BuukGroup/buuk-web

# Download workflow logs
gh run download <run-id> --repo BuukGroup/buuk-web
```

### Emergency Workarounds

1. **Disable failing workflow temporarily:**
   ```yaml
   # Add to top of workflow file
   if: false  # Disable this workflow
   ```

2. **Skip specific steps:**
   ```yaml
   - name: Problematic step
     if: false  # Skip this step
     run: echo "Skipped"
   ```

3. **Use fallback configurations:**
   ```yaml
   with:
     run-audit: false      # Skip audit if problematic
     run-typecheck: false  # Skip type checking
   ```

Remember: Most issues are related to environment differences between local development and CI. Always test locally with similar conditions when possible!