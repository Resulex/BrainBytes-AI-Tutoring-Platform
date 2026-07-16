# BrainBytes Alert Runbooks

This document provides troubleshooting procedures for every Prometheus alert
defined in `monitoring/alert_rules.yml`.

---

## Infrastructure & Health

### InstanceDown

| Property | Value |
|---|---|
| **Group** | `brainbytes_infrastructure` |
| **Severity** | `critical` |
| **Meaning** | A scrape target (backend, frontend, node-exporter, or cadvisor) is unreachable for >1 minute. |
| **User Impact** | Service may be partially or fully unavailable depending on which target is down. |

**Possible Causes:**
1. Container crashed or was stopped
2. Network partition between Prometheus and the target container
3. Docker daemon restarted or host rebooted
4. Resource exhaustion (OOM kill)

**Troubleshooting Steps:**
```bash
# 1. Check which container is affected
docker-compose ps

# 2. Check container logs
docker logs <container-name> --tail 100

# 3. Check if container is restarting in a loop
docker inspect <container-name> --format='{{.State.Restarting}}'

# 4. Verify network connectivity
docker network inspect app-network
docker exec prometheus ping -c 2 <target-hostname>
```

**Resolution:**
- **Crashed container**: `docker-compose up -d <service>`
- **OOM kill**: Increase container memory limit in `docker-compose.yml`
- **Network issue**: Restart Docker network: `docker-compose down && docker-compose up -d`
- **Persistent failure**: Check host resource availability with `docker stats` and `free -m`

---

### PrometheusDown

| Property | Value |
|---|---|
| **Group** | `brainbytes_infrastructure` |
| **Severity** | `critical` |
| **Meaning** | Prometheus cannot scrape itself. Monitoring is blind. |
| **User Impact** | No user impact directly, but no alerts will fire while this persists. |

**Possible Causes:**
1. Prometheus container crashed (config error, OOM)
2. Port 9090 conflict
3. `prometheus.yml` has a syntax error preventing startup

**Troubleshooting Steps:**
```bash
docker ps | grep prometheus
docker logs prometheus --tail 50
docker exec prometheus wget -qO- http://localhost:9090/-/healthy
```

**Resolution:**
- Validate `monitoring/prometheus.yml` syntax with `promtool check config`
- Restart: `docker-compose restart prometheus`
- If config error: fix the YAML and rebuild

---

## Application Error Budget

### HighHTTP5xxRate

| Property | Value |
|---|---|
| **Group** | `brainbytes_errors` |
| **Severity** | `warning` |
| **For** | 3 minutes |
| **Meaning** | More than 5% of HTTP requests are returning 5xx server errors over 3 minutes. |
| **User Impact** | ~1 in 20 users experiences an error. |

**Possible Causes:**
1. AI (HuggingFace) service returning errors
2. MongoDB connection pool exhausted or query timeout
3. Backend code exception (unhandled promise rejection)
4. Dependency timeout (high latency cascading to errors)

**Troubleshooting Steps:**
```bash
# 1. Check backend logs for error traces
docker logs brainbytes-backend --tail 200 | grep -i error

# 2. Identify failing endpoint — run in Grafana Explore:
#   sum(rate(brainbytes_http_requests_total{status=~"5.."}[5m])) by (endpoint)

# 3. Check AI error rate — run in Grafana Explore:
#   rate(brainbytes_ai_request_errors_total[5m])

# 4. Check MongoDB connectivity from backend
docker exec brainbytes-backend node -e "
  const mongoose = require('mongoose');
  mongoose.connect('mongodb://mongo:27017/brainbytes').then(() => {
    console.log('MongoDB OK'); process.exit(0);
  }).catch(e => {
    console.error('MongoDB ERROR:', e.message); process.exit(1);
  });
"
```

**Resolution:**
- **AI errors**: Follow `AIServiceHighErrors` runbook
- **MongoDB issues**: Check MongoDB logs, verify connection string
- **Code exception**: Deploy fix for the specific endpoint
- **If expected (scenario running)**: Acknowledge the alert

