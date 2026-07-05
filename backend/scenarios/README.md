# BrainBytes Scenario-Based Testing Framework

This directory contains parameterized load-testing scenarios designed to generate
observable patterns in Prometheus metrics. Each scenario simulates a distinct
production failure mode or load condition.

---

## Quick Start

```bash
# Default: steady single-user loop (runs forever, Ctrl+C to stop)
node simulate-activity.js

# Run a specific scenario
node scenarios/high-load.js
node scenarios/error-spikes.js
node scenarios/resource-constraint.js

# Custom parameters
node simulate-activity.js --scenario high-load --concurrency 8 --duration 300 --peak-interval 20
```

| Flag              | Default       | Description                                                   |
| ----------------- | ------------- | ------------------------------------------------------------- |
| `--scenario`      | `default`     | `default`, `high-load`, `error-spikes`, `resource-constraint` |
| `--concurrency`   | `1`           | Number of parallel worker sessions                            |
| `--duration`      | `0` (forever) | How many seconds to run before auto-stopping                  |
| `--error-rate`    | `0`           | Fraction of sessions that inject errors (0.0–1.0)             |
| `--peak-interval` | `0` (off)     | Seconds per peak/quiet cycle; e.g. `30` = 30s busy, 30s calm  |

---

## Scenario 1: High Load

**File:** `scenarios/high-load.js`

**Behavior:**

- 5 concurrent workers spawning sessions in rapid bursts
- Peak/quiet cycles: 30 seconds of fast session creation, 30 seconds of calm
- Sessions are short (1–2 messages) to maximize throughput
- Runs for 3 minutes then auto-stops

**Expected Prometheus Effects:**

| Metric                                     | Expected Pattern                                             |
| ------------------------------------------ | ------------------------------------------------------------ |
| `rate(brainbytes_http_requests_total[1m])` | Oscillating between ~0.1 rps (quiet) and ~1.5 rps (peak)     |
| `brainbytes_active_sessions`               | Gauge waves: climbs rapidly during peaks, drops during quiet |
| `brainbytes_http_request_duration_seconds` | p95 latency rises during peak bursts                         |
| `node_cpu_seconds_total`                   | CPU utilization mirrors peak/quiet cycle                     |
| `brainbytes_messages_total`                | Elevated throughput, mostly `type=user`                      |

**How to Run:**

```bash
node scenarios/high-load.js
# Or customize:
node simulate-activity.js --scenario high-load --concurrency 10 --duration 600 --peak-interval 15
```

**Dashboards to Watch:**

- Prometheus Graph: `rate(brainbytes_http_requests_total[1m])`
- Prometheus Graph: `brainbytes_active_sessions`

---

## Scenario 2: Error Spikes

**File:** `scenarios/error-spikes.js`

**Behavior:**

- 3 concurrent workers, 35% of sessions inject malformed requests
- Error types: null bodies, malformed JSON, empty text, oversized payloads, missing auth tokens
- Auth-free session-end calls trigger 401 responses
- Runs for 2 minutes

**Expected Prometheus Effects:**

| Metric                                            | Expected Pattern                                     |
| ------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| `rate(brainbytes_http_requests_total{status=~"4.. | 5.."}[1m])`                                          | ~30–40% of total request rate |
| `brainbytes_ai_request_errors_total`              | Intermittent spikes if AI endpoint hit with bad data |
| `brainbytes_http_requests_total{status="401"}`    | Non-zero, from auth-free session-end calls           |
| `brainbytes_active_sessions`                      | May drift upward if 401s prevent gauge decrement     |

**How to Run:**

```bash
node scenarios/error-spikes.js
# Or customize:
node simulate-activity.js --scenario error-spikes --error-rate 0.5 --concurrency 5 --duration 300
```

**Dashboards to Watch:**

- Prometheus Graph: `rate(brainbytes_http_requests_total{status=~"5.."}[1m])`
- Prometheus Graph: `brainbytes:http_error_ratio:rate5m` (if recording rules enabled)
- Prometheus Graph: `rate(brainbytes_ai_request_errors_total[1m])`

---

## Scenario 3: Resource Constraint (Orphaned Sessions)

**File:** `scenarios/resource-constraint.js`

**Behavior:**

- 4 concurrent workers create sessions, send one message, then **abandon** (never call session-end)
- Sessions remain `isActive=true` indefinitely
- No `PUT /api/sessions/:id` calls at all
- Runs for 2.5 minutes

**Expected Prometheus Effects:**

| Metric                                          | Expected Pattern                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `brainbytes_active_sessions`                    | **Monotonically increasing** — the gauge climbs without ever falling |
| `brainbytes_http_requests_total{method="PUT"}`  | Zero or near-zero (no session-end calls)                             |
| `brainbytes_http_requests_total{method="POST"}` | Steady rate from session creation + one message each                 |
| `brainbytes_session_duration_seconds`           | No observations (sessions never end, so duration is never recorded)  |

**How to Run:**

```bash
node scenarios/resource-constraint.js
# Or customize:
node simulate-activity.js --scenario resource-constraint --concurrency 8 --duration 600
```

**Dashboards to Watch:**

- Prometheus Graph: `brainbytes_active_sessions` — should climb without bound
- Prometheus Alert: `brainbytes_active_sessions > 50` (create an alert rule for this)

---

## Interpreting Results

After running a scenario, compare the Prometheus graphs against the expected
patterns above. Deviations may indicate:

- **No error responses during error-spikes**: Backend validation may not be catching malformed input correctly
- **Active sessions stable during resource-constraint**: Gauge decrement may be happening elsewhere (e.g., socket disconnect)
- **No CPU pattern during high-load**: Concurrency may be throttled by rate limiting or connection pooling

---

## Adding New Scenarios

1. Create `scenarios/your-scenario.js` following the pattern above
2. Use `spawn` to invoke `simulate-activity.js` with your custom flags
3. Document expected Prometheus effects in this README
4. Add any new user behaviors to `simulateSession()` in the main script
