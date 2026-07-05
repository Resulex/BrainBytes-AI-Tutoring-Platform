#!/usr/bin/env node
// scenarios/error-spikes.js
// Simulates a degraded service with intermittent failures.
//
// Expected Prometheus effects:
//   brainbytes_http_requests_total{status=~"4..|5.."} => elevated error ratio (~30%)
//   brainbytes_ai_request_errors_total               => spikes in AI error counter
//   brainbytes_http_request_duration_seconds          => 401/500 entries appear
//   brainbytes_active_sessions                        => may drift if auth failures prevent session-end
//
// Usage:
//   node scenarios/error-spikes.js

const { spawn } = require('child_process');

const args = [
  'simulate-activity.js',
  '--scenario', 'error-spikes',
  '--concurrency', '3',
  '--duration', '120',  // 2 minutes
  '--error-rate', '0.35', // 35% of sessions inject errors
];

console.log('=== Error-Spikes Scenario ===');
console.log('3 concurrent workers, 35% error rate, 2-minute run');
console.log('Expected: 4xx/5xx responses, AI error counters, partial auth failures\n');

const child = spawn('node', args, { stdio: 'inherit', cwd: __dirname + '/..' });
child.on('exit', (code) => process.exit(code));