---

### CriticalHTTP5xxRate

| Property | Value |
|---|---|
| **Group** | `brainbytes_errors` |
| **Severity** | `critical` |
| **For** | 1 minute |
| **Meaning** | Over 20% of requests are failing with 5xx. Immediate action required. |
| **User Impact** | 1 in 5 users gets an error. Service is effectively degraded. |

**Possible Causes:**
1. Complete AI service outage (all calls fail)
2. MongoDB crashed or unreachable
3. Recent deployment introduced a critical bug
4. Resource exhaustion causing cascading failures

**Troubleshooting Steps:**
1. Check all dependent services (AI, MongoDB): `docker-compose ps`
2. Review recent deployments: `git log --oneline -5`
3. Check if this is isolated to specific endpoints or global

**Resolution:**
- **AI outage**: Follow `AICompleteFailure` runbook
- **MongoDB down**: Follow `MongoDBDown` runbook
- **Buggy deploy**: Roll back: `git revert <commit> && docker-compose up -d --build backend`
- **Escalate to on-call engineer** if cause is unclear

---

### AIServiceHighErrors

| Property | Value |
|---|---|
| **Group** | `brainbytes_errors` |
| **Severity** | `warning` |
| **For** | 3 minutes |
| **Meaning** | AI service call error rate exceeds 0.02 req/s for 3 minutes. |
| **User Impact** | Some tutor responses may fail or be incomplete. |

**Possible Causes:**
1. HuggingFace API rate limit exceeded
2. Invalid/expired `HUGGINGFACE_TOKEN`
3. Model is cold-starting (warm-up latency)
4. Network connectivity issues to `api-inference.huggingface.co`

**Troubleshooting Steps:**
```bash
# Check token validity
curl -s -H "Authorization: Bearer $HUGGINGFACE_TOKEN" \
  https://api-inference.huggingface.co/models/gpt2 \
  | head -c 200

# Check error type breakdown — run in Grafana Explore:
#   sum(rate(brainbytes_ai_request_errors_total[5m])) by (error_type)
```

**Resolution:**
- **Auth failure**: Rotate `HUGGINGFACE_TOKEN` in `.env` and restart backend
- **Rate limit**: Reduce concurrency or add request queuing
- **Network**: Verify outbound connectivity from Docker network

---

## Latency & Performance

### AIServiceHighLatency

| Property | Value |
|---|---|
| **Group** | `brainbytes_latency` |
| **Severity** | `warning` |
| **For** | 5 minutes |
| **Meaning** | AI response P99 latency exceeds 10 seconds for 5 minutes. |
| **User Impact** | Users will experience slow tutor response (10+ seconds). |

**Possible Causes:**
1. HuggingFace model under heavy load (shared infrastructure)
2. Large AI model selected (e.g., `gpt2-xl` vs `gpt2`)
3. Network latency between backend and HuggingFace
4. High concurrency saturating the AI service

**Troubleshooting Steps:**
```bash
# Check per-model latency — run in Grafana Explore:
#   histogram_quantile(0.99,
#     sum(rate(brainbytes_ai_request_duration_seconds_bucket[5m])) by (le, model))

# Test latency manually
time curl -s -H "Authorization: Bearer $HUGGINGFACE_TOKEN" \
  -d '{"inputs":"Hello"}' \
  https://api-inference.huggingface.co/models/gpt2
```

**Resolution:**
- **Model load**: Wait or switch to a smaller model (`distilgpt2`)
- **Network**: Check latency with `ping api-inference.huggingface.co`
- **Concurrency**: Reduce simultaneous AI calls or add request queuing

---

### HighAPILatency

| Property | Value |
|---|---|
| **Group** | `brainbytes_latency` |
| **Severity** | `warning` |
| **For** | 3 minutes |
| **Meaning** | P95 latency for `/api/messages` exceeds 5 seconds for 3 minutes. |
| **User Impact** | 95% of message requests take >5 seconds — chat feels sluggish. |

