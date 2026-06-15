/**
 * Health check endpoint for Railway.app and UptimeRobot.
 * GET /api/health — returns 200 if the Next.js server is running.
 */
export default function handler(_req, res) {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
