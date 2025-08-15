#!/usr/bin/env node

/**
 * PR Commenter Script
 * 
 * Posts or updates comments on GitHub Pull Requests with test results and coverage reports.
 * Used by GitHub Actions workflows to provide automated feedback.
 * 
 * Usage:
 *   node pr-commenter.js [options]
 * 
 * Environment Variables:
 *   GITHUB_TOKEN          GitHub token for API access
 *   GITHUB_REPOSITORY     Repository in format owner/repo
 *   PR_NUMBER             Pull request number
 * 
 * Options:
 *   --type                Comment type: coverage, e2e, build (required)
 *   --status              Status: success, failure, warning
 *   --title               Comment title/header
 *   --body                Comment body content
 *   --details             Additional details (JSON string)
 *   --global-coverage     Global coverage percentage
 *   --changed-coverage    Changed files coverage percentage
 *   --coverage-details    Coverage details markdown
 */

const https = require('https');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  type: getArgValue('--type'),
  status: getArgValue('--status') || 'success',
  title: getArgValue('--title'),
  body: getArgValue('--body'),
  details: getArgValue('--details'),
  globalCoverage: getArgValue('--global-coverage'),
  changedCoverage: getArgValue('--changed-coverage'),
  coverageDetails: getArgValue('--coverage-details')
};