**Possible Causes:**
1. AI service high latency (most common)
2. MongoDB query performance degradation
3. Event loop blockage (check `EventLoopLag`)
4. High concurrency with limited CPU

**Troubleshooting Steps:**
```bash
# Cross-reference with AI latency
# Check event loop lag — run in Grafana Explore:
#   nodejs_eventloop_lag_seconds{job="brainbytes-backend"}

# Check active sessions count
```

**Resolution:**
- Follow `AIServiceHighLatency` runbook if AI is the cause
- Follow `EventLoopLag` runbook if event loop is blocked
- Check MongoDB query performance if AI is not the bottleneck

---

## Resource Saturation

### HighCPUUsage

| Property | Value |
|---|---|
| **Group** | `brainbytes_saturation` |
| **Severity** | `warning` |
| **For** | 5 minutes |
| **Meaning** | Host CPU above 80% for 5 minutes. |
| **User Impact** | Response times may degrade. |

**Troubleshooting Steps:**
```bash
# Identify top CPU consumers
docker stats --no-stream

# Check per-container CPU — run in Grafana Explore:
#   rate(container_cpu_usage_seconds_total[5m]) * 100
```

**Resolution:**
- High traffic: Scale horizontally or increase CPU allocation
- Background job: Stop or throttle the job
- Scenario running: Expected — acknowledge alert

---

### CPUUsageWarning

| Property | Value |
|---|---|
| **Group** | `brainbytes_saturation_layered` |
| **Severity** | `warning` |
| **For** | 10 minutes |
| **Meaning** | Host CPU above 50% for 10 minutes. Early warning before critical. |
| **User Impact** | None yet, but reduced headroom for traffic spikes. |

**Resolution:**
- Monitor trend — is it climbing?
- If sustained >1 hour: plan capacity increase

---

### HighMemoryUsage

| Property | Value |
|---|---|
| **Group** | `brainbytes_saturation` |
| **Severity** | `warning` |
| **For** | 5 minutes |
| **Meaning** | Host memory usage above 85%. Risk of OOM kills. |
| **User Impact** | Docker may OOM-kill containers, causing outages. |

**Troubleshooting Steps:**
```bash
# Identify top memory consumers
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Check for session leak — run in Grafana Explore:
#   brainbytes_active_sessions (growing without bound?)
```

**Resolution:**
- Memory leak: restart affected container; investigate code
- MongoDB: reduce WiredTiger cache or increase limit
- Increase memory limits in `docker-compose.yml`

---

### MemoryUsageWarning

| Property | Value |
|---|---|
| **Group** | `brainbytes_saturation_layered` |
| **Severity** | `warning` |
| **For** | 10 minutes |
| **Meaning** | Host memory above 60% for 10 minutes. Early warning. |
| **User Impact** | None yet. |

**Resolution:**
- Identify top memory consumers by container
- Monitor trend for potential leak

---

### DiskSpaceWarning

| Property | Value |
|---|---|
| **Group** | `brainbytes_saturation_layered` |
| **Severity** | `warning` |
| **For** | 5 minutes |
| **Meaning** | Root filesystem <20% free. |

**Resolution:**
```bash
docker system prune -a   # prune old images
docker volume prune -f   # prune unused volumes
```

---

### DiskSpaceCritical

| Property | Value |
|---|---|
| **Group** | `brainbytes_saturation_layered` |
| **Severity** | `critical` |
| **For** | 1 minute |
| **Meaning** | Root filesystem <10% free. MongoDB will stop writes. |

**Resolution:**
```bash
docker system prune -af
docker volume prune -f
# Delete old logs if needed
sudo logrotate -f /etc/logrotate.conf
```

---

## Application-Specific

### SessionLeakWarning

| Property | Value |
|---|---|
| **Group** | `brainbytes_application` |
| **Severity** | `warning` |
| **For** | 10 minutes |
| **Meaning** | Active sessions above 10 for >10 minutes without decreasing. |
| **User Impact** | Memory slowly increasing. Risk of eventual OOM. |

