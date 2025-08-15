# Workflow Usage Guide

This document provides detailed usage instructions for all available workflows in the Buuk Workflows repository.

## Available Workflows

### 1. Unit Test Coverage (`unit-test-coverage.yml`)

Runs unit tests with coverage analysis and reports results to pull requests.

**Usage:**
```yaml
name: Unit Tests
on: [push, pull_request]

jobs:
  test:
    uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
    with:
      node-version: '24'
      project-type: 'backend'  # or 'frontend'
      coverage-threshold: 20
      database-required: true  # for backend projects
    secrets: inherit
```

**Parameters:**
- `node-version` (optional): Node.js version (default: '24')
- `project-type` (required): 'backend' or 'frontend'
- `coverage-threshold` (optional): Coverage percentage for changed files (default: 20)
- `working-directory` (optional): Project directory (default: '.')
- `database-required` (optional): Whether PostgreSQL is needed (default: false)

**Use Cases:**
- ✅ buuk-server (backend with PostgreSQL)
- ✅ buuk-web (frontend without database)
- ✅ buuk-mobile (frontend without database)

### 2. Integration Tests (`integration-tests.yml`)

Runs integration tests (*.acceptance.ts) with PostgreSQL and PostGIS setup.

**Usage:**
```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration:
    uses: BuukGroup/buuk-workflows/.github/workflows/integration-tests.yml@main
    with:
      node-version: '24'
      test-timeout: 30000
      postgres-version: '14'
    secrets: inherit
```

**Parameters:**
- `node-version` (optional): Node.js version (default: '24')
- `working-directory` (optional): Project directory (default: '.')
- `test-timeout` (optional): Test timeout in milliseconds (default: 30000)
- `postgres-version` (optional): PostgreSQL version (default: '14')

**Use Cases:**
- ✅ buuk-server (LoopBack 4 acceptance tests)
- ❌ buuk-web (no integration tests)
- ❌ buuk-mobile (no integration tests)

### 3. Backend Build & Lint (`backend-build-lint.yml`)

Comprehensive backend build, linting, and quality checks.

**Usage:**
```yaml
name: Backend Build
on: [push, pull_request]

jobs:
  build:
    uses: BuukGroup/buuk-workflows/.github/workflows/backend-build-lint.yml@main
    with:
      node-version: '24'
      run-typecheck: true
      run-audit: true
      fail-on-audit: false
    secrets: inherit
```

**Parameters:**
- `node-version` (optional): Node.js version (default: '24')
- `working-directory` (optional): Project directory (default: '.')
- `run-typecheck` (optional): Run TypeScript checking (default: true)
- `run-audit` (optional): Run npm security audit (default: true)
- `fail-on-audit` (optional): Fail on audit issues (default: false)

**Features:**
- ESLint + Prettier formatting checks
- TypeScript compilation
- npm security audit
- Build verification and size reporting

### 4. Frontend Build & Lint (`frontend-build-lint.yml`)

Comprehensive frontend build, linting, and quality checks with framework support.

**Usage:**
```yaml
name: Frontend Build
on: [push, pull_request]

jobs:
  build:
    uses: BuukGroup/buuk-workflows/.github/workflows/frontend-build-lint.yml@main
    with:
      node-version: '24'
      build-command: 'npm run build'
      run-typecheck: true
    secrets: inherit
```

**Parameters:**
- `node-version` (optional): Node.js version (default: '24')
- `working-directory` (optional): Project directory (default: '.')
- `run-typecheck` (optional): Run TypeScript checking (default: true)
- `run-audit` (optional): Run npm security audit (default: true)
- `fail-on-audit` (optional): Fail on audit issues (default: false)
- `build-command` (optional): Build command (default: 'npm run build')

**Framework Support:**
- ✅ Next.js (automatic detection and bundle analysis)
- ✅ Vite (automatic detection)
- ✅ React/Generic (fallback)

### 5. E2E Tests (`e2e-tests.yml`)

Coordinated end-to-end testing with cross-repository support.

**Usage:**
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    uses: BuukGroup/buuk-workflows/.github/workflows/e2e-tests.yml@main
    with:
      frontend-repo: 'BuukGroup/buuk-web'
      backend-repo: 'BuukGroup/buuk-server'
      frontend-ref: 'main'
      backend-ref: 'main'
    secrets:
      BUUK_ACCESS_TOKEN: ${{ secrets.BUUK_ACCESS_TOKEN }}
