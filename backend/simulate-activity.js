#!/usr/bin/env node
// simulate-activity.js
// Parameterized scenario runner for BrainBytes observability testing.
//
// Usage:
//   node simulate-activity.js [--scenario <name>] [--concurrency <n>] [--duration <sec>] [--error-rate <0-1>] [--peak-interval <sec>]
//
// Scenarios:
//   default              Steady single-user tutoring flow
//   high-load            Burst of concurrent sessions, peak/quiet cycles
//   error-spikes         Intermittent bad requests, auth failures, timeouts
//   resource-constraint  Long-lived sessions that never end (gauge leak)
//
// Examples:
//   node simulate-activity.js --scenario high-load --concurrency 5 --duration 120
//   node simulate-activity.js --scenario error-spikes --error-rate 0.3 --duration 60

const fetch = require('node-fetch');

// ── CLI argument parsing ──
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const SCENARIO = getArg('--scenario', 'default');
const CONCURRENCY = parseInt(getArg('--concurrency', '1'), 10);
const DURATION = parseInt(getArg('--duration', '0'), 10); // 0 = run forever
const ERROR_RATE = parseFloat(getArg('--error-rate', '0'));
const PEAK_INTERVAL = parseInt(getArg('--peak-interval', '0'), 10); // 0 = no peaks

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUBJECTS = ['math', 'science', 'history', 'general'];

// ── Shared state ──
let authToken = null;
let running = true;

// ── Auth helper ──
async function ensureAuthToken() {
  const email = 'simulator@brainbytes.internal';
  const password = 'simulator-pass-123';

  let res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Simulator', email, password }),
  });

  if (res.status === 400) {
    res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }

  const data = await res.json();
  if (data.token) {
    authToken = data.token;
    return true;
  }
  return false;
}

// ── Sample questions ──
const sampleQuestions = {
  math: [
    'How do I solve 2x + 5 = 15?',
    'What is the Pythagorean theorem?',
    'Can you explain the quadratic formula?',
    'What is the derivative of x^2?',
    'How do I find the area of a circle?',
  ],
  science: [
    'What is photosynthesis?',
    'How does gravity work?',
    'Explain the water cycle.',
    'What are the states of matter?',
    'How do magnets work?',
  ],
  history: [
    'When was the Declaration of Independence signed?',
    'What caused World War I?',
    'Explain the Industrial Revolution.',
    'Who was Cleopatra?',
    'What was the Silk Road?',
  ],
  general: [
    'What is the meaning of life?',
    'How do I learn faster?',
    'What are good study habits?',
    'Can you give me a motivational quote?',
    'How does the internet work?',
  ],
};

// ── Error injection payloads ──
const errorPayloads = [
  { body: null, desc: 'null body' },
  { body: '{malformed', desc: 'malformed JSON', headers: { 'Content-Type': 'application/json' } },
  { body: JSON.stringify({ text: '' }), desc: 'empty text' },
  { body: JSON.stringify({ subject: 'INVALID_SUBJECT' }), desc: 'invalid subject' },
  { body: JSON.stringify({ text: 'x'.repeat(100000) }), desc: 'oversized payload' },
  { body: JSON.stringify({}), desc: 'empty object' },
];

