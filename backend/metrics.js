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

const mobileActiveSessionsGauge = new client.Gauge({
  name: 'brainbytes_mobile_active_sessions',
  help: 'Current number of active tutoring sessions started from mobile devices',
  registers: [register],
});

const sessionsCreatedCounter = new client.Counter({
  name: 'brainbytes_sessions_total',
  help: 'Total number of tutoring sessions created',
  labelNames: ['subject', 'auth_type', 'device_type'],
  registers: [register],
});

const sessionDurationHistogram = new client.Histogram({
  name: 'brainbytes_session_duration_seconds',
  help: 'Duration of completed tutoring sessions in seconds',
  labelNames: ['subject', 'outcome', 'device_type'],
  buckets: [30, 60, 120, 300, 600, 1800],
  registers: [register],
});

const messagesCounter = new client.Counter({
  name: 'brainbytes_messages_total',
  help: 'Total number of tutoring messages processed',
  labelNames: ['subject', 'role', 'device_type', 'connection_type'],
  registers: [register],
});

const dataUsageHistogram = new client.Histogram({
  name: 'brainbytes_data_usage_bytes',
  help: 'Estimated data usage per tutoring interaction in bytes',
  labelNames: ['device_type', 'connection_type'],
  buckets: [512, 2048, 8192, 32768, 131072, 524288],
  registers: [register],
});

const reconnectEventsCounter = new client.Counter({
  name: 'brainbytes_reconnect_events_total',
  help: 'Total number of reconnect-style events observed for intermittent connectivity',
  labelNames: ['device_type'],
  registers: [register],
});

// Initialize gauges to zero
activeSessionsGauge.set(0);
mobileActiveSessionsGauge.set(0);

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

function getDeviceType(userAgent = '') {
  const ua = (userAgent || '').toLowerCase();
  if (/iphone|android|mobile|ipad|ipod|opera mini/.test(ua)) {
    return 'mobile';
  }
  if (/tablet|playbook/.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

function getConnectionType(headers = {}) {
  const headerValue = (headers['x-network-type'] || headers['x-connection-type'] || '')
    .toString()
    .toLowerCase();
  const lowBandwidth =
    headers['x-low-bandwidth'] === 'true' ||
    headers['x-low-bandwidth'] === true ||
    headers['x-bandwidth-constrained'] === 'true' ||
    headers['x-bandwidth-constrained'] === true;

  if (headerValue) {
    return headerValue;
  }
  if (lowBandwidth) {
    return 'slow';
  }
  return 'unknown';
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

    httpRequestCounter.inc({
      method: req.method,
      endpoint,
      status: res.statusCode,
    });

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

function recordSessionCreated({ subject = 'general', authType = 'anonymous', deviceType = 'desktop' } = {}) {
  sessionsCreatedCounter.inc({ subject, auth_type: authType, device_type: deviceType });
  if (deviceType === 'mobile') {
    mobileActiveSessionsGauge.inc();
  }
}

function recordSessionCompleted({ subject = 'general', durationSeconds = 0, outcome = 'completed', deviceType = 'desktop' } = {}) {
  sessionDurationHistogram.observe({ subject, outcome, device_type: deviceType }, durationSeconds);
  if (deviceType === 'mobile') {
    mobileActiveSessionsGauge.dec();
  }
}

function recordMessage({ subject = 'general', role = 'user', deviceType = 'desktop', connectionType = 'unknown', dataBytes = 0, reconnectAttempt = false } = {}) {
  messagesCounter.inc({ subject, role, device_type: deviceType, connection_type: connectionType });
  dataUsageHistogram.observe({ device_type: deviceType, connection_type: connectionType }, dataBytes);
  if (reconnectAttempt) {
    reconnectEventsCounter.inc({ device_type: deviceType });
  }
}

function recordDataUsage({ deviceType = 'desktop', connectionType = 'unknown', bytes = 0 } = {}) {
  dataUsageHistogram.observe({ device_type: deviceType, connection_type: connectionType }, bytes);
}

function recordConnectivityEvent({ deviceType = 'desktop' } = {}) {
  reconnectEventsCounter.inc({ device_type: deviceType });
}

module.exports = {
  metricsMiddleware,
  incrementActiveSessions,
  decrementActiveSessions,
  recordSessionCreated,
  recordSessionCompleted,
  recordMessage,
  recordDataUsage,
  recordConnectivityEvent,
  getDeviceType,
  getConnectionType,
  aiRequestDuration,
  aiRequestErrors,
  startMetricsServer,
};