```

**Parameters:**
- `node-version` (optional): Node.js version (default: '24')
- `frontend-repo` (required): Frontend repository (owner/repo)
- `backend-repo` (required): Backend repository (owner/repo)
- `frontend-ref` (optional): Frontend branch (default: 'main')
- `backend-ref` (optional): Backend branch (default: 'main')
- `postgres-version` (optional): PostgreSQL version (default: '15')
- `test-timeout` (optional): Test timeout in minutes (default: 30)

**Required Secrets:**
- `BUUK_ACCESS_TOKEN`: Token for accessing private repositories

## Complete Workflow Examples

### Backend Repository (buuk-server)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  # Unit tests with coverage
  unit-tests:
    uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
    with:
      project-type: 'backend'
      database-required: true
      coverage-threshold: 20
    secrets: inherit

  # Integration tests
  integration-tests:
    uses: BuukGroup/buuk-workflows/.github/workflows/integration-tests.yml@main
    with:
      test-timeout: 30000
    secrets: inherit

  # Build and lint
  build-lint:
    uses: BuukGroup/buuk-workflows/.github/workflows/backend-build-lint.yml@main
    with:
      run-audit: true
      fail-on-audit: false
    secrets: inherit
```

### Frontend Repository (buuk-web)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  # Unit tests with coverage
  unit-tests:
    uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
    with:
      project-type: 'frontend'
      coverage-threshold: 20
    secrets: inherit

  # Build and lint
  build-lint:
    uses: BuukGroup/buuk-workflows/.github/workflows/frontend-build-lint.yml@main
    with:
      build-command: 'npm run build'
      run-typecheck: true
    secrets: inherit

  # E2E tests (only for main changes)
  e2e-tests:
    if: github.ref == 'refs/heads/main' || github.event_name == 'pull_request'
    uses: BuukGroup/buuk-workflows/.github/workflows/e2e-tests.yml@main
    with:
      frontend-repo: 'BuukGroup/buuk-web'
      backend-repo: 'BuukGroup/buuk-server'
    secrets:
      BUUK_ACCESS_TOKEN: ${{ secrets.BUUK_ACCESS_TOKEN }}
```

## Environment Variables

### Required for All Workflows
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Required for E2E Tests
- `BUUK_ACCESS_TOKEN`: Personal Access Token for cross-repository access

### Optional Environment Variables
- `NODE_ENV`: Set automatically to appropriate values
- `CI`: Set automatically to 'true' in CI environments

## Secrets Management

### Organization Secrets (Recommended)
Set these secrets at the organization level for all repositories:

```
BUUK_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Repository Secrets (Alternative)
Set secrets in each repository that uses the workflows:

1. Go to repository Settings → Secrets and variables → Actions
2. Add `BUUK_ACCESS_TOKEN` with appropriate permissions

### Token Permissions
The `BUUK_ACCESS_TOKEN` should have:
- `repo` scope for private repository access
- `workflow` scope for triggering workflows
- Access to both frontend and backend repositories

## Workflow Triggers

### Recommended Triggers
```yaml
on:
  push:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package*.json'
      - '.github/workflows/**'
  pull_request:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package*.json'
      - '.github/workflows/**'
```

### Path Filtering
Use path filtering to run workflows only when relevant files change:

- **Backend**: `src/**`, `package*.json`, `jest.config.js`
- **Frontend**: `src/**`, `package*.json`, `next.config.*`, `playwright.config.*`
- **E2E**: `src/**`, `e2e/**`, `package*.json`

## Performance Optimization

### Caching Strategy
All workflows automatically cache:
- npm dependencies
- Node.js setup
- Build artifacts

### Parallel Execution
Run workflows in parallel when possible:
```yaml
jobs:
  unit-tests:
    # ... unit test job
  
  integration-tests:
    # ... integration test job
  
  build-lint:
    # ... build job
    
  # All three jobs run in parallel
```

### Resource Limits
- **Unit tests**: ~5-10 minutes
- **Integration tests**: ~10-15 minutes
- **Build & lint**: ~5-10 minutes
- **E2E tests**: ~20-30 minutes

## Troubleshooting

### Common Issues

1. **"Coverage calculator not found"**
   - The script is downloaded from the public repository
   - Check internet connectivity and GitHub raw content access

2. **"PostgreSQL connection failed"**
   - Ensure PostgreSQL service is properly configured
   - Check database credentials and connection strings

3. **"Cross-repository access denied"**
   - Verify `BUUK_ACCESS_TOKEN` is set correctly
   - Check token permissions and expiration

4. **"Frontend build timeout"**
   - Increase `test-timeout` parameter
   - Check for hanging processes or network issues

### Debug Mode
Enable verbose logging by setting:
```yaml
env:
  RUNNER_DEBUG: 1
```

### Getting Help
- Check workflow run logs in GitHub Actions
- Review artifacts uploaded by workflows
- Compare with working examples in this documentation