**Possible Causes:**
1. Socket disconnect events not properly handled
2. `decrementActiveSessions` not called on session end
3. Orphaned sessions in MongoDB still marked active

**Resolution:**
- Ensure all disconnect paths call `decrementActiveSessions()`
- Scenario running: expected with `resource-constraint.js`

---

### SessionGaugeMismatch

| Property | Value |
|---|---|
| **Group** | `brainbytes_application` |
| **Severity** | `info` |
| **Meaning** | Messages flowing but gauge reports zero. Monitoring degraded. |
| **User Impact** | None directly — observability is inconsistent. |

**Resolution:**
- Audit `incrementActiveSessions`/`decrementActiveSessions` call sites

---

### SessionDropAnomaly

| Property | Value |
|---|---|
| **Group** | `brainbytes_application` |
| **Severity** | `warning` |
| **Meaning** | Sessions dropped to zero while /api/messages still has traffic. |
| **User Impact** | Monitoring blind spot — actual user impact unknown. |

**Resolution:**
- Check socket handler disconnect event handling
- Verify gauge initialization logic

---

### HighSessionChurn

| Property | Value |
|---|---|
| **Group** | `brainbytes_application` |
| **Severity** | `warning` |
| **Meaning** | Sessions connecting/disconnecting at >5/s — reconnect storm. |
| **User Impact** | Users may see "Reconnecting..." — chat state may be lost. |

**Resolution:**
- Check browser console for WebSocket errors
- Review socket.io `pingTimeout` / `pingInterval` settings
- Verify network stability

---

### EventLoopLag

| Property | Value |
|---|---|
| **Group** | `brainbytes_application` |
| **Severity** | `warning` |
| **For** | 3 minutes |
| **Meaning** | Node.js event loop blocked >50ms on average. |
| **User Impact** | All endpoints experience delayed responses. |

**Resolution:**
- Look for synchronous operations (sync file I/O, large JSON ops)
- Review recent code changes

---

### EventLoopCritical

| Property | Value |
|---|---|
| **Group** | `brainbytes_application` |
| **Severity** | `critical` |
| **For** | 2 minutes |
| **Meaning** | Event loop blocked >250ms. Service effectively degraded. |
| **User Impact** | Users will experience timeouts. |

**Resolution:**
- Immediate: `docker restart brainbytes-backend`
- Profile with `clinic.js` doctor or flamegraph

---

## Business-Level Alerts

### AIResponseDegradationWarning

| Property | Value |
|---|---|
| **Group** | `brainbytes_business` |
| **Severity** | `warning` |
| **For** | 5 minutes |
| **Meaning** | AI P99 latency >15s. |
| **User Impact** | Tutor responses feel sluggish to users. |

**Resolution:**
- Check HuggingFace model status
- Consider switching to faster model or enabling caching

---

### AIResponseDegradationCritical

| Property | Value |
|---|---|
| **Group** | `brainbytes_business` |
| **Severity** | `critical` |
| **For** | 3 minutes |
| **Meaning** | AI P99 latency >30s. |
| **User Impact** | Users will abandon sessions. |

**Resolution:**
- Switch to fallback model (e.g., `distilgpt2`)
- Escalate to on-call

---

### AICompleteFailure

| Property | Value |
|---|---|
| **Group** | `brainbytes_business` |
| **Severity** | `critical` |
| **For** | 3 minutes |
| **Meaning** | All AI calls failing. Tutor completely non-functional. |
| **User Impact** | Users cannot receive any tutoring. Service is down. |

**Resolution:**
1. Check `HUGGINGFACE_TOKEN`: huggingface.co/settings/tokens
2. Test: `curl -H "Authorization: Bearer $TOKEN" https://api-inference.huggingface.co/models/gpt2`
3. Rotate token and restart backend if needed
4. **Escalate immediately**

---

### RequestRateAnomaly

| Property | Value |
|---|---|
| **Group** | `brainbytes_business` |
| **Severity** | `warning` |
| **Meaning** | Request rate deviated >5 req/s from 30-min baseline. |
| **User Impact** | Spike = overload risk; Drop = possible outage. |

