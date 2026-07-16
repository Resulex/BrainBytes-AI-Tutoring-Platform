# BrainBytes Monitoring Demo Script

**Duration**: 12–15 minutes  
**Audience**: Technical stakeholders, SRE team, new engineers  
**Prerequisites**: `docker-compose up -d` running, Grafana on `localhost:3001/grafana`  
**Data Generator**: `node monitoring/demo-traffic-generator.js --phase full-demo --duration 2`

---

## Demo Flow Overview

```
Time    Phase          Dashboard               What You'll Show
────    ─────          ─────────               ───────────────
0:00    Setup          All                     Start generator, verify dashboards refreshing
0:30    Normal Traffic API & AI Dashboard     All green, healthy traffic, ~1-2 req/s
2:30    High Load     Resource Optimization   CPU/Memory climb, request spikes, latency grows
5:00    Error Spikes  Error Analysis          Error heatmap, tables, status timeline, correlations
8:00    Alert Review  Alertmanager            Triggered alerts, runbook walkthrough
9:30    Recovery      API & AI Dashboard     Metrics return to normal, green across the board
11:00   Q&A + Wrap    All                     Recap, documentation handoff
```

---

## Minute-by-Minute Breakdown

### 0:00 – Setup & Introduction (30 seconds)

**Action**: Start the demo generator in a visible terminal:
```bash
cd /path/to/brainbytes-multi-container
node monitoring/demo-traffic-generator.js --phase full-demo --duration 2
```

**Say**: *"The BrainBytes monitoring stack runs on Prometheus + Grafana in Docker.
This demo script generates realistic traffic through four phases: normal operation,
high load, error spikes, and recovery. Let me walk through what each dashboard
shows as the scenario progresses."*

**Also open**: Grafana home → `http://localhost:3001/grafana` — show the three dashboards in the BrainBytes folder.

---

### 0:30 – Normal Traffic: API & AI Dashboard (2 minutes)

**Open**: **BrainBytes - API & AI Dashboard**  
→ `http://localhost:3001/grafana/d/brainbytes-api`

**What to show** (scroll through rows):

| Panel | Expected Visual | Talking point |
|---|---|---|
| Backend Status (Stat) | **Green "1"** | "Stat panel — `up` metric from Prometheus. Green means healthy." |
| Node Exporter (Stat) | **Green "1"** | "node-exporter is healthy — collects host-level CPU, memory, disk" |
| cAdvisor (Stat) | **Green "1"** | "cAdvisor healthy — collects per-container metrics" |
| HTTP Request Rate (Bar Gauge) | **~1–2 req/s** across endpoints | "Bar gauge showing request rate — health checks dominate in normal mode" |
| Active Sessions (Stat) | **1–5 sessions** | "Active tutoring session gauge" |
| Requests by Endpoint (Timeseries) | Smooth, climbing lines | "Time series — steady growth, no anomalies. Template variable `endpoint` can filter." |
| Error Rate (%) (Timeseries) | **Flat at 0%** | "5xx and 4xx error rates — zero. This is what healthy looks like." |
| HTTP Latency Percentiles (Timeseries) | p50 ~200ms, p90 ~500ms, p99 ~1s | "Three bands: median, 90th, 99th percentile. Tight under normal load." |

**Transition**: *"Now let's see what happens when we push 20 concurrent users — I'll switch to the Resource Optimization dashboard."*

---

### 2:30 – High Load: Resource Optimization Dashboard (2.5 minutes)

**Open**: **BrainBytes - Resource Optimization**  
→ `http://localhost:3001/grafana/d/brainbytes-resources`

**What to show**:

| Panel | Expected Visual | Talking point |
|---|---|---|
| **CPU Usage (Gauge)** | Needle **enters yellow/orange** (>50%) | "Required gauge panel. Watch the needle climb — green <60%, orange 60-85%, red >85%." |
| **Memory Usage (Gauge)** | Needle **rises** (40-60%) | "Required gauge. Memory pressure building but still in the green zone." |
| Error Rate + Active Sessions (Stats) | Error rate stays low, sessions climb | "Stats alongside gauges for quick health check" |
| **Request Count by Endpoint (Timeseries)** | **Sharp spike** to 15-20 req/s | "Required time series. `/api/messages` dominates — 70% of traffic under load." |
| **Response Time Percentiles (Timeseries)** | p50 ~500ms, p95 **climbs to 2-3s** | "Required time series. Wider gap between p50 and p99 — more variance under load." |
| **Error Rate (Timeseries)** | **Small bumps** 1-2% from timeouts | "Required time series. Even under load, error rate stays low — no saturation yet." |
| Healthy vs Total Request Rate | Two lines mostly overlap | "2xx success line tracks total — most requests succeed" |
| **API Response Distribution (Heatmap)** | **Denser bottom-left**, tail to right | "Required heatmap. X-axis is time, Y-axis is latency bucket. Hot cells shift right under load — distribution spreads." |
| Container CPU vs Request Volume | Lines correlate | "Container CPU and request rate move together — expected correlation" |
| Container Memory vs Request Volume | Memory climbs gradually | "Memory lags CPU — slower to rise, slower to cool down" |
| **CPU Bar Gauge** | Backend bar **growing** | "Horizontal bar gauge — instantly see which container uses most CPU" |
| **Memory Bar Gauge** | Backend bar dominates | "Same for memory — backend is the heaviest consumer" |
| **Container Status (Table)** | All **UP**, CPU% rising | "Required table. Status column uses color-background: green = UP, red = DOWN." |