function getArgValue(argName) {
  const index = args.indexOf(argName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function getRequiredEnvVar(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function makeGitHubRequest(method, endpoint, data) {
  return new Promise((resolve, reject) => {
    const token = getRequiredEnvVar('GITHUB_TOKEN');
    const repo = getRequiredEnvVar('GITHUB_REPOSITORY');
    
    const postData = data ? JSON.stringify(data) : null;
    
    const requestOptions = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${repo}${endpoint}`,
      method: method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Buuk-Workflows-PR-Commenter',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    if (postData) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode} ${parsed.message || responseData}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

function generateCoverageComment(globalCoverage, changedCoverage, coverageDetails) {
  const prNumber = getRequiredEnvVar('PR_NUMBER');
  const repo = getRequiredEnvVar('GITHUB_REPOSITORY');
  const [owner, repoName] = repo.split('/');
  
  let body = `## 📊 Test Coverage Report

### Global Coverage
Coverage after merging this PR will be **${globalCoverage || 'N/A'}%**

### Changed Files Coverage
${coverageDetails || 'No coverage details available'}

---

> 💡 **Note:** The build requires 20% coverage for changed files only, not global coverage.
`;

  return {
    title: '📊 Test Coverage Report',
    body: body,
    identifier: 'test-coverage'
  };
}

function generateE2EComment(status, details) {
  let statusEmoji = '✅';
  let statusText = 'Passed';
  
  if (status === 'failure') {
    statusEmoji = '❌';
    statusText = 'Failed';
  } else if (status === 'warning') {
    statusEmoji = '⚠️';
    statusText = 'Warning';
  }

  const parsedDetails = details ? JSON.parse(details) : {};
  const testDetails = parsedDetails.testDetails || 'All E2E tests passed successfully!';
  const artifacts = status === 'failure' ? '\n### 📹 Test artifacts available in the Actions tab for debugging' : '';

  let body = `## 🎭 E2E Test Results

**Status:** ${statusEmoji} ${statusText}
**Details:** ${testDetails}

### Test Environment
- **Backend:** http://localhost:8080 (buuk-server)
- **Frontend:** http://localhost:3000 (buuk-web)
- **Database:** PostgreSQL with PostGIS
- **Browser:** Chromium (Playwright)
${artifacts}

---

> 🤖 Automated E2E testing with coordinated frontend/backend setup
`;

  return {
    title: '🎭 E2E Test Results',
    body: body,
    identifier: 'e2e-tests'
  };
}

function generateBuildComment(status, details) {
  let statusEmoji = '✅';
  let statusText = 'Success';
  
  if (status === 'failure') {
    statusEmoji = '❌';
    statusText = 'Failed';
  } else if (status === 'warning') {
    statusEmoji = '⚠️';
    statusText = 'Warning';
  }

  const parsedDetails = details ? JSON.parse(details) : {};
  const buildDetails = parsedDetails.buildDetails || 'Build and linting completed successfully!';

  let body = `## 🏗️ Build & Lint Results

**Status:** ${statusEmoji} ${statusText}
**Details:** ${buildDetails}

### Build Environment
- **Node.js:** 24 LTS
- **TypeScript:** Strict mode enabled
- **Linting:** ESLint + Prettier

---

> 🔧 Automated build and code quality checks
`;

  return {
    title: '🏗️ Build & Lint Results',
    body: body,
    identifier: 'build-lint'
  };
}

async function findExistingComment(identifier) {
  try {
    const prNumber = getRequiredEnvVar('PR_NUMBER');
    const comments = await makeGitHubRequest('GET', `/issues/${prNumber}/comments`);
    
    return comments.find(comment =>
      comment.body.includes(identifier) || 
      comment.body.includes(options.title)
    );
  } catch (error) {
    console.error(`⚠️ Failed to fetch existing comments: ${error.message}`);
    return null;
  }
}

async function postOrUpdateComment(commentData) {
  try {
    const prNumber = getRequiredEnvVar('PR_NUMBER');
    const existingComment = await findExistingComment(commentData.identifier);

    if (existingComment) {
      // Update existing comment
      await makeGitHubRequest('PATCH', `/issues/comments/${existingComment.id}`, {
        body: commentData.body
      });
      console.log(`✅ Updated existing ${commentData.title} comment`);
    } else {
      // Create new comment
      await makeGitHubRequest('POST', `/issues/${prNumber}/comments`, {
        body: commentData.body
      });
      console.log(`✅ Created new ${commentData.title} comment`);
    }
  } catch (error) {
    console.error(`❌ Failed to post/update comment: ${error.message}`);
    process.exit(1);
  }
}

function validateOptions() {
  if (!options.type) {
    console.error('❌ --type is required (coverage, e2e, build)');
    process.exit(1);
  }

  if (!['coverage', 'e2e', 'build'].includes(options.type)) {
    console.error('❌ --type must be one of: coverage, e2e, build');
    process.exit(1);
  }

  // Validate required environment variables
  getRequiredEnvVar('GITHUB_TOKEN');
  getRequiredEnvVar('GITHUB_REPOSITORY');
  getRequiredEnvVar('PR_NUMBER');
}

async function main() {
  validateOptions();

  let commentData;

  switch (options.type) {
    case 'coverage':
      commentData = generateCoverageComment(
        options.globalCoverage,
        options.changedCoverage,
        options.coverageDetails
      );
      break;
      
    case 'e2e':
      commentData = generateE2EComment(options.status, options.details);
      break;
      
    case 'build':
      commentData = generateBuildComment(options.status, options.details);
      break;
      
    default:
      console.error(`❌ Unknown comment type: ${options.type}`);
      process.exit(1);
  }

  // Override title if provided
  if (options.title) {
    commentData.title = options.title;
  }

  // Override body if provided
  if (options.body) {
    commentData.body = options.body;
  }

  await postOrUpdateComment(commentData);
}

// Show usage if no arguments provided
if (args.length === 0) {
  console.log(`
Usage: node pr-commenter.js [options]

Options:
  --type                Comment type: coverage, e2e, build (required)
  --status              Status: success, failure, warning
  --title               Comment title/header
  --body                Comment body content
  --details             Additional details (JSON string)
  --global-coverage     Global coverage percentage
  --changed-coverage    Changed files coverage percentage
  --coverage-details    Coverage details markdown

Environment Variables:
  GITHUB_TOKEN          GitHub token for API access
  GITHUB_REPOSITORY     Repository in format owner/repo  
  PR_NUMBER             Pull request number

Examples:
  node pr-commenter.js --type coverage --global-coverage 85.5 --changed-coverage 90.2
  node pr-commenter.js --type e2e --status success
  node pr-commenter.js --type build --status failure --details '{"buildDetails":"TypeScript compilation failed"}'
`);
  process.exit(1);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  generateCoverageComment,
  generateE2EComment,
  generateBuildComment,
  findExistingComment,
  postOrUpdateComment,
  makeGitHubRequest
};