#!/usr/bin/env node

/**
 * Integration Test Runner Script
 * 
 * Runs integration tests (*.acceptance.ts) for LoopBack 4 backend with proper database setup.
 * Handles PostgreSQL connection, test execution, and result reporting.
 * 
 * Usage:
 *   node integration-test-runner.js [options]
 * 
 * Options:
 *   --pattern         Test file pattern (default: *\*/*\.acceptance.ts)
 *   --database-url    PostgreSQL connection URL
 *   --coverage        Enable coverage collection
 *   --timeout         Test timeout in milliseconds (default: 30000)
 *   --verbose         Enable verbose output
 *   --bail            Stop on first test failure
 * 
 * Environment Variables:
 *   NODE_ENV                 Should be 'test' for integration tests
 *   TEST_DATABASE_URL        PostgreSQL connection URL for tests
 *   CI                       Set to 'true' in CI environment
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  pattern: getArgValue('--pattern') || '**/*.acceptance.ts',
  databaseUrl: getArgValue('--database-url') || process.env.TEST_DATABASE_URL,
  coverage: args.includes('--coverage'),
  timeout: parseInt(getArgValue('--timeout')) || 30000,
  verbose: args.includes('--verbose'),
  bail: args.includes('--bail')
};

function getArgValue(argName) {
  const index = args.indexOf(argName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🔍'
  }[level] || 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function validateEnvironment() {
  log('Validating environment for integration tests...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  log(`Node.js version: ${nodeVersion}`);
  
  if (!nodeVersion.startsWith('v24.')) {
    log('Warning: Expected Node.js 24.x, consider upgrading', 'warning');
  }
  
  // Set NODE_ENV to test if not already set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
    log('Set NODE_ENV=test');
  } else if (process.env.NODE_ENV !== 'test') {
    log(`Warning: NODE_ENV is '${process.env.NODE_ENV}', expected 'test'`, 'warning');
  }
  
  // Validate database URL
  if (!options.databaseUrl) {
    log('Database URL not provided, using default PostgreSQL connection', 'warning');
    options.databaseUrl = 'postgresql://postgres:postgres@localhost:5432/buukdb';
  }
  
  // Set database URL environment variable
  process.env.TEST_DATABASE_URL = options.databaseUrl;
  log(`Database URL: ${options.databaseUrl.replace(/\/\/.*@/, '//***@')}`);
  
  // Check if in CI environment
  if (process.env.CI) {
    log('Running in CI environment');
  }
}

function findTestFiles() {
  log(`Searching for test files with pattern: ${options.pattern}`);
  
  try {
    // Use glob-like pattern with find command
    const testFiles = execSync(
      `find . -name "*.acceptance.ts" -type f | grep -E "(src|__tests__)" | head -20`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim().split('\n').filter(Boolean);
    
    if (testFiles.length === 0) {
      log('No integration test files found!', 'warning');
      return [];
    }
    
    log(`Found ${testFiles.length} integration test files:`);
    testFiles.forEach(file => log(`  - ${file}`, 'debug'));
    
    return testFiles;
  } catch (error) {
    log(`Error finding test files: ${error.message}`, 'error');
    return [];
  }
}

function checkDatabaseConnection() {
  log('Checking database connection...');
  
  const { URL } = require('url');
  
  try {
    const dbUrl = new URL(options.databaseUrl);
    const host = dbUrl.hostname;
    const port = dbUrl.port || 5432;
    const database = dbUrl.pathname.slice(1);
    
    // Test PostgreSQL connection using pg_isready if available
    try {
      execSync(`pg_isready -h ${host} -p ${port} -U ${dbUrl.username} -d ${database}`, 
        { stdio: 'pipe', timeout: 5000 });
      log('Database connection test passed', 'success');
      return true;
    } catch (pgError) {
      log('pg_isready not available or connection failed, continuing anyway...', 'warning');
      return true; // Continue anyway, Jest will handle connection errors
    }
  } catch (error) {
    log(`Database URL parsing error: ${error.message}`, 'error');
    return false;
  }
}

function buildJestCommand() {
  const jestArgs = [
    '--testMatch="**/*.acceptance.ts"',
    `--testTimeout=${options.timeout}`,
    '--verbose',
    '--detectOpenHandles',
    '--forceExit'
  ];
  
  if (options.coverage) {
    jestArgs.push('--coverage');
    jestArgs.push('--coverageDirectory=coverage-integration');
  }
  
  if (options.bail) {
    jestArgs.push('--bail');
  }
  
  if (process.env.CI) {
    jestArgs.push('--ci');
    jestArgs.push('--watchman=false');
  }
  
  // Use npx jest to ensure we're using the project's Jest configuration
  return `npx jest ${jestArgs.join(' ')}`;
}

function runIntegrationTests() {
  return new Promise((resolve, reject) => {
    log('Starting integration tests...');
    
    const command = buildJestCommand();
    log(`Running command: ${command}`, 'debug');
    
    const startTime = Date.now();
    
    // Run Jest with real-time output
    const child = spawn('npx', ['jest', ...buildJestCommand().split(' ').slice(2)], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DATABASE_URL: options.databaseUrl,
        // Force colors in CI
        FORCE_COLOR: '1'
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      if (options.verbose) {
        process.stdout.write(output);
      }
    });
    
    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      if (options.verbose) {
        process.stderr.write(output);
      }
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        log(`Integration tests completed successfully in ${duration}ms`, 'success');
        
        // Parse test results if possible
        const testResults = parseJestOutput(stdout);
        if (testResults) {
          log(`Test Summary: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.total} total`);
        }
        
        resolve({
          success: true,
          code,
          stdout,
          stderr,
          duration,
          results: testResults
        });
      } else {
        log(`Integration tests failed with exit code ${code}`, 'error');
        
        // Show last few lines of output for debugging
        const errorLines = stderr.split('\n').slice(-10).join('\n');
        if (errorLines.trim()) {
          log('Last error output:', 'debug');
          log(errorLines, 'debug');
        }
        
        reject({
          success: false,
          code,
          stdout,
          stderr,
          duration,
          error: `Tests failed with exit code ${code}`
        });
      }
    });
    
    child.on('error', (error) => {
      log(`Failed to start test process: ${error.message}`, 'error');
      reject({
        success: false,
        error: error.message
      });
    });
  });
}