// ── Simulate a single complete session ──
async function simulateSession(workerId = 0) {
  const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
  const shouldError = ERROR_RATE > 0 && Math.random() < ERROR_RATE;

  console.log(`[W${workerId}] Starting session for ${subject}${shouldError ? ' [ERROR MODE]' : ''}...`);

  // Step 1: Create session
  let sessionId;
  try {
    const body = shouldError && Math.random() < 0.5
      ? '{bad'
      : JSON.stringify({ subject });
    const headers = { 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}/api/sessions`, {
      method: 'POST',
      headers,
      body,
    });
    const data = await res.json();
    sessionId = data.session?._id;
    if (!sessionId) {
      console.log(`[W${workerId}] Session creation returned ${res.status}${shouldError ? ' (expected error)' : ''}`);
      if (shouldError) return; // error injection succeeded
    }
  } catch (err) {
    console.error(`[W${workerId}] Session create error: ${err.message}`);
    return;
  }

  if (!sessionId) return;

  // Step 2: Send messages
  if (SCENARIO === 'resource-constraint') {
    // In resource-constraint mode: create session, send one message, then abandon
    try {
      const questions = sampleQuestions[subject] || sampleQuestions.general;
      await fetch(`${BASE_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: questions[0], subject, sessionId }),
      });
      console.log(`[W${workerId}] Resource-constraint: session ${sessionId} left open (no end)`);
    } catch (err) {
      console.error(`[W${workerId}] Message error: ${err.message}`);
    }
    return;
  }

  const numQuestions = SCENARIO === 'high-load'
    ? Math.floor(Math.random() * 2) + 1  // fewer questions in high-load for throughput
    : Math.floor(Math.random() * 4) + 2;

  const questions = sampleQuestions[subject] || sampleQuestions.general;

  for (let i = 0; i < numQuestions; i++) {
    const question = questions[Math.floor(Math.random() * questions.length)];

    try {
      let body, headers = { 'Content-Type': 'application/json' };

      if (shouldError && Math.random() < 0.4) {
        // Inject error payload
        const errPayload = errorPayloads[Math.floor(Math.random() * errorPayloads.length)];
        body = errPayload.body;
        if (errPayload.headers) headers = { ...headers, ...errPayload.headers };
        console.log(`[W${workerId}] Injecting error: ${errPayload.desc}`);
      } else {
        body = JSON.stringify({ text: question, subject, sessionId });
      }

      await fetch(`${BASE_URL}/api/messages`, {
        method: 'POST',
        headers,
        body,
      });
    } catch (err) {
      console.error(`[W${workerId}] Message error: ${err.message}`);
    }

    const delay = SCENARIO === 'high-load'
      ? Math.floor(Math.random() * 500) + 200   // fast bursts
      : Math.floor(Math.random() * 2000) + 1000; // normal pacing
    await new Promise((r) => setTimeout(r, delay));
  }

  // Step 3: End session (unless error injection wants an auth failure)
  try {
    if (shouldError && Math.random() < 0.3) {
      // Send without auth to trigger 401
      await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      console.log(`[W${workerId}] Session end sent without auth (401 expected)`);
    } else {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: false }),
      });
      console.log(`[W${workerId}] Session ended: ${sessionId}`);
    }
  } catch (err) {
    console.error(`[W${workerId}] Session end error: ${err.message}`);
  }
}

// ── Single worker loop ──
async function workerLoop(workerId) {
  while (running) {
    await simulateSession(workerId).catch((err) =>
      console.error(`[W${workerId}] Session error: ${err.message}`),
    );

    if (!running) break;

    // In peak mode, workers launch in bursts then sleep
    const isPeakPhase = PEAK_INTERVAL > 0 && Math.floor(Date.now() / 1000 / PEAK_INTERVAL) % 2 === 0;
    const waitTime = isPeakPhase
      ? Math.floor(Math.random() * 1000) + 200   // peak: rapid fire
      : Math.floor(Math.random() * 8000) + 4000; // off-peak: slow

    await new Promise((r) => setTimeout(r, waitTime));
  }
}

// ── Main runner ──
async function main() {
  console.log('=== BrainBytes Activity Simulator ===');
  console.log(`Scenario:     ${SCENARIO}`);
  console.log(`Concurrency:  ${CONCURRENCY}`);
  console.log(`Duration:     ${DURATION > 0 ? DURATION + 's' : 'forever'}`);
  console.log(`Error rate:   ${(ERROR_RATE * 100).toFixed(0)}%`);
  console.log(`Peak cycle:   ${PEAK_INTERVAL > 0 ? PEAK_INTERVAL + 's' : 'off'}`);
  console.log(`Target:       ${BASE_URL}`);
  console.log('Press Ctrl+C to stop.\n');

  // Authenticate
  const authed = await ensureAuthToken();
  if (!authed) {
    console.error('[Simulator] WARNING: Could not authenticate. Session-end calls may 401.');
  } else {
    console.log('[Simulator] Authenticated successfully.');
  }

  // Set up graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Simulator] Shutting down...');
    running = false;
  });
  process.on('SIGTERM', () => {
    running = false;
  });

  // Set duration timer
  if (DURATION > 0) {
    setTimeout(() => {
      console.log(`\n[Simulator] Duration (${DURATION}s) reached. Stopping...`);
      running = false;
    }, DURATION * 1000);
  }

  // Launch workers
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(workerLoop(i + 1));
  }

  await Promise.all(workers);
  console.log('[Simulator] All workers stopped. Goodbye!');
}

main().catch(console.error);
