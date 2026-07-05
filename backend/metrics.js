const client = require('prom-client');
const express = require('express');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event-loop lag, etc.)
client.collectDefaultMetrics({ register });

// --- CUSTOM BUSINESS METRICS ---
const httpRequestCounter = new client.Counter({
  name: 'brainbytes_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'brainbytes_http_request_duration_seconds',
  help: 'HTTP request duration distribution in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const activeSessionsGauge = new client.Gauge({
  name: 'brainbytes_active_sessions',
  help: 'Current number of concurrent active tutoring sessions',
  registers: [register],
});

// Initialize the session counter to zero
activeSessionsGauge.set(0);

// --- AI-SPECIFIC METRICS ---
const aiRequestDuration = new client.Histogram({
  name: 'brainbytes_ai_request_duration_seconds',
  help: 'External AI service call duration in seconds (HuggingFace / LLM)',
  labelNames: ['model', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const aiRequestErrors = new client.Counter({
  name: 'brainbytes_ai_request_errors_total',
  help: 'Total number of failed AI service calls',
  labelNames: ['model', 'error_type'],
  registers: [register],
});

// --- EXPOSE METRICS ENDPOINT ON PORT 9080 ---
const metricsApp = express();
metricsApp.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

let metricsServer = null;

function startMetricsServer() {
  if (metricsServer) return; // already started (idempotent)
  metricsServer = metricsApp.listen(9080, () => {
    console.log('Telemetry server listening on port 9080');
  });
}

// --- PATH NORMALIZATION ---
// Replace dynamic segments (MongoDB ObjectIds, 24 hex chars) with
// parameterised placeholders so Prometheus doesn't create a new time
// series for every session / user / material ID.
function normalizePath(path) {
  return path.replace(
    /\/(api\/sessions|api\/messages|api\/users|api\/materials|api\/preferences)\/[a-f0-9]{24}(?=\/|$)/g,
    '/$1/:id',
  );
}

// --- TELEMETRY MIDDLEWARE FOR MAIN SERVER ---
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  const endpoint = normalizePath(req.path);

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    // Increment total request counter
    httpRequestCounter.inc({
      method: req.method,
      endpoint,
      status: res.statusCode,
    });

    // Track duration within histogram buckets
    httpRequestDuration.observe(
      {
        method: req.method,
        endpoint,
        status: res.statusCode,
      },
      duration,
    );
  });

  next();
}

// Business Logic Helper Hooks
function incrementActiveSessions() {
  activeSessionsGauge.inc();
}

function decrementActiveSessions() {
  activeSessionsGauge.dec();
}

module.exports = {
  metricsMiddleware,
  incrementActiveSessions,
  decrementActiveSessions,
  aiRequestDuration,
  aiRequestErrors,
  startMetricsServer,
};
