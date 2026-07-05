#!/usr/bin/env node
// scenarios/high-load.js
// Launches the simulator with high concurrency in peak/quiet cycles.
//
// Expected Prometheus effects:
//   brainbytes_http_requests_total          => sharp rate spikes during peaks
//   brainbytes_active_sessions              => rapid oscillations matching concurrency
//   brainbytes_http_request_duration_seconds => increased p50/p99 during peak bursts
//   node_cpu_seconds_total                  => higher CPU usage during peaks
//   brainbytes_messages_total               => elevated throughput
//
// Usage:
//   node scenarios/high-load.js

const { spawn } = require('child_process');

const args = [
  'simulate-activity.js',
  '--scenario',
  'high-load',
  '--concurrency',
  '5',
  '--duration',
  '180', // 3 minutes
  '--peak-interval',
  '30', // 30s peak, 30s quiet
];

console.log('=== High-Load Scenario ===');
console.log('5 concurrent workers, 30s peak/quiet cycles, 3-minute run');
console.log('Expected: CPU spikes, request rate oscillations, session gauge waves\n');

const child = spawn('node', args, { stdio: 'inherit', cwd: __dirname + '/..' });
child.on('exit', (code) => process.exit(code));
