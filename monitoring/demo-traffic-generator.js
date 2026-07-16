#!/usr/bin/env node
/**
 * BrainBytes Monitoring Demo Traffic Generator
 * =============================================
 * Generates realistic traffic patterns to showcase the monitoring stack.
 *
 * Usage:
 *   node monitoring/demo-traffic-generator.js [--phase <name>] [--duration <min>] [--concurrency <n>]
 *
 * Options:
 *   --phase        normal | high-load | error-spikes | full-demo (default: full-demo)
 *   --duration     Minutes per phase (default: 3)
 *   --concurrency  Max simultaneous users (default: 5, overridden to 20 for high-load)
 *   --base-url     Backend URL (default: http://localhost:9080)
 *
 * Scenarios:
 *   full-demo  → Runs all four phases sequentially (12-15 min)
 *   normal     → Steady traffic, healthy metrics, green gauges
 *   high-load  → Burst traffic, CPU/memory stress, latency climbs
 *   error-spikes → Inject 4xx/5xx/AI errors to trigger error alerts
 *
 * Requirements:
 *   - Full BrainBytes stack running: docker-compose up -d
 *   - Prometheus scraping on port 9090
 *   - Grafana on port 3001/grafana
 *
 * Output files:
 *   - Prints live status to stdout
 *   - metrics-summary.json — per‑phase summary written when full-demo completes
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════
const BASE_URL = process.env.BASE_URL || "http://localhost:9080";
const DEFAULT_DURATION_MIN = 3;
const DEFAULT_CONCURRENCY = 5;

// Endpoints to exercise (matches normalised paths brainbytes_http_requests_total)
const ENDPOINTS = {
  health:     { method: "GET",  path: "/api/health" },
  sessions:   { method: "POST", path: "/api/sessions",    body: { subject: "math", topic: "algebra" } },
  messages:   { method: "POST", path: "/api/messages",    body: { sessionId: "DEMO", content: "Help me solve 2x + 5 = 15" } },
  frontend:   { method: "GET",  path: "/" },                               // hits frontend, returns HTML
  notFound:   { method: "GET",  path: "/api/nonexistent" },                // 4xx
  badMessage: { method: "POST", path: "/api/messages",    body: { sessionId: "INVALID", content: "" } }, // likely 5xx
};

// Phase metadata – stored for the summary dump
const phaseMeta = {
  normal:      { label: "Normal Traffic",   icon: "🟢" },
  "high-load": { label: "High Load",        icon: "🟡" },
  "error-spikes": { label: "Error Spikes",  icon: "🔴" },
  recovery:    { label: "Recovery",         icon: "🟢" },
};

// Per-phase counters (global so every phase can be written to the summary)
const stats = {};
let currentPhase = "";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, BASE_URL);
    const client = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
        "X-Demo-Mode": "true",
      },
      timeout: 15000,
    };

    const start = Date.now();
    const req = client.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const latency = Date.now() - start;
        recordStat(res.statusCode, latency);
        resolve({ status: res.statusCode, latency, body: body.substring(0, 200) });
      });
    });

    req.on("error", (err) => {
      const latency = Date.now() - start;
      recordStat(0, latency);
      resolve({ status: 0, latency, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      recordStat(408, 15000);
      resolve({ status: 408, latency: 15000, error: "timeout" });
    });

    if (endpoint.body) {
      req.write(JSON.stringify(endpoint.body));
    }
    req.end();
  });
}

function recordStat(status, latencyMs) {
  if (!stats[currentPhase]) {
    stats[currentPhase] = {
      total: 0,
      success2xx: 0,
      error4xx: 0,
      error5xx: 0,
      latencyMs: [],
    };
  }
  const s = stats[currentPhase];
  s.total++;
  if (status >= 200 && status < 300) s.success2xx++;
  else if (status >= 400 && status < 500) s.error4xx++;
  else if (status >= 500) s.error5xx++;
  s.latencyMs.push(latencyMs);
}

// ═══════════════════════════════════════════════════════
// Phase Runners
// ═══════════════════════════════════════════════════════

async function phaseNormal(durationMin, concurrency) {
  currentPhase = "normal";
  console.log("\n🟢 PHASE 1: Normal Traffic");
  console.log("   Duration: %d min | Concurrency: %d users", durationMin, concurrency);
  console.log("   Expected: All gauges GREEN, ~1-2 req/s, 100%% success\n");

  const endTime = Date.now() + durationMin * 60 * 1000;
  const activeUsers = [];

  for (let i = 0; i < concurrency; i++) {
    activeUsers.push((async () => {
      while (Date.now() < endTime) {
        // 60% health checks, 30% session creates, 10% frontend
        const roll = Math.random();
        const ep = roll < 0.6 ? ENDPOINTS.health : roll < 0.9 ? ENDPOINTS.sessions : ENDPOINTS.frontend;
        const result = await makeRequest(ep);
        if (result.status !== 200 && result.status !== 201 && result.status !== 304) {
          console.log("  ⚠️  Unexpected %d from %s", result.status, ep.path);
        }
        await sleep(randomBetween(800, 3000));
      }
    })());
  }

  await Promise.all(activeUsers);
  console.log("   ✅ Normal traffic phase complete (%d requests)", stats.normal?.total || 0);
}

async function phaseHighLoad(durationMin) {
  currentPhase = "high-load";
  const concurrency = 20;
  console.log("\n🟡 PHASE 2: High Load");
  console.log("   Duration: %d min | Concurrency: %d users", durationMin, concurrency);
  console.log("   Expected: CPU > 50%%, Memory climbs, request rate spikes, p95 latency > 2s\n");

  const endTime = Date.now() + durationMin * 60 * 1000;
  const activeUsers = [];

  for (let i = 0; i < concurrency; i++) {
    activeUsers.push((async () => {
      while (Date.now() < endTime) {
        // Mostly heavy /api/messages, some health
        const ep = Math.random() < 0.7 ? ENDPOINTS.messages : ENDPOINTS.health;
        const result = await makeRequest(ep);
        if (result.status === 408) {
          console.log("  ⏱️  Timeout on %s (%dms)", ep.path, result.latency);
        }
        await sleep(randomBetween(50, 500));
      }
    })());
  }

  await Promise.all(activeUsers);
  console.log("   ✅ High-load phase complete (%d requests)", stats["high-load"]?.total || 0);
}

async function phaseErrorSpikes(durationMin, concurrency) {
  currentPhase = "error-spikes";
  console.log("\n🔴 PHASE 3: Error Spikes");
  console.log("   Duration: %d min | Concurrency: %d", durationMin, concurrency);
  console.log("   Expected: 4xx/5xx rate spike, error table populates, AI errors appear\n");

  const endTime = Date.now() + durationMin * 60 * 1000;
  const activeUsers = [];

  for (let i = 0; i < concurrency; i++) {
    activeUsers.push((async () => {
      while (Date.now() < endTime) {
        const roll = Math.random();
        let ep;

        if (roll < 0.25) {
          ep = ENDPOINTS.notFound;
        } else if (roll < 0.45) {
          ep = ENDPOINTS.badMessage;
        } else if (roll < 0.70) {
          ep = ENDPOINTS.messages;
        } else {
          ep = ENDPOINTS.health;
        }

        const result = await makeRequest(ep);
        if (result.status >= 400) {
          const icon = result.status >= 500 ? "🔥" : "⚠️";
          console.log("  %s %d %s (%dms)", icon, result.status, ep.path, result.latency);
        }
        await sleep(randomBetween(200, 1500));
      }
    })());
  }

  await Promise.all(activeUsers);
  console.log("   ✅ Error spikes phase complete (%d requests)", stats["error-spikes"]?.total || 0);
}

async function phaseRecovery(durationMin) {
  currentPhase = "recovery";
  console.log("\n🟢 PHASE 4: Recovery");
  console.log("   Duration: %d min", durationMin);
  console.log("   Expected: Gauges return GREEN, error rate → 0, latency normalizes\n");

  const endTime = Date.now() + durationMin * 60 * 1000;

  while (Date.now() < endTime) {
    await makeRequest(ENDPOINTS.health);
    await sleep(randomBetween(1500, 4000));
    if (Math.random() < 0.3) {
      await makeRequest(ENDPOINTS.sessions);
    }
  }
  console.log("   ✅ Recovery complete (%d requests)", stats.recovery?.total || 0);
}

// ═══════════════════════════════════════════════════════
// Summary dump
// ═══════════════════════════════════════════════════════
function dumpSummary() {
  const outPath = path.join(__dirname, "..", "demo-metrics-summary.json");
  const summary = {};
  for (const [phase, s] of Object.entries(stats)) {
    s.latencyMs.sort((a, b) => a - b);
    const p50 = s.latencyMs[Math.floor(s.latencyMs.length * 0.50)] || 0;
    const p95 = s.latencyMs[Math.floor(s.latencyMs.length * 0.95)] || 0;
    const p99 = s.latencyMs[Math.floor(s.latencyMs.length * 0.99)] || 0;
    summary[phase] = {
      label: phaseMeta[phase]?.label || phase,
      totalRequests: s.total,
      successRate: s.total ? ((s.success2xx / s.total) * 100).toFixed(1) + "%" : "0%",
      error4xx: s.error4xx,
      error5xx: s.error5xx,
      latencyP50: p50 + "ms",
      latencyP95: p95 + "ms",
      latencyP99: p99 + "ms",
    };
  }
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log("\n📊 Summary written to %s", outPath);
}

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag, def) => {
    const idx = args.indexOf("--" + flag);
    return idx >= 0 ? args[idx + 1] : def;
  };

  const phase = getArg("phase", "full-demo");
  const durationMin = parseInt(getArg("duration", DEFAULT_DURATION_MIN), 10);
  const concurrency = parseInt(getArg("concurrency", DEFAULT_CONCURRENCY), 10);

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   BrainBytes Monitoring Demo – Traffic Generator    ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  Target:   %-39s ║", BASE_URL);
  console.log("║  Phase:    %-39s ║", phase);
  console.log("║  Duration: %d min/phase%-32s ║", durationMin, "");
  console.log("║  Users:    %-39d ║", concurrency);
  console.log("╚══════════════════════════════════════════════════════╝");

  // Connectivity check
  console.log("\n🔍 Checking backend connectivity...");
  const healthCheck = await makeRequest(ENDPOINTS.health);
  if (healthCheck.status === 200) {
    console.log("   ✅ Backend healthy (latency: %dms)", healthCheck.latency);
  } else {
    console.log("   ❌ Backend unreachable (status: %d). Is docker-compose up -d running?", healthCheck.status);
    process.exit(1);
  }

  // Run phase(s)
  switch (phase) {
    case "normal":
      await phaseNormal(durationMin, concurrency);
      break;
    case "high-load":
      await phaseHighLoad(durationMin);
      break;
    case "error-spikes":
      await phaseErrorSpikes(durationMin, concurrency);
      break;
    case "full-demo":
      await phaseNormal(durationMin, concurrency);
      await sleep(5000);
      await phaseHighLoad(durationMin);
      await sleep(5000);
      await phaseErrorSpikes(durationMin, concurrency);
      await sleep(5000);
      await phaseRecovery(Math.ceil(durationMin / 2));
      break;
    default:
      console.log("Unknown phase: %s. Use: normal | high-load | error-spikes | full-demo", phase);
      process.exit(1);
  }

  dumpSummary();

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   🎉 Demo Complete!                                 ║");
  console.log("║   Grafana:   http://localhost:3001/grafana          ║");
  console.log("║   Alertmanager: http://localhost:9093               ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // Let final metrics get scraped
  await sleep(20000);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