**Transition**: *"Annotations at the top mark phase boundaries. Now let's look at what happens when we inject errors — switching to the Error Analysis dashboard."*

---

### 5:00 – Error Spikes: Error Analysis Dashboard (3 minutes)

**Open**: **BrainBytes - Error Analysis**  
→ `http://localhost:3001/grafana/d/brainbytes-errors`

**Demonstrate template variables first**:
- Point out the dropdowns at top: `service`, `endpoint`, `instance`, `status_code`
- Change `status_code` from "5xx" to "4xx" → panels re-query instantly

**What to show**:

| Panel | Expected Visual | Talking point |
|---|---|---|
| **5xx Error Rate (Stat)** | **Orange/Red** (e.g., "28%") | "Stat with multi-threshold coloring — background turns red when >5%." |
| **4xx Error Rate (Stat)** | **Orange** (10-15%) | "Client errors from `/api/nonexistent` — less severe but still tracked." |
| **AI Error Rate (Stat)** | **Yellow/Orange** | "AI-specific error counter — HuggingFace failures." |
| 5xx Errors 1h (Stat) | Shows cumulative errors | "Hourly count gives context — is this a spike or sustained?" |
| Event Loop Lag (Stat) | Slightly elevated | "Node.js event loop lag — may rise under load" |
| **5xx Errors by Endpoint (Timeseries)** | `/api/messages` line **spikes** | "Which endpoint is failing? Clear answer: `/api/messages` from bad request injection." |
| Error Distribution by Status Code (Timeseries) | 400 + 500 bars **dominate** | "Stacked view — 5xx is the red flag, 4xx is the yellow." |
| **Error Response Latency Distribution (Heatmap)** | **Cells cluster at low latency** | "Interesting — errors are fast-failing (validation/auth), not slow timeouts. Tells us the root cause is request quality, not resource saturation." |
| Error Hotspots by Endpoint (Timeseries) | Peak-aligned patterns | "Error concentration map — helps spot cron-job bugs or time-based failures." |
| **Service Status Timeline** | Green bars with **red segments** | "State timeline — service uptime history. Deployment annotations appear as vertical lines with orange markers." |
| **Errors vs. Host CPU Usage** | Error spikes align with CPU | "Correlation panel — errors and CPU overlaid. Are failures caused by resource pressure?" |
| **Errors vs. Host Memory Usage** | Error spikes align with memory | "Same for memory — do errors correlate with memory pressure?" |
| AI Errors vs. AI Latency p99 | AI errors rise, latency may too | "AI-specific correlation — error rate vs response time" |
| **Recent Errors by Endpoint (Table)** | **Populated rows**: endpoint, 5xx rate, 4xx rate, avg latency | "Sortable, filterable table. Click any column to sort. Color-background cells show severity gradient." |
| **AI Error Detail Table** | Model + error_type breakdown | "Per-model, per-error-type breakdown — gpt2 → auth_failure, rate_limit, timeout, etc." |

**Transition**: *"Let's check Alertmanager — those error spikes should have triggered alerts by now."*

---

### 8:00 – Alert Review (1.5 minutes)

**Open**: Alertmanager → `http://localhost:9093`

**Show**:
1. **Active alerts list** — point out `HighHTTP5xxRate` (warning) firing since error rate >5%
2. **CPUUsageWarning** may also be firing from the high-load phase
3. **Inhibition in action**: Point out that `CriticalHTTP5xxRate` is NOT listed — the 5xx rate is elevated but hasn't crossed the 20% critical threshold yet. Explain that when it does, inhibition rules will suppress the warning.
4. **Alert grouping**: Show how alerts are grouped by severity and category

**Say**: *"Alerts use layered thresholds — 5% warning with 3-minute evaluation, 20% critical with 1-minute evaluation. The inhibition rules prevent alert storms: when critical fires, the warning is suppressed for the same condition."*

**Open runbook**: `monitoring/runbooks.md` — scroll to `HighHTTP5xxRate`

