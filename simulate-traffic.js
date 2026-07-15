/**
 * simulate-traffic.js
 * Generates realistic traffic against the BrainBytes backend to populate
 * Prometheus / Grafana dashboards with live data.
 *
 * Usage:  node simulate-traffic.js
 *
 * Prerequisites: docker-compose up -d   (backend must be running on :3000)
 */

const http = require('http');

const BASE_PORT = 3000;
const HOST = 'localhost';

let authToken = null;
let userId = null;

// ── helpers ──────────────────────────────────────────────────────────
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: HOST,
      port: BASE_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data.slice(0, 200) });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── main ─────────────────────────────────────────────────────────────
async function run() {
  console.log('🚀 Traffic simulation starting…\n');
  const email = `loadtest${Date.now()}@brainbytes.dev`;
  const password = 'Str0ng!Pass';

  // ── 1. Register  ───────────────────────────────────────────────
  console.log('📝 Registering user…');
  const reg = await request('POST', '/api/auth/register', {
    name: 'Load Tester',
    email,
    password,
  });
  console.log(`   ↳ ${reg.status} ${reg.body?.message || reg.body?.error || ''}`);

  // save token if registration succeeded (or login)
  if (reg.body?.token) {
    authToken = reg.body.token;
    userId = reg.body.user?.id;
  }

  // ── 2. Login (always, so we get a token even if user exists) ──
  console.log('🔐 Logging in…');
  const login = await request('POST', '/api/auth/login', { email, password });
  if (login.body?.token) {
    authToken = login.body.token;
    userId = login.body.user?.id;
    console.log('   ✅ authenticated');
  } else {
    console.log(`   ❌ ${login.status} — skipping authenticated requests`);
  }

  // ── 3. Provoke a 401 (wrong password) ─────────────────────────
  console.log('🔒 Intentional bad login (401 for error-rate dashboard)…');
  await request('POST', '/api/auth/login', { email, password: 'bad' });
  await request('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'x' });

  // ── 4. GET /api/auth/me ───────────────────────────────────────
  if (authToken) {
    console.log('👤 GET /api/auth/me…');
    await request('GET', '/api/auth/me');
  }

  // ── 5. Create sessions ────────────────────────────────────────
  const subjects = ['math', 'science', 'history', 'general'];
  const sessionIds = [];

  for (let i = 0; i < 5; i++) {
    const subj = subjects[i % subjects.length];
    const res = await request('POST', '/api/sessions', { subject: subj });
    if (res.body?.session?._id) {
      sessionIds.push(res.body.session._id);
      console.log(`📚 Session ${i + 1}: ${res.body.session._id.slice(-6)} (${subj})`);
    } else {
      // Some auth routes may not require session creation — log the response
      console.log(`📚 Session ${i + 1}: status ${res.status}`);
    }
    await wait(200);
  }

  // If no sessions were created (e.g. auth required), create anonymous ones
  if (sessionIds.length === 0) {
    console.log('   (retrying without auth…)');
    const savedToken = authToken;
    authToken = null;
    for (let i = 0; i < 3; i++) {
      const subj = subjects[i % subjects.length];
      const res = await request('POST', '/api/sessions', { subject: subj });
      if (res.body?.session?._id) {
        sessionIds.push(res.body.session._id);
        console.log(`📚 [anon] Session: ${res.body.session._id.slice(-6)} (${subj})`);
      }
      await wait(200);
    }
    authToken = savedToken;
  }

  // ── 6. Send messages (triggers AI calls) ──────────────────────
  const topics = [
    'Explain the fundamental theorem of calculus',
    'What is Newton\'s second law?',
    'How does binary search work?',
    'Describe the structure of a water molecule',
    'What is a derivative?',
    'Explain the concept of entropy',
    'How do I balance chemical equations?',
    'What is recursion in programming?',
    'Explain Ohm\'s law',
    'What is the Pythagorean theorem?',
    'Describe quantum superposition',
    'How does a linked list work?',
    'What is the difference between mitosis and meiosis?',
    'Explain the law of conservation of energy',
    'What is an API?',
  ];

  for (let i = 0; i < 20; i++) {
    const sid = sessionIds[rand(0, sessionIds.length - 1)] || null;
    const text = topics[rand(0, topics.length - 1)];
    const subj = subjects[rand(0, subjects.length - 1)]; // must be: math, science, history, general

    try {
      const msg = await request('POST', '/api/messages', { text, sessionId: sid, subject: subj });
      const status = msg.status;
      console.log(`💬 msg ${i + 1}: "${text.slice(0, 35)}…" → ${status}`);
    } catch {
      console.log(`💬 msg ${i + 1}: ERROR`);
    }

    // random delay to mimic real user cadence
    await wait(rand(400, 2200));
  }

  // ── 7. GET /api/messages (cached) ─────────────────────────────
  if (sessionIds.length && authToken) {
    console.log('📡 GET /api/messages…');
    await request('GET', `/api/messages?sessionId=${sessionIds[0]}`);
    await request('GET', `/api/messages?sessionId=${sessionIds[0]}`);
  }

  // ── 8. GET /api/materials ─────────────────────────────────────
  console.log('📦 GET /api/materials…');
  await request('GET', '/api/materials');

  // ── 9. Update sessions (PUT) ──────────────────────────────────
  if (sessionIds.length && authToken) {
    for (const sid of sessionIds.slice(0, 3)) {
      console.log(`✏️  PUT /api/sessions/${sid.slice(-6)}…`);
      await request('PUT', `/api/sessions/${sid}`, { subject: 'Updated Subject' });
      await wait(100);
    }
    // end one session to trigger decrementActiveSessions
    console.log('🏁 Ending one session…');
    await request('PUT', `/api/sessions/${sessionIds[0]}`, { isActive: false });
  }

  // ── 10. Trigger 404 for error-rate dash ───────────────────────
  console.log('❓ GET /api/nonexistent (404)…');
  await request('GET', '/api/nonexistent');
  await request('GET', '/favicon.ico');

  console.log('\n✅ Traffic simulation complete!');
  console.log('📊 Open http://localhost:3001 → Dashboards → BrainBytes');
  console.log('   Wait ~30 s for Prometheus to scrape fresh data.');
}

run().catch((e) => {
  console.error('💥 Simulation crashed:', e.message);
  process.exit(1);
});
