# BrainBytes Prometheus Monitoring Deployment Guide

## Overview

This guide covers the enhanced Prometheus monitoring system for BrainBytes, including:
- Advanced application metrics (sessions, messages, data usage, connectivity)
- Filipino-specific monitoring (mobile performance, low-bandwidth tracking)
- Traffic simulation scenarios for observability testing
- Deployment-ready configuration for local and cloud environments

---

## Quick Start

### 1. Local Development (Docker Compose)

```bash
cd BrainBytes-AI-Tutoring-Platform-main

# Start all services including Prometheus
docker-compose up -d

# Verify services are healthy
docker-compose ps

# Access Prometheus UI
open http://localhost:9090
```

### 2. Access the Monitoring Stack

- **Prometheus**: http://localhost:9090
- **Backend Metrics**: http://localhost:9080/metrics
- **Frontend**: http://localhost:8080

---

## Architecture

### Service Components

| Service      | Port  | Purpose                                    |
|--------------|-------|-------------------------------------------|
| Backend      | 3000  | BrainBytes API                            |
| Metrics      | 9080  | Prometheus metrics endpoint                |
| Prometheus   | 9090  | Metrics storage and querying               |
| Node-Exporter| 9100  | System/host metrics                       |
| cAdvisor     | 8080  | Container resource metrics                 |
| MongoDB      | 27017 | Database (internal network only)           |

### Metrics Flow

```
Backend API
  ↓
metricsMiddleware (HTTP requests)
  ↓
recordSessionCreated/recordSessionCompleted (session lifecycle)
  ↓
recordMessage (tutoring messages)
  ↓
Prometheus scrapes /metrics every 10s
  ↓
Recording rules aggregate every 1m
  ↓
Prometheus Query API (visualize in dashboards)
```

---

## Key Metrics Available

### Application Metrics (Custom Business Logic)

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `brainbytes_sessions_total` | Counter | `subject`, `auth_type`, `device_type` | Track session creation |
| `brainbytes_session_duration_seconds` | Histogram | `subject`, `outcome`, `device_type` | Session length distribution |
| `brainbytes_messages_total` | Counter | `subject`, `role`, `device_type`, `connection_type` | Message throughput |
| `brainbytes_data_usage_bytes` | Histogram | `device_type`, `connection_type` | Data consumption tracking |
| `brainbytes_active_sessions` | Gauge | None | Current active sessions |
| `brainbytes_mobile_active_sessions` | Gauge | None | Current mobile sessions |
| `brainbytes_reconnect_events_total` | Counter | `device_type` | Connectivity disruptions |

### AI Service Metrics

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `brainbytes_ai_request_duration_seconds` | Histogram | `model`, `status` | AI response latency |
| `brainbytes_ai_request_errors_total` | Counter | `model`, `error_type` | AI service failures |

### HTTP Request Metrics (Auto-tracked)

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `brainbytes_http_requests_total` | Counter | `method`, `endpoint`, `status` | API request count |
| `brainbytes_http_request_duration_seconds` | Histogram | `method`, `endpoint`, `status` | API latency distribution |

---

## Recording Rules

Recording rules pre-aggregate frequently queried expressions to reduce load:

### Available Recording Rules

```promql
brainbytes:http_error_ratio:rate5m
  # 5-minute error rate (5xx errors / all requests)
  # Use for: Error ratio alerting, SLA tracking

brainbytes:ai_response_latency_p99:histogram_quantile5m
  # 99th percentile AI response latency
  # Use for: Performance alerting, SLA tracking

brainbytes:mobile_request_rate:rate5m
  # 5-minute request rate from mobile devices
  # Use for: Mobile-specific dashboards, capacity planning
```

### How to Use Recording Rules

Query directly in Prometheus:

```promql
# Error ratio for all services
brainbytes:http_error_ratio:rate5m

# AI latency for HuggingFace model
brainbytes:ai_response_latency_p99:histogram_quantile5m{model="huggingface"}

# Mobile traffic rate
brainbytes:mobile_request_rate:rate5m
```

---

## Traffic Simulation Framework

### Purpose

The simulator generates realistic and adverse traffic patterns to validate monitoring and alerting:

- **Validate metrics capture** before going to production
- **Test alert rules** with known traffic patterns
- **Baseline performance** under various conditions
- **Document expected behavior** for reference

### Profiles

| Profile | Device Mix | Connectivity | Use Case |
|---------|-----------|--------------|----------|
| `balanced` | 60% desktop, 40% mobile | Mixed 3G/4G/WiFi | General testing |
| `mobile` | 100% mobile | 60% 4G, 40% 3G | Philippine market conditions |
| `mixed` | Dynamic | Dynamic with low-bandwidth spikes | Intermittent connectivity |

### Quick Commands

```bash
cd backend

# Default: single steady user (runs forever)
node simulate-activity.js

# High-load scenario with customization
node simulate-activity.js --scenario high-load --concurrency 8 --duration 300 --profile balanced

# Error-spikes scenario (35% error rate)
node simulate-activity.js --scenario error-spikes --error-rate 0.35 --concurrency 5 --duration 240 --profile mobile

# Resource constraint scenario (sessions never end)
node simulate-activity.js --scenario resource-constraint --concurrency 6 --duration 180 --profile mixed

# Custom parameters
node simulate-activity.js \
  --scenario default \
  --concurrency 10 \
  --duration 600 \
  --peak-interval 30 \
  --error-rate 0.05 \
  --reconnect-rate 0.1 \
  --profile mixed
```

### Scenario Details

See [backend/scenarios/README.md](backend/scenarios/README.md) for complete documentation of each scenario, expected Prometheus effects, and interpretation guide.

---

## Scenario: High Load (Peak/Quiet Cycles)

**What it simulates:** Normal traffic with periodic load spikes

```bash
node scenarios/high-load.js
```

**Expected metrics:**
- Request rate oscillates: ~0.1 rps (quiet) → ~1.5 rps (peak)
- Active sessions climb during peaks, drop during quiet
- CPU follows load pattern
- p95 latency rises during peaks

**Watch in Prometheus:**
```promql
rate(brainbytes_http_requests_total[1m])
brainbytes_active_sessions
brainbytes_http_request_duration_seconds
```

---

## Scenario: Error Spikes

**What it simulates:** Intermittent service degradation (e.g., malformed requests, auth failures)

```bash
node scenarios/error-spikes.js
```

**Expected metrics:**
- ~30-40% of requests return 4xx/5xx errors
- AI error counter spikes
- Active sessions may drift upward (401s prevent graceful shutdown)

**Watch in Prometheus:**
```promql
rate(brainbytes_http_requests_total{status=~"5.."}[1m])
brainbytes_ai_request_errors_total
brainbytes:http_error_ratio:rate5m
```

---

## Scenario: Resource Constraint (Orphaned Sessions)

**What it simulates:** Sessions that never end (users close browser without logout)

```bash
node scenarios/resource-constraint.js
```

**Expected metrics:**
- Active sessions **monotonically climb** (never fall)
- Zero PUT requests (no session-end calls)
- No duration histogram data (sessions never complete)

**Watch in Prometheus:**
```promql
brainbytes_active_sessions
rate(brainbytes_http_requests_total{method="PUT"}[1m])
```

---

## Filipino Context Adaptations

### What We Monitor for Philippine Conditions

1. **Mobile Performance**
   - Track active mobile sessions separately
   - Monitor latency by device type

2. **Data Usage**
   - Measure bytes per interaction
   - Track low-bandwidth vs normal traffic

3. **Intermittent Connectivity**
   - Monitor reconnect-style events
   - Track connection type (3G, 4G, WiFi)

4. **Session Variability**
   - Expect longer session durations on slower networks
   - Use trend-based alerts instead of absolute thresholds

### Threshold Recommendations

For Philippine deployment, use these guidelines:

| Metric | Condition | Threshold | Rationale |
|--------|-----------|-----------|-----------|
| Mobile Response Latency | Warning | > 6s | Higher tolerance for 3G networks |
| Desktop Response Latency | Warning | > 5s | Standard expectation |
| Data Per Interaction | Warning | > 128KB | Cost impact on slow plans |
| Reconnect Events | Alert | > 5/5min | Indicates connectivity problems |
| Session Duration | Alert | > 2x p50 | Trend-based, not absolute |