**Resolution:**
- Spike: verify capacity; check if load-test running
- Drop: check frontend/backend availability

---

### LowSuccessRate

| Property | Value |
|---|---|
| **Group** | `brainbytes_business` |
| **Severity** | `warning` |
| **Meaning** | <90% of requests return 2xx. >10% of users see errors. |
| **User Impact** | Poor user experience. |

**Resolution:**
- Check error distribution by status code in Grafana
- 4xx-dominant: client misconfiguration
- 5xx-dominant: follow `CriticalHTTP5xxRate` runbook

---

### NoUserActivity

| Property | Value |
|---|---|
| **Group** | `brainbytes_business` |
| **Severity** | `info` |
| **Meaning** | Zero HTTP requests in 10 minutes. |
| **User Impact** | None if off-peak; indicates outage if traffic expected. |

**Resolution:**
- Off-peak: normal — acknowledge
- Traffic expected: check frontend and DNS/ingress

---

## Frontend Health

### FrontendDown

| Property | Value |
|---|---|
| **Group** | `brainbytes_frontend` |
| **Severity** | `critical` |
| **For** | 2 minutes |
| **Meaning** | Frontend is unreachable. |
| **User Impact** | Users cannot access the application. |

**Resolution:**
```bash
docker ps | grep frontend
docker logs brainbytes-frontend --tail 100
docker-compose up -d --build frontend
```

---

### FrontendHighErrors

| Property | Value |
|---|---|
| **Group** | `brainbytes_frontend` |
| **Severity** | `warning` |
| **Meaning** | Frontend Next.js server returning 5xx errors. |

**Resolution:**
- Check frontend logs
- Verify backend reachable from frontend container

---

## Database Health

### MongoDBDown

| Property | Value |
|---|---|
| **Group** | `brainbytes_database` |
| **Severity** | `critical` |
| **For** | 1 minute |
| **Meaning** | MongoDB container not running. All API operations fail. |
| **User Impact** | Complete service outage — no data persistence. |

**Resolution:**
```bash
docker ps | grep mongo
docker logs brainbytes-mongo --tail 100
docker-compose up -d mongo
```

---

### MongoDBHighMemory

| Property | Value |
|---|---|
| **Group** | `brainbytes_database` |
| **Severity** | `warning` |
| **For** | 5 minutes |
| **Meaning** | MongoDB using >85% of 1GB memory limit. |
| **User Impact** | Risk of OOM kill — database crash. |

**Resolution:**
- Check active operations: `db.currentOp()`
- Review WiredTiger cache settings
- Consider increasing container memory limit

---

## Quick Reference: Severity Escalation

| Severity | Response Time | Escalation |
|---|---|---|
| `info` | No action needed | Log only |
| `warning` | Investigate within 1 hour | Team notification (Slack/email) |
| `critical` | **Immediate** (< 5 min) | On-call pager |

## Inhibition Rules Summary

These rules prevent alert storms by suppressing lower-severity alerts when
a higher-severity alert for the same condition is already firing:

| Source (Critical) | Suppresses (Warning) |
|---|---|
| Any critical alert | All warning alerts for same job/instance |
| `CriticalHTTP5xxRate` | `HighHTTP5xxRate` |
| `AICompleteFailure` | `AIServiceHighErrors` |
| `AIResponseDegradationCritical` | `AIResponseDegradationWarning` |
| `HighMemoryUsage` | `MemoryUsageWarning` |
| `EventLoopCritical` | `EventLoopLag` |
| `FrontendDown` | `FrontendHighErrors` |
| `MongoDBDown` | `MongoDBHighMemory` |

## Alert Checklist

When responding to any alert, follow this sequence:

1. **Acknowledge** the alert in Alertmanager
2. **Verify** the alert is not a scenario (`high-load.js`, `error-spikes.js`, etc.)
3. **Check** the dashboard for context (CPU, memory, error rate, latency)
4. **Follow** the specific runbook above
5. **Resolve** or escalate
6. **Document** the root cause and resolution in the alert comment
