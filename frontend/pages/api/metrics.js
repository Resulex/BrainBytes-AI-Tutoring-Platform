/**
 * Prometheus-compatible metrics endpoint for the Next.js frontend.
 * Returns process-level metrics (uptime, memory, CPU) in text format.
 * GET /api/metrics — scraped by Prometheus.
 */
export default function handler(_req, res) {
  const memUsage = process.memoryUsage();

  const lines = [
    // UP status — always 1 if this handler responds
    'brainbytes_frontend_up 1',

    // Process uptime in seconds
    `brainbytes_frontend_uptime_seconds ${process.uptime()}`,

    // Memory metrics in bytes
    `brainbytes_frontend_memory_rss_bytes ${memUsage.rss}`,
    `brainbytes_frontend_memory_heap_total_bytes ${memUsage.heapTotal}`,
    `brainbytes_frontend_memory_heap_used_bytes ${memUsage.heapUsed}`,
    `brainbytes_frontend_memory_external_bytes ${memUsage.external}`,

    // Node.js version info (as a gauge, set to 1)
    `brainbytes_frontend_nodejs_info{version="${process.version}"} 1`,
  ];

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.status(200).send(lines.join('\n') + '\n');
}