### Headers for Simulating Filipino Conditions

When calling the backend, include these headers to simulate local conditions:

```http
# Mobile 3G user
x-device-type: mobile
x-network-type: 3g
x-low-bandwidth: true

# Mobile 4G user
x-device-type: mobile
x-network-type: 4g

# Desktop WiFi (normal)
x-device-type: desktop
x-network-type: wifi

# Reconnect attempt
x-reconnect-attempt: true
```

The simulator automatically includes these headers based on the `--profile` parameter.

---

## Prometheus Configuration Details

### Scrape Intervals

- **Backend API**: 10s (fast feedback for application metrics)
- **Infrastructure** (Node-Exporter, cAdvisor): 15-30s (balanced cost/visibility)
- **Prometheus self**: 15s (monitoring the monitor)

### Sample Limits

- Backend: 1000 samples max per scrape (prevents runaway metrics)
- Label limits: 30 labels max per metric (avoid cardinality explosion)

### Metric Relabeling

High-cardinality metrics are dropped to reduce storage:
- Node-exporter network and disk I/O metrics
- cAdvisor per-container network metrics

### Recording Rule Intervals

Recording rules evaluate every 1 minute, providing:
- Pre-calculated aggregations for dashboards
- Faster queries in Prometheus UI
- Lower query latency for alerts

---

## Deployment to Production (Railway / Cloud)

### Environment Variables

Ensure these are set in your deployment:

```bash
HUGGINGFACE_TOKEN=<your-token>
JWT_SECRET=<strong-random-string>
NODE_ENV=production
MONGODB_URI=<your-database-url>
```

### Prometheus Configuration for Cloud

The existing `monitoring/prometheus.yml` is production-ready:

1. **External labels** identify the environment:
   ```yaml
   external_labels:
     environment: production
     cluster: brainbytes
   ```

2. **Scrape timeouts** prevent hanging:
   - 5s for backend
   - 10s for infrastructure

3. **Storage retention** (default 15 days):
   ```bash
   docker run ... --storage.tsdb.retention.time=15d
   ```

### Scaling Prometheus

For larger deployments:

1. **Increase retention** as needed (trades cost for history)
2. **Use recording rules** to pre-aggregate (included)
3. **Enable remote storage** (e.g., Thanos, Cortex) for long-term retention
4. **Separate scrape targets** across multiple Prometheus instances

---

## Monitoring the Monitor

### Health Checks

```bash
# Is Prometheus up?
curl http://localhost:9090/-/healthy

# Is the backend metrics endpoint accessible?
curl http://localhost:9080/metrics | head -20
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Targets Down" in Prometheus | Backend not running or not exposing /metrics | `docker-compose logs backend` |
| Recording rules not evaluating | Rules file not mounted | Check `docker-compose.yml` volume mount |
| No metrics data | metricsMiddleware not registered | Verify `app.use(metricsMiddleware)` in server.js |
| High cardinality warning | Too many label combinations | Check alert_rules.yml and metric_relabel_configs |

---

## Next Steps

1. **Start the monitoring stack:**
   ```bash
   docker-compose up -d
   ```

2. **Generate test traffic:**
   ```bash
   cd backend
   node simulate-activity.js --profile mobile --concurrency 3 --duration 300
   ```

3. **Verify metrics in Prometheus:**
   - Go to http://localhost:9090
   - Search for `brainbytes_` to see all custom metrics
   - Run: `rate(brainbytes_http_requests_total[1m])`

4. **Create Grafana dashboard** (optional):
   - Add Prometheus as data source
   - Build panels for: request rate, latency, active sessions, mobile traffic, data usage

5. **Set up alert rules** in `monitoring/alert_rules.yml`:
   - Active sessions too high
   - Error rate elevated
   - Mobile latency degraded

---

## Documentation References

- [Filipino Monitoring Guide](monitoring/FILIPINO_MONITORING_GUIDE.md)
- [Scenario Testing README](backend/scenarios/README.md)
- [Prometheus Official Docs](https://prometheus.io/docs/)
- [Recording Rules Best Practices](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)

