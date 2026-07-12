#!/usr/bin/env node

/**
 * Test Summary Report Generator
 * Aggregates results from unit tests, coverage, E2E tests, and performance tests
 * into a single comprehensive report for CI/CD pipeline.
 */

const fs = require('fs');
const path = require('path');

const reportPaths = {
  backendCoverage: path.join(__dirname, '..', 'backend', 'coverage', 'coverage-summary.json'),
  frontendCoverage: path.join(__dirname, '..', 'frontend', 'coverage', 'coverage-summary.json'),
  backendJunit: path.join(__dirname, '..', 'backend', 'coverage', 'junit.xml'),
  frontendJunit: path.join(__dirname, '..', 'frontend', 'coverage', 'junit.xml'),
  e2eResults: path.join(__dirname, '..', 'frontend', 'playwright-report', 'results.json'),
  perfSummary: path.join(__dirname, '..', 'backend', 'tests', 'performance', 'summary.json'),
};

function safeReadJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn(`Warning: Could not read ${filePath}: ${e.message}`);
  }
  return null;
}

function formatPercent(value) {
  if (value == null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function parseCoverage(data) {
  if (!data || !data.total) return null;
  const t = data.total;
  return {
    lines: typeof t.lines?.pct === 'number' ? `${t.lines.pct.toFixed(1)}%` : 'N/A',
    branches: typeof t.branches?.pct === 'number' ? `${t.branches.pct.toFixed(1)}%` : 'N/A',
    functions: typeof t.functions?.pct === 'number' ? `${t.functions.pct.toFixed(1)}%` : 'N/A',
    statements: typeof t.statements?.pct === 'number' ? `${t.statements.pct.toFixed(1)}%` : 'N/A',
  };
}

function generateMarkdown() {
  const sections = [];

  sections.push('# 🧪 BrainBytes Test Summary Report');
  sections.push(`_Generated: ${new Date().toISOString()}_`);
  sections.push('');

  // ── Coverage ──
  sections.push('## 📊 Code Coverage');
  sections.push('');

  const backendCov = parseCoverage(safeReadJson(reportPaths.backendCoverage));
  const frontendCov = parseCoverage(safeReadJson(reportPaths.frontendCoverage));

  sections.push('| Package   | Lines | Branches | Functions | Statements |');
  sections.push('|-----------|-------|----------|-----------|------------|');

  const bRow = backendCov
    ? `| Backend   | ${backendCov.lines} | ${backendCov.branches} | ${backendCov.functions} | ${backendCov.statements} |`
    : '| Backend   | N/A | N/A | N/A | N/A |';

  const fRow = frontendCov
    ? `| Frontend  | ${frontendCov.lines} | ${frontendCov.branches} | ${frontendCov.functions} | ${frontendCov.statements} |`
    : '| Frontend  | N/A | N/A | N/A | N/A |';

  sections.push(bRow);
  sections.push(fRow);
  sections.push('');

  // ── E2E Tests ──
  sections.push('## 🌐 E2E Tests (Playwright)');
  sections.push('');

  const e2eData = safeReadJson(reportPaths.e2eResults);
  if (e2eData) {
    const suites = e2eData.suites || [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalDuration = 0;

    function countSuite(suite) {
      suite.specs?.forEach((spec) => {
        spec.tests?.forEach((test) => {
          test.results?.forEach((r) => {
            if (r.status === 'passed') totalPassed++;
            else if (r.status === 'failed') totalFailed++;
            else if (r.status === 'skipped') totalSkipped++;
            totalDuration += r.duration || 0;
          });
        });
      });
      suite.suites?.forEach(countSuite);
    }
    suites.forEach(countSuite);

    const total = totalPassed + totalFailed + totalSkipped;
    sections.push(`| Metric       | Value |`);
    sections.push(`|--------------|-------|`);
    sections.push(`| Total Tests  | ${total} |`);
    sections.push(`| Passed       | ${totalPassed} |`);
    sections.push(`| Failed       | ${totalFailed} |`);
    sections.push(`| Skipped      | ${totalSkipped} |`);
    sections.push(`| Pass Rate    | ${total > 0 ? ((totalPassed / total) * 100).toFixed(1) : 'N/A'}% |`);
    sections.push(`| Duration     | ${(totalDuration / 1000).toFixed(1)}s |`);
  } else {
    sections.push('> ⚠️ No E2E test results found.');
  }
  sections.push('');

  // ── Performance ──
  sections.push('## ⚡ Performance (k6)');
  sections.push('');

  const perfData = safeReadJson(reportPaths.perfSummary);
  if (perfData) {
    sections.push('| Metric            | Value |');
    sections.push('|-------------------|-------|');
    sections.push(`| Total Requests    | ${perfData.totalRequests || 'N/A'} |`);
    sections.push(`| Failure Rate      | ${formatPercent(perfData.failedRequests)} |`);
    sections.push(`| Avg Duration      | ${perfData.avgDuration != null ? `${perfData.avgDuration.toFixed(1)}ms` : 'N/A'} |`);
    sections.push(`| P95 Duration      | ${perfData.p95Duration != null ? `${perfData.p95Duration.toFixed(1)}ms` : 'N/A'} |`);
    sections.push(`| P99 Duration      | ${perfData.p99Duration != null ? `${perfData.p99Duration.toFixed(1)}ms` : 'N/A'} |`);
    sections.push(`| Max Duration      | ${perfData.maxDuration != null ? `${perfData.maxDuration.toFixed(1)}ms` : 'N/A'} |`);
    sections.push(`| Error Rate        | ${formatPercent(perfData.errorRate)} |`);
    sections.push(`| VUs (Virtual Users)| ${perfData.vus || 'N/A'} |`);
    sections.push(`| Iterations        | ${perfData.iterations || 'N/A'} |`);
    sections.push(`| Checks Passed     | ${perfData.checksPassed ?? 'N/A'} / ${perfData.checksTotal ?? 'N/A'} |`);
    sections.push(`| Thresholds OK     | ${perfData.thresholdsPassed !== false ? '✅ Passed' : '❌ Failed'} |`);
  } else {
    sections.push('> ⚠️ No performance test results found.');
  }
  sections.push('');

  // ── Summary ──
  sections.push('---');
  sections.push('## 📋 Overall Status');
  sections.push('');

  let overallOk = true;
  const statuses = [];

  if (backendCov) {
    const ok = (backendCov.lines !== 'N/A' && parseFloat(backendCov.lines) >= 50);
    statuses.push(`${ok ? '✅' : '❌'} Backend Coverage`);
    if (!ok) overallOk = false;
  }
  if (frontendCov) {
    const ok = (frontendCov.lines !== 'N/A' && parseFloat(frontendCov.lines) >= 30);
    statuses.push(`${ok ? '✅' : '❌'} Frontend Coverage`);
    if (!ok) overallOk = false;
  }
  if (e2eData) {
    const failed = e2eData.suites?.reduce((acc, s) => {
      s.specs?.forEach(sp => sp.tests?.forEach(t => t.results?.forEach(r => { if (r.status === 'failed') acc++; })));
      return acc;
    }, 0) || 0;
    statuses.push(failed === 0 ? '✅ E2E Tests' : '❌ E2E Tests');
    if (failed > 0) overallOk = false;
  }
  if (perfData) {
    statuses.push(perfData.thresholdsPassed !== false ? '✅ Performance' : '❌ Performance');
    if (perfData.thresholdsPassed === false) overallOk = false;
  }

  statuses.forEach(s => sections.push(`- ${s}`));
  sections.push('');
  sections.push(`### Overall Result: ${overallOk ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);

  return sections.join('\n');
}

// Generate and output the report
const report = generateMarkdown();
console.log(report);

// Also write to file for artifact upload
const outputDir = path.join(__dirname, '..', 'test-results');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'summary.md'), report);

// Write a JSON summary for programmatic consumption
const jsonSummary = {
  timestamp: new Date().toISOString(),
  backendCoverage: parseCoverage(safeReadJson(reportPaths.backendCoverage)),
  frontendCoverage: parseCoverage(safeReadJson(reportPaths.frontendCoverage)),
  e2e: safeReadJson(reportPaths.e2eResults),
  performance: safeReadJson(reportPaths.perfSummary),
};
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(jsonSummary, null, 2));
