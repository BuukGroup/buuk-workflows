# Setup Guide

This guide walks you through setting up centralized GitHub Actions workflows for your Buuk repositories.

## Prerequisites

### 1. Repository Access
- **Public repository**: `BuukGroup/buuk-workflows` (this repository)
- **Private repositories**: Access to `BuukGroup/buuk-server` and `BuukGroup/buuk-web`
- **GitHub plan**: Free plan compatible (with token management)

### 2. Required Tools
- **Node.js 24**: All workflows use Node.js 24 LTS
- **npm**: Package management (automatically available)
- **PostgreSQL**: For backend and integration tests
- **Playwright**: For E2E testing (automatically installed)

### 3. Permissions
- **Repository admin**: To configure secrets and workflows
- **Token creation**: To create Personal Access Tokens for cross-repository access

## Step 1: Token Setup

### Create Personal Access Token (PAT)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Configure the token:
   - **Name**: `Buuk Workflows Cross-Repo Access`
   - **Expiration**: 1 year (recommended)
   - **Scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
     - ✅ `read:org` (Read org and team membership)

4. Generate and copy the token (starts with `ghp_`)

### Add Token to Organization Secrets

**Option A: Organization Level (Recommended)**
1. Go to GitHub Organization → Settings → Secrets and variables → Actions
2. Click "New organization secret"
3. Name: `BUUK_ACCESS_TOKEN`
4. Value: The PAT token created above
5. Repository access: Select repositories that need cross-repo access

**Option B: Repository Level**
1. Go to each repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `BUUK_ACCESS_TOKEN`
4. Value: The PAT token created above

## Step 2: Backend Setup (buuk-server)

### Update Jest Configuration

The integration tests workflow requires acceptance tests to be enabled:

```javascript
// jest.config.js
module.exports = {
  // ... existing config
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.acceptance.ts', // ✅ Uncommented
  ],
  // ... rest of config
};
```

### Add Integration Test Scripts

```json
{
  "scripts": {
    "test:integration": "jest --testMatch=\"**/*.acceptance.ts\" --testTimeout=30000 --verbose --detectOpenHandles --forceExit",
    "test:integration:coverage": "npm run test:integration -- --coverage --coverageDirectory=coverage-integration"
  }
}
```

### Create Workflow File

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package*.json'
      - 'jest.config.js'
      - '.github/workflows/**'
  pull_request:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package*.json'
      - 'jest.config.js'
      - '.github/workflows/**'

jobs:
  unit-tests:
    uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
    with:
      project-type: 'backend'
      database-required: true
      coverage-threshold: 20
    secrets: inherit

  integration-tests:
    uses: BuukGroup/buuk-workflows/.github/workflows/integration-tests.yml@main
    with:
      test-timeout: 30000
      postgres-version: '14'
    secrets: inherit

  build-lint:
    uses: BuukGroup/buuk-workflows/.github/workflows/backend-build-lint.yml@main
    with:
      run-audit: true
      fail-on-audit: false
    secrets: inherit
```

### Verify Backend Requirements

Ensure your `package.json` has these scripts:
```json
{
  "scripts": {
    "build": "lb-tsc",
    "lint": "lb-eslint --report-unused-disable-directives .",
    "prettier:check": "lb-prettier --check \"src/**/*.ts\"",
    "test:ci": "jest --coverage --ci --watchAll=false --passWithNoTests"
  }
}
```

## Step 3: Frontend Setup (buuk-web)

### Create Workflow File

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package*.json'
      - 'next.config.*'
      - 'playwright.config.*'
      - '.github/workflows/**'
  pull_request:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package*.json'
      - 'next.config.*'
      - 'playwright.config.*'
      - '.github/workflows/**'

jobs:
  unit-tests:
    uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
    with:
      project-type: 'frontend'
      coverage-threshold: 20
    secrets: inherit

  build-lint:
    uses: BuukGroup/buuk-workflows/.github/workflows/frontend-build-lint.yml@main
    with:
      build-command: 'npm run build'
      run-typecheck: true
    secrets: inherit

  e2e-tests:
    if: github.ref == 'refs/heads/main' || github.event_name == 'pull_request'
    uses: BuukGroup/buuk-workflows/.github/workflows/e2e-tests.yml@main
    with:
      frontend-repo: 'BuukGroup/buuk-web'
      backend-repo: 'BuukGroup/buuk-server'
      frontend-ref: ${{ github.ref }}
      backend-ref: 'main'
    secrets:
      BUUK_ACCESS_TOKEN: ${{ secrets.BUUK_ACCESS_TOKEN }}
```

