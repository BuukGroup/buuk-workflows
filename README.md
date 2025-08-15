# Buuk Workflows - Centralized GitHub Actions

A centralized repository containing reusable GitHub Actions workflows for the Buuk booking application ecosystem.

## Overview

This repository provides standardized, reusable workflows for:
- **buuk-server**: LoopBack 4 backend with PostgreSQL/PostGIS
- **buuk-web**: Next.js 13+ web application  
- **buuk-mobile**: React Native/Expo mobile application

## Benefits

✅ **50%+ reduction** in duplicate workflow code  
✅ **Centralized maintenance** and updates  
✅ **Consistent testing standards** across all repositories  
✅ **Better resource utilization** through shared caching  
✅ **Simplified onboarding** for new repositories  

## Available Workflows

### Core Testing Workflows
- **`unit-test-coverage.yml`** - Unit test execution with coverage reporting
- **`integration-tests.yml`** - Integration tests for backend acceptance tests
- **`e2e-tests.yml`** - End-to-end testing with coordinated frontend/backend setup

### Build & Quality Workflows  
- **`backend-build-lint.yml`** - LoopBack 4 backend build and linting
- **`frontend-build-lint.yml`** - Next.js frontend build and linting

## Quick Start

### Using in your repository

Add this to your `.github/workflows/` directory:

```yaml
name: Unit Tests
on: [push, pull_request]

jobs:
  test:
    uses: BuukGroup/buuk-workflows/.github/workflows/unit-test-coverage.yml@main
    with:
      node-version: '24'
      project-type: 'backend' # or 'frontend'
      coverage-threshold: 20
    secrets: inherit
```

### Required Setup

1. **Node.js 24**: All workflows use Node.js 24 LTS
2. **PostgreSQL**: Backend workflows require PostgreSQL with PostGIS extensions
3. **Secrets**: Configure required secrets in your repository settings

## Repository Structure

```
buuk-workflows/
├── .github/
│   └── workflows/           # Reusable workflow definitions
│       ├── unit-test-coverage.yml
│       ├── integration-tests.yml
│       ├── e2e-tests.yml
│       ├── backend-build-lint.yml
│       └── frontend-build-lint.yml
├── scripts/                 # Shared scripts
│   ├── coverage-calculator.js
│   ├── pr-commenter.js
│   ├── postgres-setup.sh
│   └── integration-test-runner.js
└── docs/                   # Documentation
    ├── workflow-usage.md
    ├── setup-guide.md
    └── troubleshooting.md
```

## Technology Stack

### Backend (buuk-server)
- **Framework**: LoopBack 4 with TypeScript
- **Database**: PostgreSQL 15 + PostGIS 3.4
- **Testing**: Jest with acceptance tests (*.acceptance.ts)
- **Build**: Node.js 24, npm ci, TypeScript compilation

### Frontend (buuk-web)  
- **Framework**: Next.js 13+ with TypeScript
- **Testing**: Jest + Testing Library
- **Build**: Node.js 24, npm ci, Next.js build
- **Linting**: ESLint + Prettier with React/TypeScript rules

### Mobile (buuk-mobile)
- **Framework**: React Native + Expo
- **Testing**: Jest with React Native Testing Library
- **Build**: Expo build tools

## Workflow Features

### Automated Coverage Reporting
- **Changed files analysis** - Only check coverage for modified files in PRs
- **PR comments** - Automatic coverage reports posted to pull requests  
- **Configurable thresholds** - Set different coverage requirements per project
- **Artifact uploads** - Coverage reports saved for debugging

### Cross-Repository Support
- **Private repository access** - Handles buuk-server private repository checkout
- **Token management** - Secure cross-repository authentication
- **Coordinated testing** - Synchronized frontend/backend startup for E2E tests

### Performance Optimizations
- **Smart caching** - npm dependencies and build artifacts
- **Parallel execution** - Multiple jobs run simultaneously when possible
- **Resource limits** - Optimized for GitHub free plan (2000 minutes/month)

## GitHub Free Plan Compatibility

This repository is designed to work within GitHub free plan limitations:

- **Public repository** - Avoids private repository minute usage
- **Efficient workflows** - Optimized execution time and resource usage
- **Smart caching** - Reduces build time and bandwidth usage
- **Cross-repo tokens** - Uses organization secrets for private repository access

## Database Requirements

### PostgreSQL Extensions (Required)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_topology";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";
CREATE EXTENSION IF NOT EXISTS "unaccent";
```

All workflows automatically configure these extensions during database setup.

## Environment Variables

### Backend Workflows
```bash
NODE_ENV=development|test
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=buukdb
```

### Frontend Workflows  
```bash
NEXT_PUBLIC_API_PROTOCOL=http
NEXT_PUBLIC_API_HOST=localhost
NEXT_PUBLIC_API_PORT=8080
NEXT_PUBLIC_API_VERSION=v1
```

### E2E Testing
```bash
NEXT_PUBLIC_E2E_TEST=true
# Mock service credentials
STRIPE_API_KEY=sk_test_E2E_TEST_KEY_NOT_REAL
EMAIL_USER=e2e-test@buuk-test.com
```

## Contributing

1. **Test locally** before creating workflows
2. **Follow naming conventions** - Use descriptive names (not reusable-*)
3. **Document changes** - Update README and workflow documentation
4. **Version workflows** - Use semantic versioning for breaking changes
5. **Test cross-repository** - Validate workflows work across all Buuk repositories

## Security Considerations

- **No sensitive data** - This public repository contains no secrets or credentials
- **Token rotation** - Regular rotation of cross-repository access tokens
- **Minimal permissions** - Workflows use least privilege access patterns
- **Audit logging** - All workflow executions are logged and traceable

## Support

For issues, questions, or contributions:
1. Create an issue in this repository
2. Reference the specific workflow and error details
3. Include relevant logs and environment information

## License

This project is part of the Buuk booking application ecosystem.

---

**Maintained by**: Buuk Development Team  
**Last Updated**: January 2025  
**Version**: 1.0.0