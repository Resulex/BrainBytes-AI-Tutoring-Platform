# BrainBytes Monitoring Documentation

Comprehensive documentation for the BrainBytes AI Tutoring Platform monitoring system.  
**Stack**: Prometheus 2.43 → Grafana 9.5 → Node.js Backend + Next.js Frontend + MongoDB

---

## Table of Contents

1. [Dashboard Catalog](#1-dashboard-catalog)
   - [API & AI Dashboard](#11-api--ai-dashboard--uid-brainbytes-api)
   - [Error Analysis Dashboard](#12-error-analysis-dashboard--uid-brainbytes-errors)
   - [Resource Optimization Dashboard](#13-resource-optimization-dashboard--uid-brainbytes-resources)
2. [Metric Dictionary](#2-metric-dictionary)
   - [Custom Application Metrics](#21-custom-application-metrics)
   - [Recording Rules](#22-recording-rules)
   - [Key Infrastructure Metrics](#23-key-infrastructure-metrics)

---

## 1. Dashboard Catalog

All dashboards are provisioned automatically in the Grafana **BrainBytes** folder and
refresh every 10 seconds. Cross-dashboard navigation links allow seamless switching.

| Dashboard | UID | Refresh | Visualizations / Rows |
|---|---|---|---|
| API & AI Dashboard | `brainbytes-api` | 10s | 15 panels, 4 rows |
| Error Analysis | `brainbytes-errors` | 10s | 15 panels, 4 rows |
| Resource Optimization | `brainbytes-resources` | 10s | 18 panels, 5 rows |

---

### 1.1 API & AI Dashboard — UID: `brainbytes-api`

**Purpose**: High-level operational overview. The "first stop" dashboard for engineers
monitoring the health of the BrainBytes platform.

**Target Audience**: All engineers (dev, ops, SRE). Non-technical stakeholders for
high-level status checks.

**Template Variables**: `DS_PROMETHEUS` (datasource), `endpoint` (multi-select)

#### Rows & Panels

| Row | Panels | Types | Purpose |
|---|---|---|---|
| **Overview** | Backend Status, Node Exporter, cAdvisor, HTTP Request Rate, Active Sessions | 3× `stat`, 1× `bargauge`, 1× `stat` | At-a-glance health: green = all OK |
| **HTTP Traffic** | Requests by Endpoint, Error Rate (%), HTTP Latency Percentiles (p50/p90/p99) | 3× `timeseries` | Traffic volume per endpoint, error ratio, latency distribution |
| **AI Service** | AI Request Duration by Model, AI Error Rate by Model, Active Tutoring Sessions | 3× `timeseries` | Per-model AI latency and error trends |
| **Node & Container Resources** | Host CPU Usage, Host Memory Usage | 2× `timeseries` | Infrastructure: CPU/Memory with orange/red threshold bands |

#### Use Cases

- **Daily health check**: Verify all stat panels are green
- **Incident triage**: Identify which layer (API, AI, infrastructure) is the bottleneck
- **Capacity review**: Watch CPU/Memory trends during peak usage

---

### 1.2 Error Analysis Dashboard — UID: `brainbytes-errors`

**Purpose**: Deep-dive error investigation. Understand error patterns, correlate
errors with system health, and identify root causes.

**Target Audience**: On-call engineers, backend developers debugging production issues.

**Template Variables**: `DS_PROMETHEUS`, `service`, `endpoint`, `instance`, `status_code` (custom: 5xx / 4xx / All)

**Annotations**: Deployments (tag-based), Service Restarts (`process_start_time_seconds` changes)

#### Rows & Panels

| Row | Panels | Types | Purpose |
|---|---|---|---|
| **Error Overview** | 5xx Error Rate, 4xx Error Rate, AI Error Rate, 5xx Errors (1h), Event Loop Lag | 5× `stat` | High-level error indicators with multi-threshold coloring |
| **Error Patterns** | 5xx Errors by Endpoint, Error Distribution by Status Code | 2× `timeseries` | Which endpoints fail? What status codes? |
| **Error Patterns & Heatmaps** | Error Response Latency Distribution, Error Hotspots by Endpoint | `heatmap` + `timeseries` | How slow are error responses? Where are hotspots? |
| **Service Status** | Service Status Timeline, Errors vs CPU, Errors vs Memory, AI Errors vs Latency | `state-timeline` + 3× `timeseries` | Service uptime timeline; error-resource correlation |
| **Error Detail Table** | Recent Errors by Endpoint, AI Error Detail by Model & Type | 2× `table` | Sortable/filterable tables for precise error attribution |

#### Use Cases

- **Root cause analysis**: Were errors caused by a deployment? CPU spike? Memory pressure?
- **Pattern recognition**: Heatmap shows if errors cluster at specific latencies
- **Correlation**: Overlay errors with service restarts and resource usage

---

### 1.3 Resource Optimization Dashboard — UID: `brainbytes-resources`

**Purpose**: Proactive resource management. Track efficiency, identify waste,
and stay within Docker resource limits.

**Target Audience**: DevOps, SRE, capacity planners. Anyone managing infrastructure costs.

**Template Variables**: `DS_PROMETHEUS`, `service`, `endpoint`, `instance`, `container` (filtered: no POD/sandbox)

**Annotations**: Deployments, Scaling Events (`container_last_seen` changes)

#### Rows & Panels

| Row | Panels | Types | Purpose |
|---|---|---|---|
| **System Health Gauges** | CPU Usage, Memory Usage, Error Rate, Active Sessions | 2× `gauge` + 2× `stat` | Radial gauges: green→orange→red at 60%/85% and 70%/90% |
| **Traffic & Performance** | Request Count by Endpoint, Response Time (p50/p90/p99), Error Rate (TS), Healthy vs Total, API Response Distribution | 4× `timeseries` + `heatmap` | Full request lifecycle: volume → latency → errors → distribution |
| **Resource Efficiency** | Container CPU vs Requests, Container Memory vs Requests, CPU Bar Gauge, Memory Bar Gauge | 2× `timeseries` + 2× `bargauge` | Resource usage vs traffic; horizontal bar gauges |
| **Container Status** | Container Status (Table) | `table` | UP/DOWN with CPU%, Memory, and Docker limits |

#### Required Panels Checklist

| Requirement | Panel ID | Type |
|---|---|---|
| CPU usage (Gauge) | 101 | `gauge` |
| Memory usage (Gauge) | 102 | `gauge` |
| Response time (Time Series) | 202 | `timeseries` |
| Request count (Time Series) | 201 | `timeseries` |
| Error rate (Time Series) | 203 | `timeseries` |
| API response distribution (Heatmap) | 205 | `heatmap` |
| Container status (Table) | 401 | `table` |

---

## 2. Metric Dictionary

### Naming Convention

```
brainbytes_<domain>_<unit>
├── brainbytes_http_requests_total          ← Application HTTP counter
├── brainbytes_http_request_duration_seconds ← Application latency histogram
├── brainbytes_active_sessions              ← Application gauge
├── brainbytes_ai_request_duration_seconds   ← AI latency histogram
├── brainbytes_ai_request_errors_total       ← AI error counter
└── brainbytes:<recording_rule>             ← Pre-computed recording rules
```

---

### 2.1 Custom Application Metrics

#### `brainbytes_http_requests_total`

| Property | Value |
|---|---|
| **Type** | `Counter` (monotonic) |
| **Labels** | `method`, `endpoint`, `status` |
| **How Calculated** | Incremented by `metricsMiddleware` on every response `finish`. Paths normalized (`/api/sessions/:id` not `/api/sessions/abc123`). |
| **Normal** | Growing monotonically with traffic |
| **Unusual - 5xx** | `{status=~"5.."}` rate > 5% → `HighHTTP5xxRate` alert |
| **Unusual - Zero** | `rate(…[10m]) == 0` → No traffic (off-peak or outage) |

**Key Queries**:
```promql
# Request rate per endpoint
sum(rate(brainbytes_http_requests_total[5m])) by (endpoint)

# 5xx error ratio
sum(rate(brainbytes_http_requests_total{status=~"5.."}[5m]))
/
sum(rate(brainbytes_http_requests_total[5m]))
```

---

#### `brainbytes_http_request_duration_seconds`

| Property | Value |
|---|---|
| **Type** | `Histogram` |
| **Labels** | `method`, `endpoint`, `status` |
| **Buckets** | 0.01, 0.05, 0.1, 0.5, 1, 2, 5 seconds |
| **How Calculated** | `Date.now() - start` at response `finish` |
| **Normal p50** | < 0.5s |
| **Normal p95** | < 2s |
| **Degraded p95** | > 5s → `HighAPILatency` alert |
| **Critical p99** | > 5s consistently → investigate AI or DB |

**Key Queries**:
```promql
# p50/p90/p99
histogram_quantile(0.50, sum(rate(brainbytes_http_request_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.90, sum(rate(brainbytes_http_request_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.99, sum(rate(brainbytes_http_request_duration_seconds_bucket[5m])) by (le))
```

---

#### `brainbytes_active_sessions`

| Property | Value |
|---|---|
| **Type** | `Gauge` |
| **Labels** | None |
| **How Calculated** | `incrementActiveSessions()` on WebSocket connect; `decrementActiveSessions()` on disconnect |
| **Normal** | 0–10 concurrent sessions |
| **Elevated** | > 10 for 10m → `SessionLeakWarning` |
| **Anomaly - Zero with traffic** | `SessionDropAnomaly` / `SessionGaugeMismatch` |
| **Anomaly - Rapid change** | `rate(…[10m]) > 5` → `HighSessionChurn` (reconnect storm) |

---

#### `brainbytes_ai_request_duration_seconds`

| Property | Value |
|---|---|
| **Type** | `Histogram` |
| **Labels** | `model` (e.g., `gpt2`, `distilgpt2`), `status` |
| **Buckets** | 0.1, 0.5, 1, 2, 5, 10, 30 seconds |
| **How Calculated** | Measured in `aiService.js` — HuggingFace API call duration |
| **Normal p50 (gpt2)** | 1–3s |
| **Normal p95 (gpt2)** | 5–10s |
| **Degraded p99** | > 10s → `AIServiceHighLatency` |
| **Warning p99** | > 15s → `AIResponseDegradationWarning` |
| **Critical p99** | > 30s → `AIResponseDegradationCritical` |

**Key Queries**:
```promql
# P99 AI latency by model
histogram_quantile(0.99, sum(rate(brainbytes_ai_request_duration_seconds_bucket[5m])) by (le, model))
```

---

#### `brainbytes_ai_request_errors_total`

| Property | Value |
|---|---|
| **Type** | `Counter` |
| **Labels** | `model`, `error_type` (e.g., `timeout`, `auth_failure`, `rate_limit`, `network_error`) |
| **How Calculated** | Incremented on HuggingFace API call failure in `aiService.js` |
| **Normal** | ~0 req/s (occasional errors expected) |
| **Elevated** | > 0.02 req/s → `AIServiceHighErrors` |
| **Critical** | All calls failing → `AICompleteFailure` |

**Key Queries**:
```promql
# AI errors by model and type
sum(rate(brainbytes_ai_request_errors_total[5m])) by (model, error_type)
```

---

### 2.2 Recording Rules

Pre-computed every 30s for efficient alerting and dashboard queries:

| Rule | Expression | Used By |
|---|---|---|
| `brainbytes:ai_response_latency_p99:histogram_quantile5m` | AI P99 latency (5m window) | `AIServiceHighLatency`, `AIResponseDegradation*` |
| `brainbytes:global_request_rate:rate1m` | Total request rate (1m) | Dashboards |
| `brainbytes:error_ratio_5xx:ratio5m` | 5xx / total (5m) | Error alerts |
| `brainbytes:endpoint_5xx_rate:rate5m` | 5xx rate by endpoint | Error dashboards |
| `brainbytes:api_latency_p50/p95/p99:…` | API latency percentiles | Dashboards |
| `brainbytes:container_cpu_percent:rate5m` | Container CPU % | Dashboards |

---

### 2.3 Key Infrastructure Metrics

| Metric | Source | Labels | Normal | Unusual Indicates |
|---|---|---|---|---|
| `up` | Prometheus scrape | `job`, `instance` | 1 | 0 → `InstanceDown` / `FrontendDown` |
| `node_cpu_seconds_total{mode="idle"}` | node-exporter | `instance` | Idle > 20% | Idle < 20% → CPU > 80%; `HighCPUUsage` |
| `node_memory_MemAvailable_bytes` | node-exporter | `instance` | > 15% free | < 15% → OOM risk; `HighMemoryUsage` |
| `node_filesystem_avail_bytes{mp="/"}` | node-exporter | `instance` | > 20% free | < 20% → `DiskSpaceWarning`; < 10% → `DiskSpaceCritical` |
| `container_memory_usage_bytes` | cAdvisor | `name` | < limit | Backend > 435MB → approaching 512MB limit |
| `container_cpu_usage_seconds_total` | cAdvisor | `name` | < limit | > 85% of limit → CPU throttled |
| `container_spec_memory_limit_bytes` | cAdvisor | `name` | Static | Used for %-of-limit calculations |
| `container_spec_cpu_quota` / `cpu_period` | cAdvisor | `name` | Static | Used for CPU limit calculations |
| `nodejs_eventloop_lag_seconds` | prom-client | `job` | < 0.05s | > 50ms → `EventLoopLag`; > 250ms → `EventLoopCritical` |
| `process_start_time_seconds` | prom-client | `job` | Unchanged | Change → process restarted (used by annotations) |
| `nodejs_heap_size_used_bytes` | prom-client | `job` | < 256MB | Growing → memory leak |
| `container_last_seen` | cAdvisor | `name` | Continuous | Change → container created/destroyed (used by annotations) |

---

### Collection Architecture

```
Prometheus (port 9090) ──── scrape_interval: 15s, eval: 15s
 │
 ├── backend:9080/metrics
 │   └── brainbytes_http_requests_total, brainbytes_http_request_duration_seconds,
 │       brainbytes_active_sessions, brainbytes_ai_*, nodejs_* (default)
 │
 ├── node-exporter:9100/metrics
 │   └── node_cpu_*, node_memory_*, node_filesystem_*, node_network_*
 │
 ├── cadvisor:8080/metrics
 │   └── container_cpu_*, container_memory_*, container_spec_*, container_last_seen
 │
 └── frontend:3000/api/metrics
     └── up, basic Node.js health
```

### Normal Value Ranges Quick Reference

| Metric | Normal | Warning | Critical |
|---|---|---|---|
| CPU Usage | < 50% | > 50% (10m) | > 80% (5m) |
| Memory Usage | < 60% | > 60% (10m) | > 85% (5m) |
| Disk Space | > 20% free | < 20% (5m) | < 10% (1m) |
| 5xx Error Rate | < 1% | > 5% (3m) | > 20% (1m) |
| AI Error Rate | ~0 req/s | > 0.02 req/s | All failing |
| API P95 Latency | < 2s | > 5s | — |
| AI P99 Latency | < 10s | > 10s (5m) | > 30s (3m) |
| Event Loop Lag | < 50ms | > 50ms (3m) | > 250ms (2m) |
| Active Sessions | 0–10 | > 10 (10m) | — |
| Backend Memory | < 307MB | > 307MB (60%) | > 435MB (85%) |
| MongoDB Memory | < 614MB | > 614MB (60%) | > 870MB (85%) |
