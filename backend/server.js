require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const aiService = require('./aiService');
const { setupSocketHandlers } = require('./socket/handler');
const { cacheMiddleware, cache } = require('./utils/cache');
const { validate } = require('./middleware/validate');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const logger = require('./utils/logger');
const { metricsMiddleware } = require('./metrics');

// ── Global crash handlers ──
// Prevent the process from dying on uncaught exceptions / unhandled rejections
// so the health check can still respond. Crash details are logged for forensics.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — process will exit');
  // Give logs time to flush, then exit so the orchestrator can restart
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  // Don't exit — the rejection was caught by this handler
});

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const learningMaterialRoutes = require('./routes/learningMaterials');
const sessionRoutes = require('./routes/sessions');
const preferenceRoutes = require('./routes/preferences');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════════════════
// Startup guard — crash immediately if critical secrets
// are missing. Never run on insecure defaults.
// ══════════════════════════════════════════════════════
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'HUGGINGFACE_TOKEN'];

const missingVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missingVars.length > 0) {
  logger.error(
    { missingVars },
    'FATAL: Required environment variables are not set. Refusing to start.',
  );
  console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
  console.error(
    'Set these variables in your .env file, Docker environment, or Railway service variables.',
  );
  process.exit(1);
}

// NODE_ENV defaults to production if unset (safe default — not a secret)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

logger.info({ env: process.env.NODE_ENV }, 'Environment variables validated — starting server');

// Trust the Railway load balancer proxy so express-rate-limit
// correctly identifies real client IPs from X-Forwarded-For
app.set('trust proxy', 1);

// ══════════════════════════════════════════════════════
// Health check endpoints — MUST be registered FIRST,
// before any middleware, so they always respond correctly
// even if other middleware/startup fails.
// ══════════════════════════════════════════════════════

// Liveness probe — is the process running?
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe — is the app ready to serve traffic?
app.get('/ready', async (_req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    if (dbState !== 1) {
      logger.warn(
        { dbState, dbStatus: dbStatus[dbState] },
        'Readiness check failed — DB not connected',
      );
      return res.status(503).json({
        status: 'not ready',
        reason: `Database ${dbStatus[dbState] || 'unknown'}`,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Readiness check error');
    res.status(503).json({
      status: 'not ready',
      reason: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ---- End of health check routes ----

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", process.env.CORS_ORIGIN].filter(Boolean),
            },
          }
        : false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  }),
);
app.use(mongoSanitize());

// CORS configuration with whitelist
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://brainbytesaitutor.up.railway.app',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, mobile apps, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

// Body parsing & cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

// ── Request logging middleware ──
app.use((req, res, next) => {
  const start = Date.now();
  let responseTimeSet = false;

  // Set X-Response-Time header BEFORE the response is sent (not in 'finish')
  const addResponseTimeHeader = () => {
    if (responseTimeSet) return;
    responseTimeSet = true;
    const duration = Date.now() - start;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
  };

  // Intercept res.json to set the timing header before data is written
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    addResponseTimeHeader();
    return originalJson(body);
  };

  // Intercept res.send (fallback for non-JSON responses)
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    addResponseTimeHeader();
    return originalSend(body);
  };

  // Log after the response finishes (no header manipulation here)
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    };

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error(logData, 'Request error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request client error');
    } else if (duration > 1000) {
      logger.warn({ ...logData, threshold: '1s' }, 'Slow request');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  // Prevent EventEmitter errors (e.g. from aborted connections) from crashing the process
  res.on('error', (err) => {
    logger.error({ err, method: req.method, path: req.originalUrl }, 'Response stream error');
  });

  next();
});

// ── Prometheus metrics middleware (must be after logging, before routes) ──
app.use(metricsMiddleware);

// ── Start HTTP server EARLY (health check must respond quickly) ──
// All remaining initialization happens after the server is listening
server.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server listening');
});

// Initialize AI model in background (don't crash if it fails)
try {
  aiService.initializeAI();
} catch (err) {
  logger.error({ err }, 'AI model initialization failed');
}

// Connect to MongoDB in background (server is already up for health checks)
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/brainbytes', {
    retryWrites: true,
  })
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to connect to MongoDB');
  });

// ── API Routes (below health check, server already listening) ──
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the BrainBytes API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      messages: '/api/messages',
      materials: '/api/materials',
      sessions: '/api/sessions',
      preferences: '/api/preferences',
    },
  });
});

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', learningMaterialRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/preferences', preferenceRoutes);

// REST Message endpoints (complementary to socket-based chat)
const Message = require('./models/Message');
const { buildConversationContext } = require('./utils/contextBuilder');
const { suggestFollowUps } = require('./utils/followUpSuggestions');
const { formatMessage } = require('./utils/formatMessage');

// GET /api/messages - Get messages (optionally filtered by session, with caching)
app.get('/api/messages', authenticate, cacheMiddleware(30), async (req, res, next) => {
  try {
    const { sessionId, limit = 50, before, page = 1 } = req.query;
    const query = { userId: req.user._id };
    const pageSize = Math.min(parseInt(limit), 100); // Cap at 100
    const skip = (parseInt(page) - 1) * pageSize;

    if (sessionId) {
      query.sessionId = sessionId;
    }
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const [messages, total] = await Promise.all([
      Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Message.countDocuments(query),
    ]);

    res.json({
      messages: messages.reverse(),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / pageSize),
        totalItems: total,
        itemsPerPage: pageSize,
        hasMore: skip + pageSize < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages - Create a message and get AI response (REST fallback)
app.post('/api/messages', validate('message'), async (req, res, next) => {
  try {
    const { subject, sessionId } = req.body;
    const sanitizedText = req.body.text.trim();

    // Save user message
    const userMessage = new Message({
      text: sanitizedText,
      isUser: true,
      sessionId: sessionId || null,
    });
    await userMessage.save();

    // Invalidate all cached message queries for this session
    if (sessionId) {
      const prefix = `__cache__/api/messages?sessionId=${sessionId}`;
      for (const key of cache.cache.keys()) {
        if (key.startsWith(prefix)) {
          cache.del(key);
        }
      }
    }

    // Gather context if session ID provided
    let context = null;
    if (sessionId) {
      const recentMessages = await Message.find({ sessionId }).sort({ createdAt: -1 }).limit(10);
      context = buildConversationContext(recentMessages.reverse());
    }

    // Generate AI response
    const aiResult = await aiService
      .generateResponse(sanitizedText, subject, context)
      .catch((error) => {
        logger.error({ error, message: sanitizedText }, 'AI response failed');
        return {
          category: 'error',
          response:
            "I'm sorry, but I couldn't process your request in time. Please try again with a simpler question.",
        };
      });

    // Generate follow-up suggestions
    const followUps = suggestFollowUps(aiResult.category, sanitizedText, aiResult.response);

    // Format the response
    const formatted = formatMessage(aiResult.response);

    // Save AI response
    const aiMessage = new Message({
      text: aiResult.response,
      isUser: false,
      sessionId: sessionId || null,
      category: aiResult.category,
      followUps,
      formattedContent: formatted,
    });
    await aiMessage.save();

    // Return both messages
    res.status(201).json({
      userMessage,
      aiMessage,
      category: aiResult.category,
      followUps,
    });
  } catch (err) {
    next(err);
  }
});

// Start Socket.io handlers
setupSocketHandlers(io);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Server started earlier (see line ~175) so health check is available immediately
