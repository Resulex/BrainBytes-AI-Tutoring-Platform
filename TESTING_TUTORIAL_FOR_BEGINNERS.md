# Testing BrainBytes Monitoring — A Beginner's Step-by-Step Tutorial

Welcome! This guide walks you through testing the BrainBytes monitoring system from zero, assuming no prior experience with Docker, Prometheus, or command-line tools.

---

## What We're Testing

BrainBytes now has a **monitoring system** that tracks:
- How many tutoring sessions users create
- How long sessions last
- How much data is being used (important for Philippine users)
- When connections drop and reconnect
- How fast the AI responds
- When errors happen

We'll **generate fake traffic** to the app and **watch the monitoring system** record it in real-time.

---

## Prerequisites (Install These First)

### 1. Docker Desktop
Docker lets you run multiple applications (backend, database, monitoring) together without installing them separately.

**Download & Install:**
- **Mac**: https://www.docker.com/products/docker-desktop
- **Windows**: https://www.docker.com/products/docker-desktop
- **Linux**: https://docs.docker.com/engine/install/

**Verify it's installed:**
```bash
docker --version
```

You should see: `Docker version 20.x.x` or similar (exact version doesn't matter)

### 2. Git (optional, but recommended)
If you haven't already, clone the repository:
```bash
git clone https://github.com/BrainBytes-AI-Tutoring-Platform/BrainBytes-AI-Tutoring-Platform-main.git
cd BrainBytes-AI-Tutoring-Platform-main
```

Or download the ZIP and extract it.

---

## Step 1: Start the Monitoring Stack (5 minutes)

The monitoring stack includes:
- **Backend API** — the BrainBytes server
- **Prometheus** — the monitoring database
- **Node-Exporter** — system health tracker
- **cAdvisor** — container performance tracker
- **MongoDB** — data storage

### Open a Terminal

**Mac/Linux:** Open "Terminal"  
**Windows:** Open "Command Prompt" or "PowerShell"

### Navigate to the Project Folder

```bash
cd BrainBytes-AI-Tutoring-Platform-main
```

If you see a list of files when you type `ls` (Mac/Linux) or `dir` (Windows), you're in the right place.

### Start All Services

```bash
docker-compose up -d
```

**What this does:**
- `-d` means "detached" (run in background, don't show logs)
- Docker will download images and start 6 containers

**Expected output:**
```
Creating brainbytes-ai-tutoring-platform-main_mongo_1        ... done
Creating brainbytes-ai-tutoring-platform-main_backend_1      ... done
Creating brainbytes-ai-tutoring-platform-main_prometheus_1   ... done
Creating brainbytes-ai-tutoring-platform-main_node-exporter_1   ... done
Creating brainbytes-ai-tutoring-platform-main_cadvisor_1     ... done
Creating brainbytes-ai-tutoring-platform-main_frontend_1     ... done
```

### Verify Everything Started

```bash
docker-compose ps
```

**Expected output:**
```
NAME                                  STATUS              PORTS
brainbytes-backend                    Up 2 minutes        0.0.0.0:3000->3000/tcp, 0.0.0.0:9080->9080/tcp
brainbytes-mongo                      Up 2 minutes        27017/tcp
brainbytes-prometheus                 Up 2 minutes        0.0.0.0:9090->9090/tcp
brainbytes-node-exporter              Up 2 minutes        9100/tcp
brainbytes-cadvisor                   Up 2 minutes        8080/tcp
brainbytes-frontend                   Up 2 minutes        0.0.0.0:8080->3000/tcp
```

**✅ Success if:** All containers show "Up X minutes"

**❌ If containers show "Exited":** 
- Check Docker is running: `docker ps`
- View errors: `docker-compose logs backend`
- Restart: `docker-compose restart`

---

## Step 2: Open Prometheus Dashboard (2 minutes)

Prometheus is the **monitoring dashboard** where you'll watch metrics in real-time.

### Open Your Browser

Go to: **http://localhost:9090**

You should see a page that looks like:

```
   _____ ________________   _   ______________
  / __ \/ ____/  _/  ___/  / | / / ____/_  __/
 / /_/ / __/ _/ // /      /  |/ / __/   / /
/ ____/ /___/ // /       / /|  / /___  / /
/_/   /_____/___/       /_/ |_/_____/ /_/

Prometheus
Version: 2.43.0
```

And below that, a search box that says "Expression browser".

**✅ If you see this:** Prometheus is running!

**❌ If you get "Connection refused":**
- Wait 30 seconds (Prometheus takes time to start)
- Refresh the page: `Ctrl+R` (Windows) or `Cmd+R` (Mac)
- Try again

---

## Step 3: Verify the Backend is Exposing Metrics (2 minutes)

The backend sends monitoring data to Prometheus every 10 seconds. Let's verify it's working.

### In your browser, go to:
**http://localhost:9080/metrics**

You should see **raw metrics data** (looks like:)

```
# HELP brainbytes_sessions_total Total number of tutoring sessions created
# TYPE brainbytes_sessions_total counter
brainbytes_sessions_total{auth_type="anonymous",device_type="desktop",subject="general"} 5

# HELP brainbytes_active_sessions Current number of concurrent active tutoring sessions
# TYPE brainbytes_active_sessions gauge
brainbytes_active_sessions 0

# HELP brainbytes_http_requests_total Total number of HTTP requests processed
# TYPE brainbytes_http_requests_total counter
brainbytes_http_requests_total{endpoint="/health",method="GET",status="200"} 42
```

**✅ If you see this:** The backend is working!

**❌ If you see "Connection refused":**
- Backend didn't start; check: `docker-compose logs backend`
- Wait 30 more seconds; backend needs time to start

---

## Step 4: Start a Traffic Simulator (5 minutes)

Now we'll **generate fake traffic** to the app so the monitoring system has something to track.

### Open a New Terminal (Keep Previous One Open)

**Mac/Linux:** Open another "Terminal" window  
**Windows:** Open another "Command Prompt" or "PowerShell" window

### Navigate to the Backend Folder

```bash
cd BrainBytes-AI-Tutoring-Platform-main/backend
```

Verify you're in the right place by typing:
```bash
ls
```

You should see files like `server.js`, `package.json`, `simulate-activity.js`, etc.

### Start the Traffic Simulator

```bash
node simulate-activity.js --scenario high-load --concurrency 3 --duration 180 --profile mobile
```

**What this does:**
- `--scenario high-load` → Create bursts of traffic (realistic load pattern)
- `--concurrency 3` → 3 fake users at once
- `--duration 180` → Run for 3 minutes (180 seconds)
- `--profile mobile` → Simulate Philippine mobile users (3G/4G networks)

**Expected output:**
```
=== BrainBytes Activity Simulator ===
Scenario:     high-load
Concurrency:  3
Duration:     180s
Error rate:   0%
Peak cycle:   30s
Target:       http://localhost:3000
Press Ctrl+C to stop.

[Simulator] Authenticated successfully.
[W1] Starting session for math...
[W2] Starting session for science...
[W3] Starting session for history...
[W1] Session ended: 507f1f77bcf86cd799439011
[W2] Session created, sending messages...
```

**✅ If you see this:** Traffic is being generated!

**❌ If you see errors:**
- Check backend is running: `docker-compose ps backend`
- Might need to wait for backend to fully start (up to 1 minute)

---

## Step 5: Watch Metrics Update in Real-Time (5 minutes)

While the simulator is running, go back to Prometheus and watch metrics change.

### In Prometheus (http://localhost:9090):

**Click the "Graph" tab** (near the search box)

### Search for a Metric

In the expression box, type:
```promql
brainbytes_active_sessions
```

Then click **"Execute"** (or press Enter)

You should see:
- A **value** (like "12") showing current active sessions
- A **graph** showing how that number changes over time

**What to watch:**
- During "peak" phase (first 30 seconds): the number climbs
- During "quiet" phase (next 30 seconds): the number drops
- This pattern repeats every 60 seconds

### Try Another Metric

Search for:
```promql
rate(brainbytes_http_requests_total[1m])
```

Click **"Execute"**

You should see:
- A **graph** showing request rate over time
- The rate should spike during peaks, drop during quiet periods
- Measured in requests per second (rps)

**Example pattern:**
```
Peak phase:    ~2 requests/second
Quiet phase:   ~0.5 requests/second
```

---

## Step 6: Run a Different Scenario (5 minutes)

Let's test what happens when the system has errors.

### Stop the Current Simulator

In the terminal running the simulator, press:
```
Ctrl+C
```

You should see:
```
[Simulator] Shutting down...
[Simulator] All workers stopped. Goodbye!
```

### Start the Error-Spikes Scenario

In the **same terminal**, type:
```bash
node simulate-activity.js --scenario error-spikes --error-rate 0.35 --concurrency 3 --duration 120
```

**What this does:**
- 35% of requests will be intentionally malformed (bad data)
- This simulates real-world errors (users with bad connections, timeout bugs, etc.)
- Runs for 2 minutes

**Expected output:**
```
=== BrainBytes Activity Simulator ===
Scenario:     error-spikes
Concurrency:  3
Duration:     120s
Error rate:   35%
...
[W1] Injecting error: oversized payload
[W2] Session end sent without auth (401 expected)
[W3] Injecting error: malformed JSON
```

### Watch Error Metrics in Prometheus

In Prometheus, search for:
```promql
rate(brainbytes_http_requests_total{status=~"4..|5.."}[1m])
```

Click **"Execute"**

You should see:
- **Graph showing error rate** (4xx and 5xx responses)
- During error-spikes: should be ~30-40% of all requests
- **This proves errors are being tracked!**

---

## Step 7: Test Recording Rules (Advanced) — 5 minutes

Recording rules are **pre-calculated summaries** that make queries faster.

### In Prometheus:

Search for:
```promql
brainbytes:http_error_ratio:rate5m
```

Click **"Execute"**

You should see:
- A **single value** showing the 5-minute error ratio
- Much **faster** than calculating it fresh each time

**What this shows:**
- Recording rules are working
- Prometheus pre-calculates common metrics
- This saves compute power and makes dashboards faster

---

## Step 8: Check Mobile-Specific Metrics (5 minutes)

Remember we're simulating **Philippine mobile users**. Let's verify those metrics.

### Stop Current Simulator

Press `Ctrl+C` in the simulator terminal

### Search in Prometheus

```promql
brainbytes_mobile_active_sessions
```

Click **"Execute"**

You should see:
- A **gauge showing mobile session count**
- Since we used `--profile mobile`, this should match `brainbytes_active_sessions`

### Try Another Mobile Metric

```promql
rate(brainbytes:mobile_request_rate:rate5m)
```

Click **"Execute"**

You should see:
- **Mobile request rate** aggregated over 5 minutes
- This is a **recording rule** (pre-calculated)
- Shows how many mobile requests per second

**What this proves:**
- Mobile monitoring is working
- Philippine user patterns are being tracked
- Low-bandwidth impacts are measurable

---

## Step 9: View Data Usage Metrics (5 minutes)

One of the key metrics for Philippine users: **data consumption**.

### In Prometheus:

```promql
brainbytes_data_usage_bytes_sum
```

Click **"Execute"**

You should see:
- **Total bytes used** by all interactions
- Since data is expensive in Philippines, this is critical

### See Breakdown by Connection Type

```promql
brainbytes_data_usage_bytes_sum by (connection_type, device_type)
```

Click **"Execute"**

You should see something like:
```
{connection_type="3g", device_type="mobile"}    425000
{connection_type="4g", device_type="mobile"}    328000
{connection_type="wifi", device_type="desktop"} 156000
```

**What this shows:**
- 3G users use MORE data (slower networks = larger responses)
- 4G is more efficient
- WiFi desktop is most efficient
- **This data guides cost optimization for Philippine deployment**

---

## Step 10: Check Connectivity Events (5 minutes)

When users reconnect after losing connection, that's tracked.

### In Prometheus:

```promql
brainbytes_reconnect_events_total
```

Click **"Execute"**

You should see:
- **Counter showing reconnect attempts** by device type
- In `--profile mobile` with `--reconnect-rate` active, these will tick up
- High reconnect counts = intermittent connectivity problems (common in Philippines)

### Try with Reconnect Rate

Stop the current simulator and start a new one:

```bash
node simulate-activity.js --scenario default --concurrency 2 --duration 60 --profile mobile --reconnect-rate 0.15
```

**What this does:**
- 15% of requests include reconnect headers
- Simulates users dropping connection and reconnecting

**In Prometheus, watch:**
```promql
rate(brainbytes_reconnect_events_total[1m])
```

You should see the **reconnect rate increase** during the simulator run.

---

## Step 11: Test the Resource Constraint Scenario (5 minutes)

This tests what happens when sessions never close (users close browser without logout).

### Stop Current Simulator

Press `Ctrl+C`

### Start Resource Constraint Scenario

```bash
node simulate-activity.js --scenario resource-constraint --concurrency 4 --duration 90
```

**What this does:**
- Creates sessions but never closes them
- Simulates orphaned connections
- Active session count should **climb steadily**

### Watch in Prometheus

Go to Prometheus and search:
```promql
brainbytes_active_sessions
```

Click **"Execute"**

**What to look for:**
- Graph should **climb steadily upward** (never goes down)
- After 90 seconds, should be around 40-50 sessions
- **This proves** the gauge tracks sessions correctly

**Stop after 90 seconds** and the simulator will auto-stop.

---

## Step 12: Verify All Recording Rules (2 minutes)

Let's make sure all pre-calculated summaries are working.

### In Prometheus:

Click on **"Alerts"** tab at the top

Then click **"Rules"** tab

You should see a list like:

```
brainbytes_recording_rules
├─ brainbytes:http_error_ratio:rate5m               ✓ ok
├─ brainbytes:ai_response_latency_p99:histogram_quantile5m  ✓ ok
└─ brainbytes:mobile_request_rate:rate5m            ✓ ok
```

**✅ If all show ✓ ok:** Recording rules are working!

**❌ If any show ❌ error:**
- Check Prometheus logs: `docker-compose logs prometheus`
- Might be a syntax error in `monitoring/recording_rules.yml`

---

## Step 13: Verify All Targets Are Healthy (2 minutes)

Targets = services Prometheus is scraping data from.

### In Prometheus:

Click on **"Status"** at the top  
Click on **"Targets"**

You should see:

```
Prometheus                  UP ✓
brainbytes-backend         UP ✓
node-exporter              UP ✓
cadvisor                   UP ✓
```

**✅ If all show UP:** Perfect! Everything is connected.

**❌ If any show DOWN:**
- Wait 30 seconds (sometimes slow to connect)
- Refresh the page
- Check logs: `docker-compose logs SERVICE_NAME`

---

## Step 14: Clean Up and Stop Everything (2 minutes)

When you're done testing:

### Stop the Simulator

In the simulator terminal, press:
```
Ctrl+C
```

### Stop Docker Services

In your main terminal (the one you used for `docker-compose up`), press:
```
Ctrl+C
```

Or in a new terminal, run:
```bash
docker-compose down
```

**Expected output:**
```
Stopping brainbytes-frontend      ... done
Stopping brainbytes-backend       ... done
Stopping brainbytes-prometheus    ... done
Stopping brainbytes-mongo         ... done
Stopping brainbytes-node-exporter ... done
Stopping brainbytes-cadvisor      ... done
Removing brainbytes-frontend      ... done
Removing brainbytes-backend       ... done
...
```

**✅ All containers stopped.**

---

## Troubleshooting Common Issues

### Issue: "Port 9090 already in use"

**Cause:** Another Prometheus is running on that port

**Fix:**
```bash
# Stop other containers
docker-compose down

# Or, find and kill the process
lsof -i :9090  # (Mac/Linux)
netstat -ano | findstr :9090  # (Windows)

# Then restart
docker-compose up -d
```

### Issue: Backend won't start

**Cause:** Might need environment variables

**Fix:**
```bash
# Create .env file in root folder
echo "HUGGINGFACE_TOKEN=placeholder-for-testing" > .env
echo "JWT_SECRET=test-secret-key" >> .env

# Try again
docker-compose restart backend
```

### Issue: No metrics showing in Prometheus

**Cause:** Prometheus hasn't scraped data yet

**Fix:**
- Wait 15 seconds (default scrape interval)
- Check backend is running: `docker-compose ps backend`
- Manually trigger: `docker-compose logs prometheus | grep scrape`

### Issue: Simulator says "Could not authenticate"

**Cause:** Backend's auth endpoint failing

**Fix:**
```bash
# Check backend logs
docker-compose logs backend | grep -i auth

# Restart backend
docker-compose restart backend

# Wait 30 seconds, try simulator again
```

### Issue: "Cannot connect to Docker daemon"

**Cause:** Docker Desktop not running

**Fix:**
- **Mac/Windows:** Open Docker Desktop app
- **Linux:** Start Docker service: `sudo systemctl start docker`

---

## Checklist: Everything Working?

After completing all steps, you should be able to check off:

- [ ] All Docker containers running (`docker-compose ps`)
- [ ] Prometheus dashboard loads (http://localhost:9090)
- [ ] Backend metrics endpoint accessible (http://localhost:9080/metrics)
- [ ] Traffic simulator runs without errors
- [ ] `brainbytes_active_sessions` metric increases/decreases in Prometheus
- [ ] `brainbytes_http_requests_total` shows traffic patterns
- [ ] Recording rules show as "ok" in Rules tab
- [ ] All targets show "UP" in Status > Targets
- [ ] Error-spikes scenario shows ~30-40% error rate
- [ ] Mobile metrics tracked (brainbytes_mobile_active_sessions)
- [ ] Data usage metrics showing (brainbytes_data_usage_bytes)
- [ ] Reconnect events tracked (brainbytes_reconnect_events_total)

**If all checked:** ✅ **Monitoring system is working perfectly!**

---

## Next Steps

Now that you understand the system:

1. **Create Grafana Dashboards** — Pretty visualizations
   - Add Prometheus as data source
   - Create panels for key metrics
   
2. **Set Up Alerts** — Get notified when things go wrong
   - Edit `monitoring/alert_rules.yml`
   - Add rules like: "alert if active_sessions > 100"

3. **Deploy to Production** — Move to Railway or cloud
   - Update Prometheus config for your domain
   - Scale monitoring for real users

4. **Optimize for Philippines** — Apply lessons learned
   - Use thresholds from `monitoring/FILIPINO_MONITORING_GUIDE.md`
   - Monitor data costs closely
   - Track connectivity patterns

---

## Questions?

Refer to:
- [MONITORING_DEPLOYMENT_GUIDE.md](MONITORING_DEPLOYMENT_GUIDE.md) — Advanced setup
- [monitoring/FILIPINO_MONITORING_GUIDE.md](monitoring/FILIPINO_MONITORING_GUIDE.md) — Philippine considerations
- [backend/scenarios/README.md](backend/scenarios/README.md) — Scenario details

