#!/usr/bin/env node
// scenarios/resource-constraint.js
// Creates sessions that are never explicitly ended, simulating orphaned connections
// or users who close the browser without ending their session.
//
// Expected Prometheus effects:
//   brainbytes_active_sessions          => steadily climbs throughout the run
//   brainbytes_http_requests_total      => normal creation rate, no PUT requests
//   brainbytes_session_duration_seconds => no data (sessions never end, so no duration recorded)
//   brainbytes_messages_total           => moderate (one message per session)
//
// Usage:
//   node scenarios/resource-constraint.js

const { spawn } = require('child_process');

const args = [
  'simulate-activity.js',
  '--scenario', 'resource-constraint',
  '--concurrency', '4',
  '--duration', '150',  // 2.5 minutes
];

console.log('=== Resource-Constraint Scenario ===');
console.log('4 concurrent workers creating sessions that never end, 2.5-minute run');
console.log('Expected: active_sessions gauge climbs steadily, no PUT calls, memory growth\n');

const child = spawn('node', args, { stdio: 'inherit', cwd: __dirname + '/..' });
child.on('exit', (code) => process.exit(code));
