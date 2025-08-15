#!/usr/bin/env node

/**
 * Coverage Calculator Script
 * 
 * Calculates test coverage metrics from Jest coverage-final.json files.
 * Supports both global coverage and changed files only coverage analysis.
 * 
 * Usage:
 *   node coverage-calculator.js [options]
 * 
 * Options:
 *   --global              Calculate global coverage percentage
 *   --changed-files       Calculate coverage for changed files only
 *   --coverage-file       Path to coverage-final.json (default: coverage/coverage-final.json)
 *   --base-branch         Base branch for changed files comparison (default: main)
 *   --file-patterns       File patterns to include (default: .ts,.tsx,.js,.jsx)
 *   --source-dir          Source directory pattern (default: src/)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  global: args.includes('--global'),
  changedFiles: args.includes('--changed-files'),
  coverageFile: getArgValue('--coverage-file') || 'coverage/coverage-final.json',
  baseBranch: getArgValue('--base-branch') || 'main',
  filePatterns: getArgValue('--file-patterns') || '.ts,.tsx,.js,.jsx',
  sourceDir: getArgValue('--source-dir') || 'src/'
};

function getArgValue(argName) {
  const index = args.indexOf(argName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function readCoverageFile() {
  if (!fs.existsSync(options.coverageFile)) {
    console.error(`❌ Coverage file not found: ${options.coverageFile}`);
    process.exit(1);
  }

  try {
    return JSON.parse(fs.readFileSync(options.coverageFile, 'utf8'));
  } catch (error) {
    console.error(`❌ Failed to parse coverage file: ${error.message}`);
    process.exit(1);
  }
}

function calculateGlobalCoverage(coverage) {
  let totalStatements = 0;
  let coveredStatements = 0;

  Object.values(coverage).forEach(fileData => {
    if (fileData.s) {
      const statements = Object.values(fileData.s);
      totalStatements += statements.length;
      coveredStatements += statements.filter(count => count > 0).length;
    }
  });

  return totalStatements > 0 
    ? ((coveredStatements / totalStatements) * 100).toFixed(2)
    : '0.00';
}

function getChangedFiles() {
  try {
    // Ensure we have the base branch
    execSync(`git fetch origin ${options.baseBranch}:${options.baseBranch}`, { stdio: 'pipe' });
    
    // Get changed files
    const patterns = options.filePatterns.split(',').map(p => p.trim()).join('|');
    const regex = `\\.(${patterns.replace(/\./g, '')})$`;
    
    const changedFiles = execSync(
      `git diff --name-only origin/${options.baseBranch}...HEAD | grep -E '${regex}' | grep '^${options.sourceDir}' || true`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim();

    return changedFiles ? changedFiles.split('\n').filter(Boolean) : [];
  } catch (error) {
    console.error(`❌ Failed to get changed files: ${error.message}`);
    return [];
  }
}

function calculateChangedFilesCoverage(coverage, changedFiles) {
  if (changedFiles.length === 0) {
    return {
      percentage: 'N/A',
      totalLines: 0,
      coveredLines: 0,
      files: [],
      message: `No ${options.filePatterns} files changed in ${options.sourceDir}`
    };
  }

  console.log('📋 Checking coverage for changed files:');
  changedFiles.forEach(file => console.log(`  - ${file}`));

  let totalLines = 0;
  let coveredLines = 0;
  const fileDetails = [];

  changedFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const absolutePath = path.resolve(file);
      
      // Find coverage data for this file
      const fileData = Object.values(coverage).find(data =>
        data.path === absolutePath || data.path.endsWith(file)
      );

      if (fileData && fileData.s) {
        const statements = Object.values(fileData.s);
        const fileCovered = statements.filter(count => count > 0).length;
        const fileTotal = statements.length;

        totalLines += fileTotal;
        coveredLines += fileCovered;

        if (fileTotal > 0) {
          const filePercentage = ((fileCovered / fileTotal) * 100).toFixed(2);
          fileDetails.push({
            file,
            covered: fileCovered,
            total: fileTotal,
            percentage: filePercentage
          });
          console.log(`    ${file}: ${fileCovered}/${fileTotal} (${filePercentage}%)`);
        }
      } else {
        console.log(`    ${file}: No coverage data found`);
      }
    }
  });

  const overallPercentage = totalLines > 0 
    ? ((coveredLines / totalLines) * 100).toFixed(2)
    : '0.00';

  return {
    percentage: overallPercentage,
    totalLines,
    coveredLines,
    files: fileDetails,
    message: `Overall coverage for changed files: ${coveredLines}/${totalLines} (${overallPercentage}%)`
  };
}

function generateMarkdownReport(globalCoverage, changedFilesCoverage, threshold = 20) {
  const thresholdMet = parseFloat(changedFilesCoverage.percentage) >= threshold;
  const status = thresholdMet ? '✅ Passed' : '❌ Failed';
  
  let report = `## 📊 Coverage Report

### Changed Files Coverage: ${changedFilesCoverage.percentage}%
- **Required:** ${threshold}%
- **Actual:** ${changedFilesCoverage.percentage}%
- **Status:** ${status}

`;

  if (changedFilesCoverage.files.length > 0) {
    report += `#### Details by file:
`;
    changedFilesCoverage.files.forEach(file => {
      report += `- \`${file.file}\`: ${file.covered}/${file.total} (${file.percentage}%)
`;
    });
  } else {
    report += `#### ${changedFilesCoverage.message}
`;
  }

  return report;
}

function main() {
  const coverage = readCoverageFile();

  if (options.global) {
    const globalCoverage = calculateGlobalCoverage(coverage);
    console.log(globalCoverage);
    return;
  }

  if (options.changedFiles) {
    const changedFiles = getChangedFiles();
    const result = calculateChangedFilesCoverage(coverage, changedFiles);
    
    // Output for GitHub Actions environment variables
    console.log(`CHANGED_FILES_COVERAGE=${result.percentage}`);
    
    // Generate detailed report
    const markdownReport = generateMarkdownReport(null, result);
    
    // Output multiline content for GitHub Actions
    console.log('CHANGED_FILES_DETAILS<<EOF');
    console.log(markdownReport);
    console.log('EOF');
    
    // Set coverage check status
    const thresholdMet = result.percentage !== 'N/A' && parseFloat(result.percentage) >= 20;
    console.log(`COVERAGE_CHECK_FAILED=${!thresholdMet}`);
    
    return;
  }

  // Default: show usage
  console.log(`
Usage: node coverage-calculator.js [options]

Options:
  --global              Calculate global coverage percentage
  --changed-files       Calculate coverage for changed files only
  --coverage-file       Path to coverage-final.json (default: coverage/coverage-final.json)
  --base-branch         Base branch for comparison (default: main)
  --file-patterns       File patterns to include (default: .ts,.tsx,.js,.jsx)
  --source-dir          Source directory pattern (default: src/)

Examples:
  node coverage-calculator.js --global
  node coverage-calculator.js --changed-files --base-branch main
  node coverage-calculator.js --changed-files --file-patterns .ts,.js --source-dir src/
`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  calculateGlobalCoverage,
  calculateChangedFilesCoverage,
  generateMarkdownReport,
  getChangedFiles,
  readCoverageFile
};