function parseJestOutput(output) {
  try {
    // Look for Jest summary line
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (summaryMatch) {
      return {
        failed: parseInt(summaryMatch[1]),
        passed: parseInt(summaryMatch[2]),
        total: parseInt(summaryMatch[3])
      };
    }
    
    // Alternative pattern
    const altMatch = output.match(/(\d+)\s+passing/);
    if (altMatch) {
      return {
        failed: 0,
        passed: parseInt(altMatch[1]),
        total: parseInt(altMatch[1])
      };
    }
    
    return null;
  } catch (error) {
    log(`Error parsing Jest output: ${error.message}`, 'debug');
    return null;
  }
}

function generateSummary(results) {
  log('Generating test summary...');
  
  const summary = {
    timestamp: new Date().toISOString(),
    success: results.success,
    duration: results.duration,
    results: results.results,
    environment: {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV,
      ci: !!process.env.CI,
      databaseUrl: options.databaseUrl.replace(/\/\/.*@/, '//***@')
    }
  };
  
  // Write summary to file for GitHub Actions
  try {
    fs.writeFileSync('integration-test-results.json', JSON.stringify(summary, null, 2));
    log('Test summary written to integration-test-results.json', 'success');
  } catch (error) {
    log(`Failed to write summary file: ${error.message}`, 'warning');
  }
  
  return summary;
}

async function main() {
  try {
    log('🧪 Buuk Integration Test Runner');
    log('================================');
    
    // Validate environment
    validateEnvironment();
    
    // Find test files
    const testFiles = findTestFiles();
    if (testFiles.length === 0) {
      log('No integration tests to run', 'warning');
      process.exit(0);
    }
    
    // Check database connection
    if (!checkDatabaseConnection()) {
      log('Database connection check failed', 'error');
      process.exit(1);
    }
    
    // Run integration tests
    const results = await runIntegrationTests();
    
    // Generate summary
    const summary = generateSummary(results);
    
    log('Integration test execution completed', 'success');
    
    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);
    
  } catch (error) {
    log(`Integration test runner failed: ${error.message || error.error}`, 'error');
    
    // Generate failure summary
    const failureSummary = {
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message || error.error,
      environment: {
        nodeVersion: process.version,
        nodeEnv: process.env.NODE_ENV,
        ci: !!process.env.CI
      }
    };
    
    try {
      fs.writeFileSync('integration-test-results.json', JSON.stringify(failureSummary, null, 2));
    } catch (writeError) {
      log(`Failed to write failure summary: ${writeError.message}`, 'warning');
    }
    
    process.exit(1);
  }
}

// Show usage if no arguments and not in CI
if (args.length === 0 && !process.env.CI) {
  console.log(`
Buuk Integration Test Runner

Usage: node integration-test-runner.js [options]

Options:
  --pattern         Test file pattern (default: **/*.acceptance.ts)
  --database-url    PostgreSQL connection URL
  --coverage        Enable coverage collection
  --timeout         Test timeout in milliseconds (default: 30000)
  --verbose         Enable verbose output
  --bail            Stop on first test failure
  --help            Show this help message

Environment Variables:
  NODE_ENV                 Should be 'test' for integration tests
  TEST_DATABASE_URL        PostgreSQL connection URL for tests
  CI                       Set to 'true' in CI environment

Examples:
  node integration-test-runner.js --verbose --coverage
  node integration-test-runner.js --database-url postgresql://user:pass@localhost:5432/testdb
  node integration-test-runner.js --pattern "src/**/*.acceptance.ts" --bail
`);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  findTestFiles,
  checkDatabaseConnection,
  runIntegrationTests,
  parseJestOutput,
  generateSummary
};