### Verify Frontend Requirements

Ensure your `package.json` has these scripts:
```json
{
  "scripts": {
    "build": "next build",
    "lint": "next lint",
    "prettier:check": "prettier --check \"src/**/*.{ts,tsx}\"",
    "test:ci": "jest --coverage --ci --watchAll=false --passWithNoTests",
    "test:e2e": "playwright test"
  }
}
```

## Step 4: E2E Testing Setup

### Configure Playwright (buuk-web)

Ensure `playwright.config.ts` exists with proper configuration:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### E2E Test Environment Variables

The E2E workflow automatically sets up mock environment variables. Ensure your application handles E2E mode:

```typescript
// In your application
const isE2EMode = process.env.NEXT_PUBLIC_E2E_TEST === 'true';
```

## Step 5: Remove Legacy Workflows

Once centralized workflows are working, remove old workflow files:

```bash
# In each repository
rm .github/workflows/test-coverage.yml
rm .github/workflows/e2e-tests.yml
# Keep only the new ci.yml
```

## Step 6: Validation

### Test Your Setup

1. **Create a test PR** in buuk-server or buuk-web
2. **Check workflow execution** in the Actions tab
3. **Verify PR comments** are posted with test results
4. **Check artifacts** are uploaded correctly

### Expected Workflow Runs

For a typical PR, you should see:
- ✅ Unit Test Coverage (2-5 minutes)
- ✅ Integration Tests (5-10 minutes, backend only)
- ✅ Build & Lint (3-7 minutes)
- ✅ E2E Tests (15-25 minutes, when triggered)

## Step 7: Monitoring and Maintenance

### Token Rotation

Set up a reminder to rotate the PAT token before expiration:
1. Create calendar reminder for token expiration date
2. Generate new token with same permissions
3. Update organization/repository secrets
4. Test workflows after token update

### Usage Monitoring

Track GitHub Actions minutes usage:
1. Go to Organization → Settings → Billing and plans
2. Monitor Actions minutes consumption
3. Consider upgrading to paid plan if approaching limits

### Workflow Updates

Stay updated with workflow improvements:
1. Watch this repository for updates
2. Update workflow references to use latest version tags
3. Test new versions in development branches first

## Advanced Configuration

### Custom Coverage Thresholds

```yaml
unit-tests:
  uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
  with:
    coverage-threshold: 30  # Higher threshold for critical repos
```

### Different Node.js Versions

```yaml
build-lint:
  uses: BuukGroup/buuk-workflows/.github/workflows/backend-build-lint.yml@main
  with:
    node-version: '20'  # Use older Node.js version if needed
```

### Conditional E2E Tests

```yaml
e2e-tests:
  if: contains(github.event.pull_request.labels.*.name, 'test-e2e')
  # Only run E2E when PR has 'test-e2e' label
```

## Troubleshooting

### Common Setup Issues

1. **"Token not found" Error**
   - Verify `BUUK_ACCESS_TOKEN` secret is set
   - Check token permissions and expiration
   - Ensure token has access to required repositories

2. **"Workflow not found" Error**
   - Verify the workflow file path is correct
   - Check that `buuk-workflows` repository is public
   - Ensure you're using the correct branch reference (`@main`)

3. **"PostgreSQL connection failed"**
   - Backend workflows automatically set up PostgreSQL
   - Check if custom database configuration conflicts
   - Verify PostgreSQL service configuration in workflow

4. **"Coverage calculator failed"**
   - Workflows download scripts from this public repository
   - Check network connectivity in Actions runner
   - Verify script URLs are accessible

### Getting Support

1. **Check workflow logs** in GitHub Actions for detailed error messages
2. **Review artifacts** uploaded by failed workflows
3. **Compare with working examples** in this documentation
4. **Create an issue** in this repository with:
   - Workflow file content
   - Error logs and screenshots
   - Repository configuration details

## Migration Checklist

- [ ] Created Personal Access Token with correct permissions
- [ ] Added `BUUK_ACCESS_TOKEN` to organization/repository secrets
- [ ] Updated buuk-server Jest configuration for integration tests
- [ ] Added integration test npm scripts to buuk-server
- [ ] Created new CI workflow files in both repositories
- [ ] Verified required npm scripts exist in package.json files
- [ ] Tested workflows with a sample pull request
- [ ] Removed legacy workflow files
- [ ] Set up token rotation reminder
- [ ] Documented any custom configuration for team

Once all items are checked, your centralized workflow setup is complete! 🎉