**Say**: *"Every alert has a documented runbook: what it means, possible causes, concrete troubleshooting commands, and resolution steps. This is what the on-call engineer follows."*

---

### 9:30 – Recovery (1.5 minutes)

**Switch back to**: **API & AI Dashboard**

**Show live recovery**:
- Error rate **dropping back to 0%**
- Request rate **returning to ~1 req/s**
- All stat panels **turning green again**
- CPU/Memory gauges (on Resource Optimization) **cooling down**

**Say**: *"Watch the timeseries — error rate drops, latency narrows. The generator is now in recovery phase: light traffic, no errors. All metrics return to baseline within 30 seconds."*

---

### 11:00 – Wrap-up & Q&A (1-3 minutes)

**Four-key-point summary**:
1. **3 dashboards** covering API health, deep error analysis, and resource optimization — all cross-linked
2. **29 alerts** across 9 severity-layered groups with 8 inhibition rules preventing alert storms
3. **Full runbooks** for every alert with meaning, causes, troubleshooting, and resolution
4. **Template variables** (service, endpoint, instance, container, status_code) let you filter any dashboard

**Show documentation**:
- Open `monitoring/monitoring-documentation.md` — the metric dictionary
- Open `monitoring/alert_rules.yml` — show one alert definition with recording rule
- Open `monitoring/demo-metrics-summary.json` — the per-phase metrics summary from the generator

**Q&A prompts**:
- "The dashboard JSON files are in `monitoring/dashboards/` — provisioned automatically by Grafana"
- "To add a new metric: define it in `backend/metrics.js`, instrument in the code, then add a panel in the dashboard JSON"
- "The recording rules fill a gap — `brainbytes:ai_response_latency_p99` is pre-computed every 30 seconds for efficient alert evaluation"

---

## Demo Tips

### Before the demo
```bash
# Fresh start for clean graphs
docker-compose down && docker-compose up -d

# Open these tabs in your browser
open http://localhost:3001/grafana/d/brainbytes-api          # API & AI Dashboard
open http://localhost:3001/grafana/d/brainbytes-resources     # Resource Optimization
open http://localhost:3001/grafana/d/brainbytes-errors        # Error Analysis
open http://localhost:9093                                    # Alertmanager

# Quick connectivity test
node monitoring/demo-traffic-generator.js --phase normal --duration 1
```

### Customizing the demo
| Goal | Command |
|---|---|
| Shorter demo (3 min) | `--phase error-spikes --duration 1` |
| Longer/impressive (15+ min) | `--phase full-demo --duration 3` |
| Just show error analysis | `--phase error-spikes --duration 2 --concurrency 10` |
| Just show load testing | `--phase high-load --duration 2` |

### Manual PromQL queries for Grafana Explore
```promql
# Current 5xx rate by endpoint
sum(rate(brainbytes_http_requests_total{status=~"5.."}[5m])) by (endpoint)

# AI latency P99
histogram_quantile(0.99, sum(rate(brainbytes_ai_request_duration_seconds_bucket[5m])) by (le))

# Active sessions trend
brainbytes_active_sessions

# Per-container CPU
rate(container_cpu_usage_seconds_total[5m]) * 100

# Recording rule (pre-computed)
brainbytes:ai_response_latency_p99:histogram_quantile5m
```

### Troubleshooting
- **No data in dashboards**: Check `localhost:9090/targets` — all scrape targets UP?
- **Generator can't connect**: Is `docker-compose up -d` running? Check `docker-compose ps`
- **AI calls failing**: The generator still produces HTTP metrics even if AI is down — the demo still works. The `X-Demo-Mode` header lets the backend skip actual AI calls.
- **Dashboards not appearing**: They're provisioned automatically. If missing, check `docker logs grafana` for provisioning errors.
- **Alerts not firing**: Prometheus evaluation_interval is 15s. Alerts with `for: 3m` need 3 minutes of sustained condition. Use `--duration 3` for reliable alert triggering.

### Post-demo cleanup
```bash
# Stop the generator (Ctrl+C if still running)
# Reset metrics (optional — clean slate for next run)
docker-compose restart prometheus
```

---

## Required Visualizations Checklist

| Requirement | Panel ID | Dashboard | Type |
|---|---|---|---|
| CPU usage (Gauge) | 101 | Resource Optimization | `gauge` |
| Memory usage (Gauge) | 102 | Resource Optimization | `gauge` |
| Response time (Time Series) | 202 | Resource Optimization | `timeseries` |
| Request count (Time Series) | 201 | Resource Optimization | `timeseries` |
| Error rate (Time Series) | 203 | Resource Optimization | `timeseries` |
| API response distribution (Heatmap) | 205 | Resource Optimization | `heatmap` |
| Container status (Table) | 401 | Resource Optimization | `table` |
