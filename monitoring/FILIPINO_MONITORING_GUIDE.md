# Filipino Context Monitoring for BrainBytes

## Why this matters

BrainBytes is intended for students and learners in the Philippines, where connectivity, device mix, and cost sensitivity can differ significantly from North American or European usage patterns. Monitoring should therefore reflect mobile-first access, throttled networks, and occasional reconnect behavior.

## What is now monitored

- Mobile performance: active mobile sessions and mobile request rates
- Data usage: estimated bytes per interaction for low-bandwidth and mobile traffic
- Intermittent connectivity: reconnect-style events and low-bandwidth markers
- Session outcomes: session completion duration by device type and subject

## Threshold adaptations for Filipino conditions

- Mobile response latency: use a slightly relaxed warning threshold of 6s for mobile traffic versus 5s for desktop traffic.
- Low-bandwidth traffic: treat sustained data-usage spikes above 128KB per interaction as a warning condition rather than a critical one.
- Intermittent connectivity: alert on repeated reconnect signals only when they exceed 5 events per 5 minutes for a given device class.
- Session completion: expect more variability in completion duration on 3G/slow networks, so trend-based alerts are preferred over strict absolute thresholds.

## Cost optimization for cloud resources

- Keep Prometheus scrape intervals modest for application endpoints (10s for the backend, 15s for infrastructure) to balance visibility and cost.
- Use recording rules to reduce expensive queries in dashboards and alerts.
- Prefer targeted alerts over noisy ones so incident response remains focused and avoids unnecessary scaling.
- Retain the existing Docker-based monitoring stack for local and small deployments, and scale Prometheus retention only when historical analysis becomes consistently valuable.

## Recommended deployment notes

- Deploy the monitoring stack with the updated Prometheus config and recording rules in the same environment as the backend service.
- Ensure the backend exposes /metrics on port 9080 and that the Prometheus container can reach it.
- When running the simulator in mobile or mixed profiles, include headers such as x-network-type and x-low-bandwidth to mimic realistic Filipino user conditions.
